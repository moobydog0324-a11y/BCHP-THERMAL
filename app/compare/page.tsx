"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Activity,
  ArrowLeft,
  MapPin,
  Thermometer,
  Search,
  Calendar,
  Split,
  LineChart as LineChartIcon,
  BarChart2
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
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
    range_min?: number
    range_max?: number
    actual_temp_stats?: {
      max_temp: number
      min_temp?: number // Optional
      mean_temp?: number // Optional
    }
  }
}

// Helper
const getMaxTemp = (img: ThermalImage | any): number => {
  return img.actual_temp_stats?.max_temp
    ?? img.range_max
    ?? img.temperature?.actual_temp_stats?.max_temp
    ?? img.temperature?.range_max
    ?? 0
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

type CompareMode = 'trend' | 'date' | 'profile'

export default function ComparePage() {
  const router = useRouter()
  const [selectedSection, setSelectedSection] = useState<SectionCategory | null>(null)
  const [locationGroups, setLocationGroups] = useState<LocationGroup[]>([])
  const [selectedLocation, setSelectedLocation] = useState<LocationGroup | null>(null)
  const [loading, setLoading] = useState(false)
  const [compareImages, setCompareImages] = useState<ThermalImage[]>([]) // 비교할 이미지 2개

  // Mode State
  const [mode, setMode] = useState<CompareMode>('trend')
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [baseDate, setBaseDate] = useState<string>('')
  const [targetDate, setTargetDate] = useState<string>('')

  // Profile Mode States (For Sequential Analysis)
  const [selectedCompareDates, setSelectedCompareDates] = useState<string[]>([])

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
      setBaseDate('')
      setTargetDate('')
      setSelectedCompareDates([])
    }
  }, [selectedSection])

  // 데이터 로드 후 초기 모드 설정
  useEffect(() => {
    if (locationGroups.length > 0) {
      const isSeq = locationGroups[0].id.startsWith('seq-')
      // 데이터가 순차적이면 프로파일 모드, 아니면 트렌드 모드 기본
      setMode(isSeq ? 'profile' : 'trend')

      if (availableDates.length > 0) {
        // 프로파일용 기본 날짜 (최신 3개)
        setSelectedCompareDates(availableDates.slice(0, 3))
        // 날짜 비교용 기본 날짜 (가장 과거 vs 가장 최신)
        if (availableDates.length >= 2) {
          setBaseDate(availableDates[availableDates.length - 1]) // 가장 과거
          setTargetDate(availableDates[0]) // 가장 최신
        }
      }
    }
  }, [locationGroups, availableDates])

  const fetchSectionImages = async (section: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/thermal-images/by-section/${section}?image_type=thermal`)
      const result = await res.json()

      if (result.success) {
        processLocationGroups(result.data)
        extractAvailableDates(result.data)
      }
    } catch (error) {
      console.error("데이터 로드 실패:", error)
    } finally {
      setLoading(false)
    }
  }

  const extractAvailableDates = (images: ThermalImage[]) => {
    const dates = new Set(images.map(img => img.capture_timestamp.split('T')[0]))
    setAvailableDates(Array.from(dates).sort().reverse())
  }

  // GPS 좌표 기준으로 이미지 그룹화 (약 10m 반경)
  const processLocationGroups = (images: ThermalImage[]) => {
    const groups: LocationGroup[] = []

    // 온도 데이터가 있는 이미지만 처리
    const validImages = images.filter(img => getMaxTemp(img) > 0)
    const rawNoGpsImages: ThermalImage[] = []

    validImages.forEach(img => {
      if (img.gps) {
        const existingGroup = groups.find(g =>
          g.latitude !== 0 &&
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
        rawNoGpsImages.push(img)
      }
    })

    // GPS 없는 이미지 -> 순서 기반 그룹 생성
    if (rawNoGpsImages.length > 0) {
      const imagesByDate: { [date: string]: ThermalImage[] } = {}
      rawNoGpsImages.forEach(img => {
        const date = img.capture_timestamp.split('T')[0]
        if (!imagesByDate[date]) imagesByDate[date] = []
        imagesByDate[date].push(img)
      })

      Object.keys(imagesByDate).forEach(date => {
        imagesByDate[date].sort((a, b) => new Date(a.capture_timestamp).getTime() - new Date(b.capture_timestamp).getTime())
      })

      const maxSequence = Math.max(...Object.values(imagesByDate).map(imgs => imgs.length))

      for (let i = 0; i < maxSequence; i++) {
        const sequenceImages: ThermalImage[] = []
        Object.keys(imagesByDate).forEach(date => {
          if (imagesByDate[date][i]) {
            sequenceImages.push(imagesByDate[date][i])
          }
        })

        if (sequenceImages.length > 0) {
          groups.push({
            id: `seq-${i}`,
            name: `지점 #${i + 1}`,
            latitude: 0,
            longitude: 0,
            images: sequenceImages,
            avgMaxTemp: 0,
            latestTemp: 0,
            trend: 'stable'
          })
        }
      }
    }

    // 통계 계산
    groups.forEach(g => {
      g.images.sort((a, b) => new Date(a.capture_timestamp).getTime() - new Date(b.capture_timestamp).getTime())
      const temps = g.images.map(i => getMaxTemp(i))
      g.avgMaxTemp = temps.reduce((a, b) => a + b, 0) / temps.length
      g.latestTemp = temps[temps.length - 1]

      if (temps.length >= 2) {
        const last = temps[temps.length - 1]
        const prev = temps[temps.length - 2]
        if (last > prev + 1) g.trend = 'up'
        else if (last < prev - 1) g.trend = 'down'
        else g.trend = 'stable'
      }
    })

    groups.sort((a, b) => (a.id === 'no-gps' ? 1 : b.id === 'no-gps' ? -1 : 0))
    setLocationGroups(groups)
  }

  // 차트 데이터 (Trend Mode)
  const getChartData = () => {
    if (!selectedLocation) return []
    return selectedLocation.images.map(img => ({
      date: new Date(img.capture_timestamp).toLocaleDateString(),
      fullDate: new Date(img.capture_timestamp).toLocaleString(),
      temp: getMaxTemp(img),
      img: img
    }))
  }

  // 프로파일 차트 데이터 (Profile Mode)
  const getProfileChartData = () => {
    return locationGroups.map(group => {
      const pointName = group.name.replace('지점 #', '')
      const dataPoint: any = { name: pointName, fullGroup: group }

      selectedCompareDates.forEach(date => {
        const img = group.images.find(i => i.capture_timestamp.startsWith(date))
        if (img) {
          dataPoint[date] = getMaxTemp(img)
          dataPoint[`${date}_img`] = img
        }
      })
      return dataPoint
    })
  }

  const handleImageSelect = (img: ThermalImage) => {
    if (compareImages.find(i => i.image_id === img.image_id)) {
      setCompareImages(prev => prev.filter(i => i.image_id !== img.image_id))
    } else {
      if (compareImages.length < 2) {
        setCompareImages(prev => [...prev, img])
      } else {
        setCompareImages(prev => [prev[1], img])
      }
    }
  }

  const openDetailViewer = (imageId: number) => {
    router.push(`/thermal-viewer?imageId=${imageId}`)
  }

  // 날짜별 매칭 데이터 (Date Mode)
  const getDateMatchedGroups = () => {
    if (!baseDate || !targetDate) return []
    return locationGroups.filter(g => g.id !== 'no-gps').map(group => {
      const baseImg = group.images.find(img => img.capture_timestamp.startsWith(baseDate))
      const targetImg = group.images.find(img => img.capture_timestamp.startsWith(targetDate))
      return { group, baseImg, targetImg }
    }).filter(item => item.baseImg && item.targetImg)
  }

  const isSequential = locationGroups.length > 0 && locationGroups[0].id.startsWith('seq-')
  const chartColors = ['#ea580c', '#2563eb', '#16a34a', '#d946ef', '#f59e0b', '#06b6d4']

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 shrink-0 self-start lg:self-center">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold whitespace-nowrap">시계열 비교 분석</h1>
            </Link>

            <div className="flex flex-col md:flex-row gap-4 items-center w-full lg:w-auto overflow-hidden">
              {/* Mode Selection */}
              {selectedSection && (
                <div className="bg-muted p-1 rounded-lg flex text-sm font-medium shrink-0">
                  <button
                    onClick={() => setMode('trend')}
                    className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${mode === 'trend' ? 'bg-background shadow text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Activity className="h-4 w-4 inline-block mr-1" />트렌드(위치)
                  </button>
                  <button
                    onClick={() => setMode('date')}
                    className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${mode === 'date' ? 'bg-background shadow text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Calendar className="h-4 w-4 inline-block mr-1" />날짜별 비교
                  </button>
                  {isSequential && (
                    <button
                      onClick={() => setMode('profile')}
                      className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${mode === 'profile' ? 'bg-background shadow text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <BarChart2 className="h-4 w-4 inline-block mr-1" />프로파일
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 md:pb-0 no-scrollbar">
                {sections.map(section => (
                  <Button
                    key={section}
                    variant={selectedSection === section ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSection(section)}
                    className="whitespace-nowrap shrink-0"
                  >
                    {section}
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
            <p>해당 구역에 열화상 데이터가 없습니다.</p>
          </div>
        ) : (
          /* ================= CONTENT BASED ON MODE ================= */
          <>
            {/* PROFILE MODE */}
            {mode === 'profile' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-4">
                  <Card className="p-4 h-[calc(100vh-140px)] overflow-y-auto">
                    <h2 className="font-semibold flex items-center gap-2 mb-4">
                      <Calendar className="h-5 w-5" /> 비교 날짜 선택
                    </h2>
                    <div className="space-y-2">
                      {availableDates.map(date => {
                        const idx = selectedCompareDates.indexOf(date)
                        const isSelected = idx !== -1
                        return (
                          <div key={date} className="flex items-center space-x-2 p-2 hover:bg-accent rounded">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  if (selectedCompareDates.length >= 6) return alert("최대 6개까지만 비교 가능합니다.")
                                  setSelectedCompareDates([...selectedCompareDates, date])
                                } else {
                                  setSelectedCompareDates(selectedCompareDates.filter(d => d !== date))
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-primary"
                            />
                            <label className="text-sm cursor-pointer flex-1 font-medium flex items-center justify-between">
                              <span>{date}</span>
                              {isSelected && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: chartColors[idx % chartColors.length] }}></span>}
                            </label>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                </div>
                <div className="lg:col-span-3 space-y-6">
                  <Card className="p-6">
                    <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
                      <Activity className="h-5 w-5 text-primary" /> 온도 분포 프로파일
                    </h3>
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={getProfileChartData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" label={{ value: '지점', position: 'insideBottomRight', offset: -5 }} />
                          <YAxis label={{ value: '온도(°C)', angle: -90, position: 'insideLeft' }} />
                          <Tooltip />
                          <Legend />
                          {selectedCompareDates.map((date, idx) => (
                            <Line
                              key={date}
                              type="monotone"
                              dataKey={date}
                              stroke={chartColors[idx % chartColors.length]}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              activeDot={{ r: 6 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* TREND MODE */}
            {mode === 'trend' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-4 h-[calc(100vh-140px)] overflow-y-auto pr-2">
                  <h2 className="font-semibold flex items-center gap-2">
                    <MapPin className="h-5 w-5" /> 분석 위치 선택
                  </h2>
                  {locationGroups.map(group => (
                    <Card
                      key={group.id}
                      className={`p-4 cursor-pointer transition-all hover:bg-accent ${selectedLocation?.id === group.id ? 'ring-2 ring-primary bg-accent' : ''}`}
                      onClick={() => setSelectedLocation(group)}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-bold truncate" title={group.name}>{group.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1">데이터 {group.images.length}건</p>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${group.latestTemp >= 60 ? 'text-red-600' : 'text-green-600'}`}>
                            {group.latestTemp.toFixed(1)}°C
                          </div>
                          <div className="text-xs text-gray-500">
                            {group.trend === 'up' ? '▲ 상승' : group.trend === 'down' ? '▼ 하락' : '- 안정'}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                <div className="lg:col-span-3 space-y-6">
                  {selectedLocation ? (
                    <>
                      <Card className="p-6">
                        <div className="mb-4">
                          <h3 className="font-bold text-lg">온도 변화 추이</h3>
                        </div>
                        <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={getChartData()} onClick={(e) => {
                              if (e && e.activePayload) handleImageSelect(e.activePayload[0].payload.img)
                            }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <Tooltip />
                              <Line type="monotone" dataKey="temp" stroke="#ea580c" strokeWidth={2} activeDot={{ r: 8 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>

                      {/* 선택된 이미지 보기 */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {selectedLocation.images.map(img => (
                          <Card key={img.image_id}
                            className={`cursor-pointer overflow-hidden ${compareImages.find(i => i.image_id === img.image_id) ? 'ring-2 ring-primary' : ''}`}
                            onClick={() => handleImageSelect(img)}>
                            <div className="aspect-square relative">
                              <Image src={img.thumbnail_url || img.image_url} alt="" fill className="object-cover" />
                              <div className="absolute top-1 right-1 bg-black/50 text-white text-xs px-1 rounded">
                                {getMaxTemp(img).toFixed(1)}°C
                              </div>
                              <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] text-center p-1">
                                {new Date(img.capture_timestamp).toLocaleDateString()}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>

                      {/* 비교 영역 */}
                      {compareImages.length > 0 && (
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                          {compareImages.map((img, idx) => (
                            <Card key={img.image_id} className="p-3">
                              <div className="text-sm font-bold mb-2 flex justify-between">
                                <span>#{idx + 1} {new Date(img.capture_timestamp).toLocaleDateString()}</span>
                                <Button size="sm" variant="outline" onClick={() => openDetailViewer(img.image_id)}>
                                  <Search className="h-3 w-3 mr-1" /> 상세
                                </Button>
                              </div>
                              <div className="aspect-video relative bg-slate-100 mb-2">
                                <Image src={img.image_url} alt="" fill className="object-cover" />
                              </div>
                              <div className="text-right font-bold text-red-600">
                                {getMaxTemp(img).toFixed(1)}°C
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground opacity-50">
                      <p>좌측에서 위치를 선택하세요</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DATE MODE */}
            {mode === 'date' && (
              <div className="space-y-8">
                <Card className="p-6 bg-accent/20">
                  <div className="flex flex-col md:flex-row gap-6 items-end">
                    <div className="flex-1 space-y-2 w-full">
                      <label className="text-sm font-semibold">기준 날짜 (과거)</label>
                      <select className="w-full p-2 rounded-md border text-sm" value={baseDate} onChange={(e) => setBaseDate(e.target.value)}>
                        <option value="">날짜 선택</option>
                        {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 space-y-2 w-full">
                      <label className="text-sm font-semibold">비교 날짜 (최신)</label>
                      <select className="w-full p-2 rounded-md border text-sm" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}>
                        <option value="">날짜 선택</option>
                        {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {getDateMatchedGroups().map(({ group, baseImg, targetImg }) => {
                    const tempDiff = getMaxTemp(targetImg!) - getMaxTemp(baseImg!)
                    return (
                      <Card key={group.id} className="p-4 hover:shadow-lg transition-all">
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="font-bold">{group.name}</h3>
                          <div className={`text-sm font-bold px-2 py-1 rounded ${tempDiff > 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                            {tempDiff > 0 ? '▲' : '▼'} {Math.abs(tempDiff).toFixed(1)}°C
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">{baseDate}</div>
                            <div className="aspect-video relative bg-slate-100 rounded overflow-hidden cursor-pointer" onClick={() => openDetailViewer(baseImg!.image_id)}>
                              <Image src={baseImg!.thumbnail_url || baseImg!.image_url} alt="" fill className="object-cover" />
                            </div>
                            <div className="text-xs font-bold text-right">{getMaxTemp(baseImg!).toFixed(1)}°C</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">{targetDate}</div>
                            <div className="aspect-video relative bg-slate-100 rounded overflow-hidden cursor-pointer" onClick={() => openDetailViewer(targetImg!.image_id)}>
                              <Image src={targetImg!.thumbnail_url || targetImg!.image_url} alt="" fill className="object-cover" />
                            </div>
                            <div className="text-xs font-bold text-right">{getMaxTemp(targetImg!).toFixed(1)}°C</div>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
