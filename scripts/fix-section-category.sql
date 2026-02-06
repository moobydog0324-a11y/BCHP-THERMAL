-- 기존 배관 데이터에 section_category 추가 (누락된 경우)
-- 이 스크립트는 pipes 테이블에 section_category 컬럼이 없거나 NULL인 경우를 수정합니다

-- 1. 컬럼이 없다면 추가
ALTER TABLE pipes 
ADD COLUMN IF NOT EXISTS section_category VARCHAR(10);

-- 2. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_pipes_section_category ON pipes(section_category);

-- 3. 기존 배관 데이터 확인
SELECT pipe_id, pipe_code, location, section_category 
FROM pipes 
WHERE section_category IS NULL OR section_category = '';

-- 4. 만약 위 쿼리 결과가 있다면, 수동으로 업데이트하거나
-- 또는 업로드 페이지에서 구간을 선택하고 다시 업로드하세요

-- 예시: 특정 배관에 구간 설정
-- UPDATE pipes SET section_category = 'A-1' WHERE pipe_id = 1;
-- UPDATE pipes SET section_category = 'B-1' WHERE pipe_id = 2;



