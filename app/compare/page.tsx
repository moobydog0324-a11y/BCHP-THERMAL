"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Activity,
  ArrowLeft,
  MapPin,
  Thermometer,
  ChevronDown,
  ChevronUp,
  Search,
  Calendar,
  Split,
  LineChart as LineChartIcon,
  Maximize2
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts"

type ThermalImage = {
  image_id: number
  inspection_id: number
  image_url: string
  thumbnail_url: string
  capture_timestamp: string
  image_type: "thermal" | "real"
  section_category: string
  camera_model: string | null
  gps: {
    latitude: number
    longitude: number
    formatted: string
    altitude: string | null
  } | null
  temperature: {
    range_min: string | null
    range_max: string | null
    avg_temp: string | null
    actual_temp_stats?: {
      max_temp: number
    }
  }
}

type SectionCategory = 'A-1' | 'A-2' | 'B-1' | 'B-2' | 'C-1' | 'C-2' | 'D-1' | 'D-2' | 'E-1' | 'E-2' | 'F-1' | 'F-2' | 'G-1' | 'G-2'

// GPS 위치별 그룹
type LocationGroup = {
  id: string
  name: string
  latitude: number
  longitude: number
  images: ThermalImage[]
  avgMaxTemp: number // 그룹 내 평균 최고온도
  latestTemp: number // 가장 최근 온도
  trend: 'up' | 'down' | 'stable'
}

