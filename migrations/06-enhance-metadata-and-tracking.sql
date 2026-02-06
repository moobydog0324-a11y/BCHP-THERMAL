-- ============================================================
-- Migration 06: 메타데이터 및 추적 기능 개선
-- ============================================================
-- 목적:
-- 1. GPS 좌표를 별도 컬럼으로 분리하여 인덱싱 성능 향상
-- 2. 처리 버전 추적으로 재처리 이력 관리
-- 3. 배치 처리 중복 실행 방지
-- 4. 실패 이미지 추적 및 재시도 관리
-- ============================================================

-- ============================================================
-- 1. thermal_images 테이블에 GPS 컬럼 추가
-- ============================================================

-- GPS 좌표 컬럼 추가 (NUMERIC 타입, 6자리 소수점 정밀도)
ALTER TABLE thermal_images
  ADD COLUMN IF NOT EXISTS gps_latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS gps_longitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS gps_altitude NUMERIC(8, 2);

-- GPS 인덱스 추가 (공간 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_thermal_images_gps 
  ON thermal_images(gps_latitude, gps_longitude) 
  WHERE gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL;

-- GPS 좌표로 빠른 검색을 위한 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_thermal_images_has_gps 
  ON thermal_images(gps_latitude) 
  WHERE gps_latitude IS NOT NULL;

COMMENT ON COLUMN thermal_images.gps_latitude IS 'GPS 위도 (십진법, -90 ~ 90)';
COMMENT ON COLUMN thermal_images.gps_longitude IS 'GPS 경도 (십진법, -180 ~ 180)';
COMMENT ON COLUMN thermal_images.gps_altitude IS 'GPS 고도 (미터)';

-- ============================================================
-- 2. image_metadata 테이블에 처리 버전 및 추적 컬럼 추가
-- ============================================================

ALTER TABLE image_metadata
  ADD COLUMN IF NOT EXISTS processing_version TEXT DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS processing_parameters JSONB,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- 처리 버전별 인덱스
CREATE INDEX IF NOT EXISTS idx_image_metadata_processing_version 
  ON image_metadata(processing_version);

-- 처리 시간 인덱스 (최근 처리 우선 조회)
CREATE INDEX IF NOT EXISTS idx_image_metadata_processed_at 
  ON image_metadata(processed_at DESC NULLS LAST);

COMMENT ON COLUMN image_metadata.processing_version IS '메타데이터 처리 버전 (예: v1, v2)';
COMMENT ON COLUMN image_metadata.processing_parameters IS '처리에 사용된 파라미터 (JSONB)';
COMMENT ON COLUMN image_metadata.processed_at IS '메타데이터 처리 완료 시각';
COMMENT ON COLUMN image_metadata.last_error IS '마지막 처리 오류 메시지';
COMMENT ON COLUMN image_metadata.retry_count IS '재처리 시도 횟수';

-- ============================================================
-- 3. 배치 처리 중복 실행 방지 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS batch_processing_locks (
  lock_id SERIAL PRIMARY KEY,
  batch_type VARCHAR(100) NOT NULL,  -- 예: 'metadata_extraction', 'temperature_update'
  status VARCHAR(50) NOT NULL,       -- 'running', 'completed', 'failed'
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  started_by VARCHAR(255),           -- 시작한 서버/프로세스 ID
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  error_message TEXT,
  
  CONSTRAINT unique_running_batch UNIQUE (batch_type, status)
);

-- 실행 중인 배치만 유니크 제약 (PostgreSQL 부분 유니크 인덱스)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_running_batch 
  ON batch_processing_locks(batch_type) 
  WHERE status = 'running';

-- 최근 배치 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_batch_locks_started_at 
  ON batch_processing_locks(started_at DESC);

COMMENT ON TABLE batch_processing_locks IS '배치 처리 중복 실행 방지 및 진행 상황 추적';
COMMENT ON COLUMN batch_processing_locks.batch_type IS '배치 작업 타입 (고유 식별자)';
COMMENT ON COLUMN batch_processing_locks.status IS '배치 상태: running, completed, failed';
COMMENT ON COLUMN batch_processing_locks.started_by IS '시작한 서버/프로세스 식별자';

-- ============================================================
-- 4. 이미지 처리 실패 추적 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS image_processing_failures (
  failure_id SERIAL PRIMARY KEY,
  image_id INTEGER NOT NULL REFERENCES thermal_images(image_id) ON DELETE CASCADE,
  failure_type VARCHAR(100) NOT NULL,  -- 예: 'metadata_extraction', 'temperature_calculation'
  error_message TEXT NOT NULL,
  error_details JSONB,                 -- 상세 스택트레이스 등
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_image_failure UNIQUE (image_id, failure_type)
);

-- 미해결 실패 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_failures_unresolved 
  ON image_processing_failures(image_id, failure_type) 
  WHERE resolved = FALSE;

-- 실패 타입별 인덱스
CREATE INDEX IF NOT EXISTS idx_failures_type 
  ON image_processing_failures(failure_type, resolved);

-- 재시도 대상 조회 인덱스 (재시도 횟수 적고 최근에 시도한 순)
CREATE INDEX IF NOT EXISTS idx_failures_retry 
  ON image_processing_failures(retry_count, last_retry_at DESC) 
  WHERE resolved = FALSE;

COMMENT ON TABLE image_processing_failures IS '이미지 처리 실패 추적 및 재시도 관리';
COMMENT ON COLUMN image_processing_failures.failure_type IS '실패 타입 (예: metadata_extraction)';
COMMENT ON COLUMN image_processing_failures.retry_count IS '재시도 횟수';
COMMENT ON COLUMN image_processing_failures.resolved IS '문제 해결 여부';

-- ============================================================
-- 5. 기존 데이터 마이그레이션 (GPS 추출)
-- ============================================================

-- metadata_json에서 GPS 좌표를 thermal_images로 복사
-- 주의: 대용량 데이터의 경우 배치로 나눠서 실행 권장
DO $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- GPS 데이터가 있는 이미지만 업데이트
  UPDATE thermal_images ti
  SET 
    gps_latitude = CASE 
      WHEN im.metadata_json->>'GPSLatitude' IS NOT NULL 
      THEN (im.metadata_json->>'GPSLatitude')::NUMERIC 
      ELSE NULL 
    END,
    gps_longitude = CASE 
      WHEN im.metadata_json->>'GPSLongitude' IS NOT NULL 
      THEN (im.metadata_json->>'GPSLongitude')::NUMERIC 
      ELSE NULL 
    END,
    gps_altitude = CASE 
      WHEN im.metadata_json->>'GPSAltitude' IS NOT NULL 
      THEN NULLIF(regexp_replace(im.metadata_json->>'GPSAltitude', '[^0-9.-]', '', 'g'), '')::NUMERIC 
      ELSE NULL 
    END
  FROM image_metadata im
  WHERE ti.image_id = im.image_id
    AND ti.gps_latitude IS NULL  -- 아직 업데이트되지 않은 것만
    AND im.metadata_json IS NOT NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ GPS 좌표 마이그레이션 완료: % 개 이미지 업데이트', updated_count;
END $$;

-- ============================================================
-- 6. 트리거: metadata_json 업데이트 시 GPS 자동 동기화
-- ============================================================

CREATE OR REPLACE FUNCTION sync_gps_from_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- metadata_json에 GPS 정보가 있으면 thermal_images로 동기화
  IF NEW.metadata_json IS NOT NULL THEN
    UPDATE thermal_images
    SET 
      gps_latitude = CASE 
        WHEN NEW.metadata_json->>'GPSLatitude' IS NOT NULL 
        THEN (NEW.metadata_json->>'GPSLatitude')::NUMERIC 
        ELSE gps_latitude 
      END,
      gps_longitude = CASE 
        WHEN NEW.metadata_json->>'GPSLongitude' IS NOT NULL 
        THEN (NEW.metadata_json->>'GPSLongitude')::NUMERIC 
        ELSE gps_longitude 
      END,
      gps_altitude = CASE 
        WHEN NEW.metadata_json->>'GPSAltitude' IS NOT NULL 
        THEN NULLIF(regexp_replace(NEW.metadata_json->>'GPSAltitude', '[^0-9.-]', '', 'g'), '')::NUMERIC 
        ELSE gps_altitude 
      END
    WHERE image_id = NEW.image_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trg_sync_gps_from_metadata ON image_metadata;
CREATE TRIGGER trg_sync_gps_from_metadata
  AFTER INSERT OR UPDATE OF metadata_json ON image_metadata
  FOR EACH ROW
  EXECUTE FUNCTION sync_gps_from_metadata();

COMMENT ON FUNCTION sync_gps_from_metadata() IS 'metadata_json 업데이트 시 GPS 좌표를 thermal_images로 자동 동기화';

-- ============================================================
-- 7. 통계 뷰 (모니터링용)
-- ============================================================

-- GPS 포함률 통계
CREATE OR REPLACE VIEW v_gps_coverage_stats AS
SELECT 
  COUNT(*) AS total_images,
  COUNT(gps_latitude) AS images_with_gps,
  ROUND(100.0 * COUNT(gps_latitude) / NULLIF(COUNT(*), 0), 2) AS gps_coverage_percent,
  COUNT(*) FILTER (WHERE gps_latitude IS NULL AND created_at > NOW() - INTERVAL '7 days') AS recent_missing_gps
FROM thermal_images
WHERE image_type = 'thermal';

COMMENT ON VIEW v_gps_coverage_stats IS 'GPS 좌표 포함률 통계';

-- 메타데이터 처리 통계
CREATE OR REPLACE VIEW v_metadata_processing_stats AS
SELECT 
  processing_version,
  COUNT(*) AS total_processed,
  COUNT(*) FILTER (WHERE last_error IS NOT NULL) AS failed_count,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) AS avg_processing_time_seconds,
  MAX(processed_at) AS last_processed_at
