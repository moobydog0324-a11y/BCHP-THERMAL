"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Activity,
  ArrowLeft,
  Thermometer,
  Calendar,
  Camera,
  Image as ImageIcon,
  Filter,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  Trash2,
  Square,
  MapPin
} from "lucide-react"
import { ThermalROIAnalyzer } from "@/components/ThermalROIAnalyzer"
import KakaoMap from "@/components/KakaoMap"

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
    avg_temp: string | null
    median_temp: string | null
    actual_temp_stats: {
      min_temp: number
      max_temp: number
      avg_temp: number
      median_temp: number
      pixel_count: number
    } | null
    atmospheric: string | null
    humidity: string | null
  }
  has_metadata: boolean
  metadata_json?: any  // ✅ 전체 메타데이터 (ExifTool 원본)
  thermal_data_json?: any  // ✅ 열화상 주요 데이터
}

type SectionCategory = 'all' | 'A-1' | 'A-2' | 'B-1' | 'B-2' | 'C-1' | 'C-2' | 'D-1' | 'D-2' | 'E-1' | 'E-2' | 'F-1' | 'F-2' | 'G-1' | 'G-2'
type TempWarningLevel = 'all' | 'normal' | 'observation' | 'caution' | 'warning'

export default function DataManagementPage() {
  const [images, setImages] = useState<ThermalImage[]>([])
  const [filteredImages, setFilteredImages] = useState<ThermalImage[]>([])
  const [selectedSection, setSelectedSection] = useState<SectionCategory>('all')
  const [selectedTempLevel, setSelectedTempLevel] = useState<TempWarningLevel>('all')
  const [selectedDate, setSelectedDate] = useState<string>('all')
  const [customYear, setCustomYear] = useState<string>('')
  const [customMonth, setCustomMonth] = useState<string>('')
  const [customDay, setCustomDay] = useState<string>('')
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedImage, setSelectedImage] = useState<ThermalImage | null>(null)
  const [roiAnalyzing, setRoiAnalyzing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; image: ThermalImage | null }>({
    show: false,
    image: null
  })
  const [deleting, setDeleting] = useState(false)
  const [batchUpdating, setBatchUpdating] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{
    processed: number
    failed: number
    total: number
    message: string
  } | null>(null)

  const [showBatchComplete, setShowBatchComplete] = useState(false) // ✅ 배치 완료 팝업 상태

  const [selectedIds, setSelectedIds] = useState<number[]>([]) // ✅ 다중 선택 상태 추가
  // ✅ 삭제 완료 팝업 상태 추가
  const [showDeleteComplete, setShowDeleteComplete] = useState(false)
  const [deleteResult, setDeleteResult] = useState<{ count: number; message: string } | null>(null)
  const [mapModalImage, setMapModalImage] = useState<ThermalImage | null>(null) // ✅ 카카오맵 모달 상태


  const sections: SectionCategory[] = [
    'all', 'A-1', 'A-2', 'B-1', 'B-2', 'C-1', 'C-2', 'D-1', 'D-2',
    'E-1', 'E-2', 'F-1', 'F-2', 'G-1', 'G-2'
  ]

  useEffect(() => {
    fetchAllImages()
  }, [])

  // ✅ 전체 선택/해제 토글
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredImages.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredImages.map(img => img.image_id))
    }
  }

  // ✅ 개별 선택 토글
  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(v => v !== id))
    } else {
      setSelectedIds(prev => [...prev, id])
    }
  }

  // ✅ 일괄 삭제 처리
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`선택한 ${selectedIds.length}개의 이미지를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return

    setDeleting(true)
    let successCount = 0
    let failCount = 0

    // 병렬 처리로 삭제 요청
    const promises = selectedIds.map(id =>
      fetch('/api/thermal-images/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: id })
      }).then(res => res.json())
    )

    try {
      const results = await Promise.all(promises)
      results.forEach(res => {
        if (res.success) successCount++
        else failCount++
      })

      // 목록 갱신
      const deletedSet = new Set(selectedIds)
      setImages(prev => prev.filter(img => !deletedSet.has(img.image_id)))
      setFilteredImages(prev => prev.filter(img => !deletedSet.has(img.image_id)))
      setSelectedIds([]) // 선택 초기화

      if (failCount > 0) {
        setDeleteResult({ count: successCount, message: `${successCount}개 삭제 성공, ${failCount}개 삭제 실패` })
        setShowDeleteComplete(true)
      } else {
        setDeleteResult({ count: successCount, message: `${successCount}개의 이미지가 삭제되었습니다.` })
        setShowDeleteComplete(true)
      }
    } catch (e) {
      console.error(e)
      setDeleteResult({ count: 0, message: '일괄 삭제 중 오류가 발생했습니다.' })
      setShowDeleteComplete(true)
    } finally {
      setDeleting(false)
    }
  }

  // 날짜 목록 추출
  useEffect(() => {
    const dates = [...new Set(
      images.map(img => {
        const date = new Date(img.capture_timestamp)
        return date.toISOString().split('T')[0] // YYYY-MM-DD
      })
    )].sort((a, b) => b.localeCompare(a)) // 최신순

    setAvailableDates(dates)
  }, [images])

  // 사용자가 날짜를 직접 입력했을 때
  const handleCustomDateApply = () => {
    if (!customYear || !customMonth || !customDay) {
      alert('년도, 월, 일을 모두 입력해주세요.')
      return
    }

    const year = parseInt(customYear)
    const month = parseInt(customMonth)
    const day = parseInt(customDay)

    // 유효성 검사
    if (year < 2000 || year > 2100) {
      alert('유효한 년도를 입력해주세요. (2000-2100)')
      return
    }
    if (month < 1 || month > 12) {
      alert('유효한 월을 입력해주세요. (1-12)')
      return
    }
    if (day < 1 || day > 31) {
      alert('유효한 일을 입력해주세요. (1-31)')
      return
    }

    // YYYY-MM-DD 형식으로 변환
    const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
    setSelectedDate(formattedDate)
  }

  // 날짜 입력 초기화
  const handleCustomDateReset = () => {
    setCustomYear('')
    setCustomMonth('')
    setCustomDay('')
    setSelectedDate('all')
  }

  // 필터링 로직
  useEffect(() => {
    let filtered = images

    // 1. 구역 필터
    if (selectedSection !== 'all') {
      filtered = filtered.filter(img => img.section_category === selectedSection)
    }

    // 2. 온도 레벨 필터
    if (selectedTempLevel !== 'all') {
      filtered = filtered.filter(img => {
        const level = getTempWarningLevel(img.temperature.range_max)
        return level?.level === selectedTempLevel
      })
    }

    // 3. 날짜 필터
    if (selectedDate !== 'all') {
      filtered = filtered.filter(img => {
        const imgDate = new Date(img.capture_timestamp).toISOString().split('T')[0]
        return imgDate === selectedDate
      })
    }

    setFilteredImages(filtered)
  }, [selectedSection, selectedTempLevel, selectedDate, images])

  const fetchAllImages = async () => {
    try {
      setLoading(true)
      setError("")

      // 모든 구역의 이미지를 병렬로 가져오기 (Promise.all)
      const allSections = ['A-1', 'A-2', 'B-1', 'B-2', 'C-1', 'C-2', 'D-1', 'D-2', 'E-1', 'E-2', 'F-1', 'F-2', 'G-1', 'G-2']

      const promises = allSections.map(section =>
        fetch(`/api/thermal-images/by-section/${section}?image_type=thermal`)
          .then(res => res.json())
          .then(result => result.success ? result.data : [])
          .catch(err => {
            console.warn(`구역 ${section} 조회 오류:`, err)
            return []
          })
      )

      const results = await Promise.all(promises)
      const allImages = results.flat() // 모든 결과 합치기


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

  // 삭제 확인 팝업 열기
  const openDeleteConfirm = (image: ThermalImage) => {
    setDeleteConfirm({ show: true, image })
  }

  // 삭제 확인 팝업 닫기
  const closeDeleteConfirm = () => {
    if (!deleting) {
      setDeleteConfirm({ show: false, image: null })
    }
  }

  // 이미지 삭제 실행
  // 온도 데이터 일괄 재추출 (자동 반복)
  const handleBatchUpdateTemperatures = async () => {
    if (!confirm('모든 이미지의 온도 데이터를 재추출하시겠습니까?\n시간이 오래 걸릴 수 있습니다.')) {
      return
    }

    setBatchUpdating(true)
    setBatchProgress(null)
    setError("")

    let totalProcessed = 0
    let totalFailed = 0
    let round = 0

    try {
      // 남은 이미지가 있는 동안 계속 처리
      while (true) {
        round++
        console.log(`🔄 Round ${round} 시작...`)

        const response = await fetch('/api/batch-update-temperatures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_size: 10 }) // 한 번에 10개씩
        })

        const result = await response.json()

        if (result.success) {
          totalProcessed += result.processed
          totalFailed += result.failed

          setBatchProgress({
            processed: totalProcessed,
            failed: totalFailed,
            total: result.total_pending || 0,
            message: `처리 중... (${totalProcessed + totalFailed} / ${result.total_pending || 0})`
          })

          // 더 이상 처리할 이미지가 없으면 종료
          if (!result.has_more || result.remaining === 0) {
            setBatchProgress({
              processed: totalProcessed,
              failed: totalFailed,
              total: result.total_pending || 0,
              message: `✅ 전체 처리 완료! (성공: ${totalProcessed}, 실패: ${totalFailed})`
            })
            setShowBatchComplete(true) // ✅ 완료 팝업 표시
            break
          }

          // 다음 배치 전 짧은 대기
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
          setError(result.error || '온도 데이터 추출에 실패했습니다.')
          break
        }
      }

      // 목록 새로고침
      await fetchAllImages()
    } catch (err) {
      setError('온도 데이터 추출 중 오류가 발생했습니다.')
      console.error(err)
    } finally {
      setBatchUpdating(false)
    }
  }

  const handleDeleteImage = async () => {
    if (!deleteConfirm.image) return

    setDeleting(true)
    setError("")

    try {
      const response = await fetch('/api/thermal-images/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: deleteConfirm.image.image_id })
      })

      const result = await response.json()

      if (result.success) {
        // 삭제 성공 - 목록에서 제거
        setImages(prev => prev.filter(img => img.image_id !== deleteConfirm.image!.image_id))
        setFilteredImages(prev => prev.filter(img => img.image_id !== deleteConfirm.image!.image_id))

        // 상세보기 모달이 열려있었다면 닫기
        if (selectedImage?.image_id === deleteConfirm.image.image_id) {
          setSelectedImage(null)
        }

        closeDeleteConfirm()

        // ✅ 삭제 완료 팝업 표시
        setDeleteResult({ count: 1, message: "이미지가 성공적으로 삭제되었습니다." })
        setShowDeleteComplete(true)
      } else {
        setError(result.error || '이미지 삭제에 실패했습니다.')
      }
    } catch (err) {
      setError('이미지 삭제 중 오류가 발생했습니다.')
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  // 온도 경고 레벨 계산
  const getTempWarningLevel = (maxTemp: string | null) => {
    if (!maxTemp) return null
    const temp = parseFloat(maxTemp.replace('°C', '').trim())

    // 영하: 파란색 계열
    if (temp < 0) {
      return {
        level: 'freezing',
        label: '영하',
        color: 'text-blue-600',
        bgColor: 'bg-blue-500/10',
        icon: Thermometer
      }
    }
    // 0~40°C: 초록색 계열 (정상)
    else if (temp < 40) {
      return {
        level: 'normal',
        label: '정상',
        color: 'text-green-600',
        bgColor: 'bg-green-500/10',
        icon: CheckCircle2
      }
    }
    // 40~60°C: 노란색 계열 (관찰)
    else if (temp >= 40 && temp < 60) {
      return {
        level: 'observation',
        label: '관찰',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-500/10',
        icon: Info
      }
    }
    // 60~70°C: 주황색 계열 (주의)
    else if (temp >= 60 && temp < 70) {
      return {
        level: 'caution',
        label: '주의',
        color: 'text-orange-600',
        bgColor: 'bg-orange-500/10',
        icon: AlertTriangle
      }
    }
    // 70°C 이상: 빨간색 계열 (경고)
    else {
      return {
        level: 'warning',
        label: '경고',
        color: 'text-red-600',
        bgColor: 'bg-red-500/10',
        icon: AlertOctagon
      }
    }
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
            <Button
              variant="outline"
              onClick={handleBatchUpdateTemperatures}
              disabled={batchUpdating}
            >
              {batchUpdating ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  온도 추출 중...
                </>
              ) : (
                <>🔥 온도 데이터 재추출</>
              )}
            </Button>
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
        {/* 일괄 처리 결과 */}
        {batchProgress && (
          <Card className={`p-4 ${batchUpdating ? 'border-blue-500 bg-blue-50' : 'border-green-500 bg-green-50'}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${batchUpdating ? 'bg-blue-500' : 'bg-green-500'}`}>
                {batchUpdating ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Thermometer className="h-6 w-6 text-white" />
                )}
              </div>
              <div className="flex-1">
                <div className={`font-semibold ${batchUpdating ? 'text-blue-900' : 'text-green-900'}`}>
                  {batchProgress.message}
                </div>
                <div className={`text-sm ${batchUpdating ? 'text-blue-700' : 'text-green-700'}`}>
                  성공: {batchProgress.processed}개 / 실패: {batchProgress.failed}개 / 전체: {batchProgress.total}개
                </div>
                {batchUpdating && (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-200">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{
                        width: `${batchProgress.total > 0 ? ((batchProgress.processed + batchProgress.failed) / batchProgress.total * 100) : 0}%`
                      }}
                    />
                  </div>
                )}
              </div>
              {!batchUpdating && (
                <Button variant="ghost" size="sm" onClick={() => setBatchProgress(null)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* 통계 및 필터 */}
        <div className="mb-6 space-y-6">

          {/* 1. 온도 레벨 요약 (가장 위로 이동 - 대시보드 역할) */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card
              className={`border-border bg-card p-4 cursor-pointer transition-all hover:shadow-md hover:scale-105 ${selectedTempLevel === 'all' ? 'ring-2 ring-primary bg-primary/5' : ''
                }`}
              onClick={() => setSelectedTempLevel('all')}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <ImageIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">전체 이미지</p>
                  <p className="text-2xl font-bold text-card-foreground">{images.length}</p>
                </div>
              </div>
            </Card>

            <Card
              className={`border-border bg-card p-4 cursor-pointer transition-all hover:shadow-md hover:scale-105 ${selectedTempLevel === 'normal' ? 'ring-2 ring-green-600 bg-green-50 dark:bg-green-900/10' : ''
                }`}
              onClick={() => setSelectedTempLevel('normal')}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">정상</p>
                  <p className="text-2xl font-bold text-card-foreground">
                    {images.filter(img => {
                      const level = getTempWarningLevel(img.temperature.range_max)
                      return level?.level === 'normal'
                    }).length}
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className={`border-border bg-card p-4 cursor-pointer transition-all hover:shadow-md hover:scale-105 ${selectedTempLevel === 'observation' ? 'ring-2 ring-yellow-600 bg-yellow-50 dark:bg-yellow-900/10' : ''
                }`}
              onClick={() => setSelectedTempLevel('observation')}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
                  <Info className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">관찰 (40-60°C)</p>
                  <p className="text-2xl font-bold text-card-foreground">
                    {images.filter(img => {
                      const level = getTempWarningLevel(img.temperature.range_max)
                      return level?.level === 'observation'
                    }).length}
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className={`border-border bg-card p-4 cursor-pointer transition-all hover:shadow-md hover:scale-105 ${selectedTempLevel === 'caution' ? 'ring-2 ring-orange-600 bg-orange-50 dark:bg-orange-900/10' : ''
                }`}
              onClick={() => setSelectedTempLevel('caution')}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">주의 (60-70°C)</p>
                  <p className="text-2xl font-bold text-card-foreground">
                    {images.filter(img => {
                      const level = getTempWarningLevel(img.temperature.range_max)
                      return level?.level === 'caution'
                    }).length}
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className={`border-border bg-card p-4 cursor-pointer transition-all hover:shadow-md hover:scale-105 ${selectedTempLevel === 'warning' ? 'ring-2 ring-red-600 bg-red-50 dark:bg-red-900/10' : ''
                }`}
              onClick={() => setSelectedTempLevel('warning')}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                  <AlertOctagon className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">경고 (70°C+)</p>
                  <p className="text-2xl font-bold text-card-foreground">
                    {images.filter(img => {
                      const level = getTempWarningLevel(img.temperature.range_max)
                      return level?.level === 'warning'
                    }).length}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {/* 2. 구역 필터 */}
            <Card className="border-border bg-card p-4 shadow-sm h-full">
              <div className="mb-2 flex items-center gap-2 border-b border-border pb-1">
                <Filter className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-card-foreground text-sm">구역 선택</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sections.map((section) => (
                  <Button
                    key={section}
                    variant={selectedSection === section ? "default" : "secondary"}
                    size="sm"
                    className="h-7 px-3 text-xs rounded-md shadow-sm"
                    onClick={() => setSelectedSection(section)}
                  >
                    {section === 'all' ? '전체' : section}
                  </Button>
                ))}
              </div>
            </Card>

            {/* 3. 날짜 필터 */}
            <Card className="border-border bg-card p-4 shadow-sm h-full">
              <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-card-foreground text-sm">날짜 선택</h3>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {/* 날짜 직접 선택 (Native Date Picker) */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">직접 선택:</span>
                  <Input
                    type="date"
                    value={selectedDate === 'all' ? '' : selectedDate}
                    max="2099-12-31"
                    onChange={(e) => {
                      const date = e.target.value;
                      if (date) {
                        setSelectedDate(date);
                        // custom states update explicitly if needed
                        const [y, m, d] = date.split('-');
                        setCustomYear(y);
                        setCustomMonth(m);
                        setCustomDay(d);
                      } else {
                        // Cleared
                        handleCustomDateReset();
                      }
                    }}
                    className="h-8 text-xs w-full max-w-[150px]"
                  />
                  {selectedDate !== 'all' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleCustomDateReset}
                      title="날짜 초기화"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* 빠른 날짜 선택 */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">최근 촬영일:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableDates.slice(0, 8).map((date) => (
                      <Button
                        key={date}
                        variant={selectedDate === date ? "default" : "outline"}
                        size="sm"
                        className="h-7 px-3 text-xs rounded-md"
                        onClick={() => {
                          const [year, month, day] = date.split('-')
                          setCustomYear(year)
                          setCustomMonth(month)
                          setCustomDay(day)
                          setSelectedDate(date)
                        }}
                      >
                        {new Date(date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                      </Button>
                    ))}
                    {availableDates.length > 8 && (
                      <span className="text-xs text-muted-foreground self-center px-1">...</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* 4. 활성 필터 표시 */}
          {(selectedSection !== 'all' || selectedTempLevel !== 'all' || selectedDate !== 'all') && (
            <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-primary">적용된 필터:</span>
                {selectedSection !== 'all' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-background px-3 py-1 text-xs font-medium shadow-sm border border-border">
                    구역: {selectedSection}
                    <X className="h-3 w-3 cursor-pointer opacity-50 hover:opacity-100" onClick={() => setSelectedSection('all')} />
                  </span>
                )}
                {selectedTempLevel !== 'all' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-background px-3 py-1 text-xs font-medium shadow-sm border border-border">
                    온도: {
                      selectedTempLevel === 'normal' ? '정상' :
                        selectedTempLevel === 'observation' ? '관찰' :
                          selectedTempLevel === 'caution' ? '주의' : '경고'
                    }
                    <X className="h-3 w-3 cursor-pointer opacity-50 hover:opacity-100" onClick={() => setSelectedTempLevel('all')} />
                  </span>
                )}
                {selectedDate !== 'all' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-background px-3 py-1 text-xs font-medium shadow-sm border border-border">
                    날짜: {new Date(selectedDate).toLocaleDateString('ko-KR')}
                    <X className="h-3 w-3 cursor-pointer opacity-50 hover:opacity-100" onClick={() => handleCustomDateReset()} />
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSelectedSection('all')
                  setSelectedTempLevel('all')
                  handleCustomDateReset()
                }}
              >
                필터 초기화
              </Button>
            </div>
          )}
        </div>

        {/* ✅ 5. 액션 툴바 (필터 하단, 그리드 상단) */}
        <div className="sticky top-4 z-20 mb-6 flex items-center justify-between rounded-xl border border-border bg-card/80 p-4 backdrop-blur-md shadow-lg transition-all">
          <div className="flex items-center gap-6">
            {/* 전체 선택 체크박스 */}
            <div className="flex items-center gap-3">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  id="selectAll"
                  className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-input bg-background transition-all checked:border-primary checked:bg-primary"
                  checked={filteredImages.length > 0 && selectedIds.length === filteredImages.length}
                  onChange={toggleSelectAll}
                />
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 peer-checked:opacity-100 text-primary-foreground">
                  <svg width="12" height="9" viewBox="0 0 12 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 4.5L4.33333 8L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <label htmlFor="selectAll" className="cursor-pointer text-sm font-semibold select-none text-card-foreground">
                전체 선택 ({selectedIds.length} / {filteredImages.length})
              </label>
            </div>
          </div>

          {/* 우측 액션 버튼 */}
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 ? (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-5 duration-200">
                <span className="text-xs text-muted-foreground mr-2">
                  {selectedIds.length}개 선택됨
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  className="rounded-full shadow-sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  선택 항목 삭제
                </Button>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                선택된 항목 없음
              </div>
            )}
          </div>
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
                className={`group cursor-pointer overflow-hidden border transition-all hover:shadow-lg flex flex-col
                    ${selectedIds.includes(img.image_id) ? 'border-primary ring-2 ring-primary bg-primary/5' : 'border-border bg-card'}
                `}
                onClick={() => setSelectedImage(img)}
              >
                {/* 이미지 영역 */}
                <div className="relative aspect-video overflow-hidden bg-muted">
                  <Image
                    src={img.image_url}
                    alt={`열화상 이미지 ${img.image_id}`}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                  />

                  {/* 상단 오버레이 (구역 태그와 체크박스를 이미지 안쪽 상단에 배치, 아래로 여백 확보) */}
                  <div className="absolute top-2 left-2 flex items-center gap-2 z-10">
                    <div
                      className="flex items-center justify-center h-6 w-6 bg-background/80 backdrop-blur-sm border border-border rounded-sm overflow-hidden cursor-pointer shadow-sm hover:bg-background"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelect(img.image_id)
                      }}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-primary cursor-pointer border-none"
                        checked={selectedIds.includes(img.image_id)}
                        readOnly
                      />
                    </div>
                    <div className="rounded bg-primary/90 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                      {img.section_category}
                    </div>
                  </div>

                  {(() => {
                    const warningLevel = getTempWarningLevel(img.temperature.range_max)
                    if (!warningLevel) return null
                    const IconComponent = warningLevel.icon

                    // 가독성을 극대화하기 위한 완전 불투명 색상 매핑
                    const solidColors: Record<string, string> = {
                      'normal': 'bg-green-500 text-white',
                      'observation': 'bg-yellow-500 text-white',
                      'caution': 'bg-orange-500 text-white',
                      'warning': 'bg-red-500 text-white',
                      'freezing': 'bg-blue-500 text-white',
                    }

                    const solidClass = solidColors[warningLevel.level] || 'bg-gray-500 text-white'

                    return (
                      <div className={`absolute right-2 top-2 rounded ${solidClass} px-2.5 py-1 flex items-center gap-1.5 shadow-sm border border-white/20`}>
                        <IconComponent className="h-3.5 w-3.5" />
                        <span className="text-xs font-semibold">
                          {warningLevel.label}
                        </span>
                      </div>
                    )
                  })()}
                </div>

                {/* 메타데이터 요약 */}
                <div className="px-4 pt-2 pb-3 space-y-2.5 flex-1 flex flex-col">
                  {/* ID 및 타임스탬프 */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>ID: {img.image_id}</span>
                      {img.gps ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setMapModalImage(img)
                          }}
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <MapPin className="h-3 w-3" />
                          <span>위치 보기</span>
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground/50">
                          <MapPin className="h-3 w-3" />
                          <span>위치 없음</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 text-sm font-medium text-card-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDateTime(img.capture_timestamp)}
                      </div>
                    </div>
                  </div>

                  {/* 온도 - 메타데이터에서 추출한 실제 온도 */}
                  {img.temperature.range_max && (
                    <div className={`rounded-lg p-2.5 ${getTempWarningLevel(img.temperature.range_max)?.bgColor || 'bg-muted/50'}`}>
                      <div className="mb-1 flex items-center gap-1 text-xs font-semibold">
                        <Thermometer className="h-3 w-3" />
                        <span className={getTempWarningLevel(img.temperature.range_max)?.color || 'text-muted-foreground'}>
                          실제 온도 범위
                        </span>
                      </div>
                      <div className={`text-lg font-bold ${getTempWarningLevel(img.temperature.range_max)?.color || 'text-card-foreground'}`}>
                        {img.temperature.range_min} ~ {img.temperature.range_max}
                      </div>
                    </div>
                  )}

                  {/* 삭제됨: 카메라 및 파일 사이즈 블록 */}

                  {/* 버튼들 */}
                  <div className="flex gap-2 pt-0.5 mt-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedImage(img)
                      }}
                    >
                      상세보기
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openDeleteConfirm(img)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 상세 메타데이터 모달 */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-hidden"
          onClick={() => setSelectedImage(null)}
        >
          <Card
            className="relative flex flex-col max-h-[90vh] w-full max-w-4xl border-border bg-card overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 (고정) */}
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card p-4 shadow-sm">
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

            {/* 스크롤 가능한 컨텐츠 영역 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 이미지 */}
              <div className="relative w-full max-h-[400px] overflow-hidden rounded-lg bg-muted">
                <div className="relative aspect-video">
                  <Image
                    src={selectedImage.image_url}
                    alt={`열화상 이미지 ${selectedImage.image_id}`}
                    fill
                    className="object-contain"
                  />
                </div>
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

              {/* 온도 정보 */}
              {selectedImage.temperature.range_max && (() => {
                const warningLevel = getTempWarningLevel(selectedImage.temperature.range_max)
                const IconComponent = warningLevel?.icon || Thermometer
                const actualStats = selectedImage.temperature.actual_temp_stats

                return (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-card-foreground">
                        🌡️ 온도 분석 {actualStats && <span className="text-sm text-green-600">(실제 측정값)</span>}
                      </h3>
                      <div className="flex items-center gap-2">
                        {selectedImage.image_type === 'thermal' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRoiAnalyzing(true)}
                          >
                            <Square className="mr-2 h-4 w-4" />
                            ROI 영역 분석
                          </Button>
                        )}
                        {warningLevel && (
                          <div className={`flex items-center gap-2 rounded-lg ${warningLevel.bgColor} px-3 py-1.5`}>
                            <IconComponent className={`h-5 w-5 ${warningLevel.color}`} />
                            <span className={`text-sm font-semibold ${warningLevel.color}`}>
                              {warningLevel.label}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className={`rounded-lg p-4 ${warningLevel?.bgColor || 'bg-muted/50'}`}>
                        <div className="text-xs font-medium text-muted-foreground">최저 온도</div>
                        <div className={`mt-1 text-2xl font-bold ${warningLevel?.color || 'text-card-foreground'}`}>
                          {selectedImage.temperature.range_min || 'N/A'}
                        </div>
                      </div>
                      <div className={`rounded-lg p-4 ${warningLevel?.bgColor || 'bg-muted/50'}`}>
                        <div className="text-xs font-medium text-muted-foreground">최고 온도</div>
                        <div className={`mt-1 text-2xl font-bold ${warningLevel?.color || 'text-card-foreground'}`}>
                          {selectedImage.temperature.range_max || 'N/A'}
                        </div>
                      </div>
                      {selectedImage.temperature.avg_temp && (
                        <div className={`rounded-lg p-4 ${warningLevel?.bgColor || 'bg-muted/50'}`}>
                          <div className="text-xs font-medium text-muted-foreground">평균 온도</div>
                          <div className={`mt-1 text-2xl font-bold ${warningLevel?.color || 'text-card-foreground'}`}>
                            {selectedImage.temperature.avg_temp}
                          </div>
                        </div>
                      )}
                      {selectedImage.temperature.median_temp && (
                        <div className={`rounded-lg p-4 ${warningLevel?.bgColor || 'bg-muted/50'}`}>
                          <div className="text-xs font-medium text-muted-foreground">중앙값 온도</div>
                          <div className={`mt-1 text-2xl font-bold ${warningLevel?.color || 'text-card-foreground'}`}>
                            {selectedImage.temperature.median_temp}
                          </div>
                        </div>
                      )}
                    </div>

                    {actualStats && (
                      <div className="mt-3 rounded-lg bg-green-500/10 p-3 border border-green-500/20">
                        <div className="text-xs text-green-700 dark:text-green-400">
                          ✓ 이 온도는 FLIR 전문 라이브러리로 추출한 실제 측정값입니다.
                          총 {actualStats?.pixel_count?.toLocaleString() || '알 수 없는'}개 픽셀을 분석했습니다.
                        </div>
                      </div>
                    )}

                    {/* 온도 범위 안내 */}
                    <div className="mt-4 rounded-lg bg-muted/30 p-4">
                      <h4 className="mb-2 text-sm font-semibold text-card-foreground">📊 온도 경고 기준</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span>정상: &lt;40°C</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-yellow-600" />
                          <span>관찰: 40-60°C</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <span>주의: 60-70°C</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertOctagon className="h-4 w-4 text-red-600" />
                          <span>경고: ≥70°C</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* GPS 정보 */}
              {selectedImage.gps && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-card-foreground">📍 GPS 정보</h3>
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                    <InfoItem label="위도" value={selectedImage.gps.latitude.toFixed(6)} />
                    <InfoItem label="경도" value={selectedImage.gps.longitude.toFixed(6)} />
                    {selectedImage.gps.altitude && (
                      <InfoItem label="고도" value={selectedImage.gps.altitude} />
                    )}
                    <div className="pt-2 border-t border-border">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${selectedImage.gps.latitude},${selectedImage.gps.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        🗺️ Google Maps에서 보기
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* 메타데이터 정보 */}
              {selectedImage.thermal_data_json && Object.keys(selectedImage.thermal_data_json).length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-card-foreground">🔬 열화상 메타데이터</h3>
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 max-h-[300px] overflow-y-auto">
                    {selectedImage.thermal_data_json.Emissivity && (
                      <InfoItem
                        label="방사율 (Emissivity)"
                        value={selectedImage.thermal_data_json.Emissivity}
                      />
                    )}
                    {selectedImage.thermal_data_json.ObjectDistance && (
                      <InfoItem
                        label="측정 거리"
                        value={selectedImage.thermal_data_json.ObjectDistance}
                      />
                    )}
                    {selectedImage.thermal_data_json.AtmosphericTemperature && (
                      <InfoItem
                        label="대기 온도"
                        value={selectedImage.thermal_data_json.AtmosphericTemperature}
                      />
                    )}
                    {selectedImage.thermal_data_json.RelativeHumidity && (
                      <InfoItem
                        label="상대 습도"
                        value={`${selectedImage.thermal_data_json.RelativeHumidity}%`}
                      />
                    )}
                    {selectedImage.thermal_data_json.ReflectedApparentTemperature && (
                      <InfoItem
                        label="반사 온도"
                        value={selectedImage.thermal_data_json.ReflectedApparentTemperature}
                      />
                    )}
                    {selectedImage.thermal_data_json.CameraTemperatureRangeMin && (
                      <InfoItem
                        label="카메라 최저 측정 범위"
                        value={selectedImage.thermal_data_json.CameraTemperatureRangeMin}
                      />
                    )}
                    {selectedImage.thermal_data_json.CameraTemperatureRangeMax && (
                      <InfoItem
                        label="카메라 최고 측정 범위"
                        value={selectedImage.thermal_data_json.CameraTemperatureRangeMax}
                      />
                    )}
                    {selectedImage.thermal_data_json.DateTimeOriginal && (
                      <InfoItem
                        label="촬영 일시 (원본)"
                        value={selectedImage.thermal_data_json.DateTimeOriginal}
                      />
                    )}
                    {selectedImage.thermal_data_json.Make && (
                      <InfoItem
                        label="제조사"
                        value={selectedImage.thermal_data_json.Make}
                      />
                    )}
                    {selectedImage.thermal_data_json.Model && (
                      <InfoItem
                        label="모델"
                        value={selectedImage.thermal_data_json.Model}
                      />
                    )}
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

      {/* 삭제 확인 팝업 */}
      {deleteConfirm.show && deleteConfirm.image && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md border-border bg-card p-6 shadow-xl">
            <div className="mb-4 text-center">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-destructive/10 p-4">
                  <Trash2 className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <h3 className="mb-2 text-xl font-bold text-card-foreground">
                이미지 삭제 확인
              </h3>
              <p className="text-sm text-muted-foreground">
                이 작업은 되돌릴 수 없습니다.
              </p>
            </div>

            <div className="mb-6 rounded-lg border border-border bg-muted/50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-card-foreground">
                  삭제할 이미지 정보
                </span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>ID: {deleteConfirm.image.image_id}</div>
                <div>구역: {deleteConfirm.image.section_category}</div>
                <div>촬영일시: {formatDateTime(deleteConfirm.image.capture_timestamp)}</div>
                {deleteConfirm.image.temperature.range_max && (
                  <div className="font-semibold text-destructive">
                    최고온도: {deleteConfirm.image.temperature.range_max}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={closeDeleteConfirm}
                disabled={deleting}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteImage}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    삭제 중...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    삭제하기
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ROI 온도 분석 */}
      {roiAnalyzing && selectedImage && (
        <ThermalROIAnalyzer
          imageUrl={selectedImage.image_url}
          imageId={selectedImage.image_id}
          onClose={() => setRoiAnalyzing(false)}
        />
      )}


      {/* ✅ 배치 작업 완료 팝업 */}
      {showBatchComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm border-2 border-green-500 bg-card p-6 shadow-xl">
            <div className="mb-4 flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-card-foreground">작업 완료!</h3>
              <p className="mt-2 text-muted-foreground">
                온도 데이터 재추출 작업이<br />성공적으로 완료되었습니다.
              </p>
              {batchProgress && (
                <div className="mt-4 rounded-lg bg-muted p-3 text-sm w-full">
                  <div className="flex justify-between">
                    <span>성공</span>
                    <span className="font-bold text-green-600">{batchProgress.processed}건</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>실패</span>
                    <span className="font-bold text-red-600">{batchProgress.failed}건</span>
                  </div>
                </div>
              )}
            </div>
            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
              onClick={() => {
                setShowBatchComplete(false)
                setBatchProgress(null) // 상단바도 닫기
              }}
            >
              확인
            </Button>
          </Card>
        </div>
      )}

      {/* ✅ 삭제 완료 팝업 */}
      {showDeleteComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm border-2 border-red-500 bg-card p-6 shadow-xl">
            <div className="mb-4 flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-card-foreground">삭제 완료</h3>
              <p className="mt-2 text-muted-foreground">
                {deleteResult?.message || "작업이 완료되었습니다."}
              </p>
            </div>
            <Button
              className="w-full bg-red-600 hover:bg-red-700"
              size="lg"
              onClick={() => setShowDeleteComplete(false)}
            >
              확인
            </Button>
          </Card>
        </div>
      )}

      {/* ✅ 카카오맵 모달 */}
      {mapModalImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setMapModalImage(null)}
        >
          <Card
            className="w-full max-w-2xl border-border bg-card shadow-xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-card-foreground">
                  구역 위치 ({mapModalImage.section_category})
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMapModalImage(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-0">
              {mapModalImage.gps ? (
                <KakaoMap
                  latitude={mapModalImage.gps.latitude}
                  longitude={mapModalImage.gps.longitude}
                  height="400px"
                  className="w-full rounded-none border-none"
                />
              ) : (
                <div className="flex h-[400px] flex-col items-center justify-center bg-muted text-muted-foreground p-6 text-center">
                  <MapPin className="mb-4 h-12 w-12 opacity-20" />
                  <p className="text-lg font-medium">GPS 정보가 없습니다</p>
                  <p className="mt-2 text-sm">해당 이미지에 위치 정보가 포함되어 있지 않습니다.</p>
                </div>
              )}
            </div>
            <div className="bg-muted/30 p-4 border-t border-border flex justify-between items-center text-sm text-muted-foreground">
              <div>이미지 ID: {mapModalImage.image_id}</div>
              {mapModalImage.gps && (
                <div className="font-mono text-xs">
                  {mapModalImage.gps.latitude.toFixed(6)}, {mapModalImage.gps.longitude.toFixed(6)}
                </div>
              )}
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

