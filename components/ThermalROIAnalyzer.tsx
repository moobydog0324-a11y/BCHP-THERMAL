"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, Square, Trash2, Download, Loader2 } from 'lucide-react'
import Image from 'next/image'

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
  analyzing?: boolean
}

type ThermalROIAnalyzerProps = {
  imageUrl: string
  imageId: number
  onClose: () => void
}

export function ThermalROIAnalyzer({ imageUrl, imageId, onClose }: ThermalROIAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rois, setRois] = useState<ROI[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentROI, setCurrentROI] = useState<{ x1: number; y1: number } | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const imageRef = useRef<HTMLImageElement | null>(null)

  // Canvas 초기화
  useEffect(() => {
    if (!imageLoaded || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 캔버스 크기 설정
    canvas.width = imageDimensions.width
    canvas.height = imageDimensions.height

    // 배경 이미지 그리기
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height)
    }

    // ROI 그리기
    rois.forEach((roi, index) => {
      const x = roi.x1 * canvas.width
      const y = roi.y1 * canvas.height
      const width = (roi.x2 - roi.x1) * canvas.width
      const height = (roi.y2 - roi.y1) * canvas.height

      // 온도에 따른 색상
      let color = 'rgba(59, 130, 246, 0.3)' // 기본 파란색
      if (roi.temperature) {
        if (roi.temperature.max < 0) color = 'rgba(59, 130, 246, 0.3)' // 파란색 (영하)
        else if (roi.temperature.max < 40) color = 'rgba(34, 197, 94, 0.3)' // 초록색
        else if (roi.temperature.max < 60) color = 'rgba(234, 179, 8, 0.3)' // 노란색
        else if (roi.temperature.max < 70) color = 'rgba(249, 115, 22, 0.3)' // 주황색
        else color = 'rgba(239, 68, 68, 0.3)' // 빨간색
      }

      // 사각형 채우기
      ctx.fillStyle = color
      ctx.fillRect(x, y, width, height)

      // 테두리
      ctx.strokeStyle = roi.analyzing ? 'rgba(234, 179, 8, 1)' : 'rgba(255, 255, 255, 0.8)'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, width, height)

      // 레이블
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(x, y - 20, 60, 20)
      ctx.fillStyle = 'white'
      ctx.font = '12px sans-serif'
      ctx.fillText(roi.name, x + 5, y - 6)
    })
  }, [rois, imageLoaded, imageDimensions])

  // 마우스 이벤트 핸들러
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
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

    // 다시 그리기
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height)
    }

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

  const handleMouseUp = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentROI || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x2 = (e.clientX - rect.left) / rect.width
    const y2 = (e.clientY - rect.top) / rect.height

    setIsDrawing(false)

    // 최소 크기 체크
    if (Math.abs(x2 - currentROI.x1) < 0.05 || Math.abs(y2 - currentROI.y1) < 0.05) {
      setCurrentROI(null)
      return
    }

    // 새 ROI 생성
    const newROI: ROI = {
      id: `Bx${rois.length + 1}`,
      name: `Bx${rois.length + 1}`,
      x1: Math.min(currentROI.x1, x2),
      y1: Math.min(currentROI.y1, y2),
      x2: Math.max(currentROI.x1, x2),
      y2: Math.max(currentROI.y1, y2),
      analyzing: true
    }

    setRois([...rois, newROI])
    setCurrentROI(null)

    // ROI 온도 분석
    await analyzeROI(newROI)
  }

  // ROI 온도 분석
  const analyzeROI = async (roi: ROI) => {
    try {
      // 원본 이미지 다운로드
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const file = new File([blob], `thermal_${imageId}.jpg`, { type: blob.type })

      // Flask 서버로 전송
      const formData = new FormData()
      formData.append('file', file)
      formData.append('x1', roi.x1.toString())
      formData.append('y1', roi.y1.toString())
      formData.append('x2', roi.x2.toString())
      formData.append('y2', roi.y2.toString())
      formData.append('name', roi.name)

      const flaskUrl = process.env.NEXT_PUBLIC_FLASK_URL || 'http://localhost:5001'
      const analysisResponse = await fetch(`${flaskUrl}/analyze-roi`, {
        method: 'POST',
        body: formData
      })

      const result = await analysisResponse.json()

      if (result.success && result.roi.temperature) {
        setRois(prevRois =>
          prevRois.map(r =>
            r.id === roi.id
              ? { ...r, temperature: result.roi.temperature, analyzing: false }
              : r
          )
        )
      } else {
        throw new Error(result.error || 'ROI 분석 실패')
      }
    } catch (error) {
      console.error('ROI 분석 오류:', error)
      // 분석 실패 표시
      setRois(prevRois =>
        prevRois.map(r =>
          r.id === roi.id ? { ...r, analyzing: false } : r
        )
      )
    }
  }

  // ROI 삭제
  const deleteROI = (id: string) => {
    setRois(rois.filter(roi => roi.id !== id))
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
            <span className="text-sm text-muted-foreground">
              (마우스로 드래그하여 사각형 영역을 그리세요)
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 이미지 영역 */}
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-auto">
            <div className="relative">
              {/* 숨겨진 이미지 (로드용) */}
              <img
                src={imageUrl}
                alt="Thermal"
                onLoad={handleImageLoad}
                style={{ display: 'none' }}
                crossOrigin="anonymous"
              />

              {/* Canvas */}
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="cursor-crosshair max-w-full max-h-full"
                style={{ maxHeight: '70vh' }}
              />
            </div>
          </div>

          {/* ROI 목록 */}
          <div className="w-80 border-l p-4 overflow-y-auto">
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">분석 영역 ({rois.length})</h4>
              {rois.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  왼쪽 이미지에서 드래그하여 영역을 선택하세요
                </p>
              )}
            </div>

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
                      <div className={`flex justify-between p-2 rounded border ${getTempColorClass(roi.temperature.max)}`}>
                        <span className="font-medium">최고:</span>
                        <span className="font-bold">{roi.temperature.max.toFixed(2)}°C</span>
                      </div>
                      <div className={`flex justify-between p-2 rounded border ${getTempColorClass(roi.temperature.min)}`}>
                        <span className="font-medium">최저:</span>
                        <span className="font-bold">{roi.temperature.min.toFixed(2)}°C</span>
                      </div>
                      <div className={`flex justify-between p-2 rounded border ${getTempColorClass(roi.temperature.avg)}`}>
                        <span className="font-medium">평균:</span>
                        <span className="font-bold">{roi.temperature.avg.toFixed(2)}°C</span>
                      </div>
                      <div className="flex justify-between p-2 rounded border bg-gray-50 border-gray-200">
                        <span className="font-medium">중앙값:</span>
                        <span>{roi.temperature.median.toFixed(2)}°C</span>
                      </div>
                      <div className="flex justify-between p-2 rounded border bg-gray-50 border-gray-200">
                        <span className="font-medium">픽셀 수:</span>
                        <span>{roi.temperature.pixel_count.toLocaleString()}</span>
                      </div>
                    </div>
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
          <Button onClick={onClose}>
            완료
          </Button>
        </div>
      </Card>
    </div>
  )
}



