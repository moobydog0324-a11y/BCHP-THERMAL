"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Activity, ArrowLeft, MapPin, Calendar, Thermometer, Loader2 } from "lucide-react"

type SectionCategory = 'A-1' | 'A-2' | 'B-1' | 'B-2' | 'C-1' | 'C-2' | 'D-1' | 'D-2' | 'E-1' | 'E-2' | 'F-1' | 'F-2' | 'G-1' | 'G-2'

type GPSLocation = {
  section_category: string
  gps_latitude: string
  gps_longitude: string
  gps_position: string
  latitude_decimal: number
  longitude_decimal: number
  image_count: number
  first_capture: string
  last_capture: string
}

type ImageWithMetadata = {
  image_id: number
  image_url: string
  capture_timestamp: string
  thermal_data_json: any
}

export default function GPSComparePage() {
  const [selectedSection, setSelectedSection] = useState<SectionCategory | null>(null)
  const [locations, setLocations] = useState<GPSLocation[]>([])
  const [selectedLocation, setSelectedLocation] = useState<GPSLocation | null>(null)
  const [matchedImages, setMatchedImages] = useState<{ [date: string]: ImageWithMetadata[] }>({})
  const [loading, setLoading] = useState(false)
  const [comparing, setComparing] = useState(false)
  const [selectedDates, setSelectedDates] = useState<string[]>([])

  const sections: SectionCategory[] = [
    'A-1', 'A-2', 'B-1', 'B-2', 'C-1', 'C-2', 'D-1', 'D-2',
    'E-1', 'E-2', 'F-1', 'F-2', 'G-1', 'G-2'
  ]

  // 구역 선택 시 GPS 위치 목록 로드
  useEffect(() => {
    if (selectedSection) {
      fetchGPSLocations()
    }
  }, [selectedSection])

  const fetchGPSLocations = async () => {
    if (!selectedSection) return

    setLoading(true)
    try {
      const response = await fetch(`/api/thermal-images/by-gps-location?section=${selectedSection}`)
      const data = await response.json()
      
      if (data.success) {
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error("GPS 위치 로드 오류:", error)
    } finally {
      setLoading(false)
    }
  }

  const selectLocation = async (location: GPSLocation) => {
    setSelectedLocation(location)
    setComparing(true)
    setSelectedDates([])
    
    try {
      const response = await fetch('/api/thermal-images/by-gps-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: location.section_category,
          latitude: location.latitude_decimal,
          longitude: location.longitude_decimal,
          tolerance: 5, // 5미터 허용 오차
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        setMatchedImages(data.grouped_by_date || {})
      }
    } catch (error) {
      console.error("이미지 매칭 오류:", error)
    } finally {
      setComparing(false)
    }
  }

  const toggleDateSelection = (date: string) => {
    if (selectedDates.includes(date)) {
      setSelectedDates(selectedDates.filter(d => d !== date))
    } else {
      if (selectedDates.length < 2) {
        setSelectedDates([...selectedDates, date])
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">반월 열병합 열배관 관리시스템</h1>
              <p className="text-xs text-muted-foreground">GPS 기반 시계열 비교</p>
            </div>
          </Link>
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              홈으로
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-6 text-center">
          <h2 className="mb-2 text-3xl font-bold text-foreground">
            📍 GPS 위치 기반 시계열 비교
          </h2>
          <p className="text-muted-foreground">
            동일한 GPS 좌표에서 촬영된 이미지를 시간대별로 비교하세요
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link href="/compare">
              <Button variant="outline" size="sm">
                📊 일반 비교로 전환
              </Button>
            </Link>
            <Link href="/upload">
              <Button variant="outline" size="sm">
                ➕ 이미지 더 업로드
              </Button>
            </Link>
            <Link href="/thermal-analysis">
              <Button variant="outline" size="sm">
                🌡️ 온도 분석
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[300px,1fr]">
          {/* 좌측: 컨트롤 패널 */}
          <div className="space-y-4">
            {/* 1. 구역 선택 */}
            <Card className="border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold text-card-foreground">📍 1. 구역 선택</h3>
              <div className="grid grid-cols-4 gap-2">
                {sections.map((section) => (
                  <button
                    key={section}
                    onClick={() => {
                      setSelectedSection(section)
                      setSelectedLocation(null)
                      setMatchedImages({})
                    }}
                    className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all ${
                      selectedSection === section
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:border-primary/50"
                    }`}
                  >
                    {section}
                  </button>
                ))}
              </div>
            </Card>

            {/* 2. GPS 위치 목록 */}
            {selectedSection && (
              <Card className="border-border bg-card p-4">
                <h3 className="mb-3 text-sm font-semibold text-card-foreground">
                  📌 2. 촬영 위치 선택
                  {locations.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({locations.length}개 위치)
                    </span>
                  )}
                </h3>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : locations.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    GPS 정보가 있는 이미지가 없습니다
                  </div>
                ) : (
                  <div className="max-h-[500px] space-y-2 overflow-y-auto">
                    {locations.map((location, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectLocation(location)}
                        className={`w-full rounded-lg border-2 p-3 text-left text-sm transition-all ${
                          selectedLocation === location
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:border-primary/50"
                        }`}
                      >
                        <div className="mb-1 flex items-start gap-2">
                          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                          <div className="flex-1">
                            <div className="text-xs text-muted-foreground break-all">
                              {location.gps_position}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs">
                              <span className="rounded bg-primary/20 px-2 py-0.5 font-semibold">
                                {location.image_count}장
                              </span>
                              <span className="text-muted-foreground">
                                {new Date(location.first_capture).toLocaleDateString('ko-KR')} ~
                                {new Date(location.last_capture).toLocaleDateString('ko-KR')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* 3. 날짜 선택 */}
            {Object.keys(matchedImages).length > 0 && (
              <Card className="border-border bg-card p-4">
                <h3 className="mb-3 text-sm font-semibold text-card-foreground">
                  📅 3. 비교할 날짜 선택
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (최대 2개)
                  </span>
                </h3>
                <div className="space-y-2">
                  {Object.keys(matchedImages).sort().reverse().map((date) => (
                    <button
                      key={date}
                      onClick={() => toggleDateSelection(date)}
                      disabled={!selectedDates.includes(date) && selectedDates.length >= 2}
                      className={`flex w-full items-center justify-between rounded-lg border-2 px-3 py-2 text-left text-sm transition-all disabled:opacity-40 ${
                        selectedDates.includes(date)
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span className="font-medium">
                          {new Date(date).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {matchedImages[date].length}장
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* 우측: 비교 뷰 */}
          <div>
            {!selectedSection ? (
              <Card className="flex min-h-[600px] items-center justify-center p-12">
                <div className="text-center">
                  <div className="mb-4 text-6xl">📍</div>
                  <h3 className="mb-2 text-xl font-semibold">구역을 선택해주세요</h3>
                  <p className="text-sm text-muted-foreground">
                    좌측에서 비교하고 싶은 구역을 선택하세요
                  </p>
                </div>
              </Card>
            ) : !selectedLocation ? (
              <Card className="flex min-h-[600px] items-center justify-center p-12">
                <div className="text-center">
                  <div className="mb-4 text-6xl">📌</div>
                  <h3 className="mb-2 text-xl font-semibold">촬영 위치를 선택해주세요</h3>
                  <p className="text-sm text-muted-foreground">
                    좌측에서 비교할 GPS 위치를 선택하세요
                  </p>
                </div>
              </Card>
            ) : comparing ? (
              <Card className="flex min-h-[600px] items-center justify-center p-12">
                <div className="text-center">
                  <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
                  <h3 className="mb-2 text-xl font-semibold">이미지 매칭 중...</h3>
                  <p className="text-sm text-muted-foreground">
                    GPS 좌표가 일치하는 이미지를 찾고 있습니다
                  </p>
                </div>
              </Card>
            ) : selectedDates.length === 0 ? (
              <Card className="flex min-h-[600px] items-center justify-center p-12">
                <div className="text-center">
                  <div className="mb-4 text-6xl">📅</div>
                  <h3 className="mb-2 text-xl font-semibold">날짜를 선택해주세요</h3>
                  <p className="text-sm text-muted-foreground">
                    비교할 날짜를 2개까지 선택하세요<br />
                    (같은 위치에서 촬영된 이미지를 시간대별로 비교합니다)
                  </p>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {selectedDates.slice(0, 2).map((date, idx) => (
                  <Card key={date} className="border-border bg-card p-4">
                    <div className="mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">
                          {new Date(date).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {matchedImages[date].length}장
                        </span>
                      </div>
                      {idx === 0 && selectedDates.length === 2 && (
                        <div className="mt-1 text-xs text-primary">
                          ← 이전 촬영
                        </div>
                      )}
                      {idx === 1 && (
                        <div className="mt-1 text-xs text-green-600">
                          ← 최근 촬영
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {matchedImages[date].slice(0, 3).map((img) => (
                        <div key={img.image_id} className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
                          <Image
                            src={img.image_url}
                            alt={`Image ${img.image_id}`}
                            fill
                            className="object-contain transition-transform group-hover:scale-105"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <div className="text-xs text-white">
                              <div>{new Date(img.capture_timestamp).toLocaleTimeString('ko-KR')}</div>
                              {img.thermal_data_json?.AtmosphericTemperature && (
                                <div className="flex items-center gap-1">
                                  <Thermometer className="h-3 w-3" />
                                  {img.thermal_data_json.AtmosphericTemperature}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

