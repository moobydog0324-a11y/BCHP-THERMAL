-- ============================================================
-- 06-add-advanced-schema.sql
-- Description: Adds tables for Advanced Thermal Analysis & Architecture Alignment
-- Includes: ROIs, Anomalies, Work Orders, and Extended Metadata
-- ============================================================

-- 1. Enable PostGIS if not already enabled (Required for GEOMETRY types)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Regions of Interest (ROIs)
-- Defines specific areas to monitor (e.g., "Main Valve A", "Pipe Joint B")
CREATE TABLE IF NOT EXISTS rois (
    roi_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100),
    geometry GEOMETRY(POLYGON, 4326),
    criticality INTEGER DEFAULT 1, -- 1: Low, 2: Medium, 3: High
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Anomalies (Detected Issues)
-- Stores potential issues detected by the system or marked by operators
CREATE TABLE IF NOT EXISTS anomalies (
    anomaly_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capture_id INTEGER REFERENCES thermal_images(image_id) ON DELETE CASCADE,
    roi_id UUID REFERENCES rois(roi_id) ON DELETE SET NULL,
    geometry GEOMETRY(POLYGON, 4326),
    peak_temp DECIMAL(10, 2),
    area_m2 DECIMAL(10, 2),
    score DECIMAL(3, 2), -- Confidence Score (0.00 - 1.00)
    status VARCHAR(50) DEFAULT 'unconfirmed', -- unconfirmed, confirmed, false_alarm, resolved
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Work Orders
-- Tracks maintenance tasks generated from anomalies
CREATE TABLE IF NOT EXISTS work_orders (
    wo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anomaly_id UUID REFERENCES anomalies(anomaly_id) ON DELETE CASCADE,
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    status VARCHAR(50) DEFAULT 'open', -- open, in_progress, completed, cancelled
    assigned_to VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Extend Image Metadata
-- Adds structured columns for specific environmental and camera parameters
-- This allows for faster querying/filtering without parsing JSONB
ALTER TABLE image_metadata
ADD COLUMN IF NOT EXISTS emissivity DECIMAL(5, 3),
ADD COLUMN IF NOT EXISTS object_distance DECIMAL(8, 3),
ADD COLUMN IF NOT EXISTS relative_humidity DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS reflected_apparent_temperature DECIMAL(6, 2),
ADD COLUMN IF NOT EXISTS gimbal_pitch DECIMAL(6, 2),
ADD COLUMN IF NOT EXISTS gimbal_roll DECIMAL(6, 2),
ADD COLUMN IF NOT EXISTS gimbal_yaw DECIMAL(6, 2),
ADD COLUMN IF NOT EXISTS flight_pitch DECIMAL(6, 2),
ADD COLUMN IF NOT EXISTS flight_roll DECIMAL(6, 2),
ADD COLUMN IF NOT EXISTS flight_yaw DECIMAL(6, 2);

-- 6. Create Indexes
CREATE INDEX IF NOT EXISTS idx_rois_geometry ON rois USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_anomalies_geometry ON anomalies USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_anomalies_capture ON anomalies(capture_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_anomaly ON work_orders(anomaly_id);
