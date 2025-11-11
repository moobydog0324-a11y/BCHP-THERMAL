"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Activity, ArrowLeft, Thermometer, MapPin, Camera } from "lucide-react"

type ThermalImageWithMetadata = {
  image_id: number
  image_url: string
  capture_timestamp: string
  section_category: string
  thermal_data?: {
    Make?: string
    Model?: string
    CameraTemperatureRangeMax?: string
    CameraTemperatureRangeMin?: string
    AtmosphericTemperature?: string
    Emissivity?: number
    ObjectDistance?: string
    GPSPosition?: string
    DateTimeOriginal?: string
  }
}

export default function ThermalAnalysisPage() {
  const [images, setImages] = useState<ThermalImageWithMetadata[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchImagesWithMetadata()
  }, [])

  const fetchImagesWithMetadata = async () => {
    try {
      setLoading(true)
      // 메타데이터 포함해서 조회
      const response = await fetch("/api/thermal-images?with_metadata=true")
      if (response.ok) {
        const data = await response.json()
        // thermal_data_json을 thermal_data로 변환
        const processedImages = data.data.map((img: any) => ({
          ...img,
          thermal_data: img.thermal_data_json || null,
        }))
        setImages(processedImages)
      }
    } catch (error) {
      console.error("이미지 로드 오류:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">반월 열병합 열배관 관리시스템</h1>
              <p className="text-xs text-muted-foreground">온도 데이터 분석</p>
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
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-3xl font-bold text-foreground">
            🌡️ 열화상 온도 데이터 분석
          </h2>
          <p className="text-muted-foreground">
            ExifTool로 추출한 실제 온도 정보를 확인하세요
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <p className="text-muted-foreground">데이터를 불러오는 중...</p>
            </div>
          </div>
        ) : images.length === 0 ? (
          <Card className="flex min-h-[400px] items-center justify-center p-12">
            <div className="text-center">
              <Thermometer className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
              <h3 className="mb-2 text-xl font-semibold text-foreground">
                메타데이터가 있는 이미지가 없습니다
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                열화상 이미지를 업로드하면 자동으로 온도 데이터가 추출됩니다
              </p>
              <Link href="/upload">
                <Button>이미지 업로드하기</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {images.map((img) => (
              <Card key={img.image_id} className="overflow-hidden border-border bg-card">
                {/* 이미지 */}
                <div className="relative aspect-video bg-muted">
                  <Image
                    src={img.image_url}
                    alt={`Thermal image ${img.image_id}`}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute top-2 right-2 rounded-md bg-black/70 px-2 py-1 text-xs text-white">
                    {img.section_category || 'N/A'}
                  </div>
                </div>

                {/* 정보 */}
                <div className="p-4 space-y-3">
                  {/* 카메라 정보 */}
                  {img.thermal_data?.Model && (
                    <div className="flex items-center gap-2 text-sm">
                      <Camera className="h-4 w-4 text-primary" />
                      <span className="font-semibold">
                        {img.thermal_data.Make} {img.thermal_data.Model}
                      </span>
                    </div>
                  )}

                  {/* 온도 범위 */}
                  {img.thermal_data?.CameraTemperatureRangeMax && (
                    <div className="rounded-lg border border-orange-300 bg-orange-50 p-3">
                      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-orange-900">
                        <Thermometer className="h-4 w-4" />
                        측정 범위
                      </div>
                      <div className="text-xs text-orange-700">
                        {img.thermal_data.CameraTemperatureRangeMin} ~ {img.thermal_data.CameraTemperatureRangeMax}
                      </div>
                    </div>
                  )}

                  {/* 대기 온도 */}
                  {img.thermal_data?.AtmosphericTemperature && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">대기 온도</span>
                      <span className="font-semibold">{img.thermal_data.AtmosphericTemperature}</span>
                    </div>
                  )}

                  {/* GPS 위치 */}
                  {img.thermal_data?.GPSPosition && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span className="break-all">{img.thermal_data.GPSPosition}</span>
                    </div>
                  )}

                  {/* 촬영 시간 */}
                  <div className="text-xs text-muted-foreground">
                    {new Date(img.capture_timestamp).toLocaleString("ko-KR")}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

