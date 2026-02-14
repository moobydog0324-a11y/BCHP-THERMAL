"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Activity, ArrowLeft, Upload, Loader2, Thermometer, MousePointer2, Minus, Trash2, Plus, Database, Map as MapIcon, X, Flame, Scale } from "lucide-react"
import KakaoMapViewer from "@/components/KakaoMapViewer"

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

export default function ThermalViewerPage() {
  const searchParams = useSearchParams()
  const imageId = searchParams?.get("imageId")

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [colormap, setColormap] = useState("jet")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ThermalResult | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number; temp: number } | null>(null)
  const [clickedPos, setClickedPos] = useState<{ x: number; y: number; temp: number } | null>(null)

  // 라인 측정 관련 상태
  const [drawingMode, setDrawingMode] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentLine, setCurrentLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [lines, setLines] = useState<Line[]>([])

  // Delta T Analysis State
  const [deltaMode, setDeltaMode] = useState(false)
  const [deltaPoints, setDeltaPoints] = useState<{ x: number; y: number; temp: number }[]>([])

  // 중복 이미지 체크
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState<{ filename: string; uploadTime: string } | null>(null)
  const [uploadedImages, setUploadedImages] = useState<Map<string, { filename: string; uploadTime: string }>>(new Map())

  // DB 이미지 관련
  const [dbImageInfo, setDbImageInfo] = useState<any>(null)
  const [isDbMode, setIsDbMode] = useState(false)
  const [showMap, setShowMap] = useState(false)

  // Isotherm State
  const [showIsotherm, setShowIsotherm] = useState(false)
  const [isothermThreshold, setIsothermThreshold] = useState<number>(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // URL 파라미터로 imageId가 있으면 DB에서 이미지 불러오기
  useEffect(() => {
    if (imageId) {
      loadImageFromDB(imageId)
    }
  }, [imageId])

  // 로컬 스토리지에서 업로드 기록 불러오기
  useEffect(() => {
    const stored = localStorage.getItem('uploadedThermalImages')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setUploadedImages(new Map(Object.entries(parsed)))
      } catch (e) {
        console.error('Failed to parse stored images:', e)
      }
    }
  }, [])

  // DB에서 이미지 불러오기
  const loadImageFromDB = async (id: string) => {
    setLoading(true)
    setIsDbMode(true)

    try {
      // 1. DB에서 이미지 정보 조회
      const response = await fetch(`/api/thermal-images?with_metadata=true`)
      const data = await response.json()

      if (!data.success) {
        throw new Error('이미지 조회 실패')
      }

      const imageData = data.data.find((img: any) => img.image_id === parseInt(id))

      if (!imageData) {
        throw new Error('이미지를 찾을 수 없습니다')
      }

      setDbImageInfo(imageData)

      // 2. 이미지 URL에서 파일 다운로드
      const imageResponse = await fetch(imageData.image_url)
      const imageBlob = await imageResponse.blob()

      // Blob을 File 객체로 변환
      const file = new File([imageBlob], `image_${id}.jpg`, { type: 'image/jpeg' })

      // 3. Flask 서버에 전달하여 열화상 생성
      const formData = new FormData()
      formData.append("file", file)
      formData.append("colormap", colormap)

      const flaskResponse = await fetch("http://localhost:5001/generate-thermal-image", {
        method: "POST",
        body: formData,
      })

      const thermalData = await flaskResponse.json()
      setResult(thermalData)

    } catch (error) {
      console.error('DB 이미지 로드 오류:', error)
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "DB에서 이미지를 불러올 수 없습니다.",
      })
    } finally {
      setLoading(false)
    }
  }

  // 파일 해시 생성 함수
  const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex
  }

  // 중복 체크 함수
  const checkDuplicate = async (file: File): Promise<boolean> => {
    const hash = await calculateFileHash(file)
    const existing = uploadedImages.get(hash)

    if (existing) {
      setIsDuplicate(true)
      setDuplicateInfo(existing)
      return true
    }

    return false
  }

  // 이미지 등록 함수
  const registerImage = async (file: File) => {
    const hash = await calculateFileHash(file)
    const info = {
      filename: file.name,
      uploadTime: new Date().toLocaleString('ko-KR')
    }

    const newMap = new Map(uploadedImages)
    newMap.set(hash, info)
    setUploadedImages(newMap)

    // localStorage에 저장
    const obj = Object.fromEntries(newMap)
    localStorage.setItem('uploadedThermalImages', JSON.stringify(obj))
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // 중복 체크
      const isDup = await checkDuplicate(file)

      setSelectedFile(file)
      setResult(null)
      setMousePos(null)
      setClickedPos(null)
      setLines([])
      setCurrentLine(null)
      setDrawingMode(false)
      setDeltaMode(false)
      setDeltaPoints([])

      // 중복이 아니면 자동으로 사라지도록
      if (!isDup) {
        setIsDuplicate(false)
        setDuplicateInfo(null)
      }
    }
  }

  const handleForceUpload = () => {
    setIsDuplicate(false)
    setDuplicateInfo(null)
  }

  const clearUploadHistory = () => {
    setUploadedImages(new Map())
    localStorage.removeItem('uploadedThermalImages')
    setIsDuplicate(false)
    setDuplicateInfo(null)
  }

  // 라인 상의 온도 계산 (Bresenham's line algorithm)
  const getTemperaturesAlongLine = (x1: number, y1: number, x2: number, y2: number): number[] => {
    if (!result?.temperature_data || !result.width || !result.height) return []

    const temps: number[] = []
    const dx = Math.abs(x2 - x1)
    const dy = Math.abs(y2 - y1)
    const sx = x1 < x2 ? 1 : -1
    const sy = y1 < y2 ? 1 : -1
    let err = dx - dy
    let x = x1
    let y = y1

    while (true) {
      if (x >= 0 && x < result.width && y >= 0 && y < result.height) {
        const index = y * result.width + x
        temps.push(result.temperature_data[index])
      }

      if (x === x2 && y === y2) break

      const e2 = 2 * err
      if (e2 > -dy) {
        err -= dy
        x += sx
      }
      if (e2 < dx) {
        err += dx
        y += sy
      }
    }

    return temps
  }

  // 라인 분석
  const analyzeLine = (x1: number, y1: number, x2: number, y2: number): Line | null => {
    const temps = getTemperaturesAlongLine(x1, y1, x2, y2)
    if (temps.length === 0) return null

    const minTemp = Math.min(...temps)
    const maxTemp = Math.max(...temps)
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length

    // 최저/최고 온도 위치 찾기
    const minIndex = temps.indexOf(minTemp)
    const maxIndex = temps.indexOf(maxTemp)

    // 라인 상의 실제 좌표 계산
    const dx = x2 - x1
    const dy = y2 - y1
    const length = Math.sqrt(dx * dx + dy * dy)

    const minPos = {
      x: Math.round(x1 + (dx * minIndex) / temps.length),
      y: Math.round(y1 + (dy * minIndex) / temps.length),
    }

    const maxPos = {
      x: Math.round(x1 + (dx * maxIndex) / temps.length),
      y: Math.round(y1 + (dy * maxIndex) / temps.length),
    }

    return {
      id: Date.now().toString(),
      x1,
      y1,
      x2,
      y2,
      temps,
      minTemp: Number(minTemp.toFixed(2)),
      maxTemp: Number(maxTemp.toFixed(2)),
      avgTemp: Number(avgTemp.toFixed(2)),
      minPos,
      maxPos,
    }
  }

  const generateThermalImage = async () => {
    if (!selectedFile) return

    // 중복이고 강제 업로드가 아닌 경우 경고
    if (isDuplicate && !window.confirm('이미 업로드된 이미지입니다. 그래도 계속하시겠습니까?')) {
      return
    }

    setLoading(true)
    setResult(null)
    setMousePos(null)
    setClickedPos(null)
    setDeltaMode(false)
    setDeltaPoints([])

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("colormap", colormap)

      const response = await fetch("http://localhost:5000/generate-thermal-image", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()
      setResult(data)

      // 성공적으로 업로드되면 등록
      if (data.success) {
        await registerImage(selectedFile)
        setIsDuplicate(false)
        setDuplicateInfo(null)
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      })
    } finally {
      setLoading(false)
    }
  }

  // Canvas에서 마우스 위치의 온도 추적
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!result?.temperature_data || !result.width || !result.height || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()

    // 캔버스 내 상대 좌표
    const x = Math.floor((e.clientX - rect.left) * (result.width / rect.width))
    const y = Math.floor((e.clientY - rect.top) * (result.height / rect.height))

    if (x >= 0 && x < result.width && y >= 0 && y < result.height) {
      const index = y * result.width + x
      const temp = result.temperature_data[index]
      setMousePos({ x, y, temp })

      // 라인 그리는 중이면 현재 라인 업데이트
      if (drawingMode && isDrawing && currentLine) {
        setCurrentLine({ ...currentLine, x2: x, y2: y })
        redrawCanvas()
      }
    }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingMode || !result?.width || !result.height || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()

    const x = Math.floor((e.clientX - rect.left) * (result.width / rect.width))
    const y = Math.floor((e.clientY - rect.top) * (result.height / rect.height))

    setIsDrawing(true)
    setCurrentLine({ x1: x, y1: y, x2: x, y2: y })
  }

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingMode || !isDrawing || !currentLine || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()

    const x = Math.floor((e.clientX - rect.left) * (result!.width! / rect.width))
    const y = Math.floor((e.clientY - rect.top) * (result!.height! / rect.height))

    // 라인 분석
    const line = analyzeLine(currentLine.x1, currentLine.y1, x, y)
    if (line) {
      setLines([...lines, line])
    }

    setIsDrawing(false)
    setCurrentLine(null)
    redrawCanvas()
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawingMode) return // 라인 그리기 모드에서는 클릭 무시

    if (!result?.temperature_data || !result.width || !result.height || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()

    const x = Math.floor((e.clientX - rect.left) * (result.width / rect.width))
    const y = Math.floor((e.clientY - rect.top) * (result.height / rect.height))

    if (x >= 0 && x < result.width && y >= 0 && y < result.height) {
      const index = y * result.width + x
      const temp = result.temperature_data[index]

      if (deltaMode) {
        // Delta T Point Selection
        if (deltaPoints.length >= 2) {
          setDeltaPoints([{ x, y, temp }]) // Start new
        } else {
          setDeltaPoints([...deltaPoints, { x, y, temp }])
        }
      } else {
        // Point Measurement
        setClickedPos({ x, y, temp })
      }
      redrawCanvas()
    }
  }

  const handleCanvasMouseLeave = () => {
    setMousePos(null)
  }

  const deleteLine = (lineId: string) => {
    setLines(lines.filter((line) => line.id !== lineId))
  }

  const toggleDrawingMode = () => {
    setDrawingMode(!drawingMode)
    setDeltaMode(false) // Delta Mode OFF
    setCurrentLine(null)
    setIsDrawing(false)
    if (!drawingMode) {
      setClickedPos(null)
      setDeltaPoints([])
    }
  }

  const toggleDeltaMode = () => {
    setDeltaMode(!deltaMode)
    setDrawingMode(false) // Drawing Mode OFF
    setDeltaPoints([])
    if (!deltaMode) {
      setClickedPos(null)
    }
  }

  // 캔버스 재그리기 함수
  const redrawCanvas = () => {
    if (!result?.image || !imgRef.current || !canvasRef.current || !result.width || !result.height) return

    const img = imgRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx || !img.complete) return

    const scaleX = img.naturalWidth / result.width
    const scaleY = img.naturalHeight / result.height

    // 이미지 다시 그리기
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)

    // 저장된 라인들 그리기
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

      // 라인 시작/끝 표시
      ctx.fillStyle = "#FFD700"
      ctx.beginPath()
      ctx.arc(line.x1 * scaleX, line.y1 * scaleY, 5, 0, 2 * Math.PI)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(line.x2 * scaleX, line.y2 * scaleY, 5, 0, 2 * Math.PI)
      ctx.fill()
    })

    // 그리는 중인 라인 표시
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

    // 클릭된 위치 표시
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

    // Delta T Visualization
    if (deltaPoints.length > 0) {
      deltaPoints.forEach((p, i) => {
        // Point
        ctx.fillStyle = i === 0 ? "#3b82f6" : "#ef4444" // Blue for Ref, Red for Target
        ctx.beginPath()
        ctx.arc(p.x * scaleX, p.y * scaleY, 6, 0, 2 * Math.PI)
        ctx.fill()
        ctx.strokeStyle = "white"
        ctx.lineWidth = 2
        ctx.stroke()

        // Label
        ctx.fillStyle = "white"
        ctx.font = "bold 14px sans-serif"
        ctx.fillText(i === 0 ? "Ref" : "Tgt", p.x * scaleX + 10, p.y * scaleY)
      })

      // Line connecting points
      if (deltaPoints.length === 2) {
        const p1 = deltaPoints[0]
        const p2 = deltaPoints[1]

        ctx.strokeStyle = "white"
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(p1.x * scaleX, p1.y * scaleY)
        ctx.lineTo(p2.x * scaleX, p2.y * scaleY)
        ctx.stroke()
        ctx.setLineDash([])

        // Draw Delta Text at midpoint
        const midX = (p1.x + p2.x) / 2 * scaleX
        const midY = (p1.y + p2.y) / 2 * scaleY
        const delta = Math.abs(p2.temp - p1.temp).toFixed(2)

        ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
        ctx.fillRect(midX - 40, midY - 15, 80, 30)
        ctx.fillStyle = "#fbbf24" // Amber
        ctx.font = "bold 16px sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(`Δ ${delta}°C`, midX, midY)
      }
    }
  }

  // 이미지가 로드되면 캔버스에 그리기
  useEffect(() => {
    if (result?.image && imgRef.current && canvasRef.current) {
      const img = imgRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")

      if (!ctx) return

      img.onload = () => {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        redrawCanvas()
      }
    }
  }, [result?.image])

  // 라인이나 클릭 위치가 변경되면 재그리기
  useEffect(() => {
    redrawCanvas()
  }, [lines, clickedPos, currentLine, drawingMode, deltaPoints, showIsotherm, isothermThreshold])

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
              <p className="text-xs text-muted-foreground">열화상 이미지 뷰어</p>
            </div>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              홈으로
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-6 text-center">
          <h2 className="mb-2 text-3xl font-bold text-foreground">
            🎨 열화상 이미지 뷰어 {isDbMode && <span className="text-blue-600">(DB 모드)</span>}
          </h2>
          <p className="text-muted-foreground">
            {isDbMode
              ? "데이터베이스에 저장된 이미지를 분석합니다"
              : "다양한 컬러 팔레트로 시각화하고 클릭하여 온도를 확인하세요"
            }
          </p>
        </div>

        <div className="mx-auto max-w-6xl space-y-6">
          {/* DB 모드 정보 */}
          {isDbMode && dbImageInfo && (
            <Card className="border-blue-500 bg-blue-50 p-6">
              <div className="flex items-start gap-3">
                <Database className="h-6 w-6 text-blue-600" />
                <div className="flex-1">
                  <h3 className="mb-2 text-lg font-bold text-blue-900">📊 DB 저장 이미지</h3>
                  <div className="mb-3 space-y-1 text-sm text-blue-800">
                    <div><strong>이미지 ID:</strong> #{dbImageInfo.image_id}</div>
                    <div><strong>구간:</strong> {dbImageInfo.section_category}</div>
                    <div><strong>촬영 시간:</strong> {new Date(dbImageInfo.capture_timestamp).toLocaleString('ko-KR')}</div>
                    {dbImageInfo.camera_model && <div><strong>카메라:</strong> {dbImageInfo.camera_model}</div>}
                  </div>
                  <Link href="/thermal-analysis">
                    <Button variant="outline" size="sm" className="border-blue-600 text-blue-700 hover:bg-blue-100">
                      <Database className="mr-2 h-4 w-4" />
                      이미지 목록으로 돌아가기
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          )}

          {/* 중복 이미지 경고 */}
          {!isDbMode && isDuplicate && duplicateInfo && (
            <Card className="border-orange-500 bg-orange-50 p-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-lg font-bold text-orange-900">⚠️ 중복 이미지 감지</h3>
                  <p className="mb-2 text-sm text-orange-800">
                    이 이미지는 이미 업로드된 적이 있습니다.
                  </p>
                  <div className="mb-3 rounded-md bg-orange-100 p-3 text-sm text-orange-900">
                    <div><strong>파일명:</strong> {duplicateInfo.filename}</div>
                    <div><strong>최초 업로드:</strong> {duplicateInfo.uploadTime}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleForceUpload}
                      className="border-orange-600 text-orange-700 hover:bg-orange-100"
                    >
                      무시하고 계속
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null)
                        setIsDuplicate(false)
                        setDuplicateInfo(null)
                      }}
                      className="text-gray-600"
                    >
                      취소
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* 파일 선택 및 설정 */}
          {!isDbMode && (
            <Card className="border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-card-foreground">1️⃣ 설정</h3>
                {uploadedImages.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearUploadHistory}
                    className="text-xs text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    업로드 기록 삭제 ({uploadedImages.size}개)
                  </Button>
                )}
              </div>
              <div className="space-y-4">
                {/* 파일 선택 */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground">
                    열화상 이미지 선택
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg"
                    onChange={handleFileSelect}
                    className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
                  />
                </div>

                {/* 컬러맵 선택 */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground">
                    컬러 팔레트 선택
                  </label>
                  <select
                    value={colormap}
                    onChange={(e) => setColormap(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                  >
                    {COLORMAPS.map((cm) => (
                      <option key={cm.value} value={cm.value}>
                        {cm.label} - {cm.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 생성 버튼 */}
                <Button
                  onClick={generateThermalImage}
                  disabled={!selectedFile || loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      이미지 생성 중...
                    </>
                  ) : (
                    <>
                      <Thermometer className="mr-2 h-5 w-5" />
                      열화상 이미지 생성
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}

          {/* 결과 표시 */}
          {result && result.success && (
            <>
              {/* 온도 통계 */}
              <Card className="border-border bg-card p-6">
                <h3 className="mb-4 text-xl font-bold text-card-foreground">📊 온도 통계</h3>
                <div className="grid gap-4 md:grid-cols-5">
                  <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 text-center">
                    <div className="text-xs text-blue-700">최저 온도</div>
                    <div className="text-2xl font-bold text-blue-900">{result.stats?.min}°C</div>
                  </div>
                  <div className="rounded-lg border border-orange-300 bg-orange-50 p-4 text-center">
                    <div className="text-xs text-orange-700">최고 온도</div>
                    <div className="text-2xl font-bold text-orange-900">{result.stats?.max}°C</div>
                  </div>
                  <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-center">
                    <div className="text-xs text-green-700">평균 온도</div>
                    <div className="text-2xl font-bold text-green-900">{result.stats?.mean}°C</div>
                  </div>
                  <div className="rounded-lg border border-purple-300 bg-purple-50 p-4 text-center">
                    <div className="text-xs text-purple-700">중앙값</div>
                    <div className="text-2xl font-bold text-purple-900">{result.stats?.median}°C</div>
                  </div>
                  <div className="rounded-lg border border-gray-300 bg-gray-50 p-4 text-center">
                    <div className="text-xs text-gray-700">표준편차</div>
                    <div className="text-2xl font-bold text-gray-900">{result.stats?.std}°C</div>
                  </div>
                </div>
              </Card>

              {/* 열화상 이미지 */}
              <Card className="border-border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-card-foreground">🔥 열화상 이미지</h3>
                  <div className="flex items-center gap-4">
                    <Button
                      variant={drawingMode ? "default" : "outline"}
                      size="sm"
                      onClick={toggleDrawingMode}
                    >
                      {drawingMode ? (
                        <>
                          <MousePointer2 className="mr-2 h-4 w-4" />
                          포인트 모드로 전환
                        </>
                      ) : (
                        <>
                          <Minus className="mr-2 h-4 w-4" />
                          라인 그리기 모드
                        </>
                      )}
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      {drawingMode ? "드래그하여 라인 그리기" : "클릭하여 온도 측정"}
                    </div>

                    {/* Isotherm Toggle */}
                    <Button
                      variant={showIsotherm ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const newMode = !showIsotherm
                        setShowIsotherm(newMode)
                        if (newMode && result.stats) {
                          // 기본값: 평균 온도
                          setIsothermThreshold(result.stats.mean)
                        }
                      }}
                      className={showIsotherm ? "bg-red-600 hover:bg-red-700" : "ml-2 border-red-200 bg-red-50 text-red-600 hover:bg-red-100"}
                    >
                      <Flame className="mr-2 h-4 w-4" />
                      {showIsotherm ? "등온선 끄기" : "등온선(Isotherm)"}
                    </Button>

                    {/* Delta Mode Button */}
                    <Button
                      variant={deltaMode ? "default" : "outline"}
                      size="sm"
                      onClick={toggleDeltaMode}
                      className={deltaMode ? "ml-2 bg-purple-600 hover:bg-purple-700" : "ml-2 border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100"}
                    >
                      <Scale className="mr-2 h-4 w-4" />
                      온도차 분석 (Delta T)
                    </Button>

                    {/* 위치 확인 버튼 added */}
                    {isDbMode && dbImageInfo?.gps_latitude && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMap(true)}
                        className="ml-2 border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
                      >
                        <MapIcon className="mr-2 h-4 w-4" />
                        실화상 위치 확인
                      </Button>
                    )}
                  </div>
                </div>

                {/* 현재 마우스/클릭 위치 온도 */}
                <div className="mb-4 flex gap-4">
                  {mousePos && (
                    <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2">
                      <div className="text-xs text-yellow-700">현재 위치</div>
                      <div className="font-mono text-sm font-semibold text-yellow-900">
                        ({mousePos.x}, {mousePos.y}) = {mousePos.temp.toFixed(2)}°C
                      </div>
                    </div>
                  )}
                  {clickedPos && (
                    <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-2">
                      <div className="text-xs text-green-700">📍 측정 지점</div>
                      <div className="font-mono text-lg font-bold text-green-900">
                        {clickedPos.temp.toFixed(2)}°C
                      </div>
                      <div className="text-xs text-green-600">
                        위치: ({clickedPos.x}, {clickedPos.y})
                      </div>
                    </div>
                  )}
                </div>



                {/* Isotherm Slider */}
                {showIsotherm && result.stats && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-bold text-red-900">🌡️ 등온선 임계값 설정</span>
                      <span className="text-sm font-bold text-red-700">{isothermThreshold.toFixed(1)}°C 이상 표시</span>
                    </div>
                    <input
                      type="range"
                      min={result.stats.min}
                      max={result.stats.max}
                      step={0.1}
                      value={isothermThreshold}
                      onChange={(e) => setIsothermThreshold(parseFloat(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-red-200 accent-red-600"
                    />
                    <div className="mt-1 flex justify-between text-xs text-red-600">
                      <span>{result.stats.min}°C</span>
                      <span>{result.stats.max}°C</span>
                    </div>
                  </div>
                )}

                {/* 캔버스 */}
                <div className="relative overflow-hidden rounded-lg border border-border bg-black">
                  <canvas
                    ref={canvasRef}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseLeave}
                    onClick={handleCanvasClick}
                    className={`w-full ${drawingMode ? "cursor-crosshair" : "cursor-pointer"}`}
                  />
                  <img
                    ref={imgRef}
                    src={result.image}
                    alt="Thermal"
                    className="hidden"
                  />
                </div>

                <div className="mt-4 text-center text-sm text-muted-foreground">
                  처리 시간: {result.processing_time}초 | 컬러맵: {result.colormap?.toUpperCase()} |
                  해상도: {result.width} × {result.height}
                </div>
              </Card>

              {/* 라인 분석 결과 */}
              {lines.length > 0 && (
                <Card className="border-border bg-card p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-card-foreground">📏 라인 분석 결과</h3>
                    <div className="text-sm text-muted-foreground">
                      총 {lines.length}개 라인
                    </div>
                  </div>

                  <div className="space-y-4">
                    {lines.map((line, index) => (
                      <div
                        key={line.id}
                        className="rounded-lg border border-border bg-muted/20 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div className="font-semibold text-foreground">
                            라인 {index + 1}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteLine(line.id)}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          {/* 최저 온도 */}
                          <div className="rounded-md border border-blue-300 bg-blue-50 p-3">
                            <div className="mb-1 flex items-center gap-2">
                              <div className="h-3 w-3 rounded-full bg-blue-600"></div>
                              <div className="text-xs text-blue-700">최저 온도</div>
                            </div>
                            <div className="text-2xl font-bold text-blue-900">
                              {line.minTemp}°C
                            </div>
                            <div className="text-xs text-blue-600">
                              위치: ({line.minPos.x}, {line.minPos.y})
                            </div>
                          </div>

                          {/* 최고 온도 */}
                          <div className="rounded-md border border-red-300 bg-red-50 p-3">
                            <div className="mb-1 flex items-center gap-2">
                              <div className="h-3 w-3 rounded-full bg-red-600"></div>
                              <div className="text-xs text-red-700">최고 온도</div>
                            </div>
                            <div className="text-2xl font-bold text-red-900">
                              {line.maxTemp}°C
                            </div>
                            <div className="text-xs text-red-600">
                              위치: ({line.maxPos.x}, {line.maxPos.y})
                            </div>
                          </div>

                          {/* 평균 온도 */}
                          <div className="rounded-md border border-green-300 bg-green-50 p-3">
                            <div className="mb-1 flex items-center gap-2">
                              <div className="h-3 w-3 rounded-full bg-green-600"></div>
                              <div className="text-xs text-green-700">평균 온도</div>
                            </div>
                            <div className="text-2xl font-bold text-green-900">
                              {line.avgTemp}°C
                            </div>
                            <div className="text-xs text-green-600">
                              온도 차이: {(line.maxTemp - line.minTemp).toFixed(2)}°C
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 text-xs text-muted-foreground">
                          라인 좌표: ({line.x1}, {line.y1}) → ({line.x2}, {line.y2}) |
                          측정 포인트: {line.temps.length}개
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm">
                    <div className="font-semibold text-yellow-900">💡 범례</div>
                    <div className="mt-2 space-y-1 text-yellow-800">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-blue-600"></div>
                        <span>파란색 점: 라인 상 최저 온도 지점</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-red-600"></div>
                        <span>빨간색 점: 라인 상 최고 온도 지점</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-8 bg-yellow-500"></div>
                        <span>노란색 선: 측정 라인</span>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* 오류 */}
          {result && !result.success && (
            <Card className="border-red-500 bg-red-50 p-6">
              <h3 className="mb-2 text-xl font-bold text-red-900">❌ 오류</h3>
              <p className="text-red-700">{result.error}</p>
            </Card>
          )}

          {/* 사용 방법 */}
          <Card className="border-border bg-card p-6">
            <h3 className="mb-4 text-xl font-bold text-card-foreground">💡 사용 방법</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <div className="mb-1 font-semibold text-foreground">📸 기본 사용</div>
                <p>1️⃣ 열화상 이미지 파일을 선택하세요 (FLIR 카메라로 촬영한 JPG 파일)</p>
                <p>2️⃣ 원하는 컬러 팔레트를 선택하세요</p>
                <p>3️⃣ <strong>열화상 이미지 생성</strong> 버튼을 클릭하세요</p>
              </div>

              <div>
                <div className="mb-1 font-semibold text-foreground">📍 포인트 측정 (기본 모드)</div>
                <p>• 이미지 위에 마우스를 올리면 실시간으로 온도가 표시됩니다</p>
                <p>• 클릭하면 해당 지점의 온도가 고정되어 표시됩니다 (초록색 원)</p>
              </div>

              <div>
                <div className="mb-1 font-semibold text-foreground">📏 라인 측정 (라인 그리기 모드)</div>
                <p>• <strong>라인 그리기 모드</strong> 버튼을 클릭하여 모드를 전환하세요</p>
                <p>• 이미지 위에서 드래그하여 라인을 그으세요</p>
                <p>• 라인 상의 최고/최저/평균 온도가 자동으로 분석됩니다</p>
                <p>• 빨간색 점은 최고 온도, 파란색 점은 최저 온도 위치입니다</p>
                <p>• 여러 개의 라인을 그릴 수 있으며, 쓰레기통 아이콘으로 삭제 가능합니다</p>
              </div>
            </div>
          </Card>
        </div>
      </main >

      {/* 지도 모달 */}
      {
        showMap && dbImageInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="relative h-[80vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <h3 className="text-xl font-bold">📍 실화상 위치 (지도)</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMap(false)}
                  className="rounded-full hover:bg-gray-100"
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
              <div className="h-[calc(100%-64px)] w-full">
                <KakaoMapViewer
                  latitude={parseFloat(dbImageInfo.gps_latitude)}
                  longitude={parseFloat(dbImageInfo.gps_longitude)}
                />
              </div>
            </div>
          </div>
        )
      }
    </div >
  )
}

