'use client'

import { MapFilter, MarkerIconType, MARKER_COLORS } from '@/lib/types/map'

const MARKER_TYPES: MarkerIconType[] = ['맨홀', '밸브', '센서', '수용가', '레듀서', '기타']

interface MapFilterPanelProps {
  filter: MapFilter
  onChange: (filter: MapFilter) => void
}

export default function MapFilterPanel({ filter, onChange }: MapFilterPanelProps) {
  const toggleMarkerType = (type: MarkerIconType) => {
    const types = filter.markerTypes.includes(type)
      ? filter.markerTypes.filter((t) => t !== type)
      : [...filter.markerTypes, type]
    onChange({ ...filter, markerTypes: types, showAllMarkers: types.length === MARKER_TYPES.length })
  }

  return (
    <div className="space-y-4 p-4 bg-card rounded-lg border border-border">
      <h4 className="font-bold text-sm text-foreground">필터</h4>

      {/* 설비 유형 */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">설비 유형</p>
        <label className="flex items-center gap-2 mb-1 cursor-pointer">
          <input
            type="checkbox"
            checked={filter.showAllMarkers}
            onChange={() => {
              const all = !filter.showAllMarkers
              onChange({
                ...filter,
                showAllMarkers: all,
                markerTypes: all ? [...MARKER_TYPES] : [],
              })
            }}
            className="rounded"
          />
          <span className="text-xs">전체 선택</span>
        </label>
        {MARKER_TYPES.map((type) => (
          <label key={type} className="flex items-center gap-2 mb-1 cursor-pointer">
            <input
              type="checkbox"
              checked={filter.markerTypes.includes(type)}
              onChange={() => toggleMarkerType(type)}
              className="rounded"
            />
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: MARKER_COLORS[type] }}
            />
            <span className="text-xs">{type}</span>
          </label>
        ))}
      </div>

      {/* 상태 필터 */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">상태 필터</p>
        <label className="flex items-center gap-2 mb-1 cursor-pointer">
          <input
            type="checkbox"
            checked={filter.showMaintenance}
            onChange={() => onChange({ ...filter, showMaintenance: !filter.showMaintenance, showInterest: false })}
            className="rounded"
          />
          <span className="text-xs text-red-500 font-medium">정비대상만</span>
        </label>
        <label className="flex items-center gap-2 mb-1 cursor-pointer">
          <input
            type="checkbox"
            checked={filter.showInterest}
            onChange={() => onChange({ ...filter, showInterest: !filter.showInterest, showMaintenance: false })}
            className="rounded"
          />
          <span className="text-xs text-blue-500 font-medium">관심구간만</span>
        </label>
      </div>

      {/* 배관 표시 */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">배관</p>
        <label className="flex items-center gap-2 mb-1 cursor-pointer">
          <input
            type="checkbox"
            checked={filter.showAllPipes}
            onChange={() => onChange({ ...filter, showAllPipes: !filter.showAllPipes })}
            className="rounded"
          />
          <span className="text-xs">배관 표시</span>
        </label>
      </div>

      {/* 범례 */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">배관 연령 범례</p>
        {[
          { label: '10년 이내', color: '#2ecc71' },
          { label: '10~15년', color: '#f1c40f' },
          { label: '15~20년', color: '#f39c12' },
          { label: '20~30년', color: '#e74c3c' },
          { label: '30년 이상', color: '#8b0000' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 mb-1">
            <span className="inline-block w-4 h-2 rounded" style={{ backgroundColor: item.color }} />
            <span className="text-xs">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
