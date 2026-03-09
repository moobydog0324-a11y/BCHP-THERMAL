"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, Square, Trash2, Loader2, AlertCircle } from 'lucide-react'

type ROI = {
  id: string
  name: string
  x1: number
  y1: number
  x2: number
  y2: number
  temperature?: {
    min: number
    max: number
    avg: number
    median: number
    std: number
    pixel_count: number
  }
  maxPos?: { x: number; y: number } // 최고 온도 위치 (비율 좌표 0~1)
  analyzing?: boolean
}

type TemperatureGrid = {
  data: Float32Array
  width: number
  height: number
}

type ThermalROIAnalyzerProps = {
  imageUrl: string
  imageId: number
  onClose: () => void
}

/**
 * gzip+base64로 압축된 온도 배열을 Float32Array로 디코딩
 */
async function decodeTemperatureGrid(
  base64Data: string,
  width: number,
  height: number,
): Promise<Float32Array> {
  // base64 → binary
  const binaryString = atob(base64Data)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  // gzip 해제 (DecompressionStream API)
  const ds = new DecompressionStream('gzip')
  const blob = new Blob([bytes])
  const decompressedStream = blob.stream().pipeThrough(ds)
  const decompressedBlob = await new Response(decompressedStream).arrayBuffer()

  // Float32Array로 변환
  const float32 = new Float32Array(decompressedBlob)

  if (float32.length !== width * height) {
    console.warn(
      `온도 배열 크기 불일치: 예상 ${width * height}, 실제 ${float32.length}`
    )
  }

  return float32
}

/**
 * ROI 영역의 온도 통계를 직접 계산
 */
function calculateROIStats(
  grid: TemperatureGrid,
  roiX1: number,
  roiY1: number,
  roiX2: number,
  roiY2: number
) {
  const { data, width, height } = grid

  // 비율 좌표를 픽셀 좌표로 변환
  let px1 = Math.floor(Math.min(roiX1, roiX2) * width)
  let py1 = Math.floor(Math.min(roiY1, roiY2) * height)
  let px2 = Math.floor(Math.max(roiX1, roiX2) * width)
  let py2 = Math.floor(Math.max(roiY1, roiY2) * height)

  // 경계 체크
  px1 = Math.max(0, Math.min(px1, width - 1))
  px2 = Math.max(0, Math.min(px2, width - 1))
  py1 = Math.max(0, Math.min(py1, height - 1))
  py2 = Math.max(0, Math.min(py2, height - 1))

  // ROI 영역의 온도값 수집
  const values: number[] = []
  let maxPixelX = px1
  let maxPixelY = py1
  let maxVal = -Infinity
  for (let y = py1; y <= py2; y++) {
    for (let x = px1; x <= px2; x++) {
      const v = data[y * width + x]
      values.push(v)
      if (v > maxVal) {
        maxVal = v
        maxPixelX = x
        maxPixelY = y
      }
    }
  }

  if (values.length === 0) return null

  // 통계 계산
  let min = Infinity
  let max = -Infinity
  let sum = 0
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }
  const avg = sum / values.length

  // 중앙값 계산
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]

  // 표준편차 계산
  let sumSqDiff = 0
  for (const v of values) {
    sumSqDiff += (v - avg) ** 2
  }
  const std = Math.sqrt(sumSqDiff / values.length)

  return {
    min: parseFloat(min.toFixed(2)),
    max: parseFloat(max.toFixed(2)),
    avg: parseFloat(avg.toFixed(2)),
    median: parseFloat(median.toFixed(2)),
    std: parseFloat(std.toFixed(2)),
    pixel_count: values.length,
    maxPos: { x: maxPixelX / width, y: maxPixelY / height }, // 비율 좌표
  }
}

