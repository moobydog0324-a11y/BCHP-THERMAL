'use client'

import { useEffect, useRef, useCallback } from 'react'
import type {
  MapMarkerData,
  MapPipeData,
  MapFilter,
} from '@/lib/types/map'
import { MARKER_COLORS, getPipeColorByAge, MAP_CENTER, MAP_ZOOM } from '@/lib/types/map'

// Leaflet은 dynamic import로 처리 (SSR 방지)
let L: typeof import('leaflet') | null = null

interface LeafletPipeMapProps {
  markers: MapMarkerData[]
  pipes: MapPipeData[]
  filter: MapFilter
  onMarkerClick?: (marker: MapMarkerData) => void
  onPipeClick?: (pipe: MapPipeData) => void
  onMapClick?: (lat: number, lng: number) => void
  className?: string
}

export default function LeafletPipeMap({
  markers,
  pipes,
  filter,
  onMarkerClick,
  onPipeClick,
  onMapClick,
  className = '',
}: LeafletPipeMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)
  const pipeLayerRef = useRef<L.LayerGroup | null>(null)

  // 지도 초기화
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const initMap = async () => {
      L = await import('leaflet')

      const map = L.map(mapRef.current!, {
        center: [MAP_CENTER.lat, MAP_CENTER.lng],
        zoom: MAP_ZOOM,
        zoomControl: true,
      })

      // VWorld 타일 레이어
      const vworld = L.tileLayer(
        'https://api.vworld.kr/req/wmts/1.0.0/349B2D39-80FC-3FB6-8F41-3DECF991D306/Base/{z}/{y}/{x}.png',
        { attribution: '© VWorld', maxZoom: 19 }
      )

      const osm = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { attribution: '© OpenStreetMap', maxZoom: 19 }
      )

      const satellite = L.tileLayer(
        'https://api.vworld.kr/req/wmts/1.0.0/349B2D39-80FC-3FB6-8F41-3DECF991D306/Satellite/{z}/{y}/{x}.jpeg',
        { attribution: '© VWorld Satellite', maxZoom: 19 }
      )

      vworld.addTo(map)

      L.control.layers(
        { 'VWorld': vworld, 'OpenStreetMap': osm, '위성': satellite },
        {},
        { position: 'topright' }
      ).addTo(map)

      markerLayerRef.current = L.layerGroup().addTo(map)
      pipeLayerRef.current = L.layerGroup().addTo(map)

      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick?.(e.latlng.lat, e.latlng.lng)
      })

      mapInstance.current = map
    }

    initMap()

    return () => {
      mapInstance.current?.remove()
      mapInstance.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 마커 업데이트
  const updateMarkers = useCallback(() => {
    if (!L || !markerLayerRef.current) return
    markerLayerRef.current.clearLayers()

    const filtered = markers.filter((m) => {
      if (!filter.showAllMarkers && !filter.markerTypes.includes(m.type)) return false
      if (filter.showMaintenance && !m.isMaintenance) return false
      if (filter.showInterest && !m.isInterest) return false
      return true
    })

    filtered.forEach((m) => {
      const color = MARKER_COLORS[m.type]
      const icon = L!.divIcon({
        html: `<div style="
          width:24px;height:24px;border-radius:50%;
          background:${color};border:2px solid white;
          box-shadow:0 2px 6px rgba(0,0,0,0.3);
          ${m.isMaintenance ? 'animation:pulse 1.5s infinite;box-shadow:0 0 12px red;' : ''}
          ${m.isInterest ? 'box-shadow:0 0 12px #3498db;' : ''}
        "></div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      const marker = L!.marker([m.lat, m.lng], { icon }).addTo(markerLayerRef.current!)
      marker.bindPopup(`
        <div style="min-width:180px">
          <strong>${m.tag}</strong><br/>
          <span style="color:${color}">${m.type}</span>
          ${m.spec ? `<br/>규격: ${m.spec}` : ''}
          ${m.isMaintenance ? `<br/><span style="color:red">정비대상</span>: ${m.maintenanceNotes || ''}` : ''}
          ${m.isInterest ? `<br/><span style="color:blue">관심구간</span>: ${m.specialNotes || ''}` : ''}
        </div>
      `)
      marker.on('click', () => onMarkerClick?.(m))
    })
  }, [markers, filter, onMarkerClick])

  // 배관 업데이트
  const updatePipes = useCallback(() => {
    if (!L || !pipeLayerRef.current) return
    pipeLayerRef.current.clearLayers()

    const filtered = pipes.filter((p) => {
      if (!filter.showAllPipes && filter.pipeCategories.length > 0 && p.category && !filter.pipeCategories.includes(p.category)) return false
      if (filter.showMaintenance && !p.isMaintenance) return false
      if (filter.showInterest && !p.isInterest) return false
      return true
    })

    filtered.forEach((p) => {
      const color = p.color || getPipeColorByAge(p.replacementYear)
      const line = L!.polyline(
        [[p.lat1, p.lng1], [p.lat2, p.lng2]],
        {
          color,
          weight: p.thickness * 3,
          opacity: 0.8,
        }
      ).addTo(pipeLayerRef.current!)

      line.bindPopup(`
        <div style="min-width:180px">
          <strong>${p.tag}</strong><br/>
          ${p.spec ? `규격: ${p.spec}` : ''}
          ${p.category ? `<br/>분류: ${p.category}` : ''}
          ${p.replacementYear ? `<br/>교체년도: ${p.replacementYear}` : ''}
          ${p.isMaintenance ? `<br/><span style="color:red">정비대상</span>: ${p.maintenanceNotes || ''}` : ''}
          ${p.isInterest ? `<br/><span style="color:blue">관심구간</span>: ${p.specialNotes || ''}` : ''}
        </div>
      `)
      line.on('click', () => onPipeClick?.(p))
    })
  }, [pipes, filter, onPipeClick])

  useEffect(() => { updateMarkers() }, [updateMarkers])
  useEffect(() => { updatePipes() }, [updatePipes])

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }
      `}</style>
      <div ref={mapRef} className={`w-full h-full ${className}`} />
    </>
  )
}
