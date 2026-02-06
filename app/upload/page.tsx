"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Activity, ArrowLeft, CheckCircle2, Upload, Database, ImageIcon, ClipboardList, Folder, X, FileImage, Loader2, AlertCircle } from "lucide-react"

type UploadType = "pipe" | "inspection" | "image" | null

type UploadResult = {
  fileName: string
  status: "pending" | "uploading" | "success" | "error" | "warning"
  message?: string
  imageType?: "thermal" | "real" // 자동 감지된 이미지 타입
  detectedBy?: "metadata" | "filename" | "manual" // 감지 방법
  temperatureExtracted?: boolean // 온도 데이터 추출 여부
  metadataExtracted?: boolean // 메타데이터 추출 여부
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
  // ✅ 업로드 완료 팝업 상태
  const [showUploadComplete, setShowUploadComplete] = useState(false)

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

  // 파일명으로 빠르게 이미지 타입 추측 (메타데이터 분석 X)
  const detectImageTypeByFilename = (fileName: string): { type: "thermal" | "real", detectedBy: "filename" } => {
    const lowerName = fileName.toLowerCase()

    // 확장자 패턴 확인: 파일명R.jpg = 열화상, 파일명.jpg = 실화상
    // 예: DJI_0001R.jpg (열화상), DJI_0001.jpg (실화상)
    if (/r\.(jpg|jpeg|png|tiff|tif)$/i.test(lowerName)) {
      console.log(`⚡ [${fileName}] 확장자 패턴으로 열화상 감지 (파일명R.jpg)`)
      return { type: "thermal", detectedBy: "filename" }
    }

    // 기타 열화상 관련 키워드 (FLIR 카메라 등)
    if (lowerName.includes('ir_') || lowerName.includes('flir') || lowerName.includes('thermal') || lowerName.includes('_ir.')) {
      console.log(`⚡ [${fileName}] 키워드로 열화상 감지`)
      return { type: "thermal", detectedBy: "filename" }
    }

    // 실화상 관련 키워드
    if (lowerName.includes('rgb') || lowerName.includes('real') || lowerName.includes('visible') || lowerName.includes('_rgb.')) {
      console.log(`⚡ [${fileName}] 키워드로 실화상 감지`)
      return { type: "real", detectedBy: "filename" }
    }

    // 기본값: R 없이 .jpg로 끝나면 실화상
    console.log(`⚡ [${fileName}] 기본값으로 실화상 분류 (R 없음)`)
    return { type: "real", detectedBy: "filename" }
  }

  // 이미지 타입 정밀 감지 (메타데이터 분석 포함)
  const detectImageTypeWithMetadata = async (file: File): Promise<{ type: "thermal" | "real", detectedBy: "metadata" | "filename", thermalData?: any }> => {
    const fileName = file.name.toLowerCase()
    let detectedType: "thermal" | "real" = "real" // 기본값
    let detectedBy: "metadata" | "filename" = "filename"

    // 1. 파일명으로 1차 판단
    if (/r\.(jpg|jpeg|png|tiff|tif)$/i.test(fileName) || fileName.includes('ir_') || fileName.includes('flir') || fileName.includes('thermal')) {
      console.log(`🔍 [${file.name}] 파일명으로 열화상 추정 (분석 시작)`)
      detectedType = "thermal"
    } else if (fileName.includes('rgb') || fileName.includes('real') || fileName.includes('visible')) {
      detectedType = "real"
    }

    // 2. 메타데이터 분석 (열화상 추정시 필수, 그외에도 확인)
    // 실화상으로 추정되더라도 혹시 모르니 분석할 수도 있지만, 일단 열화상 추정인 경우는 무조건 분석해야 함.
    let thermalData = null

    // 열화상으로 감지되었거나, 아직 확실하지 않은 경우(기본값) 분석 시도
    if (detectedType === "thermal" || detectedType === "real") {
      // *참고: 실화상 파일명이라도 메타데이터에 온도가 있을 수 있으므로 다 해보는 게 좋음.
      // 하지만 성능 이슈가 있다면 thermal일 때만. 여기선 정확도가 중요하므로 다 해본다.
      // 다만 파일명으로 Real이 확실하면(키워드 등) 건너뛰고 싶을 수 있음.
      // 기존 로직 유지: 파일명에 R이 없으면 Real로 보던 걸 보완.

      const metadata = await analyzeMetadata(file)
      if (metadata) {
        thermalData = metadata

        // 데이터가 있으면 열화상으로 확정
        if (metadata.actual_temp_stats || metadata.CameraTemperatureRangeMax || (metadata.Model && metadata.Model.includes('FLIR'))) {
          detectedType = "thermal"
          detectedBy = "metadata"
          console.log(`✅ [${file.name}] 메타데이터 분석 성공: 열화상 데이터 확보`)
        }
      }
    }

    // 3. 파일명은 열화상 같은데 분석 실패한 경우? -> 그래도 열화상으로 취급하되 데이터는 없음 (경고 필요)
    if (detectedType === "thermal" && !thermalData) {
      console.warn(`⚠️ [${file.name}] 파일명은 열화상 같으나 온도 데이터 추출 실패`)
    }

    return { type: detectedType, detectedBy, thermalData }
  }

  // 파일 선택 핸들러
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      let fileArray = Array.from(files)

      // 이미지 파일만 필터링
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.tiff', '.tif']
      fileArray = fileArray.filter((file) => {
        const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
        return imageExtensions.includes(ext)
      })

      if (fileArray.length === 0) {
        setErrorMessage("선택한 폴더/파일에 이미지가 없습니다. (JPG, PNG, TIFF 형식만 지원)")
        return
      }

      if (fileArray.length !== files.length) {
        console.log(`⚠️ ${files.length - fileArray.length}개 파일 제외 (이미지가 아님)`)
      }

      console.log(`📁 ${fileArray.length}개 이미지 파일 선택됨`)

      setSelectedFiles(fileArray)
      setErrorMessage("") // 에러 메시지 초기화

      // 파일명으로 빠르게 타입 추측 (즉시 표시)
      console.log(`⚡ 파일명으로 빠른 분류 시작...`)

      const quickResults = fileArray.map((file) => {
        const detection = detectImageTypeByFilename(file.name)
        return {
          fileName: file.name,
          status: "pending" as const,
          imageType: detection.type,
          detectedBy: "filename" as const,
        }
      })

      setUploadResults(quickResults)

      // 통계 출력
      const thermalCount = quickResults.filter((r) => r.imageType === "thermal").length
      const realCount = quickResults.filter((r) => r.imageType === "real").length
      console.log(`⚡ 빠른 분류 완료: 열화상 ${thermalCount}개, 실화상 ${realCount}개 (파일명 기준)`)
      console.log(`💡 업로드 시 메타데이터로 정밀 분석이 진행됩니다.`)

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
    const newFiles = selectedFiles.filter((_, i) => i !== index)
    const newResults = uploadResults.filter((_, i) => i !== index)

    setSelectedFiles(newFiles)
    setUploadResults(newResults)

    // 마지막 파일 제거 시 입력 필드 초기화
    if (newFiles.length === 0) {
      const fileInput = document.getElementById('file-input') as HTMLInputElement
      const folderInput = document.getElementById('folder-input') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      if (folderInput) folderInput.value = ''
    }
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
            ; (e.target as HTMLFormElement).reset()
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
            ; (e.target as HTMLFormElement).reset()
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

    // 촬영 시간 생성
    let captureTimestamp = null
    if (captureDate && captureHour && captureMinute) {
      const captureTime = `${captureHour}:${captureMinute}`
      captureTimestamp = `${captureDate}T${captureTime}`
    }

    // 진행률 초기화
    setUploadProgress({ current: 0, total: selectedFiles.length })

    let successCount = 0
    let errorCount = 0

    // 동적 import (Client Component에서 사용 시점 로드)
    const imageCompression = (await import("browser-image-compression")).default
    const exifr = (await import("exifr")).default

    // 각 파일을 순차적으로 업로드
    for (let i = 0; i < selectedFiles.length; i++) {
      const originalFile = selectedFiles[i]
      const fileResult = uploadResults[i]

      // 상태 업데이트: 처리 중
      setUploadResults((prev) =>
        prev.map((result, idx) =>
          idx === i ? { ...result, status: "uploading", message: "이미지 최적화 중..." } : result
        )
      )

      try {
        const fileName = originalFile.name
        console.log(`🚀 [${i + 1}/${selectedFiles.length}] ${fileName} 처리 시작`)

        // 1. EXIF 메타데이터 추출 (원본에서)
        console.log(`   - EXIF 데이터 추출 중...`)
        let exifData = null
        try {
          exifData = await exifr.parse(originalFile)
        } catch (e) {
          console.warn(`   ⚠️ EXIF 추출 실패:`, e)
        }

        // 별도 API로 상세 분석 (FLIR 데이터 등)
        const preciseDetection = await detectImageTypeWithMetadata(originalFile)
        const detectedImageType = preciseDetection.type
        const detectionMethod = preciseDetection.detectedBy
        const thermalData = preciseDetection.thermalData // ✅ 열화상 데이터 캡처

        setUploadResults((prev) =>
          prev.map((result, idx) =>
            idx === i ? { ...result, imageType: detectedImageType, detectedBy: detectionMethod } : result
          )
        )

        // 2. 이미지 압축 (WebP 변환 + 리사이즈) 또는 원본 유지
        let compressedFile = originalFile

        if (detectedImageType === 'thermal') {
          console.log(`   🔥 열화상 이미지 감지: 메타데이터 보존을 위해 압축 생략 (원본 사용)`)
          setUploadResults((prev) =>
            prev.map((result, idx) =>
              idx === i ? { ...result, message: "원본 유지 (메타데이터 보존)..." } : result
            )
          )
        } else {
          console.log(`   - 이미지 최적화 (WebP, Max 1280px) 진행 중...`)
          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1280,
            useWebWorker: true,
            fileType: "image/webp"
          }

          try {
            compressedFile = await imageCompression(originalFile, options)
            // 강제로 확장자 변경 (.webp)
            const newName = fileName.replace(/\.[^/.]+$/, "") + ".webp"
            compressedFile = new File([compressedFile], newName, { type: "image/webp" })
          } catch (e) {
            console.warn(`   ⚠️ 이미지 압축 실패, 원본 사용:`, e)
          }
        }

        // 3. Pre-signed URL 요청
        setUploadResults((prev) =>
          prev.map((result, idx) =>
            idx === i ? { ...result, message: "업로드 URL 요청 중..." } : result
          )
        )
        const uploadUrlRes = await fetch("/api/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: compressedFile.name,
            filetype: compressedFile.type,
            folder: `thermal-images/${selectedSection}` // 폴더 구조 개선
          })
        })

        if (!uploadUrlRes.ok) throw new Error("업로드 URL 발급 실패")
        const { uploadUrl, publicUrl } = await uploadUrlRes.json()

        // 4. R2 직접 업로드
        setUploadResults((prev) =>
          prev.map((result, idx) =>
            idx === i ? { ...result, message: "R2 스토리지 업로드 중..." } : result
          )
        )
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": compressedFile.type },
          body: compressedFile
        })

        if (!uploadRes.ok) throw new Error(`R2 업로드 실패: ${uploadRes.status}`)

        // 5. 백엔드에 메타데이터 저장 요청
        setUploadResults((prev) =>
          prev.map((result, idx) =>
            idx === i ? { ...result, message: "데이터베이스 저장 중..." } : result
          )
        )

        // JSON Body 구성
        const payload = {
          inspection_id: inspectionId,
          image_type: detectedImageType,
          image_url: publicUrl, // R2 URL 사용
          file_size: compressedFile.size,
          original_filename: fileName,
          capture_timestamp: captureTimestamp,
          notes: notes,
          exif_data: exifData, // 클라이언트에서 추출한 EXIF
          thermal_data: thermalData, // ✅ 서버 분석으로 얻은 열화상 데이터 (온도 포함)
        }

        const saveRes = await fetch("/api/thermal-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" }, // JSON 전송으로 변경
          body: JSON.stringify(payload),
        })

        const result = await saveRes.json()

        if (!saveRes.ok) throw new Error(result.error || "DB 저장 실패")

        // 성공 처리
        console.log(`✅ [${fileName}] 처리 완료`)
        successCount++
        setUploadResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                ...r,
                status: "success",
                message: "완료",
                temperatureExtracted: result.temperature_extracted,
                metadataExtracted: !!exifData
              }
              : r
          )
        )

      } catch (error) {
        errorCount++
        const errorMsg = error instanceof Error ? error.message : "알 수 없는 오류"
        console.error(`❌ [${originalFile.name}] 실패:`, errorMsg)

        setUploadResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, status: "error", message: errorMsg }
              : r
          )
        )
      }

      setUploadProgress({ current: i + 1, total: selectedFiles.length })
    }

    setIsSubmitting(false)

    if (errorCount === 0) {
      setUploadSuccess(true)
      setShowUploadComplete(true) // 팝업 표시
    } else {
      setErrorMessage(`${successCount}개 성공, ${errorCount}개 실패.`)
      // 실패했더라도 성공한게 있으면 팝업 띄울지 고민... 여기선 일단 메시지만.
      if (successCount > 0) {
        setShowUploadComplete(true)
      }
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
                        // 파일 입력 초기화
                        const fileInput = document.getElementById('file-input') as HTMLInputElement
                        const folderInput = document.getElementById('folder-input') as HTMLInputElement
                        if (fileInput) fileInput.value = ''
                        if (folderInput) folderInput.value = ''
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
                      이미지 파일/폴더 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      {/* 파일 선택 */}
                      <div className="flex-1">
                        <input
                          id="file-input"
                          name="image_file"
                          type="file"
                          multiple
                          required={selectedFiles.length === 0}
                          accept="image/jpeg,image/jpg,image/png,image/tiff"
                          onChange={handleFileSelect}
                          className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
                        />
                      </div>
                      {/* 폴더 선택 */}
                      <div className="flex-shrink-0">
                        <input
                          id="folder-input"
                          type="file"
                          multiple
                          // @ts-ignore - webkitdirectory is not in TypeScript types
                          webkitdirectory=""
                          directory=""
                          accept="image/jpeg,image/jpg,image/png,image/tiff"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('folder-input')?.click()}
                          className="h-full whitespace-nowrap"
                        >
                          <Folder className="mr-2 h-4 w-4" />
                          폴더 선택
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 rounded-lg bg-blue-500/10 p-3">
                      <p className="text-xs text-blue-600">
                        <span className="font-semibold">✨ 자동 분류 기능</span><br />
                        • 파일 선택 시: 파일명으로 빠르게 분류 (즉시 표시)<br />
                        • 업로드 진행 시: 메타데이터로 정밀 분석 (자동 보정)<br />
                        • 잘못 분류된 경우 '변경' 버튼으로 수동 수정 가능
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      📎 개별 파일 또는 폴더 전체 선택 가능 | JPG, PNG, TIFF 형식 지원 (각 파일 최대 50MB)
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
                              // 파일 입력 초기화
                              const fileInput = document.getElementById('file-input') as HTMLInputElement
                              const folderInput = document.getElementById('folder-input') as HTMLInputElement
                              if (fileInput) fileInput.value = ''
                              if (folderInput) folderInput.value = ''
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
                              className="flex items-center justify-between rounded-md border border-border bg-white dark:bg-slate-900 p-3 shadow-sm hover:shadow-md transition-all duration-200"
                            >
                              <div className="flex flex-1 items-center gap-3">
                                <FileImage className="h-5 w-5 flex-shrink-0 text-primary" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="truncate text-sm font-medium text-foreground">
                                      {file.name}
                                    </div>
                                    {result?.imageType && (
                                      <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${result.imageType === "thermal"
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
                                {result?.status === "warning" && (
                                  <AlertCircle className="h-5 w-5 text-yellow-600" />
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

                  {/* 업로드 완료 결과 (실패 파일 상세) */}
                  {!isSubmitting && uploadProgress.total > 0 && uploadResults.some(r => r.status === "error") && (
                    <Card className="border-red-500/50 bg-red-50 dark:bg-red-950/20">
                      <div className="p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-red-600" />
                          <h4 className="text-lg font-semibold text-red-900 dark:text-red-200">
                            ⚠️ 업로드 실패 파일 ({uploadResults.filter(r => r.status === "error").length}개)
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {uploadResults.map((result, index) => {
                            if (result.status !== "error") return null
                            const file = selectedFiles[index]
                            if (!file) return null

                            return (
                              <div
                                key={index}
                                className="rounded-lg border border-red-300 bg-white dark:bg-red-950/30 p-3"
                              >
                                <div className="flex items-start gap-3">
                                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-red-900 dark:text-red-200 truncate">
                                      {file.name}
                                    </div>
                                    <div className="mt-1 text-sm text-red-700 dark:text-red-300">
                                      {result.message || "알 수 없는 오류"}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      크기: {(file.size / (1024 * 1024)).toFixed(2)} MB
                                      {result.imageType && (
                                        <span className="ml-2">
                                          | 타입: {result.imageType === "thermal" ? "🌡️ 열화상" : "📷 실화상"}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div className="mt-4 text-sm text-red-800 dark:text-red-300">
                          💡 <strong>대처 방법:</strong>
                          <ul className="ml-4 mt-2 list-disc space-y-1 text-xs">
                            <li>파일이 손상되지 않았는지 확인하세요</li>
                            <li>파일 형식이 올바른지 확인하세요 (jpg, jpeg, png, tiff 지원)</li>
                            <li>파일 크기가 50MB를 초과하지 않는지 확인하세요</li>
                            <li>Flask 서버가 정상적으로 실행 중인지 확인하세요</li>
                            <li>서버 콘솔 로그에서 자세한 오류 내용을 확인하세요</li>
                          </ul>
                        </div>
                      </div>
                    </Card>
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
      {/* ✅ 업로드 완료 팝업 */}
      {showUploadComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm border-2 border-green-500 bg-card p-6 shadow-xl">
            <div className="mb-4 flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-card-foreground">업로드 완료!</h3>
              <p className="mt-2 text-muted-foreground">
                이미지가 성공적으로 시스템에<br />저장되었습니다.
              </p>
              <div className="mt-4 w-full rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span>전체</span>
                  <span className="font-bold">{selectedFiles.length}건</span>
                </div>
                <div className="flex justify-between text-green-600 font-semibold">
                  <span>성공</span>
                  <span>{selectedFiles.length - uploadResults.filter(r => r.status === 'error').length}건</span>
                </div>
                {uploadResults.filter(r => r.status === 'error').length > 0 && (
                  <div className="flex justify-between text-red-600 font-semibold">
                    <span>실패</span>
                    <span>{uploadResults.filter(r => r.status === 'error').length}건</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <Link href="/data" className="flex-1">
                <Button variant="outline" className="w-full">
                  목록으로 이동
                </Button>
              </Link>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  setShowUploadComplete(false)
                  setUploadSuccess(false)
                  setSelectedFiles([])
                  setUploadResults([])
                  setUploadProgress({ current: 0, total: 0 })
                  setSelectedType(null) // 초기 화면으로
                }}
              >
                계속 업로드
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

