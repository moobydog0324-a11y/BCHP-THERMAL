-- 마이그레이션: pipes 및 inspections 테이블에 section_category 필드 추가
-- 실행 날짜: 2025-01-15

-- pipes 테이블에 section_category 컬럼 추가
ALTER TABLE pipes 
ADD COLUMN IF NOT EXISTS section_category VARCHAR(10);

-- 기존 배관 데이터에 카테고리 설정 (예시)
UPDATE pipes SET section_category = 'A-1' WHERE pipe_code = 'PIPE-A-001';
UPDATE pipes SET section_category = 'A-2' WHERE pipe_code = 'PIPE-A-002';
UPDATE pipes SET section_category = 'B-1' WHERE pipe_code = 'PIPE-B-001';
UPDATE pipes SET section_category = 'B-2' WHERE pipe_code = 'PIPE-B-002';

-- 인덱스 추가 (카테고리별 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_pipes_section_category ON pipes(section_category);

-- 샘플 구간 카테고리별 배관 데이터 추가
INSERT INTO pipes (pipe_code, location, material, diameter_mm, length_m, section_category, notes) VALUES
('PIPE-A-1', '반월공단 A구역 1번', 'Steel', 150.00, 50.00, 'A-1', 'A구역 1번 라인'),
('PIPE-A-2', '반월공단 A구역 2번', 'Steel', 150.00, 45.00, 'A-2', 'A구역 2번 라인'),
('PIPE-B-1', '반월공단 B구역 1번', 'Copper', 125.00, 40.00, 'B-1', 'B구역 1번 라인'),
('PIPE-B-2', '반월공단 B구역 2번', 'Copper', 125.00, 38.00, 'B-2', 'B구역 2번 라인'),
('PIPE-C-1', '반월공단 C구역 1번', 'Steel', 200.00, 60.00, 'C-1', 'C구역 1번 라인'),
('PIPE-C-2', '반월공단 C구역 2번', 'Steel', 200.00, 55.00, 'C-2', 'C구역 2번 라인'),
('PIPE-D-1', '반월공단 D구역 1번', 'Stainless', 175.00, 48.00, 'D-1', 'D구역 1번 라인'),
('PIPE-D-2', '반월공단 D구역 2번', 'Stainless', 175.00, 52.00, 'D-2', 'D구역 2번 라인'),
('PIPE-E-1', '반월공단 E구역 1번', 'Steel', 150.00, 42.00, 'E-1', 'E구역 1번 라인'),
('PIPE-E-2', '반월공단 E구역 2번', 'Steel', 150.00, 44.00, 'E-2', 'E구역 2번 라인'),
('PIPE-F-1', '반월공단 F구역 1번', 'Copper', 125.00, 36.00, 'F-1', 'F구역 1번 라인'),
('PIPE-F-2', '반월공단 F구역 2번', 'Copper', 125.00, 38.00, 'F-2', 'F구역 2번 라인'),
('PIPE-G-1', '반월공단 G구역 1번', 'Steel', 200.00, 65.00, 'G-1', 'G구역 1번 라인'),
('PIPE-G-2', '반월공단 G구역 2번', 'Steel', 200.00, 62.00, 'G-2', 'G구역 2번 라인')
ON CONFLICT (pipe_code) DO NOTHING;

-- 변경사항 확인
COMMENT ON COLUMN pipes.section_category IS '구간 카테고리: A-1, A-2, B-1, B-2, C-1, C-2, D-1, D-2, E-1, E-2, F-1, F-2, G-1, G-2';











