-- 마이그레이션: thermal_images 테이블에 image_type 필드 추가
-- 실행 날짜: 2025-01-15

-- image_type 컬럼 추가 (열화상/실화상 구분)
ALTER TABLE thermal_images 
ADD COLUMN IF NOT EXISTS image_type VARCHAR(20) DEFAULT 'thermal' CHECK (image_type IN ('thermal', 'real'));

-- 기존 데이터는 모두 'thermal'로 설정 (이미 DEFAULT로 설정됨)
UPDATE thermal_images SET image_type = 'thermal' WHERE image_type IS NULL;

-- 인덱스 추가 (타입별 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_thermal_images_type ON thermal_images(image_type);

-- 변경사항 확인
COMMENT ON COLUMN thermal_images.image_type IS '이미지 타입: thermal(열화상) 또는 real(실화상)';




