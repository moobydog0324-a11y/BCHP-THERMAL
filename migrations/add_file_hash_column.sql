-- 파일 해시 컬럼 추가 (중복 파일 감지용)
-- SHA-256 해시: 64자 (16진수)

-- image_metadata 테이블에 file_hash 컬럼 추가
ALTER TABLE image_metadata 
ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);

-- file_hash 컬럼에 인덱스 생성 (중복 체크 성능 향상)
CREATE INDEX IF NOT EXISTS idx_image_metadata_file_hash 
ON image_metadata(file_hash);

-- 설명 추가
COMMENT ON COLUMN image_metadata.file_hash IS 'SHA-256 file hash for duplicate detection';

-- 마이그레이션 완료 확인
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'image_metadata' 
  AND column_name = 'file_hash';

