"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Activity, ArrowLeft, Upload, CheckCircle2, XCircle, FileImage, Loader2 } from "lucide-react"

type AnalysisResult = {
  success: boolean
  metadata?: any
  thermal_data?: any
  filename?: string
  error?: string
}

export default function ExifTestPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [flaskStatus, setFlaskStatus] = useState<any>(null)

  const checkFlaskServer = async () => {
    try {
      const response = await fetch("/api/exif/analyze")
      const data = await response.json()
      setFlaskStatus(data)
    } catch (error) {
      setFlaskStatus({
        success: false,
        error: "Flask 서버에 연결할 수 없습니다.",
      })
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setResult(null)
    }
  }

  const analyzeImage = async () => {
    if (!selectedFile) return

    setAnalyzing(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      // 구조화된 포맷 API 사용
      const response = await fetch("/api/exif/analyze-formatted", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      })
    } finally {
      setAnalyzing(false)
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
              <p className="text-xs text-muted-foreground">ExifTool 메타데이터 추출 테스트</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button onClick={checkFlaskServer} variant="outline" size="sm">
              Flask 상태 확인
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
            🔬 ExifTool 메타데이터 추출 테스트
          </h2>
          <p className="text-muted-foreground">
            열화상 이미지를 업로드하면 온도 정보 등 메타데이터를 추출합니다
          </p>
        </div>

        <div className="mx-auto max-w-4xl space-y-6">
          {/* Flask 서버 상태 */}
          {flaskStatus && (
            <Card className={`p-4 ${flaskStatus.success ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}>
              <div className="flex items-center gap-3">
                {flaskStatus.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <div>
                  <div className={`font-semibold ${flaskStatus.success ? "text-green-900" : "text-red-900"}`}>
                    {flaskStatus.success ? "✅ Flask 서버 연결 성공" : "❌ Flask 서버 연결 실패"}
                  </div>
                  {flaskStatus.flask_server && (
                    <div className="text-sm text-muted-foreground">
                      서버: {flaskStatus.flask_server}
                    </div>
                  )}
                  {flaskStatus.flask_status && (
                    <div className="text-sm text-muted-foreground">
                      ExifTool 사용 가능: {flaskStatus.flask_status.exiftool_available ? "✅ 예" : "❌ 아니오"}
                    </div>
                  )}
                  {flaskStatus.error && (
                    <div className="text-sm text-red-700">{flaskStatus.error}</div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* 파일 선택 */}
          <Card className="border-border bg-card p-6">
            <h3 className="mb-4 text-xl font-bold text-card-foreground">1️⃣ 이미지 선택</h3>
            <div className="space-y-4">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/tiff"
                onChange={handleFileSelect}
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
              />

              {selectedFile && (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-4">
                  <FileImage className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">{selectedFile.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                  <Button onClick={analyzeImage} disabled={analyzing}>
                    {analyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        분석 중...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        메타데이터 추출
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* 분석 결과 */}
          {result && (
            <Card className={`border-border bg-card p-6 ${result.success ? "" : "border-red-500 bg-red-50"}`}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-600" />
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-card-foreground">
                      {result.success ? "✅ 메타데이터 추출 성공" : "❌ 추출 실패"}
                    </h3>
                    {result.success && result.filename && (
                      <p className="text-sm text-muted-foreground">
                        {result.filename} • 처리 시간: {result.processing_time}초
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {result.success && result.sections && (
                <div className="space-y-4">
                  {/* 경고 메시지 */}
                  {result.warnings && result.warnings.length > 0 && (
                    <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
                      <h4 className="mb-2 font-semibold text-yellow-900">⚠️ 경고</h4>
                      {result.warnings.map((warning: string, idx: number) => (
                        <p key={idx} className="text-sm text-yellow-800">{warning}</p>
                      ))}
                    </div>
                  )}

                  {/* 각 섹션 렌더링 */}
                  {Object.entries(result.sections)
                    .sort(([, a]: any, [, b]: any) => (a.priority || 999) - (b.priority || 999))
                    .map(([key, section]: any) => (
                      <details 
                        key={key} 
                        className="rounded-lg border border-border bg-muted/20 p-4"
                        open={!section.collapsed}
                      >
                        <summary className="cursor-pointer font-semibold text-foreground hover:text-primary">
                          {section.title}
                        </summary>
                        <div className="mt-4 space-y-3">
                          {section.data.warning && (
                            <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                              {section.data.warning}
                            </div>
                          )}
                          {section.data.note && (
                            <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
                              💡 {section.data.note}
                            </div>
                          )}
                          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {Object.entries(section.data)
                              .filter(([k]: any) => k !== 'warning' && k !== 'note' && k !== 'atmospheric_trans')
                              .map(([fieldKey, fieldData]: any) => {
                                if (!fieldData || typeof fieldData !== 'object' || !fieldData.label) return null
                                return (
                                  <div key={fieldKey} className="rounded-md border border-border/50 bg-background p-3">
                                    <div className="text-xs text-muted-foreground">{fieldData.label}</div>
                                    <div className="font-semibold text-foreground">{fieldData.value}</div>
                                    {fieldData.description && (
                                      <div className="mt-1 text-xs text-muted-foreground italic">
                                        {fieldData.description}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                          </div>
                          
                          {/* 대기 투과 계수는 별도 표시 */}
                          {section.data.atmospheric_trans && (
                            <div className="mt-3 rounded-md border border-border/50 bg-background p-3">
                              <div className="mb-2 text-sm font-semibold text-foreground">
                                {section.data.atmospheric_trans.label}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
                                <div>
                                  <span className="text-muted-foreground">Alpha1: </span>
                                  <span className="font-mono">{section.data.atmospheric_trans.alpha1 ?? 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Alpha2: </span>
                                  <span className="font-mono">{section.data.atmospheric_trans.alpha2 ?? 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Beta1: </span>
                                  <span className="font-mono">{section.data.atmospheric_trans.beta1 ?? 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Beta2: </span>
                                  <span className="font-mono">{section.data.atmospheric_trans.beta2 ?? 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">X: </span>
                                  <span className="font-mono">{section.data.atmospheric_trans.x ?? 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </details>
                    ))}

                  {/* 원본 JSON 데이터 */}
                  <details className="rounded-lg border border-border bg-muted/20 p-4">
                    <summary className="cursor-pointer font-semibold text-foreground">
                      📋 원본 메타데이터 (JSON)
                    </summary>
                    <pre className="mt-4 overflow-x-auto rounded-md bg-black p-4 text-xs text-green-400">
                      {JSON.stringify(result._raw_metadata, null, 2)}
                    </pre>
                  </details>
                </div>
              )}

              {!result.success && result.error && (
                <div className="text-red-700">
                  <div className="mb-2 font-semibold">오류 메시지:</div>
                  <div className="rounded-md bg-red-100 p-3 font-mono text-sm">{result.error}</div>
                </div>
              )}
            </Card>
          )}

          {/* 사용 방법 */}
          <Card className="border-border bg-card p-6">
            <h3 className="mb-4 text-xl font-bold text-card-foreground">💡 사용 방법</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>1️⃣ <strong>Flask 상태 확인</strong> 버튼을 눌러 백엔드 서버가 실행 중인지 확인하세요</p>
              <p>2️⃣ 열화상 이미지 파일을 선택하세요 (JPG, PNG, TIFF 형식)</p>
              <p>3️⃣ <strong>메타데이터 추출</strong> 버튼을 클릭하세요</p>
              <p>4️⃣ 추출된 온도 정보와 카메라 정보를 확인하세요</p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}


