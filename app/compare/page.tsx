"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Activity, ArrowLeft, MapPin, Thermometer } from "lucide-react"

type ThermalImage = {
  image_id: number
  inspection_id: number
  image_url: string
  thumbnail_url: string
  capture_timestamp: string
  image_type: "thermal" | "real"
  section_category: string
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
  }
  has_metadata: boolean
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

  const sections: SectionCategory[] = [
    'A-1', 'A-2', 'B-1', 'B-2', 'C-1', 'C-2', 'D-1', 'D-2', 
    'E-1', 'E-2', 'F-1', 'F-2', 'G-1', 'G-2'
  ]

  const fetchSectionImages = React.useCallback(async () => {
    if (!selectedSection) return

    try {
      setLoading(true)
      setError("")
      
      const response = await fetch(`/api/thermal-images/by-section/${selectedSection}?image_type=thermal`)
      const result = await response.json()

      if (result.success) {
        const images = result.data as ThermalImage[]
        
        // GPS 좌표 기반으로 그룹핑 (소수점 4자리 = 약 11m 반경)
        const grouped: Record<string, ThermalImage[]> = {}
        
        images.forEach((img) => {
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
                    {selectedGroup && selectedGroup.images[0].temperature.range_max && (
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Thermometer className="h-4 w-4" />
                          카메라 측정 범위
                        </div>
                        <div className="text-lg font-semibold">
                          {selectedGroup.images[0].temperature.range_min} ~ {selectedGroup.images[0].temperature.range_max}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* 시계열 이미지 그리드 */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {selectedGroup?.images.map((img, idx) => (
                    <Card key={img.image_id} className="border-border bg-card p-4">
                      <div className="mb-2 flex items-start justify-between">
                        <div className="text-sm font-semibold text-primary">
                          #{idx + 1}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ID: {img.image_id}
                        </div>
                      </div>
                      
                      <div className="relative mb-3 aspect-video overflow-hidden rounded-lg bg-muted">
                        <Image
                          src={img.image_url}
                          alt={`열화상 이미지 ${img.image_id}`}
                          fill
                          className="object-cover"
                        />
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">촬영 시각</span>
                          <span className="font-medium">{formatDateTime(img.capture_timestamp)}</span>
                        </div>
                        {img.temperature.atmospheric && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">대기 온도</span>
                            <span className="font-medium">{img.temperature.atmospheric}</span>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