FROM image_metadata
WHERE processed_at IS NOT NULL
GROUP BY processing_version
ORDER BY processing_version DESC;

COMMENT ON VIEW v_metadata_processing_stats IS '메타데이터 처리 버전별 통계';

-- 실패 이미지 요약
CREATE OR REPLACE VIEW v_failure_summary AS
SELECT 
  failure_type,
  COUNT(*) AS total_failures,
  COUNT(*) FILTER (WHERE resolved = FALSE) AS unresolved_count,
  AVG(retry_count) AS avg_retry_count,
  MAX(updated_at) AS last_failure_at
FROM image_processing_failures
GROUP BY failure_type
ORDER BY unresolved_count DESC;

COMMENT ON VIEW v_failure_summary IS '이미지 처리 실패 요약 통계';

-- ============================================================
-- 8. 유틸리티 함수
-- ============================================================

-- 배치 락 획득 함수
CREATE OR REPLACE FUNCTION acquire_batch_lock(
  p_batch_type VARCHAR,
  p_started_by VARCHAR DEFAULT 'unknown'
) RETURNS INTEGER AS $$
DECLARE
  v_lock_id INTEGER;
BEGIN
  -- 이미 실행 중인 배치가 있는지 확인
  IF EXISTS (
    SELECT 1 FROM batch_processing_locks 
    WHERE batch_type = p_batch_type AND status = 'running'
  ) THEN
    RAISE EXCEPTION '배치 작업이 이미 실행 중입니다: %', p_batch_type;
  END IF;
  
  -- 새 락 생성
  INSERT INTO batch_processing_locks (batch_type, status, started_by)
  VALUES (p_batch_type, 'running', p_started_by)
  RETURNING lock_id INTO v_lock_id;
  
  RETURN v_lock_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION acquire_batch_lock IS '배치 처리 락 획득 (중복 실행 방지)';

