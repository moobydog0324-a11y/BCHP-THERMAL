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

      const response = await fetch("/api/exif/analyze", {
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
              <div className="mb-4 flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
                <h3 className="text-xl font-bold text-card-foreground">
                  {result.success ? "✅ 메타데이터 추출 성공" : "❌ 추출 실패"}
                </h3>
              </div>

              {result.success && result.thermal_data && (
                <div className="space-y-4">
                  {/* 주요 정보 */}
                  <div className="rounded-lg border border-primary bg-primary/5 p-4">
                    <h4 className="mb-3 font-semibold text-primary">📸 주요 정보</h4>
                    <div className="grid gap-2 md:grid-cols-2">
                      {result.thermal_data.Make && (
                        <div>
                          <div className="text-xs text-muted-foreground">제조사</div>
                          <div className="font-semibold">{result.thermal_data.Make}</div>
                        </div>
                      )}
                      {result.thermal_data.Model && (
                        <div>
                          <div className="text-xs text-muted-foreground">모델</div>
                          <div className="font-semibold">{result.thermal_data.Model}</div>
                        </div>
                      )}
                      {result.thermal_data.DateTimeOriginal && (
                        <div>
                          <div className="text-xs text-muted-foreground">촬영 시간</div>
                          <div className="font-semibold">{result.thermal_data.DateTimeOriginal}</div>
                        </div>
                      )}
                      {result.thermal_data.Emissivity && (
                        <div>
                          <div className="text-xs text-muted-foreground">방사율</div>
                          <div className="font-semibold">{result.thermal_data.Emissivity}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 온도 정보 */}
                  {(result.thermal_data.AtmosphericTemperature || 
                    result.thermal_data.ReflectedApparentTemperature ||
                    result.thermal_data.ObjectDistance) && (
                    <div className="rounded-lg border border-orange-300 bg-orange-50 p-4">
                      <h4 className="mb-3 font-semibold text-orange-900">🌡️ 온도 정보</h4>
                      <div className="grid gap-2 md:grid-cols-3">
                        {result.thermal_data.AtmosphericTemperature && (
                          <div>
                            <div className="text-xs text-orange-700">대기 온도</div>
                            <div className="font-semibold text-orange-900">
                              {result.thermal_data.AtmosphericTemperature}°C
                            </div>
                          </div>
                        )}
                        {result.thermal_data.ReflectedApparentTemperature && (
                          <div>
                            <div className="text-xs text-orange-700">반사 온도</div>
                            <div className="font-semibold text-orange-900">
                              {result.thermal_data.ReflectedApparentTemperature}°C
                            </div>
                          </div>
                        )}
                        {result.thermal_data.ObjectDistance && (
                          <div>
                            <div className="text-xs text-orange-700">촬영 거리</div>
                            <div className="font-semibold text-orange-900">
                              {result.thermal_data.ObjectDistance}m
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 전체 메타데이터 (JSON) */}
                  <details className="rounded-lg border border-border bg-muted/20 p-4">
                    <summary className="cursor-pointer font-semibold text-foreground">
                      📋 전체 메타데이터 보기 (JSON)
                    </summary>
                    <pre className="mt-4 overflow-x-auto rounded-md bg-black p-4 text-xs text-green-400">
                      {JSON.stringify(result.metadata, null, 2)}
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


