// TypeScript types for database schema

export interface Pipe {
  pipe_id: number
  pipe_code: string
  location: string
  material?: string
  diameter_mm?: number
  length_m?: number
  installation_date?: Date
  section_category?: string // A-1, A-2, B-1, B-2, etc.
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
  image_type: 'thermal' | 'real' // 'thermal': 열화상, 'real': 실화상
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

// BAP 통합 타입

export interface User {
  user_id: number
  email: string
  password_hash: string
  name: string
  role: 'admin' | 'user'
  is_active: boolean
  last_login?: Date
  created_at: Date
  updated_at: Date
}

export type MarkerType = '맨홀' | '밸브' | '센서' | '수용가' | '레듀서' | '기타'

export interface Marker {
  marker_id: number
  tag_number: string
  lat: number
  lng: number
  spec?: string
  marker_type: MarkerType
  construction_history?: string
  construction_link?: string
  is_maintenance: boolean
  maintenance_notes?: string
  is_interest: boolean
  special_notes?: string
  steam_open?: string
  pipe_asset?: string
  contact_info?: string
  self_boiler?: string
  nav_address?: string
  created_at: Date
  updated_at: Date
}

export interface BapPipe {
  bap_pipe_id: number
  pipe_tag: string
  lat1: number
  lng1: number
  lat2: number
  lng2: number
  color?: string
  thickness: number
  spec?: string
  depth?: string
  category?: string
  culvert?: string
  construction_history?: string
  construction_link?: string
  is_maintenance: boolean
  maintenance_notes?: string
  is_interest: boolean
  special_notes?: string
  replacement_year?: number
  pipe_id?: number
  created_at: Date
  updated_at: Date
}

export interface GpsPhoto {
  photo_id: number
  lat: number
  lng: number
  image_url: string
  description?: string
  overlay_bounds?: Record<string, unknown>
  taken_at?: Date
  created_at: Date
}

export interface Report {
  report_id: number
  title: string
  report_type?: string
  report_data?: Record<string, unknown>
  created_by?: number
  created_at: Date
  updated_at: Date
}

export interface SyncLog {
  sync_id: number
  direction: 'to_sheets' | 'from_sheets'
  sheet_name: string
  rows_synced: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  error_message?: string
  started_at: Date
  completed_at?: Date
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
