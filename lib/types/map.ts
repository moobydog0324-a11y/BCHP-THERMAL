export type MarkerIconType = '맨홀' | '밸브' | '센서' | '수용가' | '레듀서' | '기타'
export type MapProviderType = 'kakao' | 'leaflet'

export interface MapMarkerData {
  id: number
  tag: string
  lat: number
  lng: number
  type: MarkerIconType
  spec?: string
  isMaintenance: boolean
  isInterest: boolean
  maintenanceNotes?: string
  specialNotes?: string
  constructionHistory?: string
  contactInfo?: string
  navAddress?: string
}

export interface MapPipeData {
  id: number
  tag: string
  lat1: number
  lng1: number
  lat2: number
  lng2: number
  color: string
  thickness: number
  spec?: string
  depth?: string
  category?: string
  culvert?: string
  isMaintenance: boolean
  isInterest: boolean
  maintenanceNotes?: string
  specialNotes?: string
  replacementYear?: number
}

export interface MapFilter {
  markerTypes: MarkerIconType[]
  pipeCategories: string[]
  showMaintenance: boolean
  showInterest: boolean
  showAllMarkers: boolean
  showAllPipes: boolean
}

export const DEFAULT_MAP_FILTER: MapFilter = {
  markerTypes: ['맨홀', '밸브', '센서', '수용가', '레듀서', '기타'],
  pipeCategories: [],
  showMaintenance: false,
  showInterest: false,
  showAllMarkers: true,
  showAllPipes: true,
}

export const MAP_CENTER = { lat: 37.29789, lng: 126.80096 } // 반월 지역
export const MAP_ZOOM = 14

export const MARKER_COLORS: Record<MarkerIconType, string> = {
  '맨홀': '#e74c3c',
  '밸브': '#3498db',
  '센서': '#2ecc71',
  '수용가': '#f39c12',
  '레듀서': '#9b59b6',
  '기타': '#95a5a6',
}

export function getPipeColorByAge(replacementYear?: number): string {
  if (!replacementYear) return '#95a5a6'
  const age = new Date().getFullYear() - replacementYear
  if (age >= 30) return '#8b0000'
  if (age >= 20) return '#e74c3c'
  if (age >= 15) return '#f39c12'
  if (age >= 10) return '#f1c40f'
  return '#2ecc71'
}
