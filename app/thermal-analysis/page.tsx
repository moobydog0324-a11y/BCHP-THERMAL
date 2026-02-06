"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Activity, ArrowLeft, Image as ImageIcon, Thermometer, MapPin, Calendar, X, Minus, Trash2, MousePointer2, Palette } from "lucide-react"

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
}

type ThermalResult = {
  success: boolean
  image?: string
  temperature_data?: number[]
  width?: number
  height?: number
  stats?: {
    min: number
    max: number
    mean: number
    median: number
    std: number
  }
  colormap?: string
  processing_time?: number
  error?: string
}

type Line = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  temps: number[]
  minTemp: number
  maxTemp: number
  avgTemp: number
  minPos: { x: number; y: number }
  maxPos: { x: number; y: number }
}

const COLORMAPS = [
  { value: "jet", label: "Jet (기본)", description: "파란색→빨간색" },
  { value: "hot", label: "Hot", description: "검은색→노란색→흰색" },
  { value: "cool", label: "Cool", description: "청록색→마젠타" },
  { value: "rainbow", label: "Rainbow", description: "무지개" },
  { value: "viridis", label: "Viridis", description: "보라색→노란색" },
  { value: "plasma", label: "Plasma", description: "보라색→핑크→노란색" },
  { value: "inferno", label: "Inferno", description: "검은색→빨간색→노란색" },
  { value: "turbo", label: "Turbo", description: "파란색→빨간색 (향상)" },
  { value: "seismic", label: "Seismic", description: "파란색→흰색→빨간색" },
  { value: "coolwarm", label: "Cool-Warm", description: "청록색→회색→빨간색" },
]