-- 배치 락 해제 함수
CREATE OR REPLACE FUNCTION release_batch_lock(
  p_lock_id INTEGER,
  p_status VARCHAR DEFAULT 'completed',
  p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE batch_processing_locks
  SET 
    status = p_status,
    completed_at = NOW(),
    error_message = p_error_message
  WHERE lock_id = p_lock_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION release_batch_lock IS '배치 처리 락 해제';

-- ============================================================
-- 마이그레이션 완료
-- ============================================================

-- 마이그레이션 버전 기록
INSERT INTO schema_migrations (version, description, applied_at)
VALUES (
  '06',
  'GPS 컬럼 분리, 처리 버전 추적, 배치 락, 실패 추적 테이블 추가',
  NOW()
)
ON CONFLICT (version) DO NOTHING;

-- 최종 통계 출력
DO $$
DECLARE
  v_total_images INTEGER;
  v_images_with_gps INTEGER;
  v_gps_percent NUMERIC;
BEGIN
  SELECT 
    total_images, 
    images_with_gps,
    gps_coverage_percent
  INTO v_total_images, v_images_with_gps, v_gps_percent
  FROM v_gps_coverage_stats;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅ Migration 06 완료';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '총 이미지 수: %', v_total_images;
  RAISE NOTICE 'GPS 포함 이미지: % (%.2f%%)', v_images_with_gps, v_gps_percent;
  RAISE NOTICE '============================================================';
END $$;



