-- Sample data for Therma-Twin platform
-- This creates demo pipes and inspections for testing

-- Insert sample pipes
INSERT INTO pipes (pipe_code, location, material, diameter_mm, length_m, installation_date, notes) VALUES
('PIPE-A-001', '반월공단 A동 1층', 'Steel', 150.00, 50.00, '2020-03-15', '주요 증기 배관'),
('PIPE-A-002', '반월공단 A동 2층', 'Copper', 100.00, 30.00, '2019-08-22', '냉각수 배관'),
('PIPE-B-001', '반월공단 B동 지하', 'PVC', 200.00, 75.00, '2021-01-10', '배수 배관'),
('PIPE-B-002', '반월공단 B동 옥상', 'Steel', 125.00, 40.00, '2018-11-05', '난방 배관');

-- Insert sample inspections
INSERT INTO inspections (pipe_id, inspection_date, inspector_name, weather_condition, ambient_temp_celsius, notes, status) VALUES
(1, '2024-01-15 09:30:00', '김철수', '맑음', 5.5, '정기 점검', 'completed'),
(1, '2024-06-20 14:00:00', '이영희', '흐림', 22.3, '이상 온도 감지로 재점검', 'completed'),
(2, '2024-02-10 10:15:00', '박민수', '맑음', 3.2, '정기 점검', 'completed'),
(3, '2024-03-05 11:00:00', '김철수', '비', 8.7, '누수 의심 구간 점검', 'completed'),
(4, '2024-04-12 15:30:00', '이영희', '맑음', 18.5, '정기 점검', 'completed');

-- Note: Thermal images, analysis points, and temperature readings 
-- will be added through the application UI when users upload images
