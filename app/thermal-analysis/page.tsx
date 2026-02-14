"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Activity, ArrowLeft, Image as ImageIcon, Thermometer, MapPin, Search } from "lucide-react"

type ThermalImageData = {
  image_id: number
  inspection_id: number
  image_url: string
  thumbnail_url: string
  camera_model: string
  capture_timestamp: string
  file_size_bytes: number
  image_type: string
  section_category: string
  metadata_json: any
  thermal_data_json: any
  temperature: {
    range_min?: number
    range_max?: number
    actual_temp_stats?: {
      max_temp: number
      min_temp: number
      mean_temp: number
    }
  }
}

// Helper to get max temp from various possible fields
const getMaxTemp = (img: ThermalImageData | any): number => {
  return img.actual_temp_stats?.max_temp
    ?? img.range_max
    ?? img.temperature?.actual_temp_stats?.max_temp
    ?? img.temperature?.range_max
    ?? 0
}

export default function ThermalAnalysisPage() {
  const router = useRouter()
  const [images, setImages] = useState<ThermalImageData[]>([])
  const [loading, setLoading] = useState(true)

  // 필터 관련
  const [filterType, setFilterType] = useState<"section" | "date" | "risk">("risk") // Default to Risk for dashboard feel
  const [selectedSection, setSelectedSection] = useState<string>("all")
  const [selectedDate, setSelectedDate] = useState<string>("all")

  // Daily Risk Analysis State
  const [riskData, setRiskData] = useState<{ date: string; topRisks: ThermalImageData[] }[]>([])

  // DB에서 이미지 목록 불러오기
  useEffect(() => {
    loadImages()
  }, [])

  // 이미지 클릭 → 상세 뷰어로 이동
  const openDetailViewer = (image: ThermalImageData) => {
    router.push(`/thermal-viewer?imageId=${image.image_id}`)
  }

  const loadImages = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/thermal-images?with_metadata=true")
      const data = await response.json()

      if (data.success) {
        setImages(data.data)
      }
    } catch (error) {
      console.error("이미지 로드 오류:", error)
    } finally {
      setLoading(false)
    }
  }

  // 날짜 추출 (YYYY-MM-DD 형식)
  const extractDate = (timestamp: string) => {
    return timestamp ? timestamp.split('T')[0] : ''
  }

  // 섹션 필터링
  const sections = Array.from(new Set(images.map(img => img.section_category).filter(Boolean)))

  // 날짜 필터링
  const dates = Array.from(new Set(images.map(img => extractDate(img.capture_timestamp)).filter(Boolean))).sort().reverse()

  // 일별 위험 분석 (최고 온도 상위 3개)
  const analyzeDailyRisks = () => {
    const dateGroups: { [key: string]: ThermalImageData[] } = {}

    // 날짜별 그룹화
    images.forEach(img => {
      const date = extractDate(img.capture_timestamp)
      // 온도 데이터 확인 (actual_temp_stats 또는 range_max)
      const maxTemp = getMaxTemp(img)

      if (date && maxTemp !== undefined) {
        if (!dateGroups[date]) {
          dateGroups[date] = []
        }
        dateGroups[date].push(img)
      }
    })

    const risks: { date: string; topRisks: ThermalImageData[] }[] = []

    Object.keys(dateGroups).sort().reverse().forEach(date => {
      const imgs = dateGroups[date]
      // 온도 내림차순 정렬
      imgs.sort((a, b) => getMaxTemp(b) - getMaxTemp(a))

      // 상위 3개 추출
      if (imgs.length > 0) {
        risks.push({
          date,
          topRisks: imgs.slice(0, 3)
        })
      }
    })

    return risks
  }

  // 데이터 로드 시 위험 분석 실행
  useEffect(() => {
    if (images.length > 0) {
      setRiskData(analyzeDailyRisks())
    }
  }, [images])

  // 현재 선택된 필터에 따라 이미지 필터링
  const filteredImages = (() => {
    if (filterType === "section") {
      return selectedSection === "all"
        ? images
        : images.filter(img => img.section_category === selectedSection)
    } else if (filterType === "date") {
      return selectedDate === "all"
        ? images
        : images.filter(img => extractDate(img.capture_timestamp) === selectedDate)
    } else {
      return []
    }
  })()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">반월 열병합 열배관 관리시스템</h1>
              <p className="text-xs text-muted-foreground">저장된 열화상 이미지 분석</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button onClick={loadImages} variant="outline" size="sm">
              새로고침
            </Button>
            <Link href="/">
              <Button variant="ghost" className="text-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" />
                홈으로
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-6 text-center">
          <h2 className="mb-2 text-3xl font-bold text-foreground">
            📊 DB 저장 열화상 이미지 분석
          </h2>
          <p className="text-muted-foreground">
            데이터베이스에 저장된 열화상 이미지와 메타데이터를 조회합니다
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="text-muted-foreground">이미지 목록을 불러오는 중...</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-7xl space-y-6">
            {/* 통계 */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <ImageIcon className="h-8 w-8 text-primary" />
                  <div>
                    <div className="text-sm text-muted-foreground">총 이미지</div>
                    <div className="text-2xl font-bold text-foreground">{images.length}개</div>
                  </div>
                </div>
              </Card>

              <Card className="border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <Thermometer className="h-8 w-8 text-orange-600" />
                  <div>
                    <div className="text-sm text-muted-foreground">열화상 이미지</div>
                    <div className="text-2xl font-bold text-foreground">
                      {images.filter(img => img.image_type === 'thermal').length}개
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <MapPin className="h-8 w-8 text-blue-600" />
                  <div>
                    <div className="text-sm text-muted-foreground">구간 수</div>
                    <div className="text-2xl font-bold text-foreground">{sections.length}개</div>
                  </div>
                </div>
              </Card>
            </div>

            {/* 필터 */}
            <Card className="border-border bg-card p-6">
              <div className="mb-4 text-lg font-semibold text-foreground">📊 데이터 필터</div>

              {/* 필터 타입 선택 */}
              <div className="mb-4 flex gap-2">
                <Button
                  variant={filterType === "risk" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFilterType("risk")
                    setSelectedSection("all")
                    setSelectedDate("all")
                  }}
                  className={filterType === "risk" ? "bg-red-600 hover:bg-red-700" : ""}
                >
                  🔥 일별 위험 분석
                </Button>
                <Button
                  variant={filterType === "section" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFilterType("section")
                    setSelectedDate("all")
                  }}
                >
                  📍 구간별
                </Button>
                <Button
                  variant={filterType === "date" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFilterType("date")
                    setSelectedSection("all")
                  }}
                >
                  📅 날짜별
                </Button>
              </div>

              {/* 구간별 필터 */}
              {filterType === "section" && (
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">구간 선택</div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedSection === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSection("all")}
                    >
                      전체 ({images.length})
                    </Button>
                    {sections.map((section) => (
                      <Button
                        key={section}
                        variant={selectedSection === section ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedSection(section)}
                      >
                        {section} ({images.filter(img => img.section_category === section).length})
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* 날짜별 필터 */}
              {filterType === "date" && (
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">날짜 선택</div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedDate === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDate("all")}
                    >
                      전체 ({images.length})
                    </Button>
                    {dates.map((date) => (
                      <Button
                        key={date}
                        variant={selectedDate === date ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedDate(date)}
                      >
                        {date} ({images.filter(img => extractDate(img.capture_timestamp) === date).length})
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* 위험 분석 설명 */}
              {filterType === "risk" && (
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    각 날짜별로 <span className="font-bold text-red-500">가장 온도가 높은 상위 3개</span> 지점을 추출하여 표시합니다.
                    배관 파열이나 열손실 의심 구간을 빠르게 식별할 수 있습니다.
                  </div>
                </div>
              )}
            </Card>

            {/* 위험 분석 결과 */}
            {filterType === "risk" && (
              <div className="space-y-8">
                {riskData.map((dayRisk) => (
                  <div key={dayRisk.date} className="space-y-4">
                    <h3 className="flex items-center gap-2 text-xl font-bold text-foreground border-b pb-2">
                      📅 {dayRisk.date}
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        최고 온도 Top 3
                      </span>
                    </h3>

                    <div className="grid gap-6 md:grid-cols-3">
                      {dayRisk.topRisks.map((img, index) => (
                        <Card
                          key={img.image_id}
                          className="overflow-hidden border-2 border-transparent hover:border-red-500 transition-all cursor-pointer shadow-md group"
                          onClick={() => openDetailViewer(img)}
                        >
                          <div className="relative aspect-video bg-muted">
                            <img
                              src={img.thumbnail_url || img.image_url}
                              alt={`Risk ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                            {/* 순위 뱃지 */}
                            <div className={`absolute top-2 left-2 flex h-8 w-8 items-center justify-center rounded-full text-white font-bold shadow-lg
                              ${index === 0 ? 'bg-red-600 ring-2 ring-red-300' : index === 1 ? 'bg-orange-500' : 'bg-yellow-500'}
                            `}>
                              {index + 1}
                            </div>

                            {/* 온도 뱃지 */}
                            <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-sm font-bold text-white backdrop-blur-sm">
                              {getMaxTemp(img).toFixed(1)}°C
                            </div>

                            {/* 호버 시 분석 아이콘 */}
                            <div className="absolute inset-0 bg-black/0 flex items-center justify-center transition-all group-hover:bg-black/20">
                              <div className="opacity-0 transform translate-y-4 transition-all group-hover:opacity-100 group-hover:translate-y-0 bg-white text-black px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2">
                                <Search className="h-4 w-4" /> 상세 분석
                              </div>
                            </div>
                          </div>

                          <div className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-lg text-foreground">
                                {img.section_category || '구역 미상'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(img.capture_timestamp).toLocaleTimeString()}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-red-600 font-semibold bg-red-50 p-2 rounded">
                              <Thermometer className="h-4 w-4" />
                              <span>최고: {getMaxTemp(img).toFixed(1)}°C</span>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}

                {riskData.length === 0 && (
                  <div className="text-center py-20 bg-muted/30 rounded-lg">
                    <Thermometer className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
                    <p className="text-muted-foreground">분석할 수 있는 온도 데이터가 없습니다.</p>
                  </div>
                )}
              </div>
            )}

            {/* 일반 목록 뷰 (구간/날짜 필터 시) */}
            {filterType !== "risk" && (
              <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
                {filteredImages.map((img) => (
                  <Card
                    key={img.image_id}
                    className="overflow-hidden border-2 border-transparent hover:border-primary transition-all cursor-pointer group"
                    onClick={() => openDetailViewer(img)}
                  >
                    <div className="relative aspect-video bg-muted">
                      <img
                        src={img.thumbnail_url || img.image_url}
                        alt={`Image ${img.image_id}`}
                        className="h-full w-full object-cover"
                      />
                      {/* 호버 시 분석 아이콘 */}
                      <div className="absolute inset-0 bg-black/0 flex items-center justify-center transition-all group-hover:bg-black/20">
                        <div className="opacity-0 transform translate-y-4 transition-all group-hover:opacity-100 group-hover:translate-y-0 bg-white text-black px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2">
                          <Search className="h-4 w-4" /> 상세 분석
                        </div>
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium text-foreground text-sm">Image {img.image_id}</div>
                        <div className="text-xs font-bold text-primary px-2 py-0.5 bg-primary/10 rounded">
                          {img.section_category}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(img.capture_timestamp).toLocaleString()}
                      </div>
                    </div>
                  </Card>
                ))}
                {filteredImages.length === 0 && (
                  <div className="col-span-full text-center py-10 text-muted-foreground">
                    검색 결과가 없습니다.
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  )
}
