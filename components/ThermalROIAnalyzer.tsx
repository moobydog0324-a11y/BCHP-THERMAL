"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, Square, Trash2, Loader2, AlertCircle, Pentagon, Pencil } from 'lucide-react'

// ─── 도형 타입 ───
type DrawTool = 'rect' | 'polygon' | 'freeform'

type ROI = {
  id: string
  name: string
  type: DrawTool
  // 사각형용
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  // 다각형/자유형용
  points?: { x: number; y: number }[]
  temperature?: {
    min: number
    max: number
    avg: number
    median: number
    std: number
    pixel_count: number
  }
  maxPos?: { x: number; y: number }
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

// ─── 유틸: gzip+base64 디코딩 ───
async function decodeTemperatureGrid(
  base64Data: string,
  width: number,
  height: number,
): Promise<Float32Array> {
  const binaryString = atob(base64Data)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  const ds = new DecompressionStream('gzip')
  const blob = new Blob([bytes])
  const decompressedStream = blob.stream().pipeThrough(ds)
  const decompressedBlob = await new Response(decompressedStream).arrayBuffer()

  const float32 = new Float32Array(decompressedBlob)

  if (float32.length !== width * height) {
    console.warn(
      `온도 배열 크기 불일치: 예상 ${width * height}, 실제 ${float32.length}`
    )
  }

  return float32
}

// ─── 유틸: Point-in-Polygon (Ray Casting Algorithm) ───
function isPointInPolygon(px: number, py: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y

    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

// ─── ROI 통계 계산: 사각형 ───
function calculateRectStats(
  grid: TemperatureGrid,
  roiX1: number, roiY1: number, roiX2: number, roiY2: number
) {
  const { data, width, height } = grid

  let px1 = Math.floor(Math.min(roiX1, roiX2) * width)
  let py1 = Math.floor(Math.min(roiY1, roiY2) * height)
  let px2 = Math.floor(Math.max(roiX1, roiX2) * width)
  let py2 = Math.floor(Math.max(roiY1, roiY2) * height)

  px1 = Math.max(0, Math.min(px1, width - 1))
  px2 = Math.max(0, Math.min(px2, width - 1))
  py1 = Math.max(0, Math.min(py1, height - 1))
  py2 = Math.max(0, Math.min(py2, height - 1))

  const values: number[] = []
  let maxPixelX = px1, maxPixelY = py1, maxVal = -Infinity
  for (let y = py1; y <= py2; y++) {
    for (let x = px1; x <= px2; x++) {
      const v = data[y * width + x]
      values.push(v)
      if (v > maxVal) { maxVal = v; maxPixelX = x; maxPixelY = y }
    }
  }

  return computeStats(values, maxPixelX, maxPixelY, width, height)
}

// ─── ROI 통계 계산: 다각형/자유형 ───
function calculatePolygonStats(
  grid: TemperatureGrid,
  points: { x: number; y: number }[]
) {
  const { data, width, height } = grid

  // 비율 좌표를 픽셀 좌표로 변환
  const pixelPoints = points.map(p => ({
    x: p.x * width,
    y: p.y * height,
  }))

  // 바운딩 박스 계산
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pixelPoints) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  minX = Math.max(0, Math.floor(minX))
  minY = Math.max(0, Math.floor(minY))
  maxX = Math.min(width - 1, Math.ceil(maxX))
  maxY = Math.min(height - 1, Math.ceil(maxY))

  const values: number[] = []
  let maxPixelX = minX, maxPixelY = minY, maxValFound = -Infinity

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (isPointInPolygon(x, y, pixelPoints)) {
        const v = data[y * width + x]
        values.push(v)
        if (v > maxValFound) { maxValFound = v; maxPixelX = x; maxPixelY = y }
      }
    }
  }

  return computeStats(values, maxPixelX, maxPixelY, width, height)
}

// ─── 공통 통계 연산 ───
function computeStats(
  values: number[],
  maxPixelX: number, maxPixelY: number,
  width: number, height: number
) {
  if (values.length === 0) return null

  let min = Infinity, max = -Infinity, sum = 0
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }
  const avg = sum / values.length

  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]

  let sumSqDiff = 0
  for (const v of values) sumSqDiff += (v - avg) ** 2
  const std = Math.sqrt(sumSqDiff / values.length)

  return {
    min: parseFloat(min.toFixed(2)),
    max: parseFloat(max.toFixed(2)),
    avg: parseFloat(avg.toFixed(2)),
    median: parseFloat(median.toFixed(2)),
    std: parseFloat(std.toFixed(2)),
    pixel_count: values.length,
    maxPos: { x: maxPixelX / width, y: maxPixelY / height },
  }
}

