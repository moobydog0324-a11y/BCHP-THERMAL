-- DB 메타데이터 상태 확인 쿼리
-- PostgreSQL에서 실행하세요

-- 1. 전체 이미지 개수와 메타데이터 상태
SELECT 
  COUNT(*) as total_images,
  COUNT(im.metadata_json) as has_metadata_json,
  COUNT(im.thermal_data_json) as has_thermal_data_json,
  COUNT(*) - COUNT(im.metadata_json) as missing_metadata,
  COUNT(*) - COUNT(im.thermal_data_json) as missing_thermal_data
FROM thermal_images ti
LEFT JOIN image_metadata im ON ti.image_id = im.image_id
WHERE ti.image_type = 'thermal';

-- 2. 샘플 이미지 5개 상세 확인
SELECT 
  ti.image_id,
  ti.camera_model,
  ti.capture_timestamp,
  im.metadata_json IS NOT NULL as has_metadata,
  im.thermal_data_json IS NOT NULL as has_thermal,
  CASE 
    WHEN im.thermal_data_json IS NOT NULL THEN 
      im.thermal_data_json::text LIKE '%actual_temp_stats%'
    ELSE false
  END as has_temp_stats
FROM thermal_images ti
LEFT JOIN image_metadata im ON ti.image_id = im.image_id
WHERE ti.image_type = 'thermal'
ORDER BY ti.image_id DESC
LIMIT 5;

-- 3. 최신 이미지 1개의 메타데이터 내용 확인
SELECT 
  ti.image_id,
  im.metadata_json,
  im.thermal_data_json
FROM thermal_images ti
LEFT JOIN image_metadata im ON ti.image_id = im.image_id
WHERE ti.image_type = 'thermal'
ORDER BY ti.created_at DESC
LIMIT 1;





