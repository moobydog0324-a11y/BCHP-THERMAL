'use client'

import { useEffect, useRef, useCallback } from 'react'
import type {
  MapMarkerData,
  MapPipeData,
  MapFilter,
} from '@/lib/types/map'
import { MARKER_COLORS, getPipeColorByAge, MAP_CENTER, MAP_ZOOM } from '@/lib/types/map'

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void
        Map: new (container: HTMLElement, options: Record<string, unknown>) => KakaoMap
        LatLng: new (lat: number, lng: number) => KakaoLatLng
        Marker: new (options: Record<string, unknown>) => KakaoMarker
        InfoWindow: new (options: Record<string, unknown>) => KakaoInfoWindow
        Polyline: new (options: Record<string, unknown>) => KakaoPolyline
        MapTypeId: { ROADMAP: number; SKYVIEW: number; HYBRID: number }
        event: { addListener: (target: unknown, type: string, handler: (...args: unknown[]) => void) => void }
        MarkerImage: new (src: string, size: KakaoSize) => KakaoMarkerImage
        Size: new (w: number, h: number) => KakaoSize
      }
    }
  }
}

interface KakaoMap { setCenter: (latlng: KakaoLatLng) => void; setLevel: (level: number) => void; getCenter: () => KakaoLatLng }
interface KakaoLatLng { getLat: () => number; getLng: () => number }
interface KakaoMarker { setMap: (map: KakaoMap | null) => void }
interface KakaoInfoWindow { open: (map: KakaoMap, marker: KakaoMarker) => void; close: () => void; setContent: (content: string) => void }
interface KakaoPolyline { setMap: (map: KakaoMap | null) => void }
interface KakaoMarkerImage {}
interface KakaoSize {}

interface KakaoPipeMapProps {
  markers: MapMarkerData[]
  pipes: MapPipeData[]
  filter: MapFilter
  onMarkerClick?: (marker: MapMarkerData) => void
  onPipeClick?: (pipe: MapPipeData) => void
  onMapClick?: (lat: number, lng: number) => void
  className?: string
}

export default function KakaoPipeMap({
  markers,
  pipes,
  filter,
  onMarkerClick,
  onPipeClick,
  onMapClick,
  className = '',
}: KakaoPipeMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<KakaoMap | null>(null)
  const kakaoMarkers = useRef<KakaoMarker[]>([])
  const kakaoPolylines = useRef<KakaoPolyline[]>([])
  const infoWindow = useRef<KakaoInfoWindow | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const initMap = () => {
      if (!window.kakao?.maps) return

      window.kakao.maps.load(() => {
        const map = new window.kakao.maps.Map(mapRef.current!, {
          center: new window.kakao.maps.LatLng(MAP_CENTER.lat, MAP_CENTER.lng),
          level: 19 - MAP_ZOOM, // Kakao의 level은 Leaflet zoom과 반비례
        })

        infoWindow.current = new window.kakao.maps.InfoWindow({ zIndex: 1 })

        window.kakao.maps.event.addListener(map, 'click', (e: { latLng: KakaoLatLng }) => {
          onMapClick?.(e.latLng.getLat(), e.latLng.getLng())
        })

        mapInstance.current = map
      })
    }

    // kakao maps SDK 로드 대기
    const checkAndInit = () => {
      if (window.kakao?.maps) {
        initMap()
      } else {
        setTimeout(checkAndInit, 200)
      }
    }
    checkAndInit()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearMarkers = useCallback(() => {
    kakaoMarkers.current.forEach((m) => m.setMap(null))
    kakaoMarkers.current = []
  }, [])

  const clearPolylines = useCallback(() => {
    kakaoPolylines.current.forEach((p) => p.setMap(null))
    kakaoPolylines.current = []
  }, [])

  // 마커 렌더링
  useEffect(() => {
    if (!mapInstance.current || !window.kakao?.maps) return
    clearMarkers()

    const filtered = markers.filter((m) => {
      if (!filter.showAllMarkers && !filter.markerTypes.includes(m.type)) return false
      if (filter.showMaintenance && !m.isMaintenance) return false
      if (filter.showInterest && !m.isInterest) return false
      return true
    })

    filtered.forEach((m) => {
      const color = MARKER_COLORS[m.type]
      const svgMarker = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">
          <circle cx="14" cy="14" r="11" fill="${color}" stroke="white" stroke-width="2"/>
        </svg>
      `)}`

      const markerImage = new window.kakao.maps.MarkerImage(
        svgMarker,
        new window.kakao.maps.Size(28, 28)
      )

      const marker = new window.kakao.maps.Marker({
        map: mapInstance.current,
        position: new window.kakao.maps.LatLng(m.lat, m.lng),
        image: markerImage,
      })

      window.kakao.maps.event.addListener(marker, 'click', () => {
        infoWindow.current?.setContent(`
          <div style="padding:8px;min-width:180px;font-size:13px">
            <strong>${m.tag}</strong><br/>
            <span style="color:${color}">${m.type}</span>
            ${m.spec ? `<br/>규격: ${m.spec}` : ''}
            ${m.isMaintenance ? `<br/><span style="color:red">정비대상</span>` : ''}
            ${m.isInterest ? `<br/><span style="color:blue">관심구간</span>` : ''}
          </div>
        `)
        infoWindow.current?.open(mapInstance.current!, marker)
        onMarkerClick?.(m)
      })

      kakaoMarkers.current.push(marker)
    })
  }, [markers, filter, clearMarkers, onMarkerClick])

  // 배관 렌더링
  useEffect(() => {
    if (!mapInstance.current || !window.kakao?.maps) return
    clearPolylines()

    const filtered = pipes.filter((p) => {
      if (!filter.showAllPipes && filter.pipeCategories.length > 0 && p.category && !filter.pipeCategories.includes(p.category)) return false
      if (filter.showMaintenance && !p.isMaintenance) return false
      if (filter.showInterest && !p.isInterest) return false
      return true
    })

    filtered.forEach((p) => {
      const color = p.color || getPipeColorByAge(p.replacementYear)
      const polyline = new window.kakao.maps.Polyline({
        map: mapInstance.current,
        path: [
          new window.kakao.maps.LatLng(p.lat1, p.lng1),
          new window.kakao.maps.LatLng(p.lat2, p.lng2),
        ],
        strokeWeight: p.thickness * 3,
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeStyle: 'solid',
      })

      window.kakao.maps.event.addListener(polyline, 'click', () => {
        onPipeClick?.(p)
      })

      kakaoPolylines.current.push(polyline)
    })
  }, [pipes, filter, clearPolylines, onPipeClick])

  return <div ref={mapRef} className={`w-full h-full ${className}`} />
}
