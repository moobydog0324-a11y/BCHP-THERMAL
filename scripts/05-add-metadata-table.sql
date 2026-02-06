-- 이미지 메타데이터 저장 테이블
-- ExifTool로 추출한 모든 메타데이터를 JSON으로 저장

CREATE TABLE IF NOT EXISTS image_metadata (
    metadata_id SERIAL PRIMARY KEY,
    image_id INTEGER UNIQUE NOT NULL REFERENCES thermal_images(image_id) ON DELETE CASCADE,
    
    -- 전체 메타데이터 (JSON)
    metadata_json JSONB,
    
    -- 열화상 관련 주요 데이터만 추출 (JSON)
    thermal_data_json JSONB,
    
    -- 생성 시간
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 추가 (JSONB 쿼리 성능 향상)
CREATE INDEX IF NOT EXISTS idx_image_metadata_image ON image_metadata(image_id);
CREATE INDEX IF NOT EXISTS idx_metadata_json ON image_metadata USING gin(metadata_json);
CREATE INDEX IF NOT EXISTS idx_thermal_data_json ON image_metadata USING gin(thermal_data_json);

-- JSONB 필드에서 특정 값 검색 예시 쿼리:
-- 특정 카메라 모델 찾기:
-- SELECT * FROM image_metadata WHERE thermal_data_json->>'Model' = 'XT2';

-- 온도 범위로 검색:
-- SELECT * FROM image_metadata 
-- WHERE (thermal_data_json->>'AtmosphericTemperature')::text LIKE '%20.0%';

COMMENT ON TABLE image_metadata IS '열화상 이미지의 EXIF 메타데이터 저장';
COMMENT ON COLUMN image_metadata.metadata_json IS 'ExifTool로 추출한 전체 메타데이터 (JSONB)';
COMMENT ON COLUMN image_metadata.thermal_data_json IS '열화상 관련 주요 데이터 (온도, Planck 상수 등)';


