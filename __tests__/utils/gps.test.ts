/**
 * GPS 유틸리티 함수 유닛 테스트
 */

import { dmsToDecimal, formatGPS } from '@/lib/utils/gps'
import { 
  calculateHaversineDistance, 
  clusterByGPS, 
  isValidGPS 
} from '@/lib/utils/gps-clustering'

describe('GPS 유틸리티 테스트', () => {
  describe('dmsToDecimal', () => {
    test('DMS 문자열을 십진법으로 변환', () => {
      // 서울 좌표: 37° 33' 59.99" N
      expect(dmsToDecimal("37 deg 33' 59.99\" N")).toBeCloseTo(37.5666, 4)
      
      // 서울 경도: 126° 58' 41.11" E
      expect(dmsToDecimal("126 deg 58' 41.11\" E")).toBeCloseTo(126.9781, 4)
      
      // 남위
      expect(dmsToDecimal("33 deg 51' 35.9\" S")).toBeCloseTo(-33.8600, 4)
      
      // 서경
      expect(dmsToDecimal("151 deg 12' 26.2\" W")).toBeCloseTo(-151.2073, 4)
    })

    test('잘못된 입력에 대해 null 반환', () => {
      expect(dmsToDecimal('')).toBeNull()
      expect(dmsToDecimal('invalid')).toBeNull()
      expect(dmsToDecimal('123')).toBeNull()
    })

    test('십진법 숫자 입력은 그대로 반환', () => {
      expect(dmsToDecimal('37.5666')).toBeCloseTo(37.5666, 4)
      expect(dmsToDecimal('-126.9781')).toBeCloseTo(-126.9781, 4)
    })
  })

  describe('formatGPS', () => {
    test('GPS 좌표를 문자열로 포맷팅', () => {
      expect(formatGPS(37.5666, 126.9781)).toBe('N 37.57°, E 126.98°')
      expect(formatGPS(-33.8600, 151.2073)).toBe('S 33.86°, E 151.21°')
      expect(formatGPS(40.7128, -74.0060)).toBe('N 40.71°, W 74.01°')
    })
  })

  describe('calculateHaversineDistance', () => {
    test('두 GPS 좌표 간 거리 계산 (미터)', () => {
      // 서울시청 → 남산타워 (약 2km)
      const seoul = { latitude: 37.5665, longitude: 126.9780 }
      const namsan = { latitude: 37.5512, longitude: 126.9882 }
      const distance = calculateHaversineDistance(seoul, namsan)
      
      expect(distance).toBeGreaterThan(1500) // 최소 1.5km
      expect(distance).toBeLessThan(2500)    // 최대 2.5km
    })

    test('같은 위치의 거리는 0', () => {
      const point = { latitude: 37.5665, longitude: 126.9780 }
      const distance = calculateHaversineDistance(point, point)
      
      expect(distance).toBe(0)
    })

    test('5m 거리 감지', () => {
      const point1 = { latitude: 37.566500, longitude: 126.978000 }
      const point2 = { latitude: 37.566545, longitude: 126.978000 } // 약 5m 북쪽
      const distance = calculateHaversineDistance(point1, point2)
      
      expect(distance).toBeGreaterThan(4)
      expect(distance).toBeLessThan(6)
    })
  })

  describe('clusterByGPS', () => {
    test('가까운 포인트들을 클러스터링', () => {
      const points = [
        { id: 1, latitude: 37.5665, longitude: 126.9780 },
        { id: 2, latitude: 37.5666, longitude: 126.9781 }, // 1번과 가까움
        { id: 3, latitude: 37.5700, longitude: 126.9800 }, // 멀리 떨어짐
      ]

      const clusters = clusterByGPS(points, 20) // 20m threshold

      // 1번과 2번은 같은 클러스터, 3번은 별도 클러스터
      expect(clusters.length).toBe(2)
      
      const cluster1 = clusters.find(c => c.points.some(p => p.id === 1))
      expect(cluster1?.points.length).toBe(2)
      expect(cluster1?.points.map(p => p.id).sort()).toEqual([1, 2])
      
      const cluster2 = clusters.find(c => c.points.some(p => p.id === 3))
      expect(cluster2?.points.length).toBe(1)
    })

    test('빈 배열은 빈 클러스터 반환', () => {
      const clusters = clusterByGPS([], 5)
      expect(clusters).toEqual([])
    })
  })

  describe('isValidGPS', () => {
    test('유효한 GPS 좌표 확인', () => {
      expect(isValidGPS({ latitude: 37.5665, longitude: 126.9780 })).toBe(true)
      expect(isValidGPS({ latitude: 0, longitude: 0 })).toBe(true)
      expect(isValidGPS({ latitude: 90, longitude: 180 })).toBe(true)
      expect(isValidGPS({ latitude: -90, longitude: -180 })).toBe(true)
    })

    test('잘못된 GPS 좌표 거부', () => {
      expect(isValidGPS({ latitude: 91, longitude: 0 })).toBe(false) // 위도 초과
      expect(isValidGPS({ latitude: 0, longitude: 181 })).toBe(false) // 경도 초과
      expect(isValidGPS({ latitude: -91, longitude: 0 })).toBe(false)
      expect(isValidGPS({ latitude: 0, longitude: -181 })).toBe(false)
      expect(isValidGPS({})).toBe(false) // 값 없음
      expect(isValidGPS({ latitude: null, longitude: null } as any)).toBe(false)
    })
  })
})