export default function ThermalAnalysisPage() {
  const [images, setImages] = useState<ThermalImageData[]>([])
  const [selectedImage, setSelectedImage] = useState<ThermalImageData | null>(null)
  const [loading, setLoading] = useState(true)

  // 필터 관련
  const [filterType, setFilterType] = useState<"section" | "date" | "compare">("section")
  const [selectedSection, setSelectedSection] = useState<string>("all")
  const [selectedDate, setSelectedDate] = useState<string>("all")
  const [compareMode, setCompareMode] = useState<"first" | "last" | "both">("both")

  // 전체 화면 분석 모드
  const [analysisMode, setAnalysisMode] = useState(false)
  const [analyzingImage, setAnalyzingImage] = useState<ThermalImageData | null>(null)
  const [thermalResult, setThermalResult] = useState<ThermalResult | null>(null)
  const [colormap, setColormap] = useState("jet")
  const [processingThermal, setProcessingThermal] = useState(false)

  // 라인 측정
  const [drawingMode, setDrawingMode] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentLine, setCurrentLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [mousePos, setMousePos] = useState<{ x: number; y: number; temp: number } | null>(null)
  const [clickedPos, setClickedPos] = useState<{ x: number; y: number; temp: number } | null>(null)

  // 최고/최저 온도 지점 표시
  const [showHotColdSpots, setShowHotColdSpots] = useState(true)
  const [hotSpot, setHotSpot] = useState<{ x: number; y: number; temp: number } | null>(null)
  const [coldSpot, setColdSpot] = useState<{ x: number; y: number; temp: number } | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // DB에서 이미지 목록 불러오기
  useEffect(() => {
    loadImages()
  }, [])

  // 이미지 클릭 → 분석 모드 진입
  const startAnalysis = async (image: ThermalImageData) => {
    console.log('🔍 이미지 분석 시작:', image.image_id)

    setAnalyzingImage(image)
    setAnalysisMode(true)
    setProcessingThermal(true)
    setThermalResult(null)
    setLines([])
    setClickedPos(null)
    setDrawingMode(false)

    try {
      // 1. 이미지 URL에서 파일 다운로드
      console.log('📥 이미지 다운로드 중:', image.image_url)
      const imageResponse = await fetch(image.image_url)
      const imageBlob = await imageResponse.blob()
      const file = new File([imageBlob], `image_${image.image_id}.jpg`, { type: 'image/jpeg' })
      console.log('✅ 이미지 다운로드 완료:', file.size, 'bytes')

      // 2. Flask 서버에 전달하여 열화상 생성
      console.log('🔥 Flask 서버로 전송 중...')
      const formData = new FormData()
      formData.append("file", file)
      formData.append("colormap", colormap)

      const flaskResponse = await fetch("http://localhost:5001/generate-thermal-image", {
        method: "POST",
        body: formData,
      })

      if (!flaskResponse.ok) {
        throw new Error(`Flask 서버 오류: ${flaskResponse.status}`)
      }

      const thermalData = await flaskResponse.json()
      console.log('✅ 열화상 생성 완료:', thermalData.success, thermalData.width, 'x', thermalData.height)

      if (thermalData.image) {
        console.log('📸 이미지 데이터 길이:', thermalData.image.length)
      }

      setThermalResult(thermalData)
    } catch (error) {
      console.error('❌ 열화상 생성 오류:', error)
      setThermalResult({
        success: false,
        error: error instanceof Error ? error.message : "열화상 이미지를 생성할 수 없습니다.",
      })
    } finally {
      setProcessingThermal(false)
    }
  }

  // 분석 모드 종료
  const closeAnalysis = () => {
    setAnalysisMode(false)
    setAnalyzingImage(null)
    setThermalResult(null)
    setLines([])
    setClickedPos(null)
    setDrawingMode(false)
    setHotSpot(null)
    setColdSpot(null)
  }

  // 최고/최저 온도 지점 찾기
  const findHotColdSpots = () => {
    if (!thermalResult?.temperature_data || !thermalResult.width || !thermalResult.height) return

    const tempData = thermalResult.temperature_data
    let maxTemp = -Infinity
    let minTemp = Infinity
    let maxIndex = 0
    let minIndex = 0

    for (let i = 0; i < tempData.length; i++) {
      if (tempData[i] > maxTemp) {
        maxTemp = tempData[i]
        maxIndex = i
      }
      if (tempData[i] < minTemp) {
        minTemp = tempData[i]
        minIndex = i
      }
    }

    const hotX = maxIndex % thermalResult.width
    const hotY = Math.floor(maxIndex / thermalResult.width)
    const coldX = minIndex % thermalResult.width
    const coldY = Math.floor(minIndex / thermalResult.width)

    setHotSpot({ x: hotX, y: hotY, temp: maxTemp })
    setColdSpot({ x: coldX, y: coldY, temp: minTemp })

    console.log('🔥 최고 온도 지점:', hotX, hotY, maxTemp.toFixed(2) + '°C')
    console.log('❄️ 최저 온도 지점:', coldX, coldY, minTemp.toFixed(2) + '°C')
  }

  // 라인 분석 함수들 (thermal-viewer와 동일)
  const getTemperaturesAlongLine = (x1: number, y1: number, x2: number, y2: number): number[] => {
    if (!thermalResult?.temperature_data || !thermalResult.width || !thermalResult.height) return []
    const temps: number[] = []
    const dx = Math.abs(x2 - x1)
    const dy = Math.abs(y2 - y1)
    const sx = x1 < x2 ? 1 : -1
    const sy = y1 < y2 ? 1 : -1
    let err = dx - dy
    let x = x1
    let y = y1

    while (true) {
      if (x >= 0 && x < thermalResult.width && y >= 0 && y < thermalResult.height) {
        const index = y * thermalResult.width + x
        temps.push(thermalResult.temperature_data[index])
      }
      if (x === x2 && y === y2) break
      const e2 = 2 * err
      if (e2 > -dy) { err -= dy; x += sx }
      if (e2 < dx) { err += dx; y += sy }
    }
    return temps
  }

  const analyzeLine = (x1: number, y1: number, x2: number, y2: number): Line | null => {
    const temps = getTemperaturesAlongLine(x1, y1, x2, y2)
    if (temps.length === 0) return null
    const minTemp = Math.min(...temps)
    const maxTemp = Math.max(...temps)
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length
    const minIndex = temps.indexOf(minTemp)
    const maxIndex = temps.indexOf(maxTemp)
    const dx = x2 - x1
    const dy = y2 - y1
    return {
      id: Date.now().toString(),
      x1, y1, x2, y2, temps,
      minTemp: Number(minTemp.toFixed(2)),
      maxTemp: Number(maxTemp.toFixed(2)),
      avgTemp: Number(avgTemp.toFixed(2)),
      minPos: { x: Math.round(x1 + (dx * minIndex) / temps.length), y: Math.round(y1 + (dy * minIndex) / temps.length) },
      maxPos: { x: Math.round(x1 + (dx * maxIndex) / temps.length), y: Math.round(y1 + (dy * maxIndex) / temps.length) },
    }
  }

  // 캔버스 이벤트 핸들러들
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!thermalResult?.temperature_data || !thermalResult.width || !thermalResult.height || !canvasRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) * (thermalResult.width / rect.width))
    const y = Math.floor((e.clientY - rect.top) * (thermalResult.height / rect.height))
    if (x >= 0 && x < thermalResult.width && y >= 0 && y < thermalResult.height) {
      const index = y * thermalResult.width + x
      const temp = thermalResult.temperature_data[index]
      setMousePos({ x, y, temp })
      if (drawingMode && isDrawing && currentLine) {
        setCurrentLine({ ...currentLine, x2: x, y2: y })
        redrawCanvas()
      }
    }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingMode || !thermalResult?.width || !thermalResult.height || !canvasRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) * (thermalResult.width / rect.width))
    const y = Math.floor((e.clientY - rect.top) * (thermalResult.height / rect.height))
    setIsDrawing(true)
    setCurrentLine({ x1: x, y1: y, x2: x, y2: y })
  }

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingMode || !isDrawing || !currentLine || !canvasRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) * (thermalResult!.width! / rect.width))
    const y = Math.floor((e.clientY - rect.top) * (thermalResult!.height! / rect.height))
    const line = analyzeLine(currentLine.x1, currentLine.y1, x, y)
    if (line) setLines([...lines, line])
    setIsDrawing(false)
    setCurrentLine(null)
    redrawCanvas()
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawingMode) return
    if (!thermalResult?.temperature_data || !thermalResult.width || !thermalResult.height || !canvasRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) * (thermalResult.width / rect.width))
    const y = Math.floor((e.clientY - rect.top) * (thermalResult.height / rect.height))
    if (x >= 0 && x < thermalResult.width && y >= 0 && y < thermalResult.height) {
      const index = y * thermalResult.width + x
      const temp = thermalResult.temperature_data[index]
      setClickedPos({ x, y, temp })
      redrawCanvas()
    }
  }

  const redrawCanvas = () => {
    if (!canvasRef.current || !imgRef.current || !thermalResult?.width || !thermalResult?.height) return

    const canvas = canvasRef.current
    const img = imgRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // 이미지가 로드되지 않았으면 리턴
    if (!img.complete || !img.naturalWidth) return

    // 캔버스 크기를 이미지 크기에 맞춤
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight

    // 캔버스 초기화 (투명하게)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 스케일 계산 (thermal data 좌표 -> canvas 좌표)
    const scaleX = img.naturalWidth / thermalResult.width
    const scaleY = img.naturalHeight / thermalResult.height

    // 라인들 그리기
    lines.forEach((line) => {
      // 라인
      ctx.strokeStyle = "#FFD700"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(line.x1 * scaleX, line.y1 * scaleY)
      ctx.lineTo(line.x2 * scaleX, line.y2 * scaleY)
      ctx.stroke()

      // 최고 온도 지점 (빨간색)
      ctx.fillStyle = "#FF0000"
      ctx.beginPath()
      ctx.arc(line.maxPos.x * scaleX, line.maxPos.y * scaleY, 8, 0, 2 * Math.PI)
      ctx.fill()
      ctx.strokeStyle = "#FFFFFF"
      ctx.lineWidth = 2
      ctx.stroke()

      // 최저 온도 지점 (파란색)
      ctx.fillStyle = "#0000FF"
      ctx.beginPath()
      ctx.arc(line.minPos.x * scaleX, line.minPos.y * scaleY, 8, 0, 2 * Math.PI)
      ctx.fill()
      ctx.strokeStyle = "#FFFFFF"
      ctx.lineWidth = 2
      ctx.stroke()
    })

    // 현재 그리고 있는 라인 (초록색 점선)
    if (drawingMode && currentLine && isDrawing) {
      ctx.strokeStyle = "#00FF00"
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(currentLine.x1 * scaleX, currentLine.y1 * scaleY)
      ctx.lineTo(currentLine.x2 * scaleX, currentLine.y2 * scaleY)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // 클릭한 지점 표시
    if (clickedPos && !drawingMode) {
      ctx.strokeStyle = "#00ff00"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(clickedPos.x * scaleX, clickedPos.y * scaleY, 15, 0, 2 * Math.PI)
      ctx.stroke()

      // 십자선
      ctx.beginPath()
      ctx.moveTo(clickedPos.x * scaleX - 20, clickedPos.y * scaleY)
      ctx.lineTo(clickedPos.x * scaleX + 20, clickedPos.y * scaleY)
      ctx.moveTo(clickedPos.x * scaleX, clickedPos.y * scaleY - 20)
      ctx.lineTo(clickedPos.x * scaleX, clickedPos.y * scaleY + 20)
      ctx.stroke()
    }

    // 최고/최저 온도 지점 표시
    if (showHotColdSpots) {
      // 최고 온도 지점 (큰 빨간 원 + 라벨)
      if (hotSpot) {
        // 외곽선
        ctx.strokeStyle = "#FFD700"
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(hotSpot.x * scaleX, hotSpot.y * scaleY, 20, 0, 2 * Math.PI)
        ctx.stroke()

        // 내부 원
        ctx.fillStyle = "#FF0000"
        ctx.beginPath()
        ctx.arc(hotSpot.x * scaleX, hotSpot.y * scaleY, 12, 0, 2 * Math.PI)
        ctx.fill()

        // 흰색 테두리
        ctx.strokeStyle = "#FFFFFF"
        ctx.lineWidth = 2
        ctx.stroke()

        // 라벨 배경
        const labelText = `최고: ${hotSpot.temp.toFixed(2)}°C`
        ctx.font = 'bold 14px sans-serif'
        const textWidth = ctx.measureText(labelText).width
        const labelX = hotSpot.x * scaleX - textWidth / 2
        const labelY = hotSpot.y * scaleY - 30

        ctx.fillStyle = 'rgba(255, 0, 0, 0.9)'
        ctx.fillRect(labelX - 5, labelY - 18, textWidth + 10, 24)

        // 라벨 텍스트
        ctx.fillStyle = '#FFFFFF'
        ctx.fillText(labelText, labelX, labelY)
      }

      // 최저 온도 지점 (큰 파란 원 + 라벨)
      if (coldSpot) {
        // 외곽선
        ctx.strokeStyle = "#00FFFF"
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(coldSpot.x * scaleX, coldSpot.y * scaleY, 20, 0, 2 * Math.PI)
        ctx.stroke()

        // 내부 원
        ctx.fillStyle = "#0000FF"
        ctx.beginPath()
        ctx.arc(coldSpot.x * scaleX, coldSpot.y * scaleY, 12, 0, 2 * Math.PI)
        ctx.fill()

        // 흰색 테두리
        ctx.strokeStyle = "#FFFFFF"
        ctx.lineWidth = 2
        ctx.stroke()

        // 라벨 배경
        const labelText = `최저: ${coldSpot.temp.toFixed(2)}°C`
        ctx.font = 'bold 14px sans-serif'
        const textWidth = ctx.measureText(labelText).width
        const labelX = coldSpot.x * scaleX - textWidth / 2
        const labelY = coldSpot.y * scaleY + 45

        ctx.fillStyle = 'rgba(0, 0, 255, 0.9)'
        ctx.fillRect(labelX - 5, labelY - 18, textWidth + 10, 24)

        // 라벨 텍스트
        ctx.fillStyle = '#FFFFFF'
        ctx.fillText(labelText, labelX, labelY)
      }
    }
  }

  // 이미지 로드 및 캔버스 초기화
  useEffect(() => {
    if (thermalResult?.image && imgRef.current) {
      const img = imgRef.current

      const handleImageLoad = () => {
        console.log('✅ 열화상 이미지 로드 완료:', img.naturalWidth, 'x', img.naturalHeight)

        // 최고/최저 온도 지점 자동 찾기
        findHotColdSpots()

        // 약간의 딜레이 후 redraw (DOM 업데이트 대기)
        setTimeout(() => {
          redrawCanvas()
        }, 100)
      }

      if (img.complete && img.naturalWidth) {
        // 이미 로드된 경우
        handleImageLoad()
      } else {
        // 로드 대기
        img.onload = handleImageLoad
        img.onerror = () => {
          console.error('❌ 열화상 이미지 로드 실패')
        }
      }
    }
  }, [thermalResult?.image])

  // 라인, 클릭 위치, 최고/최저 표시 등 변경 시 다시 그리기
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth) {
      redrawCanvas()
    }
  }, [lines, clickedPos, currentLine, drawingMode, showHotColdSpots, hotSpot, coldSpot])

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

  // 날짜별 첫/마지막 사진 추출
  const getDateComparison = () => {
    const dateGroups: { [key: string]: ThermalImageData[] } = {}

    // 날짜별로 그룹화
    images.forEach(img => {
      const date = extractDate(img.capture_timestamp)
      if (date) {
        if (!dateGroups[date]) {
          dateGroups[date] = []
        }
        dateGroups[date].push(img)
      }
    })

    // 각 날짜별로 첫/마지막 사진 추출
    const comparison: Array<{
      date: string
      first: ThermalImageData
      last: ThermalImageData
    }> = []

    Object.keys(dateGroups).sort().reverse().forEach(date => {
      const imagesInDate = dateGroups[date].sort((a, b) =>
        new Date(a.capture_timestamp).getTime() - new Date(b.capture_timestamp).getTime()
      )

      if (imagesInDate.length > 0) {
        comparison.push({
          date,
          first: imagesInDate[0],
          last: imagesInDate[imagesInDate.length - 1]
        })
      }
    })

    return comparison
  }

  const dateComparison = getDateComparison()

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
      // compare 모드에서는 별도 UI 사용
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
                <Button
                  variant={filterType === "compare" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFilterType("compare")
                    setSelectedSection("all")
                    setSelectedDate("all")
                  }}
                >
                  🔄 날짜별 비교
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

              {/* 비교 모드 설명 */}
              {filterType === "compare" && (
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    각 날짜별로 가장 이른 시간과 가장 늦은 시간에 촬영된 사진을 비교합니다
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={compareMode === "both" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCompareMode("both")}
                    >
                      양쪽 다 보기
                    </Button>
                    <Button
                      variant={compareMode === "first" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCompareMode("first")}
                    >
                      첫 사진만
                    </Button>
                    <Button
                      variant={compareMode === "last" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCompareMode("last")}
                    >
                      마지막 사진만
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* 비교 모드 - 날짜별 첫/마지막 사진 */}
            {filterType === "compare" && dateComparison.length > 0 && (
              <div className="space-y-6">
                {dateComparison.map((comparison) => (
                  <Card key={comparison.date} className="border-border bg-card p-6">
                    <h3 className="mb-4 text-lg font-bold text-foreground">
                      📅 {comparison.date}
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {/* 첫 사진 */}
                      {(compareMode === "both" || compareMode === "first") && (
                        <div>
                          <div className="mb-2 text-sm font-semibold text-foreground">
                            🌅 첫 촬영 ({new Date(comparison.first.capture_timestamp).toLocaleTimeString('ko-KR')})
                          </div>
                          <Card
                            className="cursor-pointer border-border bg-card transition-all hover:shadow-lg hover:ring-2 hover:ring-primary"
                            onClick={() => startAnalysis(comparison.first)}
                          >
                            <div className="relative aspect-video overflow-hidden rounded-t-lg bg-muted">
                              {comparison.first.thumbnail_url ? (
                                <img
                                  src={comparison.first.thumbnail_url}
                                  alt={`Image ${comparison.first.image_id}`}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center">
                                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                                </div>
                              )}
                              <div className="absolute right-2 top-2 rounded-full bg-green-500 px-2 py-1 text-xs font-semibold text-white">
                                열화상
                              </div>
                            </div>
                            <div className="p-4">
                              <div className="mb-2 text-sm font-semibold text-foreground">
                                ID: {comparison.first.image_id}
                              </div>
                              <div className="space-y-1 text-xs text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3 w-3" />
                                  <span>구간: {comparison.first.section_category || "미지정"}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3" />
                                  <span>{new Date(comparison.first.capture_timestamp).toLocaleString('ko-KR')}</span>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </div>
                      )}

                      {/* 마지막 사진 */}
                      {(compareMode === "both" || compareMode === "last") && (
                        <div>
                          <div className="mb-2 text-sm font-semibold text-foreground">
                            🌆 마지막 촬영 ({new Date(comparison.last.capture_timestamp).toLocaleTimeString('ko-KR')})
                          </div>
                          <Card
                            className="cursor-pointer border-border bg-card transition-all hover:shadow-lg hover:ring-2 hover:ring-primary"
                            onClick={() => startAnalysis(comparison.last)}
                          >
                            <div className="relative aspect-video overflow-hidden rounded-t-lg bg-muted">
                              {comparison.last.thumbnail_url ? (
                                <img
                                  src={comparison.last.thumbnail_url}
                                  alt={`Image ${comparison.last.image_id}`}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center">
                                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                                </div>
                              )}
                              <div className="absolute right-2 top-2 rounded-full bg-blue-500 px-2 py-1 text-xs font-semibold text-white">
                                열화상
                              </div>
                            </div>
                            <div className="p-4">
                              <div className="mb-2 text-sm font-semibold text-foreground">
                                ID: {comparison.last.image_id}
                              </div>
                              <div className="space-y-1 text-xs text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3 w-3" />
                                  <span>구간: {comparison.last.section_category || "미지정"}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3" />
                                  <span>{new Date(comparison.last.capture_timestamp).toLocaleString('ko-KR')}</span>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* 일반 이미지 그리드 (구간별/날짜별) */}
            {filterType !== "compare" && (
              <>
                {filteredImages.length === 0 ? (
                  <Card className="border-border bg-card p-12 text-center">
                    <ImageIcon className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                    <h3 className="mb-2 text-xl font-bold text-foreground">저장된 이미지가 없습니다</h3>
                    <p className="text-muted-foreground">
                      이미지를 업로드하면 여기에 표시됩니다.
                    </p>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredImages.map((image) => (
                      <Card
                        key={image.image_id}
                        className="cursor-pointer border-border bg-card transition-all hover:shadow-lg hover:ring-2 hover:ring-primary"
                        onClick={() => startAnalysis(image)}
                      >
                        <div className="relative aspect-video overflow-hidden rounded-t-lg bg-muted">
                          {image.thumbnail_url ? (
                            <img
                              src={image.thumbnail_url}
                              alt={`Image ${image.image_id}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <ImageIcon className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                          {image.image_type === 'thermal' && (
                            <div className="absolute right-2 top-2 rounded-full bg-orange-500 px-2 py-1 text-xs font-semibold text-white">
                              열화상
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <div className="mb-2 text-sm font-semibold text-foreground">
                            ID: {image.image_id}
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3" />
                              <span>구간: {image.section_category || "미지정"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(image.capture_timestamp).toLocaleString('ko-KR')}</span>
                            </div>
                            {image.camera_model && (
                              <div className="flex items-center gap-2">
                                <Thermometer className="h-3 w-3" />
                                <span>{image.camera_model}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* 선택된 이미지 상세 정보 */}
            {selectedImage && (
              <Card className="border-primary bg-card p-6">
                <h3 className="mb-4 text-2xl font-bold text-foreground">
                  📋 이미지 #{selectedImage.image_id} 상세 정보
                </h3>

                <div className="mb-6 grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="mb-2 font-semibold text-foreground">기본 정보</h4>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div><strong>구간:</strong> {selectedImage.section_category}</div>
                      <div><strong>촬영 시간:</strong> {new Date(selectedImage.capture_timestamp).toLocaleString('ko-KR')}</div>
                      <div><strong>카메라:</strong> {selectedImage.camera_model || "미지정"}</div>
                      <div><strong>파일 크기:</strong> {(selectedImage.file_size_bytes / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 font-semibold text-foreground">링크</h4>
                    <div className="flex gap-2">
                      <a href={selectedImage.image_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline">
                          원본 이미지 보기
                        </Button>
                      </a>
                      <Link href={`/thermal-viewer?imageId=${selectedImage.image_id}`}>
                        <Button size="sm">
                          <Thermometer className="mr-2 h-4 w-4" />
                          열화상 분석
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* 메타데이터 표시 */}
                {selectedImage.metadata_json && (
                  <details className="rounded-lg border border-border bg-muted/20 p-4">
                    <summary className="cursor-pointer font-semibold text-foreground">
                      📋 전체 메타데이터 (JSON)
                    </summary>
                    <pre className="mt-4 overflow-x-auto rounded-md bg-black p-4 text-xs text-green-400">
                      {JSON.stringify(selectedImage.metadata_json, null, 2)}
                    </pre>
                  </details>
                )}
              </Card>
            )}

            {/* 사용 안내 */}
            <Card className="border-border bg-card p-6">
              <h3 className="mb-4 text-xl font-bold text-card-foreground">💡 사용 방법</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>1️⃣ <strong>구간별/날짜별/비교</strong> 필터를 선택하여 원하는 방식으로 이미지를 정리할 수 있습니다</p>
                <p>2️⃣ <strong>날짜별 비교</strong> 모드에서는 각 날짜별로 첫 사진과 마지막 사진을 나란히 비교할 수 있습니다</p>
                <p>3️⃣ 이미지 카드를 클릭하면 바로 열화상 분석 모드로 진입합니다</p>
                <p>4️⃣ 분석 모드에서 온도 측정, 라인 그리기 등 다양한 분석을 수행할 수 있습니다</p>
                <p>5️⃣ 메타데이터가 자동으로 저장되어 있어 언제든지 조회 가능합니다</p>
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* 전체 화면 분석 모드 */}
      {analysisMode && analyzingImage && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          {/* 상단 바 */}
          <div className="border-b border-border bg-card px-6 py-4">
            <div className="mx-auto flex max-w-7xl items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={closeAnalysis}>
                  <X className="mr-2 h-4 w-4" />
                  닫기
                </Button>
                <div className="h-8 w-px bg-border"></div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    이미지 #{analyzingImage.image_id}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {analyzingImage.section_category} | {new Date(analyzingImage.capture_timestamp).toLocaleString('ko-KR')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={showHotColdSpots ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowHotColdSpots(!showHotColdSpots)}
                >
                  {showHotColdSpots ? (
                    <>
                      <Thermometer className="mr-2 h-4 w-4" />
                      최고/최저 ON
                    </>
                  ) : (
                    <>
                      <Thermometer className="mr-2 h-4 w-4" />
                      최고/최저 OFF
                    </>
                  )}
                </Button>
                <Button
                  variant={drawingMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDrawingMode(!drawingMode)}
                >
                  {drawingMode ? (
                    <>
                      <MousePointer2 className="mr-2 h-4 w-4" />
                      포인트 모드
                    </>
                  ) : (
                    <>
                      <Minus className="mr-2 h-4 w-4" />
                      라인 그리기
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* 메인 콘텐츠 */}
          <div className="flex-1 overflow-auto">
            <div className="mx-auto max-w-7xl space-y-6 p-6">
              {processingThermal ? (
                <Card className="border-border bg-card p-12 text-center">
                  <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-border border-t-primary"></div>
                  <p className="text-lg font-semibold text-foreground">열화상 이미지 생성 중...</p>
                  <p className="text-sm text-muted-foreground">잠시만 기다려주세요</p>
                </Card>
              ) : thermalResult?.error ? (
                <Card className="border-red-500 bg-red-50 p-8 text-center">
                  <p className="text-lg font-semibold text-red-800">⚠️ 오류</p>
                  <p className="text-sm text-red-600">{thermalResult.error}</p>
                </Card>
              ) : thermalResult?.success && thermalResult.image ? (
                <>
                  {/* 컬러맵 선택 */}
                  <Card className="border-border bg-card p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-foreground">🎨 컬러 팔레트</h3>
                        <p className="text-sm text-muted-foreground">온도 시각화 색상을 선택하세요</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-foreground">팔레트:</label>
                        <select
                          value={colormap}
                          onChange={async (e) => {
                            const newColormap = e.target.value
                            setColormap(newColormap)
                            setProcessingThermal(true)
                            try {
                              const imageResponse = await fetch(analyzingImage.image_url)
                              const imageBlob = await imageResponse.blob()
                              const file = new File([imageBlob], `image_${analyzingImage.image_id}.jpg`, { type: 'image/jpeg' })
                              const formData = new FormData()
                              formData.append("file", file)
                              formData.append("colormap", newColormap)
                              const response = await fetch("http://localhost:5001/generate-thermal-image", {
                                method: "POST",
                                body: formData,
                              })
                              const data = await response.json()
                              setThermalResult(data)
                              setLines([])
                              setClickedPos(null)
                            } catch (error) {
                              console.error(error)
                            } finally {
                              setProcessingThermal(false)
                            }
                          }}
                          className="min-w-[200px] rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          {COLORMAPS.map((cm) => (
                            <option key={cm.value} value={cm.value}>
                              {cm.label} ({cm.description})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </Card>

                  {/* 온도 통계 */}
                  {thermalResult.stats && (
                    <Card className="border-border bg-card p-6">
                      <h3 className="mb-4 text-lg font-bold text-foreground">📊 온도 통계</h3>
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                        <div>
                          <div className="text-xs text-muted-foreground">최저</div>
                          <div className="text-2xl font-bold text-blue-600">{Number(thermalResult.stats.min).toFixed(2)}°C</div>
                          {coldSpot && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              위치: ({coldSpot.x}, {coldSpot.y})
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">최고</div>
                          <div className="text-2xl font-bold text-red-600">{Number(thermalResult.stats.max).toFixed(2)}°C</div>
                          {hotSpot && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              위치: ({hotSpot.x}, {hotSpot.y})
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">평균</div>
                          <div className="text-2xl font-bold text-foreground">{Number(thermalResult.stats.mean).toFixed(2)}°C</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">중앙값</div>
                          <div className="text-2xl font-bold text-foreground">{Number(thermalResult.stats.median).toFixed(2)}°C</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">표준편차</div>
                          <div className="text-2xl font-bold text-foreground">{Number(thermalResult.stats.std).toFixed(2)}°C</div>
                        </div>
                      </div>
                      {showHotColdSpots && (hotSpot || coldSpot) && (
                        <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm">
                          <p className="font-semibold text-foreground mb-1">🎯 극값 지점 표시:</p>
                          <p className="text-muted-foreground">
                            <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-red-600 mr-1"></span>
                            빨간 원: 최고 온도 지점
                          </p>
                          <p className="text-muted-foreground">
                            <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-blue-600 mr-1"></span>
                            파란 원: 최저 온도 지점
                          </p>
                        </div>
                      )}
                    </Card>
                  )}

                  {/* 캔버스 */}
                  <Card className="border-border bg-card p-6">
                    <h3 className="mb-4 text-lg font-bold text-foreground">🖼️ 열화상 이미지</h3>
                    <div className="relative flex items-center justify-center bg-muted/30 p-4 rounded-lg">
                      <div className="relative inline-block">
                        {/* 실제 이미지 (배경) */}
                        <img
                          ref={imgRef}
                          src={thermalResult.image}
                          alt="Thermal"
                          className="max-w-full h-auto rounded-lg shadow-lg"
                          crossOrigin="anonymous"
                          style={{ display: 'block' }}
                        />
                        {/* 투명 캔버스 (오버레이) */}
                        <canvas
                          ref={canvasRef}
                          className="absolute top-0 left-0 cursor-crosshair"
                          style={{ width: '100%', height: '100%' }}
                          onMouseMove={handleCanvasMouseMove}
                          onMouseDown={handleCanvasMouseDown}
                          onMouseUp={handleCanvasMouseUp}
                          onClick={handleCanvasClick}
                        />
                      </div>
                      {mousePos && (
                        <div className="absolute right-4 top-4 rounded-lg bg-black/90 px-4 py-3 text-white shadow-xl z-10">
                          <div className="text-xs text-gray-300">
                            X: {mousePos.x}, Y: {mousePos.y}
                          </div>
                          <div className="text-3xl font-bold">{mousePos.temp.toFixed(2)}°C</div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground text-center">
                      {drawingMode ? "🖱️ 드래그하여 라인을 그리세요" : "🖱️ 클릭하여 온도를 측정하세요"}
                    </div>
                  </Card>

                  {/* 클릭한 지점 온도 */}
                  {clickedPos && !drawingMode && (
                    <Card className="border-green-500 bg-green-50 p-6">
                      <h3 className="mb-2 text-lg font-bold text-green-800">📍 선택된 지점 온도</h3>
                      <div className="flex items-center gap-4">
                        <div className="text-3xl font-bold text-green-600">{clickedPos.temp.toFixed(2)}°C</div>
                        <div className="text-sm text-green-700">
                          좌표: ({clickedPos.x}, {clickedPos.y})
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* 라인 분석 결과 */}
                  {lines.length > 0 && (
                    <Card className="border-border bg-card p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-xl font-bold text-card-foreground">📏 라인 분석 결과</h3>
                        <div className="text-sm text-muted-foreground">총 {lines.length}개 라인</div>
                      </div>
                      <div className="space-y-4">
                        {lines.map((line, index) => (
                          <div key={line.id} className="rounded-lg border border-border bg-muted/20 p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <div className="font-semibold text-foreground">라인 #{index + 1}</div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setLines(lines.filter((l) => l.id !== line.id))
                                  redrawCanvas()
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <div className="text-xs text-muted-foreground">최저 온도</div>
                                <div className="flex items-center gap-2">
                                  <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-600"></div>
                                  <div className="text-lg font-bold text-blue-600">{line.minTemp}°C</div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  ({line.minPos.x}, {line.minPos.y})
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">최고 온도</div>
                                <div className="flex items-center gap-2">
                                  <div className="h-4 w-4 rounded-full border-2 border-white bg-red-600"></div>
                                  <div className="text-lg font-bold text-red-600">{line.maxTemp}°C</div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  ({line.maxPos.x}, {line.maxPos.y})
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">평균 온도</div>
                                <div className="text-lg font-bold text-foreground">{line.avgTemp}°C</div>
                                <div className="text-xs text-muted-foreground">측정 포인트: {line.temps.length}개</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                        <p>
                          <span className="mr-2 inline-block h-3 w-8 bg-yellow-500"></span>
                          노란색 라인: 측정 구간
                        </p>
                        <p>
                          <span className="mr-2 inline-block h-3 w-3 rounded-full border-2 border-white bg-red-600"></span>
                          빨간 점: 최고 온도 지점
                        </p>
                        <p>
                          <span className="mr-2 inline-block h-3 w-3 rounded-full border-2 border-white bg-blue-600"></span>
                          파란 점: 최저 온도 지점
                        </p>
                      </div>
                    </Card>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
