"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CheckCircle2, AlertCircle, Loader2, ArrowLeft, Database } from "lucide-react"

export default function SetupMetadataPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")

  const createTable = async () => {
    try {
      setLoading(true)
      setError("")
      setResult(null)

      const response = await fetch("/api/setup-metadata-table", {
        method: "POST",
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setResult(data)
      } else {
        setError(data.error || "테이블 생성에 실패했습니다.")
      }
    } catch (err) {
      setError("서버와의 통신 중 오류가 발생했습니다.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">메타데이터 테이블 설정</h1>
              <p className="text-xs text-muted-foreground">image_metadata 테이블 생성</p>
            </div>
          </Link>
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              뒤로
            </Button>
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-6 py-12">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* 설명 카드 */}
          <Card className="border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-3">
              <Database className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-card-foreground">메타데이터 저장 준비</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                이미지 업로드 시 GPS 좌표, 촬영 시간, 온도 정보 등의 메타데이터를 저장하기 위해
                <code className="mx-1 rounded bg-muted px-2 py-1 font-mono text-xs">
                  image_metadata
                </code>
                테이블이 필요합니다.
              </p>
              <p className="font-semibold text-card-foreground">
                ⚠️ 현재 테이블이 생성되지 않아 메타데이터를 저장할 수 없습니다.
              </p>
              <p>아래 버튼을 클릭하면 자동으로 테이블이 생성됩니다.</p>
            </div>
          </Card>

          {/* 생성 버튼 */}
          {!result && (
            <Card className="border-border bg-card p-6">
              <div className="text-center">
                <h3 className="mb-4 text-lg font-semibold text-card-foreground">
                  테이블을 생성하시겠습니까?
                </h3>
                <Button
                  onClick={createTable}
                  disabled={loading}
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      image_metadata 테이블 생성
                    </>
                  )}
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  (실행 내용: scripts/05-add-metadata-table.sql)
                </p>
              </div>
            </Card>
          )}

          {/* 성공 메시지 */}
          {result && (
            <Card className="border-green-500/20 bg-green-500/10 p-6">
              <div className="mb-4 flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-6 w-6" />
                <h3 className="text-xl font-bold">생성 완료! 🎉</h3>
              </div>
              <div className="mb-4 space-y-2 text-sm text-green-700">
                <p className="font-semibold">{result.message}</p>
                {result.next_steps?.map((step: string, idx: number) => (
                  <p key={idx}>• {step}</p>
                ))}
              </div>
              <div className="mb-4 rounded-lg bg-green-500/5 p-4">
                <h4 className="mb-2 font-semibold text-green-700">생성된 테이블 정보:</h4>
                <div className="space-y-1 text-xs text-green-600">
                  <p>• 테이블: {result.table?.name}</p>
                  <p>• 컬럼: {result.table?.columns?.length}개</p>
                  <p>• 인덱스: {result.table?.indexes?.length}개</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href="/upload" className="flex-1">
                  <Button className="w-full">
                    📤 이미지 업로드 하러 가기
                  </Button>
                </Link>
                <Link href="/api/check-metadata-table" target="_blank">
                  <Button variant="outline">
                    확인
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          {/* 오류 메시지 */}
          {error && (
            <Card className="border-red-500/20 bg-red-500/10 p-6">
              <div className="mb-4 flex items-center gap-2 text-red-600">
                <AlertCircle className="h-6 w-6" />
                <h3 className="text-xl font-bold">오류 발생</h3>
              </div>
              <p className="mb-4 text-sm text-red-700">{error}</p>
              <div className="space-y-2 text-sm text-red-600">
                <p className="font-semibold">수동 해결 방법:</p>
                <ol className="list-inside list-decimal space-y-1">
                  <li>pgAdmin 또는 DBeaver 실행</li>
                  <li>therma_twin 데이터베이스 연결</li>
                  <li>scripts/05-add-metadata-table.sql 파일 열기</li>
                  <li>SQL 실행</li>
                </ol>
              </div>
              <Button
                onClick={createTable}
                variant="outline"
                className="mt-4 border-red-500 text-red-600 hover:bg-red-500/10"
              >
                다시 시도
              </Button>
            </Card>
          )}

          {/* 정보 카드 */}
          <Card className="border-border bg-card p-6">
            <h3 className="mb-3 font-semibold text-card-foreground">💡 저장되는 정보</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>📍 GPS 좌표 (위도, 경도)</li>
              <li>📅 촬영 날짜 및 시간</li>
              <li>🌡️ 온도 데이터 (대기 온도, 방사율 등)</li>
              <li>📸 카메라 정보 (모델, 시리얼 번호)</li>
              <li>🔢 Planck 상수 (온도 계산용)</li>
              <li>📊 이미지 크기 및 메타데이터 100+ 필드</li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  )
}


