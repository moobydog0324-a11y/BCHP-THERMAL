-- ============================================================
-- BCHP-THERMA Database Setup Script
-- ============================================================
-- 이 스크립트는 모든 테이블과 스키마를 한 번에 생성합니다.
-- Supabase Dashboard > SQL Editor에 복사하여 실행하세요.

-- 1. Migration Tracking Table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(10) PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
  applied_by VARCHAR(255) DEFAULT CURRENT_USER
);
INSERT INTO schema_migrations (version, description) VALUES ('00', 'Init migrations table') ON CONFLICT DO NOTHING;

-- 2. Core Tables (Pipes, Inspections, etc)
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

CREATE INDEX IF NOT EXISTS idx_pipes_code ON pipes(pipe_code);
CREATE INDEX IF NOT EXISTS idx_inspections_pipe ON inspections(pipe_id);
CREATE INDEX IF NOT EXISTS idx_thermal_images_inspection ON thermal_images(inspection_id);

-- 3. Add Image Type
ALTER TABLE thermal_images 
ADD COLUMN IF NOT EXISTS image_type VARCHAR(20) DEFAULT 'thermal' CHECK (image_type IN ('thermal', 'real'));
CREATE INDEX IF NOT EXISTS idx_thermal_images_type ON thermal_images(image_type);

-- 4. Add Section Category
ALTER TABLE pipes ADD COLUMN IF NOT EXISTS section_category VARCHAR(10);
CREATE INDEX IF NOT EXISTS idx_pipes_section_category ON pipes(section_category);

-- 5. Add Metadata Table
CREATE TABLE IF NOT EXISTS image_metadata (
    metadata_id SERIAL PRIMARY KEY,
    image_id INTEGER UNIQUE NOT NULL REFERENCES thermal_images(image_id) ON DELETE CASCADE,
    metadata_json JSONB,
    thermal_data_json JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_image_metadata_image ON image_metadata(image_id);
CREATE INDEX IF NOT EXISTS idx_metadata_json ON image_metadata USING gin(metadata_json);

-- 6. Add File Hash
ALTER TABLE image_metadata ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_image_metadata_file_hash ON image_metadata(file_hash);

-- 7. Enhance Metadata & Tracking (Migration 06)
ALTER TABLE thermal_images
  ADD COLUMN IF NOT EXISTS gps_latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS gps_longitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS gps_altitude NUMERIC(8, 2);

CREATE INDEX IF NOT EXISTS idx_thermal_images_gps 
  ON thermal_images(gps_latitude, gps_longitude) 
  WHERE gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL;

ALTER TABLE image_metadata
  ADD COLUMN IF NOT EXISTS processing_version TEXT DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS processing_parameters JSONB,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS batch_processing_locks (
  lock_id SERIAL PRIMARY KEY,
  batch_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  started_by VARCHAR(255),
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  error_message TEXT,
  CONSTRAINT unique_running_batch UNIQUE (batch_type, status)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_running_batch 
  ON batch_processing_locks(batch_type) 
  WHERE status = 'running';

CREATE TABLE IF NOT EXISTS image_processing_failures (
  failure_id SERIAL PRIMARY KEY,
  image_id INTEGER NOT NULL REFERENCES thermal_images(image_id) ON DELETE CASCADE,
  failure_type VARCHAR(100) NOT NULL,
  error_message TEXT NOT NULL,
  error_details JSONB,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_image_failure UNIQUE (image_id, failure_type)
);

-- Trigger for GPS Sync
CREATE OR REPLACE FUNCTION sync_gps_from_metadata()
RETURNS TRIGGER AS $$
BEGIN
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
      END
    WHERE image_id = NEW.image_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_gps_from_metadata ON image_metadata;
CREATE TRIGGER trg_sync_gps_from_metadata
  AFTER INSERT OR UPDATE OF metadata_json ON image_metadata
  FOR EACH ROW
  EXECUTE FUNCTION sync_gps_from_metadata();
