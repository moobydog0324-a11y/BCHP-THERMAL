/**
 * GPS 좌표 유틸리티
 */

/**
 * DMS (도 분 초) 형식을 십진수로 변환
 * 예: "37 deg 19' 6.44" N" -> 37.318455
 */
export function dmsToDecimal(dms: string): number | null {
  if (!dms) return null

  try {
    // "37 deg 19' 6.44" N" 형식 파싱
    const parts = dms.match(/(\d+)\s*deg\s*(\d+)'\s*([\d.]+)"\s*([NSEW])/)
    if (!parts) return null

    const degrees = parseFloat(parts[1])
    const minutes = parseFloat(parts[2])
    const seconds = parseFloat(parts[3])
    const direction = parts[4]

    let decimal = degrees + minutes / 60 + seconds / 3600

    // 남위(S) 또는 서경(W)인 경우 음수로
    if (direction === 'S' || direction === 'W') {
      decimal = -decimal
    }

    return decimal
  } catch (error) {
    console.error('DMS 변환 오류:', error)
    return null
  }
}

/**
 * 두 GPS 좌표 간의 거리 계산 (미터 단위)
 * Haversine 공식 사용
 */
export function getDistanceBetweenCoords(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3 // 지구 반지름 (미터)
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // 거리 (미터)
}

/**
 * GPS 좌표를 키로 변환 (그룹핑용)
 * precision: 소수점 자릿수 (4 = 약 11m, 5 = 약 1.1m)
 */
export function gpsToKey(lat: number, lon: number, precision: number = 4): string {
  return `${lat.toFixed(precision)},${lon.toFixed(precision)}`
}

/**
 * GPS 좌표 표시용 포맷팅
 */
export function formatGPS(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(6)}°${latDir}, ${Math.abs(lon).toFixed(6)}°${lonDir}`
}

/**
 * 두 좌표가 같은 위치인지 확인 (threshold 내)
 */
export function isSameLocation(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  thresholdMeters: number = 10
): boolean {
  const distance = getDistanceBetweenCoords(lat1, lon1, lat2, lon2)
  return distance <= thresholdMeters
}

