'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import MapFilterPanel from './MapFilterPanel'
import type { MapMarkerData, MapPipeData, MapFilter, MapProviderType } from '@/lib/types/map'
import { DEFAULT_MAP_FILTER } from '@/lib/types/map'
import { Marker, BapPipe } from '@/lib/types/database'

const LeafletPipeMap = dynamic(() => import('./LeafletPipeMap'), { ssr: false })
const KakaoPipeMap = dynamic(() => import('./KakaoPipeMap'), { ssr: false })

interface PipeMapContainerProps {
  compact?: boolean
  className?: string
}

export default function PipeMapContainer({ compact = false, className = '' }: PipeMapContainerProps) {
  const [provider, setProvider] = useState<MapProviderType>('leaflet')
  const [markers, setMarkers] = useState<MapMarkerData[]>([])
  const [pipes, setPipes] = useState<MapPipeData[]>([])
  const [filter, setFilter] = useState<MapFilter>(DEFAULT_MAP_FILTER)
  const [search, setSearch] = useState('')
  const [showFilter, setShowFilter] = useState(!compact)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [markersRes, pipesRes] = await Promise.all([
        fetch('/api/markers'),
        fetch('/api/bap-pipes'),
      ])

      const markersData = await markersRes.json()
      const pipesData = await pipesRes.json()

      if (markersData.success) {
        setMarkers(
          markersData.data.map((m: Marker) => ({
            id: m.marker_id,
            tag: m.tag_number,
            lat: m.lat,
            lng: m.lng,
            type: m.marker_type,
            spec: m.spec,
            isMaintenance: m.is_maintenance,
            isInterest: m.is_interest,
            maintenanceNotes: m.maintenance_notes,
            specialNotes: m.special_notes,
            constructionHistory: m.construction_history,
            contactInfo: m.contact_info,
            navAddress: m.nav_address,
          }))
        )
      }

      if (pipesData.success) {
        setPipes(
          pipesData.data.map((p: BapPipe) => ({
            id: p.bap_pipe_id,
            tag: p.pipe_tag,
            lat1: p.lat1,
            lng1: p.lng1,
            lat2: p.lat2,
            lng2: p.lng2,
            color: p.color || '',
            thickness: p.thickness,
            spec: p.spec,
            depth: p.depth,
            category: p.category,
            culvert: p.culvert,
            isMaintenance: p.is_maintenance,
            isInterest: p.is_interest,
            maintenanceNotes: p.maintenance_notes,
            specialNotes: p.special_notes,
            replacementYear: p.replacement_year,
          }))
        )
      }
    } catch (error) {
      console.error('데이터 로드 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 검색 필터링
  const filteredMarkers = useMemo(() => {
    if (!search) return markers
    const q = search.toLowerCase()
    return markers.filter(
      (m) => m.tag.toLowerCase().includes(q) || m.type.includes(q)
    )
  }, [markers, search])

  const filteredPipes = useMemo(() => {
    if (!search) return pipes
    const q = search.toLowerCase()
    return pipes.filter(
      (p) => p.tag.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q))
    )
  }, [pipes, search])

  const MapComponent = provider === 'kakao' ? KakaoPipeMap : LeafletPipeMap

  return (
    <div className={`flex h-full ${className}`}>
      {/* 사이드바 */}
      {showFilter && (
        <div className="w-64 shrink-0 overflow-y-auto border-r border-border bg-background p-2">
          <div className="mb-3">
            <Input
              placeholder="마커/배관 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm"
            />
          </div>
          <MapFilterPanel filter={filter} onChange={setFilter} />
        </div>
      )}

      {/* 지도 영역 */}
      <div className="flex-1 flex flex-col">
        {/* 툴바 */}
        <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilter(!showFilter)}
          >
            {showFilter ? '필터 닫기' : '필터'}
          </Button>

          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            <Button
              variant={provider === 'leaflet' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setProvider('leaflet')}
              className="h-7 text-xs"
            >
              Leaflet
            </Button>
            <Button
              variant={provider === 'kakao' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setProvider('kakao')}
              className="h-7 text-xs"
            >
              Kakao
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {isLoading ? (
              <span>로딩 중...</span>
            ) : (
              <span>설비 {filteredMarkers.length}개 | 배관 {filteredPipes.length}개</span>
            )}
          </div>
        </div>

        {/* 지도 */}
        <div className="flex-1 relative">
          <MapComponent
            markers={filteredMarkers}
            pipes={filteredPipes}
            filter={filter}
          />
        </div>
      </div>
    </div>
  )
}