export function ThermalROIAnalyzer({
  imageUrl,
  imageId,
  onClose,
}: ThermalROIAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rois, setRois] = useState<ROI[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentROI, setCurrentROI] = useState<{
    x1: number
    y1: number
  } | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  })
  const imageRef = useRef<HTMLImageElement | null>(null)

  // 온도 배열 데이터
  const [temperatureGrid, setTemperatureGrid] =
    useState<TemperatureGrid | null>(null)
  const [gridLoading, setGridLoading] = useState(true)
  const [gridError, setGridError] = useState<string | null>(null)

  // 온도 배열 로드
  useEffect(() => {
    const loadGrid = async () => {
      setGridLoading(true)
      setGridError(null)

      try {
        const res = await fetch(
          `/api/thermal-images/temperature-grid?image_id=${imageId}`
        )
        const result = await res.json()

        if (!result.success) {
          setGridError(result.error || '온도 데이터를 불러올 수 없습니다.')
          return
        }

        const { data, width, height } = result.temperature_grid
        const decoded = await decodeTemperatureGrid(data, width, height)

        setTemperatureGrid({ data: decoded, width, height })
        console.log(
          `✅ 온도 배열 로드 완료: ${width}x${height} (${decoded.length} pixels)`
        )
      } catch (err) {
        console.error('온도 배열 로드 실패:', err)
        setGridError('온도 데이터를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setGridLoading(false)
      }
    }

    loadGrid()
  }, [imageId])

  // Canvas 초기화 및 ROI 그리기
  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !imageRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = imageRef.current.clientWidth
    canvas.height = imageRef.current.clientHeight

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // ROI 그리기
    rois.forEach((roi) => {
      const x = roi.x1 * canvas.width
      const y = roi.y1 * canvas.height
      const width = (roi.x2 - roi.x1) * canvas.width
      const height = (roi.y2 - roi.y1) * canvas.height

      // 온도에 따른 색상
      let color = 'rgba(59, 130, 246, 0.3)'
      if (roi.temperature) {
        if (roi.temperature.max < 0) color = 'rgba(59, 130, 246, 0.3)'
        else if (roi.temperature.max < 40) color = 'rgba(34, 197, 94, 0.3)'
        else if (roi.temperature.max < 60) color = 'rgba(234, 179, 8, 0.3)'
        else if (roi.temperature.max < 70) color = 'rgba(249, 115, 22, 0.3)'
        else color = 'rgba(239, 68, 68, 0.3)'
      }

      ctx.fillStyle = color
      ctx.fillRect(x, y, width, height)

      ctx.strokeStyle = roi.analyzing
        ? 'rgba(234, 179, 8, 1)'
        : 'rgba(255, 255, 255, 0.8)'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, width, height)

      // 레이블
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(x, y - 20, 60, 20)
      ctx.fillStyle = 'white'
      ctx.font = '12px sans-serif'
      ctx.fillText(roi.name, x + 5, y - 6)

      // 🔴 최고 온도 지점 마커
      if (roi.maxPos && roi.temperature) {
        const mx = roi.maxPos.x * canvas.width
        const my = roi.maxPos.y * canvas.height
        const markerSize = 8

        // 십자가 마커
        ctx.strokeStyle = 'rgba(255, 50, 50, 1)'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(mx - markerSize, my)
        ctx.lineTo(mx + markerSize, my)
        ctx.moveTo(mx, my - markerSize)
        ctx.lineTo(mx, my + markerSize)
        ctx.stroke()

        // 마커 주변 원
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(mx, my, markerSize + 2, 0, Math.PI * 2)
        ctx.stroke()

        // 온도 레이블
        const tempLabel = `${roi.temperature.max.toFixed(1)}°C`
        ctx.font = 'bold 11px sans-serif'
        const labelWidth = ctx.measureText(tempLabel).width + 8
        const labelX = mx + markerSize + 4
        const labelY = my - 8
        ctx.fillStyle = 'rgba(220, 38, 38, 0.9)'
        ctx.beginPath()
        ctx.roundRect(labelX, labelY, labelWidth, 16, 3)
        ctx.fill()
        ctx.fillStyle = 'white'
        ctx.fillText(tempLabel, labelX + 4, labelY + 12)
      }
    })
  }, [rois, imageLoaded, imageDimensions])

  // 마우스 이벤트 핸들러
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!temperatureGrid) return // 온도 데이터 없으면 그리기 불가
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    setIsDrawing(true)
    setCurrentROI({ x1: x, y1: y })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentROI || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 기존 ROI 그리기
    rois.forEach((roi) => {
      const rx = roi.x1 * canvas.width
      const ry = roi.y1 * canvas.height
      const rw = (roi.x2 - roi.x1) * canvas.width
      const rh = (roi.y2 - roi.y1) * canvas.height

      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'
      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.lineWidth = 2
      ctx.strokeRect(rx, ry, rw, rh)
    })

    // 현재 그리는 중인 ROI
    const currentX = currentROI.x1 * canvas.width
    const currentY = currentROI.y1 * canvas.height
    const currentWidth = x * canvas.width - currentX
    const currentHeight = y * canvas.height - currentY

    ctx.fillStyle = 'rgba(234, 179, 8, 0.3)'
    ctx.fillRect(currentX, currentY, currentWidth, currentHeight)
    ctx.strokeStyle = 'rgba(234, 179, 8, 1)'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.strokeRect(currentX, currentY, currentWidth, currentHeight)
    ctx.setLineDash([])
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentROI || !canvasRef.current || !temperatureGrid)
      return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x2 = (e.clientX - rect.left) / rect.width
    const y2 = (e.clientY - rect.top) / rect.height

    setIsDrawing(false)

    // 최소 크기 체크
    if (
      Math.abs(x2 - currentROI.x1) < 0.02 ||
      Math.abs(y2 - currentROI.y1) < 0.02
    ) {
      setCurrentROI(null)
      return
    }

    // ROI 온도 직접 계산 (프론트엔드에서!)
    const stats = calculateROIStats(
      temperatureGrid,
      currentROI.x1,
      currentROI.y1,
      x2,
      y2
    )

    const newROI: ROI = {
      id: `Bx${rois.length + 1}`,
      name: `Bx${rois.length + 1}`,
      x1: Math.min(currentROI.x1, x2),
      y1: Math.min(currentROI.y1, y2),
      x2: Math.max(currentROI.x1, x2),
      y2: Math.max(currentROI.y1, y2),
      temperature: stats ? { min: stats.min, max: stats.max, avg: stats.avg, median: stats.median, std: stats.std, pixel_count: stats.pixel_count } : undefined,
      maxPos: stats?.maxPos,
      analyzing: false,
    }

    setRois([...rois, newROI])
    setCurrentROI(null)
  }

  // ROI 삭제
  const deleteROI = (id: string) => {
    setRois(rois.filter((roi) => roi.id !== id))
  }

  // 이미지 로드
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    imageRef.current = img
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
    setImageLoaded(true)
  }

  // 온도에 따른 색상 스타일
  const getTempColorClass = (temp: number) => {
    if (temp < 0) return 'text-blue-600 bg-blue-50 border-blue-200'
    if (temp < 40) return 'text-green-600 bg-green-50 border-green-200'
    if (temp < 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    if (temp < 70) return 'text-orange-600 bg-orange-50 border-orange-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <Card className="w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <Square className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">ROI 온도 분석</h3>
            {gridLoading ? (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                온도 데이터 로딩 중...
              </span>
            ) : gridError ? (
              <span className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {gridError}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                (마우스로 드래그하여 사각형 영역을 그리세요)
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 이미지 영역 */}
          <div className="flex-1 relative bg-muted flex items-center justify-center overflow-auto p-4">
            <div className="relative shadow-xl">
              <img
                src={imageUrl}
                alt="Thermal"
                onLoad={handleImageLoad}
                className="max-w-full max-h-[70vh] object-contain block"
              />

              {/* Canvas 오버레이 */}
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className={`absolute inset-0 w-full h-full ${temperatureGrid
                  ? 'cursor-crosshair'
                  : 'cursor-not-allowed opacity-50'
                  }`}
              />

              {/* 로딩 오버레이 */}
              {gridLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                  <div className="text-center text-white">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm">온도 데이터 로딩 중...</p>
                  </div>
                </div>
              )}

              {/* 에러 오버레이 */}
              {gridError && !gridLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                  <div className="text-center text-white max-w-xs">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
                    <p className="text-sm">{gridError}</p>
                    <p className="text-xs mt-1 opacity-70">
                      데이터 관리에서 &ldquo;온도 데이터 재추출&rdquo;을 실행한
                      후 다시 시도해주세요.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ROI 목록 */}
          <div className="w-80 border-l p-4 overflow-y-auto">
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">
                분석 영역 ({rois.length})
              </h4>
              {rois.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {temperatureGrid
                    ? '왼쪽 이미지에서 드래그하여 영역을 선택하세요'
                    : '온도 데이터를 먼저 로드해주세요'}
                </p>
              )}
            </div>

            {/* 온도 배열 정보 */}
            {temperatureGrid && (
              <div className="mb-4 p-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700">
                ✅ 온도 데이터 로드됨 ({temperatureGrid.width}×
                {temperatureGrid.height})
              </div>
            )}

            <div className="space-y-3">
              {rois.map((roi) => (
                <Card key={roi.id} className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-semibold text-sm">{roi.name}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteROI(roi.id)}
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {roi.analyzing && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>분석 중...</span>
                    </div>
                  )}

                  {roi.temperature && !roi.analyzing && (
                    <div className="space-y-2 text-xs">
                      <div
                        className={`flex justify-between p-2 rounded border ${getTempColorClass(roi.temperature.max)}`}
                      >
                        <span className="font-medium">최고:</span>
                        <span className="font-bold">
                          {roi.temperature.max.toFixed(2)}°C
                        </span>
                      </div>
                      <div
                        className={`flex justify-between p-2 rounded border ${getTempColorClass(roi.temperature.min)}`}
                      >
                        <span className="font-medium">최저:</span>
                        <span className="font-bold">
                          {roi.temperature.min.toFixed(2)}°C
                        </span>
                      </div>
                      <div
                        className={`flex justify-between p-2 rounded border ${getTempColorClass(roi.temperature.avg)}`}
                      >
                        <span className="font-medium">평균:</span>
                        <span className="font-bold">
                          {roi.temperature.avg.toFixed(2)}°C
                        </span>
                      </div>
                      <div className="flex justify-between p-2 rounded border bg-gray-50 border-gray-200">
                        <span className="font-medium">중앙값:</span>
                        <span>{roi.temperature.median.toFixed(2)}°C</span>
                      </div>
                      <div className="flex justify-between p-2 rounded border bg-gray-50 border-gray-200">
                        <span className="font-medium">픽셀 수:</span>
                        <span>
                          {roi.temperature.pixel_count.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}

                  {!roi.temperature && !roi.analyzing && (
                    <p className="text-xs text-muted-foreground">
                      온도 데이터 없음
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* 하단 액션 */}
        <div className="border-t p-4 flex justify-between">
          <Button variant="outline" onClick={() => setRois([])}>
            <Trash2 className="mr-2 h-4 w-4" />
            모두 삭제
          </Button>
          <Button onClick={onClose}>완료</Button>
        </div>
      </Card>
    </div>
  )
}
