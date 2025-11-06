# Therma-Twin Database Schema Documentation

## Overview
This document describes the database schema for the Therma-Twin thermal pipe health management platform.

## Entity Relationship

\`\`\`
pipes (1) ──< (N) inspections (1) ──< (N) thermal_images (1) ──< (N) analysis_points (1) ──< (N) temperature_readings
                    │
                    └──< (N) defect_predictions
\`\`\`

## Tables

### 1. pipes
Master data for pipe assets being monitored.

**Key Fields:**
- `pipe_code`: Unique identifier for each pipe (e.g., "PIPE-A-001")
- `location`: Physical location of the pipe
- `material`: Pipe material (Steel, Copper, PVC, etc.)
- `diameter_mm`, `length_m`: Physical dimensions

### 2. inspections
Records of thermal inspections performed on pipes.

**Key Fields:**
- `pipe_id`: Foreign key to pipes table
- `inspection_date`: When the inspection was performed
- `inspector_name`: Name of the field engineer
- `ambient_temp_celsius`: Environmental temperature during inspection
- `status`: Inspection status (completed, pending, etc.)

### 3. thermal_images
Metadata for thermal images captured during inspections.

**Key Fields:**
- `inspection_id`: Foreign key to inspections table
- `image_url`: URL to the stored thermal image
- `thumbnail_url`: URL to thumbnail for quick preview
- `camera_model`: Thermal camera model used
- `capture_timestamp`: Exact time the image was captured

### 4. analysis_points
Specific points or areas of interest marked on thermal images.

**Key Fields:**
- `image_id`: Foreign key to thermal_images table
- `point_type`: Type of analysis ('spot', 'area', 'line')
- `x_coordinate`, `y_coordinate`: Position on the image
- `width`, `height`: Dimensions for area analysis

### 5. temperature_readings
Temperature measurements for analysis points.

**Key Fields:**
- `point_id`: Foreign key to analysis_points table
- `temp_celsius`: Primary temperature reading
- `temp_min_celsius`, `temp_max_celsius`, `temp_avg_celsius`: Statistics for area analysis

### 6. defect_predictions
AI-based predictions of potential defects.

**Key Fields:**
- `inspection_id`: Foreign key to inspections table
- `defect_type`: Type of defect detected
- `confidence_score`: AI confidence (0.0 to 1.0)
- `severity`: Risk level (low, medium, high, critical)
- `recommended_action`: Suggested maintenance action

## Usage Notes

1. **Cascading Deletes**: Deleting a pipe will cascade delete all related inspections, images, and analysis data.
2. **Indexes**: Indexes are created on foreign keys and frequently queried fields for performance.
3. **Timestamps**: All tables include `created_at` and most include `updated_at` for audit trails.
4. **Image Storage**: Images are stored externally (e.g., Vercel Blob), with URLs stored in the database.
