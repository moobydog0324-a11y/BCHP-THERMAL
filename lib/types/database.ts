// TypeScript types for database schema

export interface Pipe {
  pipe_id: number
  pipe_code: string
  location: string
  material?: string
  diameter_mm?: number
  length_m?: number
  installation_date?: Date
  notes?: string
  created_at: Date
  updated_at: Date
}

export interface Inspection {
  inspection_id: number
  pipe_id: number
  inspection_date: Date
  inspector_name: string
  weather_condition?: string
  ambient_temp_celsius?: number
  notes?: string
  status: string
  created_at: Date
  updated_at: Date
}

export interface ThermalImage {
  image_id: number
  inspection_id: number
  image_url: string
  thumbnail_url?: string
  image_width?: number
  image_height?: number
  camera_model?: string
  capture_timestamp: Date
  file_size_bytes?: number
  file_format?: string
  created_at: Date
}

export interface AnalysisPoint {
  point_id: number
  image_id: number
  point_type: "spot" | "area" | "line"
  x_coordinate: number
  y_coordinate: number
  width?: number
  height?: number
  label?: string
  notes?: string
  created_at: Date
}

export interface TemperatureReading {
  reading_id: number
  point_id: number
  temp_celsius: number
  temp_min_celsius?: number
  temp_max_celsius?: number
  temp_avg_celsius?: number
  measurement_timestamp: Date
  created_at: Date
}

export interface DefectPrediction {
  prediction_id: number
  inspection_id: number
  defect_type: string
  confidence_score?: number
  severity?: "low" | "medium" | "high" | "critical"
  location_description?: string
  recommended_action?: string
  created_at: Date
}

// Extended types with relations
export interface InspectionWithDetails extends Inspection {
  pipe?: Pipe
  thermal_images?: ThermalImage[]
  defect_predictions?: DefectPrediction[]
}

export interface ThermalImageWithAnalysis extends ThermalImage {
  analysis_points?: (AnalysisPoint & {
    temperature_readings?: TemperatureReading[]
  })[]
}