export default function ComparePage() {
  const [selectedSection, setSelectedSection] = useState<SectionCategory | null>(null)
  const [locationGroups, setLocationGroups] = useState<LocationGroup[]>([])
  const [selectedLocation, setSelectedLocation] = useState<LocationGroup | null>(null)
  const [loading, setLoading] = useState(false)
  const [compareImages, setCompareImages] = useState<ThermalImage[]>([]) // 비교할 이미지 2개

  const sections: SectionCategory[] = [
    'A-1', 'A-2', 'B-1', 'B-2', 'C-1', 'C-2', 'D-1', 'D-2',
    'E-1', 'E-2', 'F-1', 'F-2', 'G-1', 'G-2'
  ]

  // 구역 선택 시 데이터 로드
  useEffect(() => {
    if (selectedSection) {
      fetchSectionImages(selectedSection)
      setCompareImages([])
      setSelectedLocation(null)
    }
  }, [selectedSection])

  const fetchSectionImages = async (section: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/thermal-images/by-section/${section}?image_type=thermal`)
      const result = await res.json()

      if (result.success) {
        processLocationGroups(result.data)
      }
    } catch (error) {
      console.error("데이터 로드 실패:", error)
    } finally {
      setLoading(false)
    }
  }

  // GPS 좌표 기준으로 이미지 그룹화 (약 10m 반경)
  const processLocationGroups = (images: ThermalImage[]) => {
    const groups: LocationGroup[] = []

    // 온도 데이터가 있는 이미지만 처리 (GPS 필터 제거)
    const validImages = images.filter(img => img.temperature.actual_temp_stats?.max_temp)

    validImages.forEach(img => {
      if (img.gps) {
        // 기존 그룹 중 가까운 것 찾기 (대략 0.0001도 차이 ≈ 11m)
        const existingGroup = groups.find(g =>
          g.latitude !== 0 && // GPS 없는 그룹과 섞이지 않게
          Math.abs(g.latitude - img.gps!.latitude) < 0.0001 &&
          Math.abs(g.longitude - img.gps!.longitude) < 0.0001
        )

        if (existingGroup) {
          existingGroup.images.push(img)
        } else {
          groups.push({
            id: `loc-${groups.length}`,
            name: `위치 #${groups.length + 1}`,
            latitude: img.gps!.latitude,
            longitude: img.gps!.longitude,
            images: [img],
            avgMaxTemp: 0,
            latestTemp: 0,
            trend: 'stable'
          })
        }
      } else {
        // GPS가 없는 경우: '위치 정보 없음' 그룹으로 통합
        let noGpsGroup = groups.find(g => g.id === 'no-gps')
        if (!noGpsGroup) {
          noGpsGroup = {
            id: 'no-gps',
            name: '⚠️ 위치 정보 없음',
            latitude: 0,
            longitude: 0,
            images: [],
            avgMaxTemp: 0,
            latestTemp: 0,
            trend: 'stable'
          }
          groups.push(noGpsGroup)
        }
        noGpsGroup.images.push(img)
      }
    })

    // 그룹별 통계 계산 및 정렬
    groups.forEach(g => {
      // 날짜순 정렬 (과거 -> 현재)
      g.images.sort((a, b) => new Date(a.capture_timestamp).getTime() - new Date(b.capture_timestamp).getTime())

      const temps = g.images.map(i => i.temperature.actual_temp_stats!.max_temp)
      g.avgMaxTemp = temps.reduce((a, b) => a + b, 0) / temps.length
      g.latestTemp = temps[temps.length - 1]

      // 트렌드 계산 (최근 2개 비교)
      if (temps.length >= 2) {
        const last = temps[temps.length - 1]
        const prev = temps[temps.length - 2]
        if (last > prev + 1) g.trend = 'up'
        else if (last < prev - 1) g.trend = 'down'
        else g.trend = 'stable'
      }
    })

    setLocationGroups(groups)
  }

  // 차트 데이터 변환
  const getChartData = () => {
    if (!selectedLocation) return []
    return selectedLocation.images.map(img => ({
      date: new Date(img.capture_timestamp).toLocaleDateString(),
      fullDate: new Date(img.capture_timestamp).toLocaleString(),
      temp: img.temperature.actual_temp_stats?.max_temp,
      img: img
    }))
  }

  const handleImageSelect = (img: ThermalImage) => {
    if (compareImages.find(i => i.image_id === img.image_id)) {
      setCompareImages(prev => prev.filter(i => i.image_id !== img.image_id))
    } else {
      if (compareImages.length < 2) {
        setCompareImages(prev => [...prev, img])
      } else {
        // 이미 2개면 첫번째꺼 빼고 넣기
        setCompareImages(prev => [prev[1], img])
      }
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold">시계열 비교 분석</h1>
            </Link>

            <div className="flex gap-2">
              {/* 구역 선택 드롭다운 */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                {sections.map(section => (
                  <Button
                    key={section}
                    variant={selectedSection === section ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSection(section)}
                    className="whitespace-nowrap"
                  >
                    {section}구역
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        {!selectedSection ? (
          <div className="flex h-[60vh] flex-col items-center justify-center text-muted-foreground">
            <LineChartIcon className="mb-4 h-16 w-16 opacity-20" />
            <p className="text-lg">분석할 구역을 선택해주세요</p>
          </div>
        ) : loading ? (
          <div className="flex h-[60vh] items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : locationGroups.length === 0 ? (
          <div className="text-center py-20">
            <p>해당 구역에 GPS 정보가 있는 열화상 이미지가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* 좌측: 위치 목록 */}
            <div className="lg:col-span-1 space-y-4 h-[calc(100vh-140px)] overflow-y-auto pr-2">
              <h2 className="font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                분석 위치 선택 ({locationGroups.length})
              </h2>
              {locationGroups.map(group => (
                <Card
                  key={group.id}
                  className={`p-4 cursor-pointer transition-all hover:bg-accent ${selectedLocation?.id === group.id ? 'ring-2 ring-primary bg-accent' : ''
                    }`}
                  onClick={() => setSelectedLocation(group)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold">{group.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        데이터 {group.images.length}건
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${group.latestTemp >= 70 ? 'text-red-600' :
                        group.latestTemp >= 60 ? 'text-orange-600' :
                          group.latestTemp >= 40 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                        {group.latestTemp.toFixed(1)}°C
                      </div>
                      <div className="text-xs flex items-center justify-end gap-1">
                        {group.trend === 'up' && <span className="text-red-500">▲ 상승중</span>}
                        {group.trend === 'down' && <span className="text-blue-500">▼ 하락중</span>}
                        {group.trend === 'stable' && <span className="text-gray-500">- 안정적</span>}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* 우측: 상세 분석 & 차트 */}
            <div className="lg:col-span-2 space-y-6">
              {selectedLocation ? (
                <>
                  {/* 1. 트렌드 차트 */}
                  <Card className="p-6">
                    <div className="mb-4">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        온도 변화 추이
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedLocation.images[0].capture_timestamp.split('T')[0]} ~ {selectedLocation.images[selectedLocation.images.length - 1].capture_timestamp.split('T')[0]}
                      </p>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={getChartData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis domain={['auto', 'auto']} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload
                                return (
                                  <div className="bg-background border rounded p-2 shadow-lg text-xs">
                                    <p className="font-bold">{data.fullDate}</p>
                                    <p className="text-primary">최고 온도: {data.temp?.toFixed(1)}°C</p>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="temp"
                            stroke="#ea580c"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 8 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* 2. 비교 선택 영역 */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {compareImages.length === 2 ? (
                      // 비교 뷰
                      compareImages.map((img, idx) => (
                        <Card key={img.image_id} className={`p-4 border-2 ${idx === 0 ? 'border-blue-500' : 'border-red-500'}`}>
                          <div className="mb-2 font-bold flex justify-between">
                            <span>{idx === 0 ? '기준 시점 (과거)' : '비교 시점 (최근)'}</span>
                            <Button variant="ghost" size="sm" onClick={() => setCompareImages([])}><Split className="h-4 w-4" /></Button>
                          </div>
                          <div className="aspect-video relative bg-muted rounded overflow-hidden mb-2">
                            <Image src={img.image_url} alt="" fill className="object-cover" />
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>일시</span>
                              <span className="font-mono">{new Date(img.capture_timestamp).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                              <span>최고 온도</span>
                              <span className={idx === 0 ? 'text-blue-600' : 'text-red-600'}>
                                {img.temperature.actual_temp_stats?.max_temp.toFixed(1)}°C
                              </span>
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      // 선택 안내
                      <div className="col-span-2 bg-muted/30 border-dashed border-2 rounded-lg p-8 text-center text-muted-foreground">
                        <p>아래 목록에서 비교할 이미지 2개를 선택하세요 ({compareImages.length}/2)</p>
                      </div>
                    )}
                  </div>

                  {/* 3. 이미지 타임라인 목록 */}
                  <div className="space-y-2">
                    <h3 className="font-semibold">타임라인 ({selectedLocation.images.length})</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {selectedLocation.images.map(img => (
                        <Card
                          key={img.image_id}
                          className={`cursor-pointer overflow-hidden transition-all ${compareImages.find(i => i.image_id === img.image_id) ? 'ring-4 ring-primary' : 'hover:ring-2 hover:ring-muted'
                            }`}
                          onClick={() => handleImageSelect(img)}
                        >
                          <div className="aspect-square relative">
                            <Image src={img.thumbnail_url || img.image_url} alt="" fill className="object-cover" />
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] p-1 text-center truncate">
                              {new Date(img.capture_timestamp).toLocaleDateString()}
                            </div>
                            <div className="absolute top-1 right-1 bg-black/50 text-white text-xs px-1 rounded">
                              {img.temperature.actual_temp_stats?.max_temp.toFixed(1)}°C
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                  <MapPin className="h-16 w-16 mb-4" />
                  <p>좌측에서 분석할 위치를 선택하세요</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
