/**
 * GPS 클러스터링 유틸리티
 * Haversine 공식을 사용한 정밀한 거리 계산 및 클러스터링
 */

export type GPSCoordinate = {
  latitude: number
  longitude: number
}

export type GPSPoint = GPSCoordinate & {
  id: number | string
  [key: string]: any
}

export type GPSCluster = {
  centroid: GPSCoordinate
  points: GPSPoint[]
  radius_meters: number
}

/**
 * Haversine 공식으로 두 GPS 좌표 간 거리 계산 (미터 단위)
 * 
 * @param point1 - 첫 번째 GPS 좌표
 * @param point2 - 두 번째 GPS 좌표
 * @returns 거리 (미터)
 */
export function calculateHaversineDistance(
  point1: GPSCoordinate,
  point2: GPSCoordinate
): number {
  const EARTH_RADIUS_KM = 6371 // 지구 반지름 (km)

  // 라디안 변환
  const lat1Rad = toRadians(point1.latitude)
  const lat2Rad = toRadians(point2.latitude)
  const deltaLatRad = toRadians(point2.latitude - point1.latitude)
  const deltaLonRad = toRadians(point2.longitude - point1.longitude)

  // Haversine 공식
  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distanceKm = EARTH_RADIUS_KM * c

  return distanceKm * 1000 // 미터로 변환
}

/**
 * 각도를 라디안으로 변환
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * GPS 포인트들을 거리 기반으로 클러스터링 (DBSCAN 알고리즘)
 * 
 * @param points - GPS 포인트 배열
 * @param thresholdMeters - 클러스터링 거리 임계값 (미터, 기본 5m)
 * @returns 클러스터 배열
 */
export function clusterByGPS(
  points: GPSPoint[],
  thresholdMeters: number = 5
): GPSCluster[] {
  if (points.length === 0) return []

  const clusters: GPSCluster[] = []
  const visited = new Set<number | string>()
  const clustered = new Set<number | string>()

  for (const point of points) {
    if (visited.has(point.id)) continue

    visited.add(point.id)

    // 현재 포인트 주변의 이웃 찾기
    const neighbors = findNeighbors(point, points, thresholdMeters)

    if (neighbors.length === 0) {
      // 이웃이 없으면 단독 클러스터
      clusters.push({
        centroid: { latitude: point.latitude, longitude: point.longitude },
        points: [point],
        radius_meters: 0,
      })
      clustered.add(point.id)
    } else {
      // 이웃이 있으면 클러스터 확장
      const clusterPoints: GPSPoint[] = [point]
      const queue = [...neighbors]

      while (queue.length > 0) {
        const neighbor = queue.shift()!

        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id)

          const neighborNeighbors = findNeighbors(neighbor, points, thresholdMeters)
          queue.push(...neighborNeighbors.filter((n) => !visited.has(n.id)))
        }

        if (!clustered.has(neighbor.id)) {
          clusterPoints.push(neighbor)
          clustered.add(neighbor.id)
        }
      }

      clustered.add(point.id)

      // 클러스터 중심 계산
      const centroid = calculateCentroid(clusterPoints)
      const maxRadius = calculateMaxRadius(centroid, clusterPoints)

      clusters.push({
        centroid,
        points: clusterPoints,
        radius_meters: maxRadius,
      })
    }
  }

  return clusters
}

/**
 * 주변 이웃 찾기
 */
function findNeighbors(
  point: GPSPoint,
  allPoints: GPSPoint[],
  thresholdMeters: number
): GPSPoint[] {
  return allPoints.filter((p) => {
    if (p.id === point.id) return false
    const distance = calculateHaversineDistance(point, p)
    return distance <= thresholdMeters
  })
}

/**
 * 클러스터 중심 (centroid) 계산
 */
function calculateCentroid(points: GPSPoint[]): GPSCoordinate {
  if (points.length === 0) {
    return { latitude: 0, longitude: 0 }
  }

  const sum = points.reduce(
    (acc, p) => ({
      latitude: acc.latitude + p.latitude,
      longitude: acc.longitude + p.longitude,
    }),
    { latitude: 0, longitude: 0 }
  )

  return {
    latitude: sum.latitude / points.length,
    longitude: sum.longitude / points.length,
  }
}

/**
 * 클러스터의 최대 반경 계산
 */
function calculateMaxRadius(centroid: GPSCoordinate, points: GPSPoint[]): number {
  if (points.length === 0) return 0

  const distances = points.map((p) => calculateHaversineDistance(centroid, p))
  return Math.max(...distances)
}

/**
 * GPS 좌표가 유효한지 확인
 */
export function isValidGPS(coord: Partial<GPSCoordinate>): coord is GPSCoordinate {
  if (!coord.latitude || !coord.longitude) return false

  const lat = coord.latitude
  const lon = coord.longitude

  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}

/**
 * GPS 좌표를 사람이 읽을 수 있는 문자열로 변환
 */
export function formatGPSCoordinate(coord: GPSCoordinate, precision: number = 5): string {
  return `${coord.latitude.toFixed(precision)}, ${coord.longitude.toFixed(precision)}`
}

/**
 * GPS 클러스터에 라벨 생성
 * 
 * @param cluster - GPS 클러스터
 * @param prefix - 라벨 접두사 (선택)
 * @returns 클러스터 라벨
 */
export function generateClusterLabel(cluster: GPSCluster, prefix?: string): string {
  const coord = formatGPSCoordinate(cluster.centroid, 5)
  const count = cluster.points.length
  const label = prefix ? `${prefix} - ${coord}` : coord

  return count > 1 ? `${label} (${count}개)` : label
}

/**
 * 두 클러스터가 겹치는지 확인
 */
export function areClustersOverlapping(
  cluster1: GPSCluster,
  cluster2: GPSCluster
): boolean {
  const distance = calculateHaversineDistance(cluster1.centroid, cluster2.centroid)
  return distance <= cluster1.radius_meters + cluster2.radius_meters
}

/**
 * 클러스터 통계 정보 계산
 */
export function getClusterStatistics(clusters: GPSCluster[]): {
  total_clusters: number
  total_points: number
  avg_cluster_size: number
  max_cluster_size: number
  min_cluster_size: number
  avg_radius_meters: number
} {
  if (clusters.length === 0) {
    return {
      total_clusters: 0,
      total_points: 0,
      avg_cluster_size: 0,
      max_cluster_size: 0,
      min_cluster_size: 0,
      avg_radius_meters: 0,
    }
  }

  const totalPoints = clusters.reduce((sum, c) => sum + c.points.length, 0)
  const clusterSizes = clusters.map((c) => c.points.length)
  const radii = clusters.map((c) => c.radius_meters)

  return {
    total_clusters: clusters.length,
    total_points: totalPoints,
    avg_cluster_size: totalPoints / clusters.length,
    max_cluster_size: Math.max(...clusterSizes),
    min_cluster_size: Math.min(...clusterSizes),
    avg_radius_meters: radii.reduce((sum, r) => sum + r, 0) / radii.length,
  }
}



