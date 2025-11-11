"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Activity, ArrowLeft, RefreshCw, Database, Image as ImageIcon, CheckCircle2, XCircle } from "lucide-react"

type DebugData = {
  success: boolean
  data?: {
    pipes: {
      count: number
      data: any[]
    }
    inspections: {
      count: number
      recent: any[]
    }
    images: {
      count: number
      recent: any[]
    }
    section_summary: {
      data: any[]
    }
  }
  error?: string
  timestamp?: string
}

type ImageDetailData = {
  success: boolean
  data?: {
    total_images: number
    orphan_images: any[]
    sections_with_images: string[]
  }
}

type PipesNeedingFix = {
  success: boolean
  data?: any[]
  count?: number
  message?: string
}

export default function DebugPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DebugData | null>(null)
  const [imageDetail, setImageDetail] = useState<ImageDetailData | null>(null)
  const [pipesNeedingFix, setPipesNeedingFix] = useState<PipesNeedingFix | null>(null)
  const [fixing, setFixing] = useState(false)
  const [clearing, setClearing] = useState(false)

  const fetchDebugData = async () => {
    setLoading(true)
    try {
      const [dataResponse, imageResponse, fixResponse] = await Promise.all([
        fetch("/api/debug/data-check"),
        fetch("/api/debug/image-data"),
        fetch("/api/debug/fix-sections"),
      ])
      
      const dataResult = await dataResponse.json()
      const imageResult = await imageResponse.json()
      const fixResult = await fixResponse.json()
      
      setData(dataResult)
      setImageDetail(imageResult)
      setPipesNeedingFix(fixResult)
    } catch (error) {
      console.error("데이터 로드 오류:", error)
      setData({
        success: false,
        error: "서버와의 통신 중 오류가 발생했습니다.",
      })
    } finally {
      setLoading(false)
    }
  }

  const fixPipeSection = async (pipeId: number, section: string) => {
    setFixing(true)
    try {
      const response = await fetch("/api/debug/fix-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipe_id: pipeId, section_category: section }),
      })
      const result = await response.json()
      
      if (result.success) {
        alert(`✅ 구역이 설정되었습니다!`)
        fetchDebugData() // 새로고침
      } else {
        alert(`❌ 오류: ${result.error}`)
      }
    } catch (error) {
      alert(`❌ 서버 오류가 발생했습니다.`)
    } finally {
      setFixing(false)
    }
  }

  const clearAllData = async () => {
    if (!confirm('⚠️ 정말로 모든 데이터를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!\n- 배관 데이터\n- 점검 기록\n- 모든 이미지\n\n삭제 후 다시 업로드하셔야 합니다.')) {
      return
    }

    setClearing(true)
    try {
      const response = await fetch("/api/debug/clear-sample-data", {
        method: "POST",
      })
      const result = await response.json()
      
      if (result.success) {
        alert(`✅ 모든 데이터가 삭제되었습니다!\n\n이제 업로드 페이지에서 새로 이미지를 업로드하세요.`)
        fetchDebugData() // 새로고침
      } else {
        alert(`❌ 오류: ${result.error}`)
      }
    } catch (error) {
      alert(`❌ 서버 오류가 발생했습니다.`)
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => {
    fetchDebugData()
  }, [])

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
              <p className="text-xs text-muted-foreground">데이터베이스 디버그</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button 
              onClick={clearAllData} 
              variant="destructive" 
              size="sm"
              disabled={clearing || loading}
            >
              <XCircle className="mr-2 h-4 w-4" />
              전체 삭제
            </Button>
            <Button onClick={fetchDebugData} variant="outline" disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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
        <div className="mb-6">
          <h2 className="mb-2 text-3xl font-bold text-foreground">🔧 데이터베이스 상태 확인</h2>
          <p className="text-muted-foreground">
            업로드된 데이터와 이미지를 확인하세요
          </p>
        </div>

        {loading ? (
          <Card className="flex min-h-[400px] items-center justify-center border-border bg-card p-12">
            <div className="text-center">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <h3 className="text-xl font-semibold text-card-foreground">
                데이터를 불러오는 중...
              </h3>
            </div>
          </Card>
        ) : !data ? (
          <Card className="flex min-h-[400px] items-center justify-center border-border bg-card p-12">
            <div className="text-center">
              <div className="mb-4 text-6xl">⚠️</div>
              <h3 className="mb-2 text-xl font-semibold text-card-foreground">
                데이터를 불러오지 못했습니다
              </h3>
              <Button onClick={fetchDebugData}>다시 시도</Button>
            </div>
          </Card>
        ) : !data.success ? (
          <Card className="border-red-500 bg-red-50 p-6">
            <div className="flex items-start gap-3">
              <XCircle className="h-6 w-6 flex-shrink-0 text-red-600" />
              <div>
                <h3 className="mb-2 text-lg font-semibold text-red-900">오류 발생</h3>
                <p className="text-sm text-red-700">{data.error}</p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* 연결 상태 */}
            <Card className="border-green-500 bg-green-50 p-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <div>
                  <h3 className="text-lg font-semibold text-green-900">
                    ✅ 데이터베이스 연결 성공
                  </h3>
                  <p className="text-sm text-green-700">
                    {data.timestamp && new Date(data.timestamp).toLocaleString("ko-KR")}
                  </p>
                </div>
              </div>
            </Card>

            {/* 배관 데이터 */}
            <Card className="border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-bold text-card-foreground">
                  배관 데이터 ({data.data?.pipes.count || 0}개)
                </h3>
              </div>
              {data.data?.pipes.count === 0 ? (
                <p className="text-sm text-muted-foreground">
                  ⚠️ 배관 데이터가 없습니다. 스크립트를 실행하거나 데이터를 업로드하세요.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr className="text-left">
                        <th className="pb-2 pr-4">ID</th>
                        <th className="pb-2 pr-4">코드</th>
                        <th className="pb-2 pr-4">위치</th>
                        <th className="pb-2">구역</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data?.pipes.data.map((pipe) => (
                        <tr key={pipe.pipe_id} className="border-b">
                          <td className="py-2 pr-4">{pipe.pipe_id}</td>
                          <td className="py-2 pr-4 font-mono text-xs">{pipe.pipe_code}</td>
                          <td className="py-2 pr-4">{pipe.location}</td>
                          <td className="py-2">
                            <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold">
                              {pipe.section_category || "N/A"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* 점검 데이터 */}
            <Card className="border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-bold text-card-foreground">
                  최근 점검 기록 ({data.data?.inspections.count || 0}개)
                </h3>
              </div>
              {data.data?.inspections.count === 0 ? (
                <p className="text-sm text-muted-foreground">
                  ⚠️ 점검 기록이 없습니다.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr className="text-left">
                        <th className="pb-2 pr-4">점검ID</th>
                        <th className="pb-2 pr-4">배관ID</th>
                        <th className="pb-2 pr-4">구역</th>
                        <th className="pb-2 pr-4">점검자</th>
                        <th className="pb-2">일시</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data?.inspections.recent.map((insp) => (
                        <tr key={insp.inspection_id} className="border-b">
                          <td className="py-2 pr-4">{insp.inspection_id}</td>
                          <td className="py-2 pr-4">{insp.pipe_id}</td>
                          <td className="py-2 pr-4">
                            <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold">
                              {insp.section_category || "N/A"}
                            </span>
                          </td>
                          <td className="py-2 pr-4">{insp.inspector_name}</td>
                          <td className="py-2 text-xs">
                            {new Date(insp.inspection_date).toLocaleString("ko-KR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* 이미지 데이터 */}
            <Card className="border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-bold text-card-foreground">
                    업로드된 이미지 ({data.data?.images.count || 0}개)
                  </h3>
                </div>
                {data.data?.images.count > 0 && (
                  <div className="flex gap-2">
                    <Link href="/compare">
                      <Button size="sm" variant="outline">
                        📊 비교하기
                      </Button>
                    </Link>
                    <Link href="/gps-compare">
                      <Button size="sm" variant="outline">
                        📍 GPS 비교
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
              {data.data?.images.count === 0 ? (
                <div className="text-center py-8">
                  <div className="mb-4 text-6xl">📷</div>
                  <p className="text-lg font-semibold text-card-foreground mb-2">
                    ⚠️ 업로드된 이미지가 없습니다
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    이미지를 업로드하면 시작할 수 있습니다.
                  </p>
                  <Link href="/upload">
                    <Button>
                      ➕ 지금 이미지 업로드하기
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr className="text-left">
                          <th className="pb-2 pr-4">이미지ID</th>
                          <th className="pb-2 pr-4">점검ID</th>
                          <th className="pb-2 pr-4">구역</th>
                          <th className="pb-2 pr-4">타입</th>
                          <th className="pb-2">촬영시간</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.data?.images.recent.map((img) => (
                          <tr key={img.image_id} className="border-b">
                            <td className="py-2 pr-4">{img.image_id}</td>
                            <td className="py-2 pr-4">{img.inspection_id}</td>
                            <td className="py-2 pr-4">
                              <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold">
                                {img.section_category || "N/A"}
                              </span>
                            </td>
                            <td className="py-2 pr-4">
                              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${
                                img.image_type === 'thermal' 
                                  ? 'bg-orange-100 text-orange-700' 
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {img.image_type === 'thermal' ? '🌡️ 열화상' : '📷 실화상'}
                              </span>
                            </td>
                            <td className="py-2 text-xs">
                              {new Date(img.capture_timestamp).toLocaleString("ko-KR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>

            {/* 구역별 이미지 개수 */}
            {data.data?.section_summary.data.length > 0 && (
              <Card className="border-border bg-card p-6">
                <div className="mb-4 flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-bold text-card-foreground">
                    구역별 이미지 현황
                  </h3>
                </div>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {data.data?.section_summary.data.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-border bg-muted/20 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            구역 {item.section_category}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.image_type === 'thermal' ? '🌡️ 열화상' : '📷 실화상'}
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-primary">
                          {item.image_count}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* 구역이 없는 고아 이미지 경고 */}
            {imageDetail?.data?.orphan_images && imageDetail.data.orphan_images.length > 0 && (
              <Card className="border-yellow-500 bg-yellow-50 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-yellow-600" />
                  <h3 className="text-xl font-bold text-yellow-900">
                    ⚠️ 구역이 설정되지 않은 이미지 ({imageDetail.data.orphan_images.length}개)
                  </h3>
                </div>
                <p className="mb-4 text-sm text-yellow-700">
                  다음 이미지들은 배관에 구역(section_category)이 설정되지 않아 비교 페이지에서 보이지 않습니다.
                </p>
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {imageDetail.data.orphan_images.map((img) => (
                    <div
                      key={img.image_id}
                      className="rounded-md border border-yellow-300 bg-white p-3 text-sm"
                    >
                      <div className="mb-1 font-semibold">이미지 ID: {img.image_id}</div>
                      <div className="text-xs text-muted-foreground">
                        점검 ID: {img.inspection_id} | 배관 ID: {img.pipe_id} | 
                        배관 코드: {img.pipe_code || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* 구역 설정이 필요한 배관 */}
            {pipesNeedingFix?.data && pipesNeedingFix.data.length > 0 && (
              <Card className="border-orange-500 bg-orange-50 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-orange-600" />
                    <h3 className="text-xl font-bold text-orange-900">
                      🔧 구역 설정이 필요한 배관 ({pipesNeedingFix.count}개)
                    </h3>
                  </div>
                  <Button onClick={fetchDebugData} variant="outline" size="sm" disabled={fixing}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${fixing ? "animate-spin" : ""}`} />
                    새로고침
                  </Button>
                </div>
                <p className="mb-4 text-sm text-orange-700">
                  아래 배관들에 구역을 설정하면 해당 배관의 이미지가 비교 페이지에 나타납니다.
                </p>
                <div className="space-y-3">
                  {pipesNeedingFix.data.map((pipe) => (
                    <div
                      key={pipe.pipe_id}
                      className="rounded-lg border border-orange-300 bg-white p-4"
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <div className="mb-1 font-semibold text-foreground">
                            배관 ID: {pipe.pipe_id}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            코드: {pipe.pipe_code} | 위치: {pipe.location}
                          </div>
                          <div className="mt-1 text-xs text-orange-600">
                            이미지 {pipe.image_count}개 대기 중
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {['A-1', 'A-2', 'B-1', 'B-2', 'C-1', 'C-2', 'D-1', 'D-2', 'E-1', 'E-2', 'F-1', 'F-2', 'G-1', 'G-2'].map((section) => (
                          <button
                            key={section}
                            onClick={() => fixPipeSection(pipe.pipe_id, section)}
                            disabled={fixing}
                            className="rounded-md border border-primary bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                          >
                            {section}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

