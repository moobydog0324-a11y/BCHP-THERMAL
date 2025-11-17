"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Activity, ArrowLeft, CheckCircle2, Upload, Database, ImageIcon, ClipboardList, Folder, X, FileImage, Loader2, AlertCircle } from "lucide-react"

type UploadType = "pipe" | "inspection" | "image" | null

type UploadResult = {
  fileName: string
  status: "pending" | "uploading" | "success" | "error"
  message?: string
  imageType?: "thermal" | "real" // 자동 감지된 이미지 타입
  detectedBy?: "metadata" | "filename" | "manual" // 감지 방법
}

type SectionCategory = 'A-1' | 'A-2' | 'B-1' | 'B-2' | 'C-1' | 'C-2' | 'D-1' | 'D-2' | 'E-1' | 'E-2' | 'F-1' | 'F-2' | 'G-1' | 'G-2'

export default function UploadPage() {
  const [selectedType, setSelectedType] = useState<UploadType>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [captureDate, setCaptureDate] = useState("")
  const [captureHour, setCaptureHour] = useState("")
  const [captureMinute, setCaptureMinute] = useState("")
  const [imageType, setImageType] = useState<"thermal" | "real">("thermal")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([])
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  })
  const [selectedSection, setSelectedSection] = useState<SectionCategory | null>(null)
  const [inspectionId, setInspectionId] = useState<number | null>(null)
  const [isCreatingInspection, setIsCreatingInspection] = useState(false)
  const [weather, setWeather] = useState<string>("")
  const [ambientTemp, setAmbientTemp] = useState<string>("") // 주변 온도
  const [metadataExtracted, setMetadataExtracted] = useState(false) // 메타데이터 추출 여부
  
  // Supabase Storage 경로 계산
  const getStoragePath = () => {
    if (!selectedSection) return "구간을 선택하면 저장 경로가 표시됩니다"
    if (!captureDate) return `${selectedSection}/ ← 날짜를 선택하세요`
    
    const date = new Date(captureDate)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    return `thermal-images/${selectedSection}/${year}/${month}/${day}/${imageType}/`
  }

  // 메타데이터 분석
  const analyzeMetadata = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append("file", file)
      
      const response = await fetch("/api/exif/analyze", {
        method: "POST",
        body: formData,
      })
      
      const result = await response.json()
      
      if (result.success && result.thermal_data) {
        console.log(`📸 ${file.name} 메타데이터:`, result.thermal_data)
        return result.thermal_data
      }
      
      return null
    } catch (error) {
      console.error("메타데이터 분석 오류:", error)
      return null
    }
  }

  // 이미지 타입 자동 감지
  const detectImageType = async (file: File): Promise<{ type: "thermal" | "real", detectedBy: "metadata" | "filename" }> => {
    // 1. 파일명으로 먼저 판단 (빠른 감지)
    const fileName = file.name.toLowerCase()
    if (fileName.includes('ir_') || fileName.includes('flir') || fileName.includes('thermal')) {
      console.log(`🔍 [${file.name}] 파일명으로 열화상 감지`)
      return { type: "thermal", detectedBy: "filename" }
    }
    if (fileName.includes('rgb') || fileName.includes('real') || fileName.includes('visible')) {
      console.log(`🔍 [${file.name}] 파일명으로 실화상 감지`)
      return { type: "real", detectedBy: "filename" }
    }

    // 2. 메타데이터로 정확한 판단
    const metadata = await analyzeMetadata(file)
    if (metadata) {
      // FLIR 카메라 모델 확인
      const cameraModel = metadata.Model || metadata.Make || ''
      if (cameraModel.toLowerCase().includes('flir')) {
        console.log(`🔍 [${file.name}] 메타데이터로 열화상 감지 (카메라: ${cameraModel})`)
        return { type: "thermal", detectedBy: "metadata" }
      }

      // 열화상 관련 데이터 존재 여부 확인
      if (metadata.CameraTemperatureRangeMax || metadata.PlanckR1 || metadata.actual_temp_stats) {
        console.log(`🔍 [${file.name}] 메타데이터로 열화상 감지 (온도 데이터 존재)`)
        return { type: "thermal", detectedBy: "metadata" }
      }
    }

    // 3. 기본값: 실화상으로 분류
    console.log(`🔍 [${file.name}] 기본값으로 실화상 분류`)
    return { type: "real", detectedBy: "filename" }
  }

  // 파일 선택 핸들러
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const fileArray = Array.from(files)
      setSelectedFiles(fileArray)
      
      // 초기 상태 설정 (분석 중)
      setUploadResults(
        fileArray.map((file) => ({
          fileName: file.name,
          status: "pending" as const,
          imageType: undefined,
          detectedBy: undefined,
        }))
      )
      
      console.log(`🔍 ${fileArray.length}개 파일의 이미지 타입 자동 감지 시작...`)
      
      // 각 파일의 이미지 타입 자동 감지
      const detectionPromises = fileArray.map(async (file, index) => {
        const detection = await detectImageType(file)
        return { index, detection }
      })
      
      const detectionResults = await Promise.all(detectionPromises)
      
      // 감지 결과 업데이트
      setUploadResults((prev) =>
        prev.map((result, index) => {
          const detectionResult = detectionResults.find((r) => r.index === index)
          return {
            ...result,
            imageType: detectionResult?.detection.type,
            detectedBy: detectionResult?.detection.detectedBy,
          }
        })
      )
      
      // 통계 출력
      const thermalCount = detectionResults.filter((r) => r.detection.type === "thermal").length
      const realCount = detectionResults.filter((r) => r.detection.type === "real").length
      console.log(`✅ 자동 감지 완료: 열화상 ${thermalCount}개, 실화상 ${realCount}개`)
      
      // 첫 번째 파일의 메타데이터로 촬영 시간 자동 설정
      if (fileArray.length > 0) {
        const metadata = await analyzeMetadata(fileArray[0])
        if (metadata) {
          console.log("✅ 메타데이터 추출 성공:", metadata)
          // 촬영 시간이 있으면 자동으로 설정
          if (metadata.DateTimeOriginal) {
            const date = new Date(metadata.DateTimeOriginal)
            if (!isNaN(date.getTime())) {
              const dateStr = date.toISOString().split('T')[0]
              const hours = String(date.getHours()).padStart(2, '0')
              const minutes = String(date.getMinutes()).padStart(2, '0')
              
              setCaptureDate(dateStr)
              setCaptureHour(hours)
              setCaptureMinute(minutes)
              setMetadataExtracted(true) // ✅ 메타데이터 추출 성공
              
              console.log(`📅 메타데이터에서 자동 추출: ${dateStr} ${hours}:${minutes}`)
            }
          } else {
            setMetadataExtracted(false) // 메타데이터에 날짜 정보 없음
          }
        } else {
          setMetadataExtracted(false) // 메타데이터 추출 실패
        }
      } else {
        setMetadataExtracted(false) // 파일 없음
      }
    }
  }

  // 파일 제거
  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
    setUploadResults((prev) => prev.filter((_, i) => i !== index))
  }

  // 구간 선택 및 점검 자동 생성
  const handleSectionSelect = async (section: SectionCategory) => {
    setSelectedSection(section)
    setIsCreatingInspection(true)
    setErrorMessage("")

    console.log('구간 선택:', section)

    try {
      // 해당 구간에 대한 점검 자동 생성
      const response = await fetch(`/api/sections/${section}/inspection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspector_name: "시스템",
          notes: `${section} 구간 이미지 업로드`,
          weather_condition: weather || null,
          ambient_temp_celsius: ambientTemp ? parseFloat(ambientTemp) : null,
        }),
      })

      console.log('응답 상태:', response.status)
      console.log('응답 헤더:', response.headers)
      
      const responseText = await response.text()
      console.log('응답 원본:', responseText)
      
      let result
      try {
        result = JSON.parse(responseText)
      } catch (parseError) {
        console.error('JSON 파싱 오류:', parseError)
        console.error('응답 내용:', responseText)
        setErrorMessage(`서버 응답 파싱 실패: ${responseText.substring(0, 100)}`)
        setSelectedSection(null)
        return
      }
      
      console.log('응답 결과:', result)

      if (result.success) {
        setInspectionId(result.data.inspection.inspection_id)
        console.log('점검 ID 설정:', result.data.inspection.inspection_id)
      } else {
        console.error('점검 생성 실패:', result.error)
        console.error('상세 정보:', result.details)
        setErrorMessage(result.error || "점검 생성에 실패했습니다.")
        setSelectedSection(null)
      }
    } catch (error) {
      console.error('통신 오류:', error)
      setErrorMessage(`서버와의 통신 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
      setSelectedSection(null)
    } finally {
      setIsCreatingInspection(false)
    }
  }

  const handlePipeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMessage("")

    const formData = new FormData(e.currentTarget)
    const pipeData = {
      pipe_code: formData.get("pipe_code"),
      location: formData.get("location"),
      material: formData.get("material"),
      diameter_mm: formData.get("diameter_mm") ? Number(formData.get("diameter_mm")) : null,
      length_m: formData.get("length_m") ? Number(formData.get("length_m")) : null,
      installation_date: formData.get("installation_date"),
      notes: formData.get("notes"),
    }

    try {
      const response = await fetch("/api/pipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pipeData),
      })

      const result = await response.json()

      if (result.success) {
        setUploadSuccess(true)
        setTimeout(() => {
          setUploadSuccess(false)
          setSelectedType(null)
          ;(e.target as HTMLFormElement).reset()
        }, 2000)
      } else {
        setErrorMessage(result.error || "업로드 중 오류가 발생했습니다.")
      }
    } catch (error) {
      setErrorMessage("서버와의 통신 중 오류가 발생했습니다.")
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInspectionSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMessage("")

    const formData = new FormData(e.currentTarget)
    const inspectionData = {
      pipe_id: Number(formData.get("pipe_id")),
      inspection_date: formData.get("inspection_date"),
      inspector_name: formData.get("inspector_name"),
      weather_condition: formData.get("weather_condition"),
      ambient_temp_celsius: formData.get("ambient_temp_celsius")
        ? Number(formData.get("ambient_temp_celsius"))
        : null,
      notes: formData.get("notes"),
      status: formData.get("status") || "completed",
    }

    try {
      const response = await fetch("/api/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inspectionData),
      })

      const result = await response.json()

      if (result.success) {
        setUploadSuccess(true)
        setTimeout(() => {
          setUploadSuccess(false)
          setSelectedType(null)
          ;(e.target as HTMLFormElement).reset()
        }, 2000)
      } else {
        setErrorMessage(result.error || "업로드 중 오류가 발생했습니다.")
      }
    } catch (error) {
      setErrorMessage("서버와의 통신 중 오류가 발생했습니다.")
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleImageSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMessage("")

    const form = e.currentTarget
    const notes = (form.elements.namedItem("notes") as HTMLTextAreaElement).value
    
    // 구간 선택 검증
    if (!selectedSection || !inspectionId) {
      setErrorMessage("구간을 먼저 선택해주세요.")
      setIsSubmitting(false)
      return
    }

    // 파일 선택 검증
    if (selectedFiles.length === 0) {
      setErrorMessage("업로드할 이미지를 선택해주세요.")
      setIsSubmitting(false)
      return
    }
    
    // 촬영 시간 생성 (있으면 사용, 없으면 서버에서 메타데이터 또는 현재 시간 사용)
    let captureTimestamp = null
    if (captureDate && captureHour && captureMinute) {
      const captureTime = `${captureHour}:${captureMinute}`
      captureTimestamp = `${captureDate}T${captureTime}`
      console.log('📅 사용자 지정 시간 사용:', captureTimestamp)
    } else {
      console.log('📅 촬영 시간 미지정 - 서버에서 메타데이터 또는 현재 시간 사용')
    }
    
    // 진행률 초기화
    setUploadProgress({ current: 0, total: selectedFiles.length })
    
    let successCount = 0
    let errorCount = 0

    // 각 파일을 순차적으로 업로드
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      const fileResult = uploadResults[i]
      
      // 자동 감지된 이미지 타입 사용 (없으면 기본값 "thermal")
      const detectedImageType = fileResult?.imageType || "thermal"
      
      // 상태 업데이트: uploading
      setUploadResults((prev) =>
        prev.map((result, idx) =>
          idx === i ? { ...result, status: "uploading" } : result
        )
      )

      try {
        const formData = new FormData()
        formData.append("inspection_id", inspectionId.toString())
        formData.append("image_type", detectedImageType) // 자동 감지된 타입 사용
        formData.append("image_file", file)
        // 촬영 시간이 있으면 전달, 없으면 서버에서 메타데이터 또는 현재 시간 사용
        if (captureTimestamp) {
          formData.append("capture_timestamp", captureTimestamp)
        }
        formData.append("notes", notes)
        
        console.log(`📤 [${file.name}] 업로드 시작 - 타입: ${detectedImageType} (${fileResult?.detectedBy})`)

        console.log(`📤 파일 업로드 시작: ${file.name}`)
        
        const response = await fetch("/api/thermal-images", {
          method: "POST",
          body: formData,
        })

        console.log(`📥 서버 응답: ${response.status}`)
        
        const result = await response.json()
        console.log(`📊 결과:`, result)

        if (result.success) {
          successCount++
          setUploadResults((prev) =>
            prev.map((r, idx) =>
              idx === i
                ? { ...r, status: "success", message: "업로드 완료" }
                : r
            )
          )
        } else {
          errorCount++
          setUploadResults((prev) =>
            prev.map((r, idx) =>
              idx === i
                ? { ...r, status: "error", message: result.error || "업로드 실패" }
                : r
            )
          )
        }
      } catch (error) {
        errorCount++
        const errorMsg = error instanceof Error ? error.message : "서버 오류"
        console.error(`❌ 업로드 오류:`, error)
        setUploadResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, status: "error", message: errorMsg }
              : r
          )
        )
      }

      // 진행률 업데이트
      setUploadProgress({ current: i + 1, total: selectedFiles.length })
    }

    setIsSubmitting(false)

    // 결과 메시지
    if (errorCount === 0) {
      setUploadSuccess(true)
      // 성공 시 5초 후 자동 초기화 (또는 사용자가 다음 단계 선택)
      setTimeout(() => {
        // 자동 초기화하지 않고 사용자가 선택하도록 변경
      }, 5000)
    } else {
      setErrorMessage(
        `${successCount}개 성공, ${errorCount}개 실패했습니다. 실패한 파일을 확인해주세요.`
      )
    }
  }

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
              <p className="text-xs text-muted-foreground">데이터 업로드</p>
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

      <main className="container mx-auto px-6 py-12">
        {/* Title Section */}
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-4xl font-bold text-foreground">데이터 업로드</h2>
          <p className="text-lg text-muted-foreground">
            배관 정보, 점검 기록, 배관 이미지를 등록하세요
          </p>
        </div>

        {!selectedType ? (
          // Type Selection Cards
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
            <Card
              className="cursor-pointer border-border bg-card p-8 transition-all hover:border-primary hover:shadow-lg"
              onClick={() => setSelectedType("pipe")}
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
                <Database className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-card-foreground">배관 정보</h3>
              <p className="text-sm text-muted-foreground">새로운 배관 데이터를 등록합니다</p>
            </Card>

            <Card
              className="cursor-pointer border-border bg-card p-8 transition-all hover:border-primary hover:shadow-lg"
              onClick={() => setSelectedType("inspection")}
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
                <ClipboardList className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-card-foreground">점검 기록</h3>
              <p className="text-sm text-muted-foreground">열화상 점검 결과를 등록합니다</p>
            </Card>

            <Card
              className="cursor-pointer border-border bg-card p-8 transition-all hover:border-primary hover:shadow-lg"
              onClick={() => setSelectedType("image")}
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
                <ImageIcon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-card-foreground">
                배관 이미지<br />
                <span className="text-base text-muted-foreground">(실화상, 열화상)</span>
              </h3>
              <p className="text-sm text-muted-foreground">촬영한 배관 이미지를 업로드합니다</p>
            </Card>
          </div>
        ) : (
          // Form Section
          <div className="mx-auto max-w-2xl">
            <Card className="border-border bg-card p-8">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-card-foreground">
                  {selectedType === "pipe" && "배관 정보 등록"}
                  {selectedType === "inspection" && "점검 기록 등록"}
                  {selectedType === "image" && (
                    <>
                      배관 이미지 업로드<br />
                      <span className="text-lg text-muted-foreground">(실화상, 열화상)</span>
                    </>
                  )}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  뒤로
                </Button>
              </div>

              {uploadSuccess && (
                <div className="mb-6 space-y-3 rounded-lg bg-green-500/10 p-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">✅ 업로드가 완료되었습니다!</span>
                  </div>
                  <div className="text-sm text-green-700">
                    {selectedSection && `📍 구역: ${selectedSection}`}
                    {' | '}
                    {selectedFiles.length}개 파일 업로드 완료
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Link href="/compare">
                      <Button size="sm" variant="default">
                        📊 시간대별 비교하기
                      </Button>
                    </Link>
                    <Link href="/gps-compare">
                      <Button size="sm" variant="default">
                        📍 GPS 기반 비교하기
                      </Button>
                    </Link>
                    <Link href="/thermal-analysis">
                      <Button size="sm" variant="outline">
                        🌡️ 온도 분석 보기
                      </Button>
                    </Link>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setUploadSuccess(false)
                        setSelectedType(null)
                        setCaptureDate("")
                        setCaptureHour("")
                        setCaptureMinute("")
                        setImageType("thermal")
                        setSelectedFiles([])
                        setUploadResults([])
                        setSelectedSection(null)
                        setInspectionId(null)
                      }}
                    >
                      ➕ 더 업로드하기
                    </Button>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="mb-6 rounded-lg bg-red-500/10 p-4 text-red-600">
                  <span className="font-medium">{errorMessage}</span>
                </div>
              )}

              {/* Pipe Form */}
              {selectedType === "pipe" && (
                <form onSubmit={handlePipeSubmit} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      배관 코드 <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="pipe_code"
                      type="text"
                      required
                      placeholder="예: PIPE-A-001"
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      위치 <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="location"
                      type="text"
                      required
                      placeholder="예: 반월공단 A동 1층"
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">재질</label>
                      <select
                        name="material"
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                      >
                        <option value="">선택</option>
                        <option value="Steel">Steel (강철)</option>
                        <option value="Copper">Copper (구리)</option>
                        <option value="PVC">PVC</option>
                        <option value="Stainless">Stainless (스테인리스)</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        직경 (mm)
                      </label>
                      <input
                        name="diameter_mm"
                        type="number"
                        step="0.01"
                        placeholder="예: 150"
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        길이 (m)
                      </label>
                      <input
                        name="length_m"
                        type="number"
                        step="0.01"
                        placeholder="예: 50"
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        설치일
                      </label>
                      <input
                        name="installation_date"
                        type="date"
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">메모</label>
                    <textarea
                      name="notes"
                      rows={3}
                      placeholder="추가 정보를 입력하세요"
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isSubmitting ? (
                      "업로드 중..."
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        배관 정보 등록
                      </>
                    )}
                  </Button>
                </form>
              )}

              {/* Inspection Form */}
              {selectedType === "inspection" && (
                <form onSubmit={handleInspectionSubmit} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      배관 ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="pipe_id"
                      type="number"
                      required
                      placeholder="예: 1"
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      점검할 배관의 ID를 입력하세요
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        점검 일시 <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="inspection_date"
                        type="datetime-local"
                        required
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        점검자 <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="inspector_name"
                        type="text"
                        required
                        placeholder="예: 김철수"
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        날씨 상태
                      </label>
                      <select
                        name="weather_condition"
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                      >
                        <option value="">선택</option>
                        <option value="맑음">맑음</option>
                        <option value="흐림">흐림</option>
                        <option value="비">비</option>
                        <option value="눈">눈</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        주변 온도 (°C)
                      </label>
                      <input
                        name="ambient_temp_celsius"
                        type="number"
                        step="0.1"
                        placeholder="예: 22.5"
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">상태</label>
                    <select
                      name="status"
                      defaultValue="completed"
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value="completed">완료</option>
                      <option value="pending">대기중</option>
                      <option value="in_progress">진행중</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">메모</label>
                    <textarea
                      name="notes"
                      rows={3}
                      placeholder="점검 내용을 입력하세요"
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isSubmitting ? (
                      "업로드 중..."
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        점검 기록 등록
                      </>
                    )}
                  </Button>
                </form>
              )}

              {/* Image Form */}
              {selectedType === "image" && (
                <form onSubmit={handleImageSubmit} className="space-y-4">
                  {/* 구간 카테고리 선택 */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      구간 선택 <span className="text-red-500">*</span>
                    </label>
                    {!selectedSection ? (
                      <>
                        <div className="grid grid-cols-7 gap-2">
                          {(['A-1', 'A-2', 'B-1', 'B-2', 'C-1', 'C-2', 'D-1', 'D-2', 'E-1', 'E-2', 'F-1', 'F-2', 'G-1', 'G-2'] as SectionCategory[]).map((section) => (
                            <button
                              key={section}
                              type="button"
                              onClick={() => handleSectionSelect(section)}
                              disabled={isCreatingInspection}
                              className="rounded-lg border-2 border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-all hover:border-primary hover:bg-primary/10 disabled:opacity-50"
                            >
                              {section}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          📍 이미지를 업로드할 구간을 선택하세요 (자동으로 점검 기록이 생성됩니다)
                        </p>
                      </>
                    ) : (
                      <div className="flex items-center justify-between rounded-lg border-2 border-primary bg-primary/10 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                            {selectedSection}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              선택된 구간: {selectedSection}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              점검 ID: {inspectionId}
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedSection(null)
                            setInspectionId(null)
                          }}
                          className="text-xs"
                        >
                          변경
                        </Button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      이미지 파일 (다중 선택 가능) <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="image_file"
                      type="file"
                      multiple
                      required
                      accept="image/jpeg,image/jpg,image/png,image/tiff"
                      onChange={handleFileSelect}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
                    />
                    <div className="mt-2 rounded-lg bg-blue-500/10 p-3">
                      <p className="text-xs text-blue-600">
                        <span className="font-semibold">✨ 자동 분류 기능</span><br />
                        파일의 메타데이터와 파일명을 분석하여 자동으로 열화상/실화상을 구분합니다.<br />
                        잘못 분류된 경우 '변경' 버튼으로 수정할 수 있습니다.
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      📎 여러 파일 선택 가능 | JPG, PNG, TIFF 형식 지원 (각 파일 최대 50MB)
                    </p>
                  </div>

                  {/* 선택된 파일 목록 */}
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-foreground">
                          📋 선택된 파일 ({selectedFiles.length}개)
                          {uploadResults.some(r => r.imageType) && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (🌡️ 열화상 {uploadResults.filter(r => r.imageType === "thermal").length}개 
                              / 📷 실화상 {uploadResults.filter(r => r.imageType === "real").length}개)
                            </span>
                          )}
                        </div>
                        {!isSubmitting && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedFiles([])
                              setUploadResults([])
                            }}
                            className="h-7 text-xs"
                          >
                            전체 제거
                          </Button>
                        )}
                      </div>
                      <div className="max-h-60 space-y-2 overflow-y-auto">
                        {selectedFiles.map((file, index) => {
                          const result = uploadResults[index]
                          const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)

                          return (
                            <div
                              key={index}
                              className="flex items-center justify-between rounded-md border border-border bg-background p-3"
                            >
                              <div className="flex flex-1 items-center gap-3">
                                <FileImage className="h-5 w-5 flex-shrink-0 text-primary" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="truncate text-sm font-medium text-foreground">
                                      {file.name}
                                    </div>
                                    {result?.imageType && (
                                      <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                        result.imageType === "thermal" 
                                          ? "bg-red-500/10 text-red-600" 
                                          : "bg-blue-500/10 text-blue-600"
                                      }`}>
                                        {result.imageType === "thermal" ? "🌡️ 열화상" : "📷 실화상"}
                                        {result.detectedBy === "metadata" && (
                                          <span className="text-[10px] opacity-70">(메타데이터)</span>
                                        )}
                                        {result.detectedBy === "filename" && (
                                          <span className="text-[10px] opacity-70">(파일명)</span>
                                        )}
                                      </div>
                                    )}
                                    {!result?.imageType && (
                                      <div className="flex items-center gap-1 rounded-full bg-gray-500/10 px-2 py-0.5 text-xs text-gray-600">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        <span>분석 중...</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {fileSizeMB} MB
                                  </div>
                                </div>
                              </div>

                              {/* 상태 표시 */}
                              <div className="ml-3 flex items-center gap-2">
                                {result?.status === "pending" && !isSubmitting && (
                                  <>
                                    {result?.imageType && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setUploadResults((prev) =>
                                            prev.map((r, idx) =>
                                              idx === index
                                                ? { ...r, imageType: r.imageType === "thermal" ? "real" : "thermal", detectedBy: "manual" }
                                                : r
                                            )
                                          )
                                        }}
                                        className="h-7 text-xs"
                                      >
                                        변경
                                      </Button>
                                    )}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeFile(index)}
                                      className="h-7 w-7 p-0"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                {result?.status === "uploading" && (
                                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                )}
                                {result?.status === "success" && (
                                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                                )}
                                {result?.status === "error" && (
                                  <div className="flex items-center gap-1">
                                    <AlertCircle className="h-5 w-5 text-red-600" />
                                    <span className="text-xs text-red-600">{result.message}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 업로드 진행률 */}
                  {isSubmitting && uploadProgress.total > 0 && (
                    <div className="space-y-2 rounded-lg border border-primary bg-primary/5 p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">업로드 중...</span>
                        <span className="font-semibold text-primary">
                          {uploadProgress.current} / {uploadProgress.total}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{
                            width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 촬영 날짜 및 시간 */}
                  <div className="space-y-3 rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <Folder className="h-4 w-4" />
                        촬영 날짜/시간
                      </div>
                      {metadataExtracted && (
                        <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          메타데이터에서 자동 추출
                        </div>
                      )}
                    </div>
                    
                    {metadataExtracted ? (
                      // 메타데이터 추출 성공 - 자동 설정된 값 표시
                      <div className="space-y-3">
                        <div className="rounded-lg border-2 border-green-500/20 bg-green-500/5 p-4">
                          <div className="mb-2 text-sm font-medium text-foreground">
                            ✅ EXIF 메타데이터에서 자동으로 촬영 시간을 추출했습니다
                          </div>
                          <div className="flex items-center gap-2 text-2xl font-bold text-green-700">
                            📅 {captureDate} {captureHour}:{captureMinute}
                          </div>
                          <div className="mt-3 text-xs text-muted-foreground">
                            💡 자동 추출된 값이 정확하지 않다면 아래에서 수동으로 변경할 수 있습니다.
                          </div>
                        </div>
                        
                        {/* 수동 수정 옵션 */}
                        <details className="group">
                          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                            🔧 수동으로 수정하기 (선택사항)
                          </summary>
                          <div className="mt-3 grid gap-4 md:grid-cols-3">
                            <div className="md:col-span-1">
                              <label className="mb-2 block text-sm font-medium text-foreground">
                                촬영 날짜
                              </label>
                              <input
                                name="capture_date"
                                type="date"
                                value={captureDate}
                                onChange={(e) => setCaptureDate(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="mb-2 block text-sm font-medium text-foreground">시</label>
                              <select
                                name="capture_hour"
                                value={captureHour}
                                onChange={(e) => setCaptureHour(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                              >
                                {Array.from({ length: 24 }, (_, i) => (
                                  <option key={i} value={String(i).padStart(2, '0')}>
                                    {String(i).padStart(2, '0')}시
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-2 block text-sm font-medium text-foreground">분</label>
                              <select
                                name="capture_minute"
                                value={captureMinute}
                                onChange={(e) => setCaptureMinute(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                              >
                                {Array.from({ length: 60 }, (_, i) => (
                                  <option key={i} value={String(i).padStart(2, '0')}>
                                    {String(i).padStart(2, '0')}분
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </details>
                      </div>
                    ) : (
                      // 메타데이터 없음 - 수동 입력 가능 (선택사항)
                      <div className="space-y-3">
                        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-700">
                          💡 이미지에 EXIF 메타데이터가 없거나 추출에 실패했습니다.<br />
                          촬영 날짜/시간을 입력하지 않으면 <strong>이미지 파일의 메타데이터 또는 현재 시간</strong>이 자동으로 사용됩니다.
                        </div>
                        
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="md:col-span-1">
                            <label className="mb-2 block text-sm font-medium text-foreground">
                              촬영 날짜 (선택사항)
                            </label>
                            <input
                              name="capture_date"
                              type="date"
                              value={captureDate}
                              onChange={(e) => setCaptureDate(e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-foreground">
                              시 (선택사항)
                            </label>
                            <select
                              name="capture_hour"
                              value={captureHour}
                              onChange={(e) => setCaptureHour(e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                            >
                              <option value="">시간</option>
                              {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={String(i).padStart(2, '0')}>
                                  {String(i).padStart(2, '0')}시
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-foreground">
                              분 (선택사항)
                            </label>
                            <select
                              name="capture_minute"
                              value={captureMinute}
                              onChange={(e) => setCaptureMinute(e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                            >
                              <option value="">분</option>
                              {Array.from({ length: 60 }, (_, i) => (
                                <option key={i} value={String(i).padStart(2, '0')}>
                                  {String(i).padStart(2, '0')}분
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        
                        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                          ℹ️ <strong>촬영 시간 결정 순서:</strong><br />
                          1️⃣ 수동 입력한 시간<br />
                          2️⃣ 이미지 EXIF 메타데이터의 DateTimeOriginal<br />
                          3️⃣ 현재 시간 (업로드 시점)
                        </div>
                      </div>
                    )}

                    {/* 저장 경로 미리보기 */}
                    <div className="rounded-md bg-muted/50 p-3">
                      <div className="mb-1 text-xs font-medium text-muted-foreground">
                        📁 저장될 폴더 경로:
                      </div>
                      <div className="font-mono text-sm text-foreground">
                        {getStoragePath()}
                      </div>
                    </div>
                  </div>

                  {/* 촬영 날씨 및 온도 */}
                  <div className="space-y-3 rounded-lg border-2 border-blue-500/20 bg-blue-500/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                      🌤️ 촬영 환경 정보 (선택사항)
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          날씨
                        </label>
                        <select
                          value={weather}
                          onChange={(e) => setWeather(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                        >
                          <option value="">날씨 선택 (선택사항)</option>
                          <option value="맑음">☀️ 맑음</option>
                          <option value="구름 조금">🌤️ 구름 조금</option>
                          <option value="구름 많음">⛅ 구름 많음</option>
                          <option value="흐림">☁️ 흐림</option>
                          <option value="비">🌧️ 비</option>
                          <option value="눈">❄️ 눈</option>
                          <option value="안개">🌫️ 안개</option>
                          <option value="황사">🏜️ 황사</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          주변 온도 (°C)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="예: 22.5"
                          value={ambientTemp}
                          onChange={(e) => setAmbientTemp(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      💡 날씨와 온도 정보는 점검 기록에 저장되어 열화상 분석에 활용됩니다
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">메모</label>
                    <textarea
                      name="notes"
                      rows={3}
                      placeholder="추가 정보를 입력하세요"
                      className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting || selectedFiles.length === 0}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {uploadProgress.current} / {uploadProgress.total} 업로드 중...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        {selectedFiles.length > 0
                          ? `${selectedFiles.length}개 파일 업로드`
                          : "이미지 업로드"}
                      </>
                    )}
                  </Button>
                </form>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}

