-- Add temperature columns to thermal_images table
ALTER TABLE thermal_images 
ADD COLUMN IF NOT EXISTS range_min FLOAT,
ADD COLUMN IF NOT EXISTS range_max FLOAT,
ADD COLUMN IF NOT EXISTS avg_temp FLOAT;
