"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Activity, ArrowLeft, MapPin, Thermometer, ChevronDown, ChevronUp } from "lucide-react"

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
    atmospheric: string | null
    reflected: string | null
    humidity: string | null
  }
  weather_condition: string | null
  ambient_temp_celsius: number | null
  has_metadata: boolean
  metadata_json?: any
  thermal_data_json?: {
    actual_temp_stats?: {
      min_temp: number
      max_temp: number
      avg_temp: number
      median_temp: number
      pixel_count: number
    }
    [key: string]: any
  } | null
}

type SectionCategory = 'A-1' | 'A-2' | 'B-1' | 'B-2' | 'C-1' | 'C-2' | 'D-1' | 'D-2' | 'E-1' | 'E-2' | 'F-1' | 'F-2' | 'G-1' | 'G-2'

// GPS 위치별로 그룹핑
type GPSGroup = {
  gpsKey: string
  gpsFormatted: string
  images: ThermalImage[]
}

export default function ComparePage() {
  const [selectedSection, setSelectedSection] = useState<SectionCategory | null>(null)
  const [gpsGroups, setGpsGroups] = useState<GPSGroup[]>([])
  const [selectedGpsKey, setSelectedGpsKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [expandedMetadata, setExpandedMetadata] = useState<Record<number, boolean>>({})
  const [allImages, setAllImages] = useState<ThermalImage[]>([]) // 모든 이미지 (thermal + real)
  const [showingRealImage, setShowingRealImage] = useState<Record<number, boolean>>({}) // 실화상 표시 여부

  const sections: SectionCategory[] = [
    'A-1', 'A-2', 'B-1', 'B-2', 'C-1', 'C-2', 'D-1', 'D-2', 
    'E-1', 'E-2', 'F-1', 'F-2', 'G-1', 'G-2'
  ]

  // 열화상에 대응하는 실화상 찾기 (GPS + 시간 기준)
  const findMatchingRealImage = (thermalImage: ThermalImage): ThermalImage | null => {
    const realImages = allImages.filter(img => img.image_type === 'real')
    
    if (!thermalImage.gps) return null
    
    // 같은 GPS 위치 (소수점 4자리 = 약 11m 반경)
    const matchingByGPS = realImages.filter(img => {
      if (!img.gps) return false
      const latDiff = Math.abs(img.gps.latitude - thermalImage.gps!.latitude)
      const lonDiff = Math.abs(img.gps.longitude - thermalImage.gps!.longitude)
      return latDiff < 0.0001 && lonDiff < 0.0001 // 약 11m 이내
    })
    
    if (matchingByGPS.length === 0) return null
    
    // 같은 위치 중에서 시간이 가장 가까운 것 선택 (5분 이내)
    const thermalTime = new Date(thermalImage.capture_timestamp).getTime()
    const closest = matchingByGPS.reduce((prev, curr) => {
      const prevDiff = Math.abs(new Date(prev.capture_timestamp).getTime() - thermalTime)
      const currDiff = Math.abs(new Date(curr.capture_timestamp).getTime() - thermalTime)
      return currDiff < prevDiff ? curr : prev
    })
    
    const timeDiff = Math.abs(new Date(closest.capture_timestamp).getTime() - thermalTime)
    // 5분 이내 촬영된 것만 매칭으로 인정
    return timeDiff < 5 * 60 * 1000 ? closest : null
  }

  // 실화상 토글
  const toggleRealImage = (thermalImageId: number) => {
    setShowingRealImage(prev => ({
      ...prev,
      [thermalImageId]: !prev[thermalImageId]
    }))
  }

  const toggleMetadata = (imageId: number) => {
    setExpandedMetadata(prev => ({
      ...prev,
      [imageId]: !prev[imageId]
    }))
  }

  // 그룹 전체의 실제 온도 범위 계산
  const getGroupTemperatureRange = (images: ThermalImage[]) => {
    const temps = images
      .map(img => img.thermal_data_json?.actual_temp_stats)
      .filter(stats => stats != null)
    
    if (temps.length === 0) return null

    const allMinTemps = temps.map(t => t!.min_temp)
    const allMaxTemps = temps.map(t => t!.max_temp)
    
    return {
      min: Math.min(...allMinTemps),
      max: Math.max(...allMaxTemps),
      count: temps.length
    }
  }

  const fetchSectionImages = React.useCallback(async () => {
    if (!selectedSection) return

    try {
      setLoading(true)
      setError("")
      
      // 모든 이미지 타입 가져오기 (thermal + real)
      const response = await fetch(`/api/thermal-images/by-section/${selectedSection}`)
      const result = await response.json()

      if (result.success) {
        const fetchedImages = result.data as ThermalImage[]
        
        // 모든 이미지 저장 (실화상 매칭용)
        setAllImages(fetchedImages)
        
        // 열화상 이미지만 필터링 (기본 표시용)
        const thermalImages = fetchedImages.filter(img => img.image_type === 'thermal')
        
        // GPS 좌표 기반으로 그룹핑 (소수점 4자리 = 약 11m 반경)
        const grouped: Record<string, ThermalImage[]> = {}
        
        thermalImages.forEach((img) => {
          if (!img.gps) return
          
          const gpsKey = `${img.gps.latitude.toFixed(4)},${img.gps.longitude.toFixed(4)}`
          
          if (!grouped[gpsKey]) {
            grouped[gpsKey] = []
          }
          grouped[gpsKey].push(img)
        })

        // 각 GPS 그룹 내에서 시간순 정렬
        const groups: GPSGroup[] = Object.entries(grouped).map(([gpsKey, imgs]) => {
          const sortedImages = imgs.sort((a, b) => 
            new Date(a.capture_timestamp).getTime() - new Date(b.capture_timestamp).getTime()
          )
          
          return {
            gpsKey,
            gpsFormatted: imgs[0].gps?.formatted || gpsKey,
            images: sortedImages,
          }
        })

        // 이미지 개수가 많은 순으로 정렬
        groups.sort((a, b) => b.images.length - a.images.length)

        setGpsGroups(groups)
        setSelectedGpsKey(null)
      } else {
        setError(result.error || "이미지를 불러오는 데 실패했습니다.")
        setGpsGroups([])
      }
    } catch (err) {
      setError("서버와의 통신 중 오류가 발생했습니다.")
      setGpsGroups([])
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedSection])

  useEffect(() => {
    if (selectedSection) {
      fetchSectionImages()
    }
  }, [selectedSection, fetchSectionImages])

  const handleSectionSelect = (section: SectionCategory) => {
    setSelectedSection(section)
    setError("")
  }

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const selectedGroup = gpsGroups.find(g => g.gpsKey === selectedGpsKey)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-card-foreground">
                GPS 기반 시계열 비교
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/upload">
              <Button variant="default">
                ➕ 이미지 업로드
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* 좌측: 구역 및 GPS 위치 선택 */}
          <div className="space-y-6">
            {/* 구역 선택 */}
            <Card className="border-border bg-card p-4">
              <h2 className="mb-3 font-semibold text-card-foreground">📍 구역 선택</h2>
              <div className="grid grid-cols-2 gap-2">
                {sections.map((section) => (
                  <Button
                    key={section}
                    variant={selectedSection === section ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSectionSelect(section)}
                    className="w-full"
                  >
                    {section}
                  </Button>
                ))}
              </div>
            </Card>

            {/* GPS 위치 목록 */}
            {selectedSection && gpsGroups.length > 0 && (
              <Card className="border-border bg-card p-4">
                <h2 className="mb-3 font-semibold text-card-foreground">
                  <MapPin className="inline h-4 w-4" /> GPS 위치 ({gpsGroups.length}개)
                </h2>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {gpsGroups.map((group) => (
                    <Button
                      key={group.gpsKey}
                      variant={selectedGpsKey === group.gpsKey ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedGpsKey(group.gpsKey)}
                      className="w-full justify-start text-left"
                    >
                      <div className="w-full">
                        <div className="text-xs font-mono">{group.gpsFormatted}</div>
                        <div className="text-xs text-muted-foreground">
                          📷 {group.images.length}장 이미지
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* 우측: 시계열 이미지 표시 */}
          <div>
            {!selectedSection ? (
              <Card className="flex min-h-[600px] items-center justify-center border-border bg-card p-12">
                <div className="text-center">
                  <div className="mb-4 text-6xl">📍</div>
                  <h3 className="mb-2 text-xl font-semibold text-card-foreground">
                    구역을 선택해주세요
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    좌측에서 분석할 구역을 선택하세요
                  </p>
                </div>
              </Card>
            ) : loading ? (
              <Card className="flex min-h-[600px] items-center justify-center border-border bg-card p-12">
                <div className="text-center">
                  <div className="mb-4 text-4xl">⏳</div>
                  <p className="text-muted-foreground">이미지를 불러오는 중...</p>
                </div>
              </Card>
            ) : error ? (
              <Card className="border-destructive bg-destructive/10 p-6">
                <p className="text-destructive">{error}</p>
              </Card>
            ) : gpsGroups.length === 0 ? (
              <Card className="flex min-h-[600px] items-center justify-center border-border bg-card p-12">
                <div className="text-center">
                  <div className="mb-4 text-6xl">📷</div>
                  <h3 className="mb-2 text-xl font-semibold text-card-foreground">
                    이미지가 없습니다
                  </h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {selectedSection} 구역에 업로드된 열화상 이미지가 없습니다
                  </p>
                  <Link href="/upload">
                    <Button>이미지 업로드</Button>
                  </Link>
                </div>
              </Card>
            ) : !selectedGpsKey ? (
              <Card className="flex min-h-[600px] items-center justify-center border-border bg-card p-12">
                <div className="text-center">
                  <div className="mb-4 text-6xl">🗺️</div>
                  <h3 className="mb-2 text-xl font-semibold text-card-foreground">
                    GPS 위치를 선택해주세요
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    좌측에서 비교할 GPS 위치를 선택하세요
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* GPS 위치 정보 */}
                <Card className="border-border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-card-foreground">
                        <MapPin className="inline h-5 w-5" /> {selectedGroup?.gpsFormatted}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedGroup?.images.length}장의 시계열 이미지
                      </p>
                    </div>
                    {selectedGroup && (() => {
                      const groupTempRange = getGroupTemperatureRange(selectedGroup.images)
                      return groupTempRange ? (
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Thermometer className="h-4 w-4" />
                            실제 온도 범위 (전체 {groupTempRange.count}장)
                          </div>
                          <div className="text-lg font-semibold text-red-500">
                            {groupTempRange.min.toFixed(2)}°C ~ {groupTempRange.max.toFixed(2)}°C
                          </div>
                        </div>
                      ) : selectedGroup.images[0].temperature.range_max ? (
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Thermometer className="h-4 w-4" />
                            카메라 측정 범위
                          </div>
                          <div className="text-lg font-semibold">
                            {selectedGroup.images[0].temperature.range_min} ~ {selectedGroup.images[0].temperature.range_max}
                          </div>
                        </div>
                      ) : null
                    })()}
                  </div>
                </Card>

                {/* 시계열 이미지 그리드 */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {selectedGroup?.images.map((img, idx) => {
                    const matchingRealImage = findMatchingRealImage(img)
                    const isShowingReal = showingRealImage[img.image_id]
                    const displayImage = isShowingReal && matchingRealImage ? matchingRealImage : img
                    
                    return (
                    <Card key={img.image_id} className="border-border bg-card p-4">
                      <div className="mb-2 flex items-start justify-between">
                        <div className="text-sm font-semibold text-primary">
                          #{idx + 1}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ID: {displayImage.image_id}
                        </div>
                      </div>
                      
                      <div className="relative mb-3 aspect-video overflow-hidden rounded-lg bg-muted">
                        <Image
                          src={displayImage.image_url}
                          alt={`${isShowingReal ? '실화상' : '열화상'} 이미지 ${displayImage.image_id}`}
                          fill
                          className="object-cover"
                        />
                        {/* 이미지 타입 배지 */}
                        <div className={`absolute left-2 top-2 rounded px-2 py-1 text-xs font-semibold ${
                          isShowingReal ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {isShowingReal ? '📷 실화상' : '🌡️ 열화상'}
                        </div>
                      </div>

                      {/* 실화상 토글 버튼 */}
                      {matchingRealImage && (
                        <div className="mb-3">
                          <Button
                            variant={isShowingReal ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleRealImage(img.image_id)}
                            className="w-full"
                          >
                            {isShowingReal ? (
                              <>
                                🌡️ 열화상 보기
                              </>
                            ) : (
                              <>
                                📷 실화상 보기
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      <div className="space-y-1.5 text-xs">
                        {/* 촬영 시각 */}
                        <div className="flex justify-between border-b border-border pb-1">
                          <span className="text-muted-foreground">📅 촬영 시각</span>
                          <span className="font-medium">{formatDateTime(img.capture_timestamp)}</span>
                        </div>

                        {/* 카메라 모델 */}
                        {img.camera_model && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">📷 카메라</span>
                            <span className="font-medium text-xs">{img.camera_model}</span>
                          </div>
                        )}

                        {/* GPS 고도 */}
                        {img.gps?.altitude && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">📍 고도</span>
                            <span className="font-medium">{img.gps.altitude}</span>
                          </div>
                        )}

                        {/* 실제 입력한 주변 온도만 표시 */}
                        {img.ambient_temp_celsius !== null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">🌡️ 주변 온도</span>
                            <span className="font-medium">{img.ambient_temp_celsius}°C</span>
                          </div>
                        )}

                        {/* 날씨 */}
                        {img.weather_condition && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">☁️ 날씨</span>
                            <span className="font-medium">
                              {img.weather_condition === 'sunny' && '☀️ 맑음'}
                              {img.weather_condition === 'cloudy' && '☁️ 흐림'}
                              {img.weather_condition === 'rainy' && '🌧️ 비'}
                              {img.weather_condition === 'snowy' && '❄️ 눈'}
                              {!['sunny', 'cloudy', 'rainy', 'snowy'].includes(img.weather_condition) && img.weather_condition}
                            </span>
                          </div>
                        )}

                        {/* 메타데이터 상태 */}
                        <div className="mt-2 pt-1 border-t border-border">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">메타데이터</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${img.has_metadata ? 'text-green-500' : 'text-yellow-500'}`}>
                                {img.has_metadata ? '✅ 있음' : '⚠️ 없음'}
                              </span>
                              {img.has_metadata && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleMetadata(img.image_id)}
                                  className="h-6 px-2 text-xs"
                                >
                                  {expandedMetadata[img.image_id] ? (
                                    <>
                                      <ChevronUp className="h-3 w-3 mr-1" />
                                      접기
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3 mr-1" />
                                      상세보기
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 전체 메타데이터 표시 (펼쳤을 때) */}
                        {expandedMetadata[img.image_id] && img.has_metadata && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <div className="text-xs font-semibold text-primary mb-2">
                              📋 전체 메타데이터
                            </div>
                            
                            {/* 실제 온도 통계 (최우선 표시) */}
                            {img.thermal_data_json?.actual_temp_stats && (
                              <div className="mb-3">
                                <div className="text-xs font-medium text-card-foreground mb-1">
                                  🔥 실제 온도 (이미지 분석 결과):
                                </div>
                                <div className="bg-red-500/10 border border-red-500/20 rounded p-2 space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">🔥 최고 온도:</span>
                                    <span className="font-bold text-red-600">
                                      {img.thermal_data_json.actual_temp_stats.max_temp}°C
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">🧊 최저 온도:</span>
                                    <span className="font-bold text-blue-600">
                                      {img.thermal_data_json.actual_temp_stats.min_temp}°C
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">📊 평균 온도:</span>
                                    <span className="font-medium">
                                      {img.thermal_data_json.actual_temp_stats.avg_temp}°C
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">📈 중앙값:</span>
                                    <span className="font-medium">
                                      {img.thermal_data_json.actual_temp_stats.median_temp}°C
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs pt-1 border-t border-red-500/20">
                                    <span className="text-muted-foreground">픽셀 수:</span>
                                    <span className="font-medium">
                                      {img.thermal_data_json.actual_temp_stats.pixel_count.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 열화상 데이터 */}
                            {img.metadata_json && (
                              <div className="mb-3">
                                <div className="text-xs font-medium text-card-foreground mb-1">
                                  🔥 주요 열화상 정보:
                                </div>
                                <div className="bg-muted/50 rounded p-2 space-y-1 max-h-[200px] overflow-y-auto">
                                  {Object.entries(img.metadata_json)
                                    .filter(([key]) => {
                                      const k = key.toLowerCase()
                                      return k.includes('temp') || k.includes('thermal') || 
                                             k.includes('planck') || k.includes('emissivity') ||
                                             k.includes('humidity') || k.includes('atmospheric')
                                    })
                                    .map(([key, value]) => (
                                      <div key={key} className="flex justify-between text-xs">
                                        <span className="text-muted-foreground font-mono">{key}:</span>
                                        <span className="font-medium ml-2 text-right break-all">
                                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* GPS 데이터 */}
                            {img.metadata_json && (
                              <div className="mb-3">
                                <div className="text-xs font-medium text-card-foreground mb-1">
                                  📍 GPS 정보:
                                </div>
                                <div className="bg-muted/50 rounded p-2 space-y-1 max-h-[150px] overflow-y-auto">
                                  {Object.entries(img.metadata_json)
                                    .filter(([key]) => key.toLowerCase().includes('gps'))
                                    .map(([key, value]) => (
                                      <div key={key} className="flex justify-between text-xs">
                                        <span className="text-muted-foreground font-mono">{key}:</span>
                                        <span className="font-medium ml-2 text-right break-all">
                                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* 카메라 정보 */}
                            {img.metadata_json && (
                              <div className="mb-3">
                                <div className="text-xs font-medium text-card-foreground mb-1">
                                  📷 카메라 정보:
                                </div>
                                <div className="bg-muted/50 rounded p-2 space-y-1 max-h-[150px] overflow-y-auto">
                                  {Object.entries(img.metadata_json)
                                    .filter(([key]) => {
                                      const k = key.toLowerCase()
                                      return k.includes('camera') || k.includes('lens') || 
                                             k.includes('exposure') || k.includes('iso') ||
                                             k.includes('aperture') || k.includes('focal')
                                    })
                                    .map(([key, value]) => (
                                      <div key={key} className="flex justify-between text-xs">
                                        <span className="text-muted-foreground font-mono">{key}:</span>
                                        <span className="font-medium ml-2 text-right break-all">
                                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Raw Thermal Data */}
                            {img.thermal_data_json && (
                              <div>
                                <div className="text-xs font-medium text-card-foreground mb-1">
                                  🔬 Raw Thermal Data:
                                </div>
                                <div className="bg-muted/50 rounded p-2 space-y-1 max-h-[200px] overflow-y-auto">
                                  {Object.entries(img.thermal_data_json).map(([key, value]) => (
                                    <div key={key} className="flex justify-between text-xs">
                                      <span className="text-muted-foreground font-mono">{key}:</span>
                                      <span className="font-medium ml-2 text-right break-all">
                                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
