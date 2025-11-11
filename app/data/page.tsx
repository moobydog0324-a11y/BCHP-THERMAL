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
  Calendar,
  Camera,
  Image as ImageIcon,
  Filter,
  X
} from "lucide-react"

type ThermalImage = {
  image_id: number
  inspection_id: number
  image_url: string
  thumbnail_url: string
  capture_timestamp: string
  image_type: "thermal" | "real"
  section_category: string
  camera_model: string
  image_width: number
  image_height: number
  file_size_bytes: string
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
    humidity: string | null
  }
  has_metadata: boolean
}

type SectionCategory = 'all' | 'A-1' | 'A-2' | 'B-1' | 'B-2' | 'C-1' | 'C-2' | 'D-1' | 'D-2' | 'E-1' | 'E-2' | 'F-1' | 'F-2' | 'G-1' | 'G-2'

export default function DataManagementPage() {
  const [images, setImages] = useState<ThermalImage[]>([])
  const [filteredImages, setFilteredImages] = useState<ThermalImage[]>([])
  const [selectedSection, setSelectedSection] = useState<SectionCategory>('all')
  const [selectedImage, setSelectedImage] = useState<ThermalImage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const sections: SectionCategory[] = [
    'all', 'A-1', 'A-2', 'B-1', 'B-2', 'C-1', 'C-2', 'D-1', 'D-2', 
    'E-1', 'E-2', 'F-1', 'F-2', 'G-1', 'G-2'
  ]

  useEffect(() => {
    fetchAllImages()
  }, [])

  useEffect(() => {
    if (selectedSection === 'all') {
      setFilteredImages(images)
    } else {
      setFilteredImages(images.filter(img => img.section_category === selectedSection))
    }
  }, [selectedSection, images])

  const fetchAllImages = async () => {
    try {
      setLoading(true)
      setError("")
      
      // 모든 구역의 이미지를 가져오기
      const allSections = ['A-1', 'A-2', 'B-1', 'B-2', 'C-1', 'C-2', 'D-1', 'D-2', 'E-1', 'E-2', 'F-1', 'F-2', 'G-1', 'G-2']
      const allImages: ThermalImage[] = []

      for (const section of allSections) {
        try {
          const response = await fetch(`/api/thermal-images/by-section/${section}?image_type=thermal`)
          const result = await response.json()
          
          if (result.success && result.data.length > 0) {
            allImages.push(...result.data)
          }
        } catch (err) {
          console.warn(`구역 ${section} 조회 오류:`, err)
        }
      }

      // 최신순 정렬
      allImages.sort((a, b) => 
        new Date(b.capture_timestamp).getTime() - new Date(a.capture_timestamp).getTime()
      )

      setImages(allImages)
    } catch (err) {
      setError("이미지를 불러오는 중 오류가 발생했습니다.")
      console.error(err)
    } finally {
      setLoading(false)
    }
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

  const formatFileSize = (bytes: string) => {
    const size = parseInt(bytes)
    return (size / 1024 / 1024).toFixed(2) + ' MB'
  }

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
                데이터 관리
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/compare">
              <Button variant="outline">
                📊 비교분석
              </Button>
            </Link>
            <Link href="/upload">
              <Button variant="default">
                ➕ 이미지 업로드
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        {/* 통계 및 필터 */}
        <div className="mb-6 space-y-4">
          {/* 통계 카드 */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <ImageIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">전체 이미지</p>
                  <p className="text-2xl font-bold text-card-foreground">{images.length}</p>
                </div>
              </div>
            </Card>

            <Card className="border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">GPS 정보 있음</p>
                  <p className="text-2xl font-bold text-card-foreground">
                    {images.filter(img => img.gps).length}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Thermometer className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">온도 정보 있음</p>
                  <p className="text-2xl font-bold text-card-foreground">
                    {images.filter(img => img.temperature.range_max).length}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                  <Filter className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">필터된 결과</p>
                  <p className="text-2xl font-bold text-card-foreground">{filteredImages.length}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* 구역 필터 */}
          <Card className="border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-card-foreground">구역 필터</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {sections.map((section) => (
                <Button
                  key={section}
                  variant={selectedSection === section ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedSection(section)}
                >
                  {section === 'all' ? '전체' : section}
                </Button>
              ))}
            </div>
          </Card>
        </div>

        {/* 이미지 그리드 */}
        {loading ? (
          <Card className="flex min-h-[400px] items-center justify-center border-border bg-card p-12">
            <div className="text-center">
              <div className="mb-4 text-4xl">⏳</div>
              <p className="text-muted-foreground">이미지를 불러오는 중...</p>
            </div>
          </Card>
        ) : error ? (
          <Card className="border-destructive bg-destructive/10 p-6">
            <p className="text-destructive">{error}</p>
          </Card>
        ) : filteredImages.length === 0 ? (
          <Card className="flex min-h-[400px] items-center justify-center border-border bg-card p-12">
            <div className="text-center">
              <div className="mb-4 text-6xl">📷</div>
              <h3 className="mb-2 text-xl font-semibold text-card-foreground">
                이미지가 없습니다
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                선택한 필터에 해당하는 이미지가 없습니다
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredImages.map((img) => (
              <Card 
                key={img.image_id} 
                className="group cursor-pointer overflow-hidden border-border bg-card transition-all hover:shadow-lg"
                onClick={() => setSelectedImage(img)}
              >
                {/* 이미지 */}
                <div className="relative aspect-video overflow-hidden bg-muted">
                  <Image
                    src={img.image_url}
                    alt={`열화상 이미지 ${img.image_id}`}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute left-2 top-2 rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
                    {img.section_category}
                  </div>
                </div>

                {/* 메타데이터 요약 */}
                <div className="p-4 space-y-3">
                  {/* ID 및 타임스탬프 */}
                  <div>
                    <div className="text-xs text-muted-foreground">ID: {img.image_id}</div>
                    <div className="flex items-center gap-1 text-sm font-medium text-card-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDateTime(img.capture_timestamp)}
                    </div>
                  </div>

                  {/* GPS */}
                  {img.gps && (
                    <div className="rounded-lg bg-muted/50 p-2">
                      <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        GPS 위치
                      </div>
                      <div className="text-xs font-mono">{img.gps.formatted}</div>
                      {img.gps.altitude && (
                        <div className="text-xs text-muted-foreground">고도: {img.gps.altitude}</div>
                      )}
                    </div>
                  )}

                  {/* 온도 */}
                  {img.temperature.range_max && (
                    <div className="rounded-lg bg-blue-500/5 p-2">
                      <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-blue-600">
                        <Thermometer className="h-3 w-3" />
                        온도 범위
                      </div>
                      <div className="text-sm font-semibold">
                        {img.temperature.range_min} ~ {img.temperature.range_max}
                      </div>
                      {img.temperature.atmospheric && (
                        <div className="text-xs text-muted-foreground">
                          대기: {img.temperature.atmospheric}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 카메라 */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Camera className="h-3 w-3" />
                      {img.camera_model}
                    </div>
                    <div>
                      {img.image_width}x{img.image_height}
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedImage(img)
                    }}
                  >
                    상세보기
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 상세 메타데이터 모달 */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <Card 
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto border-border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card p-4">
              <h2 className="text-xl font-bold text-card-foreground">
                이미지 상세 정보 (ID: {selectedImage.image_id})
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              {/* 이미지 */}
              <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                <Image
                  src={selectedImage.image_url}
                  alt={`열화상 이미지 ${selectedImage.image_id}`}
                  fill
                  className="object-contain"
                />
              </div>

              {/* 기본 정보 */}
              <div>
                <h3 className="mb-3 text-lg font-semibold text-card-foreground">📋 기본 정보</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <InfoItem label="이미지 ID" value={selectedImage.image_id.toString()} />
                  <InfoItem label="점검 ID" value={selectedImage.inspection_id.toString()} />
                  <InfoItem label="구역" value={selectedImage.section_category} />
                  <InfoItem label="촬영 시각" value={formatDateTime(selectedImage.capture_timestamp)} />
                  <InfoItem label="카메라" value={selectedImage.camera_model} />
                  <InfoItem label="해상도" value={`${selectedImage.image_width}x${selectedImage.image_height}`} />
                  <InfoItem label="파일 크기" value={formatFileSize(selectedImage.file_size_bytes)} />
                  <InfoItem label="이미지 타입" value={selectedImage.image_type} />
                </div>
              </div>

              {/* GPS 정보 */}
              {selectedImage.gps && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-card-foreground">
                    📍 GPS 위치 정보
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoItem label="위도" value={selectedImage.gps.latitude.toFixed(6)} />
                    <InfoItem label="경도" value={selectedImage.gps.longitude.toFixed(6)} />
                    <InfoItem 
                      label="좌표 표시" 
                      value={selectedImage.gps.formatted} 
                      className="md:col-span-2"
                    />
                    {selectedImage.gps.altitude && (
                      <InfoItem label="고도" value={selectedImage.gps.altitude} />
                    )}
                  </div>
                </div>
              )}

              {/* 온도 정보 */}
              {selectedImage.temperature.range_max && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-card-foreground">
                    🌡️ 온도 정보
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoItem label="최저 온도" value={selectedImage.temperature.range_min || 'N/A'} />
                    <InfoItem label="최고 온도" value={selectedImage.temperature.range_max || 'N/A'} />
                    <InfoItem label="대기 온도" value={selectedImage.temperature.atmospheric || 'N/A'} />
                    <InfoItem label="습도" value={selectedImage.temperature.humidity || 'N/A'} />
                  </div>
                </div>
              )}

              {/* 링크 */}
              <div className="flex gap-3">
                <Link href={selectedImage.image_url} target="_blank" className="flex-1">
                  <Button variant="outline" className="w-full">
                    🔗 원본 이미지 열기
                  </Button>
                </Link>
                <Link href={`/compare?section=${selectedImage.section_category}`} className="flex-1">
                  <Button variant="default" className="w-full">
                    📊 이 구역 비교분석
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function InfoItem({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-lg bg-muted/50 p-3 ${className}`}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm text-card-foreground">{value}</div>
    </div>
  )
}