// ─── 도구 정보 ───
const TOOLS: { id: DrawTool; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'rect', label: '사각형', icon: <Square className="h-4 w-4" />, desc: '드래그하여 사각형 영역 선택' },
  { id: 'polygon', label: '다각형', icon: <Pentagon className="h-4 w-4" />, desc: '클릭으로 꼭짓점 추가, 더블클릭으로 완성' },
  { id: 'freeform', label: '자유형', icon: <Pencil className="h-4 w-4" />, desc: '드래그하여 자유롭게 영역 그리기' },
]

// ─── 메인 컴포넌트 ───
export function ThermalROIAnalyzer({ imageUrl, imageId, onClose }: ThermalROIAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rois, setRois] = useState<ROI[]>([])
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const imageRef = useRef<HTMLImageElement | null>(null)

  // 도구 선택
  const [activeTool, setActiveTool] = useState<DrawTool>('rect')

  // 사각형 그리기 상태
  const [isDrawingRect, setIsDrawingRect] = useState(false)
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null)

  // 다각형 그리기 상태
  const [polygonPoints, setPolygonPoints] = useState<{ x: number; y: number }[]>([])
  const [polygonPreviewPoint, setPolygonPreviewPoint] = useState<{ x: number; y: number } | null>(null)

  // 자유형 그리기 상태
  const [isDrawingFreeform, setIsDrawingFreeform] = useState(false)
  const [freeformPoints, setFreeformPoints] = useState<{ x: number; y: number }[]>([])

  // 온도 배열 데이터
  const [temperatureGrid, setTemperatureGrid] = useState<TemperatureGrid | null>(null)
  const [gridLoading, setGridLoading] = useState(true)
  const [gridError, setGridError] = useState<string | null>(null)

  // ─── 온도 배열 로드 ───
  useEffect(() => {
    const loadGrid = async () => {
      setGridLoading(true)
      setGridError(null)
      try {
        const res = await fetch(`/api/thermal-images/temperature-grid?image_id=${imageId}`)
        const result = await res.json()
        if (!result.success) {
          setGridError(result.error || '온도 데이터를 불러올 수 없습니다.')
          return
        }
        const { data, width, height } = result.temperature_grid
        const decoded = await decodeTemperatureGrid(data, width, height)
        setTemperatureGrid({ data: decoded, width, height })
        console.log(`✅ 온도 배열 로드 완료: ${width}x${height} (${decoded.length} pixels)`)
      } catch (err) {
        console.error('온도 배열 로드 실패:', err)
        setGridError('온도 데이터를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setGridLoading(false)
      }
    }
    loadGrid()
  }, [imageId])

  // ─── Canvas 렌더링 ───
  const redrawCanvas = useCallback(() => {
    if (!imageLoaded || !canvasRef.current || !imageRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = imageRef.current.clientWidth
    canvas.height = imageRef.current.clientHeight

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // ─── 저장된 ROI 그리기 ───
    rois.forEach((roi) => {
      if (roi.type === 'rect' && roi.x1 !== undefined && roi.y1 !== undefined && roi.x2 !== undefined && roi.y2 !== undefined) {
        drawRectROI(ctx, canvas, roi)
      } else if ((roi.type === 'polygon' || roi.type === 'freeform') && roi.points && roi.points.length >= 3) {
        drawPolygonROI(ctx, canvas, roi)
      }
    })

    // ─── 그리기 중인 다각형 미리보기 ───
    if (activeTool === 'polygon' && polygonPoints.length > 0) {
      ctx.strokeStyle = 'rgba(234, 179, 8, 1)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(polygonPoints[0].x * canvas.width, polygonPoints[0].y * canvas.height)
      for (let i = 1; i < polygonPoints.length; i++) {
        ctx.lineTo(polygonPoints[i].x * canvas.width, polygonPoints[i].y * canvas.height)
      }
      if (polygonPreviewPoint) {
        ctx.lineTo(polygonPreviewPoint.x * canvas.width, polygonPreviewPoint.y * canvas.height)
      }
      ctx.stroke()
      ctx.setLineDash([])

      // 꼭짓점 점 그리기
      polygonPoints.forEach((pt, idx) => {
        ctx.fillStyle = idx === 0 ? 'rgba(239, 68, 68, 1)' : 'rgba(234, 179, 8, 1)'
        ctx.beginPath()
        ctx.arc(pt.x * canvas.width, pt.y * canvas.height, idx === 0 ? 6 : 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 1.5
        ctx.stroke()
      })
    }

    // ─── 그리기 중인 자유형 미리보기 ───
    if (activeTool === 'freeform' && isDrawingFreeform && freeformPoints.length > 1) {
      ctx.strokeStyle = 'rgba(168, 85, 247, 1)'
      ctx.lineWidth = 2
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(freeformPoints[0].x * canvas.width, freeformPoints[0].y * canvas.height)
      for (let i = 1; i < freeformPoints.length; i++) {
        ctx.lineTo(freeformPoints[i].x * canvas.width, freeformPoints[i].y * canvas.height)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }
  }, [rois, imageLoaded, imageDimensions, polygonPoints, polygonPreviewPoint, activeTool, isDrawingFreeform, freeformPoints])

  // ─── ROI 사각형 그리기 ───
  function drawRectROI(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, roi: ROI) {
    const x = roi.x1! * canvas.width
    const y = roi.y1! * canvas.height
    const w = (roi.x2! - roi.x1!) * canvas.width
    const h = (roi.y2! - roi.y1!) * canvas.height

    let color = 'rgba(59, 130, 246, 0.3)'
    if (roi.temperature) {
      if (roi.temperature.max < 0) color = 'rgba(59, 130, 246, 0.3)'
      else if (roi.temperature.max < 40) color = 'rgba(34, 197, 94, 0.3)'
      else if (roi.temperature.max < 60) color = 'rgba(234, 179, 8, 0.3)'
      else if (roi.temperature.max < 70) color = 'rgba(249, 115, 22, 0.3)'
      else color = 'rgba(239, 68, 68, 0.3)'
    }

    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, h)

    // 레이블
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(x, y - 20, 60, 20)
    ctx.fillStyle = 'white'
    ctx.font = '12px sans-serif'
    ctx.fillText(roi.name, x + 5, y - 6)

    drawMaxTempMarker(ctx, canvas, roi)
  }

  // ─── ROI 다각형/자유형 그리기 ───
  function drawPolygonROI(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, roi: ROI) {
    const pts = roi.points!
    const canvasPts = pts.map(p => ({ x: p.x * canvas.width, y: p.y * canvas.height }))

    let color = 'rgba(168, 85, 247, 0.3)'
    if (roi.temperature) {
      if (roi.temperature.max < 0) color = 'rgba(59, 130, 246, 0.3)'
      else if (roi.temperature.max < 40) color = 'rgba(34, 197, 94, 0.3)'
      else if (roi.temperature.max < 60) color = 'rgba(234, 179, 8, 0.3)'
      else if (roi.temperature.max < 70) color = 'rgba(249, 115, 22, 0.3)'
      else color = 'rgba(239, 68, 68, 0.3)'
    }

    ctx.beginPath()
    ctx.moveTo(canvasPts[0].x, canvasPts[0].y)
    for (let i = 1; i < canvasPts.length; i++) {
      ctx.lineTo(canvasPts[i].x, canvasPts[i].y)
    }
    ctx.closePath()

    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.lineWidth = 2
    ctx.stroke()

    // 레이블 (첫 번째 점 근처)
    const labelX = canvasPts[0].x
    const labelY = canvasPts[0].y
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(labelX, labelY - 20, 60, 20)
    ctx.fillStyle = 'white'
    ctx.font = '12px sans-serif'
    ctx.fillText(roi.name, labelX + 5, labelY - 6)

    drawMaxTempMarker(ctx, canvas, roi)
  }

  // ─── 최고 온도 지점 마커 ───
  function drawMaxTempMarker(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, roi: ROI) {
    if (!roi.maxPos || !roi.temperature) return

    const mx = roi.maxPos.x * canvas.width
    const my = roi.maxPos.y * canvas.height
    const markerSize = 8

    ctx.strokeStyle = 'rgba(255, 50, 50, 1)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(mx - markerSize, my)
    ctx.lineTo(mx + markerSize, my)
    ctx.moveTo(mx, my - markerSize)
    ctx.lineTo(mx, my + markerSize)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(mx, my, markerSize + 2, 0, Math.PI * 2)
    ctx.stroke()

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

  useEffect(() => { redrawCanvas() }, [redrawCanvas])

  // ─── 좌표 변환 헬퍼 ───
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
  }

  // ─── ROI 생성 & 분석 ───
  const createROI = (type: DrawTool, extra: Partial<ROI>) => {
    if (!temperatureGrid) return

    let stats: ReturnType<typeof calculateRectStats> = null
    if (type === 'rect' && extra.x1 !== undefined && extra.y1 !== undefined && extra.x2 !== undefined && extra.y2 !== undefined) {
      stats = calculateRectStats(temperatureGrid, extra.x1, extra.y1, extra.x2, extra.y2)
    } else if ((type === 'polygon' || type === 'freeform') && extra.points && extra.points.length >= 3) {
      stats = calculatePolygonStats(temperatureGrid, extra.points)
    }

    const idx = rois.length + 1
    const prefix = type === 'rect' ? 'Bx' : type === 'polygon' ? 'Pg' : 'Fr'
    const newROI: ROI = {
      id: `${prefix}${idx}`,
      name: `${prefix}${idx}`,
      type,
      ...extra,
      temperature: stats ? {
        min: stats.min, max: stats.max, avg: stats.avg,
        median: stats.median, std: stats.std, pixel_count: stats.pixel_count
      } : undefined,
      maxPos: stats?.maxPos,
      analyzing: false,
    }

    setRois(prev => [...prev, newROI])
  }

  // ─── 마우스 이벤트: MouseDown ───
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!temperatureGrid) return
    const { x, y } = getCanvasCoords(e)

    if (activeTool === 'rect') {
      setIsDrawingRect(true)
      setRectStart({ x, y })
    } else if (activeTool === 'freeform') {
      setIsDrawingFreeform(true)
      setFreeformPoints([{ x, y }])
    }
  }

  // ─── 마우스 이벤트: MouseMove ───
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e)

    if (activeTool === 'rect' && isDrawingRect && rectStart && canvasRef.current) {
      // 사각형 미리보기
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      redrawCanvas()

      const currentX = rectStart.x * canvas.width
      const currentY = rectStart.y * canvas.height
      const currentWidth = x * canvas.width - currentX
      const currentHeight = y * canvas.height - currentY

      ctx.fillStyle = 'rgba(234, 179, 8, 0.3)'
      ctx.fillRect(currentX, currentY, currentWidth, currentHeight)
      ctx.strokeStyle = 'rgba(234, 179, 8, 1)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.strokeRect(currentX, currentY, currentWidth, currentHeight)
      ctx.setLineDash([])
    } else if (activeTool === 'polygon' && polygonPoints.length > 0) {
      setPolygonPreviewPoint({ x, y })
    } else if (activeTool === 'freeform' && isDrawingFreeform) {
      setFreeformPoints(prev => [...prev, { x, y }])
    }
  }

  // ─── 마우스 이벤트: MouseUp ───
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'rect' && isDrawingRect && rectStart && temperatureGrid) {
      const { x: x2, y: y2 } = getCanvasCoords(e)
      setIsDrawingRect(false)

      // 최소 크기 체크
      if (Math.abs(x2 - rectStart.x) < 0.02 || Math.abs(y2 - rectStart.y) < 0.02) {
        setRectStart(null)
        return
      }

      createROI('rect', {
        x1: Math.min(rectStart.x, x2),
        y1: Math.min(rectStart.y, y2),
        x2: Math.max(rectStart.x, x2),
        y2: Math.max(rectStart.y, y2),
      })
      setRectStart(null)
    } else if (activeTool === 'freeform' && isDrawingFreeform) {
      setIsDrawingFreeform(false)

      // 최소 포인트 체크 (충분한 포인트가 있어야 영역 인식)
      if (freeformPoints.length < 10) {
        setFreeformPoints([])
        return
      }

      // 포인트 간소화 (성능: 매 N번째 점만 사용)
      const step = Math.max(1, Math.floor(freeformPoints.length / 200))
      const simplified = freeformPoints.filter((_, i) => i % step === 0)

      createROI('freeform', { points: simplified })
      setFreeformPoints([])
    }
  }

  // ─── 마우스 이벤트: Click (다각형) ───
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'polygon' || !temperatureGrid) return

    const { x, y } = getCanvasCoords(e)

    // 시작점 근처 클릭 → 다각형 완성
    if (polygonPoints.length >= 3) {
      const first = polygonPoints[0]
      const dist = Math.sqrt((x - first.x) ** 2 + (y - first.y) ** 2)
      if (dist < 0.03) {
        createROI('polygon', { points: [...polygonPoints] })
        setPolygonPoints([])
        setPolygonPreviewPoint(null)
        return
      }
    }

    setPolygonPoints(prev => [...prev, { x, y }])
  }

  // ─── 마우스 이벤트: DoubleClick (다각형 완성) ───
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'polygon' || polygonPoints.length < 3 || !temperatureGrid) return

    e.preventDefault()
    createROI('polygon', { points: [...polygonPoints] })
    setPolygonPoints([])
    setPolygonPreviewPoint(null)
  }

  // ─── ROI 삭제 ───
  const deleteROI = (id: string) => {
    setRois(rois.filter((roi) => roi.id !== id))
  }

  // ─── 이미지 로드 ───
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    imageRef.current = img
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
    setImageLoaded(true)
  }

  // ─── 도구 변경 시 진행 중인 그리기 초기화 ───
  useEffect(() => {
    setIsDrawingRect(false)
    setRectStart(null)
    setPolygonPoints([])
    setPolygonPreviewPoint(null)
    setIsDrawingFreeform(false)
    setFreeformPoints([])
  }, [activeTool])

  // 온도에 따른 색상 스타일
  const getTempColorClass = (temp: number) => {
    if (temp < 0) return 'text-blue-600 bg-blue-50 border-blue-200'
    if (temp < 40) return 'text-green-600 bg-green-50 border-green-200'
    if (temp < 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    if (temp < 70) return 'text-orange-600 bg-orange-50 border-orange-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  // 타입 레이블
  const getTypeLabel = (type: DrawTool) => {
    if (type === 'rect') return '□ 사각형'
    if (type === 'polygon') return '⬠ 다각형'
    return '✏ 자유형'
  }

  // ─── 커서 스타일 ───
  const getCursor = () => {
    if (!temperatureGrid) return 'cursor-not-allowed'
    if (activeTool === 'rect' || activeTool === 'freeform') return 'cursor-crosshair'
    if (activeTool === 'polygon') return 'cursor-cell'
    return 'cursor-crosshair'
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
            ) : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 도구 선택 바 */}
        {temperatureGrid && !gridLoading && (
          <div className="flex items-center gap-2 border-b px-4 py-2 bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground mr-1">그리기 도구:</span>
            {TOOLS.map((tool) => (
              <Button
                key={tool.id}
                variant={activeTool === tool.id ? 'default' : 'outline'}
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setActiveTool(tool.id)}
                title={tool.desc}
              >
                {tool.icon}
                {tool.label}
              </Button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {TOOLS.find(t => t.id === activeTool)?.desc}
            </span>
          </div>
        )}

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
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                className={`absolute inset-0 w-full h-full ${getCursor()} ${!temperatureGrid ? 'opacity-50' : ''}`}
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
                      데이터 관리에서 &ldquo;온도 데이터 재추출&rdquo;을 실행한 후 다시 시도해주세요.
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
                    ? '왼쪽 이미지에서 영역을 선택하세요'
                    : '온도 데이터를 먼저 로드해주세요'}
                </p>
              )}
            </div>

            {/* 온도 배열 정보 */}
            {temperatureGrid && (
              <div className="mb-4 p-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700">
                ✅ 온도 데이터 로드됨 ({temperatureGrid.width}×{temperatureGrid.height})
              </div>
            )}

            <div className="space-y-3">
              {rois.map((roi) => (
                <Card key={roi.id} className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-sm">{roi.name}</div>
                      <div className="text-[10px] text-muted-foreground">{getTypeLabel(roi.type)}</div>
                    </div>
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRois([])}>
              <Trash2 className="mr-2 h-4 w-4" />
              모두 삭제
            </Button>
            {activeTool === 'polygon' && polygonPoints.length > 0 && (
              <Button variant="outline" onClick={() => { setPolygonPoints([]); setPolygonPreviewPoint(null) }}>
                <X className="mr-2 h-4 w-4" />
                그리기 취소
              </Button>
            )}
          </div>
          <Button onClick={onClose}>완료</Button>
        </div>
      </Card>
    </div>
  )
}
