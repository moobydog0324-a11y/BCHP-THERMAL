-- Therma-Twin Database Schema
-- Phase 1: Core tables for thermal pipe health management

-- 1. Pipes table: Master data for pipe assets
CREATE TABLE IF NOT EXISTS pipes (
    pipe_id SERIAL PRIMARY KEY,
    pipe_code VARCHAR(50) UNIQUE NOT NULL,
    location VARCHAR(255) NOT NULL,
    material VARCHAR(100),
    diameter_mm DECIMAL(10, 2),
    length_m DECIMAL(10, 2),
    installation_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Inspections table: Records of thermal inspections
CREATE TABLE IF NOT EXISTS inspections (
    inspection_id SERIAL PRIMARY KEY,
    pipe_id INTEGER NOT NULL REFERENCES pipes(pipe_id) ON DELETE CASCADE,
    inspection_date TIMESTAMP NOT NULL,
    inspector_name VARCHAR(100) NOT NULL,
    weather_condition VARCHAR(100),
    ambient_temp_celsius DECIMAL(5, 2),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Thermal images table: Stores thermal image metadata
CREATE TABLE IF NOT EXISTS thermal_images (
    image_id SERIAL PRIMARY KEY,
    inspection_id INTEGER NOT NULL REFERENCES inspections(inspection_id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    image_width INTEGER,
    image_height INTEGER,
    camera_model VARCHAR(100),
    capture_timestamp TIMESTAMP NOT NULL,
    file_size_bytes BIGINT,
    file_format VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Analysis points table: Specific points of interest on thermal images
CREATE TABLE IF NOT EXISTS analysis_points (
    point_id SERIAL PRIMARY KEY,
    image_id INTEGER NOT NULL REFERENCES thermal_images(image_id) ON DELETE CASCADE,
    point_type VARCHAR(50) NOT NULL, -- 'spot', 'area', 'line'
    x_coordinate INTEGER NOT NULL,
    y_coordinate INTEGER NOT NULL,
    width INTEGER, -- for area analysis
    height INTEGER, -- for area analysis
    label VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Temperature readings table: Temperature data for analysis points
CREATE TABLE IF NOT EXISTS temperature_readings (
    reading_id SERIAL PRIMARY KEY,
    point_id INTEGER NOT NULL REFERENCES analysis_points(point_id) ON DELETE CASCADE,
    temp_celsius DECIMAL(6, 2) NOT NULL,
    temp_min_celsius DECIMAL(6, 2), -- for area analysis
    temp_max_celsius DECIMAL(6, 2), -- for area analysis
    temp_avg_celsius DECIMAL(6, 2), -- for area analysis
    measurement_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Defect predictions table: AI-based defect predictions
CREATE TABLE IF NOT EXISTS defect_predictions (
    prediction_id SERIAL PRIMARY KEY,
    inspection_id INTEGER NOT NULL REFERENCES inspections(inspection_id) ON DELETE CASCADE,
    defect_type VARCHAR(100) NOT NULL,
    confidence_score DECIMAL(5, 4), -- 0.0000 to 1.0000
    severity VARCHAR(50), -- 'low', 'medium', 'high', 'critical'
    location_description TEXT,
    recommended_action TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pipes_code ON pipes(pipe_code);
CREATE INDEX IF NOT EXISTS idx_inspections_pipe ON inspections(pipe_id);
CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections(inspection_date);
CREATE INDEX IF NOT EXISTS idx_thermal_images_inspection ON thermal_images(inspection_id);
CREATE INDEX IF NOT EXISTS idx_analysis_points_image ON analysis_points(image_id);
CREATE INDEX IF NOT EXISTS idx_temperature_readings_point ON temperature_readings(point_id);
CREATE INDEX IF NOT EXISTS idx_defect_predictions_inspection ON defect_predictions(inspection_id);
