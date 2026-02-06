-- ============================================================
-- Analysis & Alignment System Schema
-- ============================================================

-- 1. Analysis Groups (Start of a time-series analysis)
-- Defines a specific location/monitoring point (e.g., "Review Point A-1")
CREATE TABLE IF NOT EXISTS analysis_groups (
    group_id SERIAL PRIMARY KEY,
    section_category VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL, -- e.g. "Main Pipe Junction A"
    master_image_id INTEGER REFERENCES thermal_images(image_id),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Anchor Points (Fixed reference points on Master Image)
-- These are manually selected by the user once.
CREATE TABLE IF NOT EXISTS analysis_anchors (
    anchor_id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES analysis_groups(group_id) ON DELETE CASCADE,
    point_index INTEGER NOT NULL, -- 0, 1, 2... order matters
    x_coordinate FLOAT NOT NULL, -- Normalized 0.0 ~ 1.0 or pixel value? Let's use Normalized.
    y_coordinate FLOAT NOT NULL,
    label VARCHAR(50), -- "Top Left Corner", "Bolt"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Image Alignments (Relation between Target Image and Master)
-- Stores the calculated transformation matrix to align this image to the master.
CREATE TABLE IF NOT EXISTS image_alignments (
    alignment_id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES analysis_groups(group_id) ON DELETE CASCADE,
    image_id INTEGER REFERENCES thermal_images(image_id) ON DELETE CASCADE,
    
    -- Transformation Matrix (3x3 Homography or 2x3 Affine)
    -- Stored as JSON array: [[a,b,c], [d,e,f], ...]
    transform_matrix JSONB,
    
    alignment_score FLOAT, -- Similarity score (0.0 ~ 1.0) or RMSE
    status VARCHAR(20) DEFAULT 'pending', -- 'aligned', 'manual_required', 'pending'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(group_id, image_id)
);

-- 4. Analysis ROIs (Regions of Interest on Master)
CREATE TABLE IF NOT EXISTS analysis_rois (
    roi_id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES analysis_groups(group_id) ON DELETE CASCADE,
    
    label VARCHAR(100) NOT NULL, -- "Valve #1", "Connection Joint"
    roi_type VARCHAR(20) DEFAULT 'rect', -- 'rect', 'polygon'
    
    -- Coordinates on the Master Image (Normalized 0.0 ~ 1.0)
    -- { "x1": 0.1, "y1": 0.1, "x2": 0.2, "y2": 0.2 }
    coordinates JSONB NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Time-Series Data Cache (Optional, for quick charting)
CREATE TABLE IF NOT EXISTS analysis_results (
    result_id SERIAL PRIMARY KEY,
    roi_id INTEGER REFERENCES analysis_rois(roi_id) ON DELETE CASCADE,
    alignment_id INTEGER REFERENCES image_alignments(alignment_id) ON DELETE CASCADE,
    
    -- Extracted thermal stats
    min_temp FLOAT,
    max_temp FLOAT,
    avg_temp FLOAT,
    
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
