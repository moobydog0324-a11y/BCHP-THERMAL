import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Activity, Database, ImageIcon, LineChart, Thermometer, FileSearch, Palette } from "lucide-react"

export default function HomePage() {
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
              <p className="text-xs text-muted-foreground">BCHP Thermal Pipe Management System</p>
            </div>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/data">
              <Button variant="ghost" className="text-foreground">
                💾 데이터관리
              </Button>
            </Link>
            <Link href="/upload">
              <Button variant="ghost" className="text-foreground">
                📤 업로드
              </Button>
            </Link>
            <Link href="/thermal-analysis">
              <Button variant="ghost" className="text-foreground">
                🔥 열화상분석
              </Button>
            </Link>
            <Link href="/compare">
              <Button variant="ghost" className="text-foreground">
                📊 비교분석
              </Button>
            </Link>
            {/* 개발자 메뉴 (숨김) */}
            {process.env.NODE_ENV === 'development' && (
              <>
                <Link href="/debug">
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    🐛
                  </Button>
                </Link>
                <Link href="/exif-test">
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    🔬
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-5xl font-bold leading-tight text-balance text-foreground">
            열화상 데이터로
            <br />
            <span className="text-primary">배관 결함을 예측</span>하세요
          </h2>
          <p className="mb-8 text-lg leading-relaxed text-muted-foreground text-pretty">
            시간 경과에 따른 열화상 이미지를 비교하고 온도 변화를 분석하여 배관 시스템의 잠재적 결함을 조기에
            발견합니다.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/upload">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                📤 이미지 업로드
              </Button>
            </Link>
            <Link href="/data">
              <Button
                size="lg"
                variant="outline"
                className="border-border text-foreground hover:bg-muted bg-transparent"
              >
                💾 데이터 관리
              </Button>
            </Link>
            <Link href="/compare">
              <Button
                size="lg"
                variant="outline"
                className="border-border text-foreground hover:bg-muted bg-transparent"
              >
                📊 비교분석
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            💡 간단한 3단계: 이미지 업로드 → 데이터 확인 → GPS 기반 비교
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-6 py-16">
        <h3 className="mb-8 text-center text-2xl font-bold text-foreground">주요 기능</h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/data">
            <Card className="border-border bg-card p-6 transition-all hover:shadow-lg cursor-pointer">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-card-foreground">💾 데이터 관리</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                GPS, 온도, 메타데이터가 포함된 모든 열화상 이미지를 한눈에 확인하고 관리합니다.
              </p>
            </Card>
          </Link>

          <Link href="/upload">
            <Card className="border-border bg-card p-6 transition-all hover:shadow-lg cursor-pointer">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                <ImageIcon className="h-6 w-6 text-accent" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-card-foreground">📤 이미지 업로드</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                열화상 이미지 업로드 시 자동으로 GPS 좌표, 온도, 카메라 정보를 추출하여 저장합니다.
              </p>
            </Card>
          </Link>

          <Link href="/thermal-analysis">
            <Card className="border-border bg-card p-6 transition-all hover:shadow-lg cursor-pointer">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10">
                <Thermometer className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-card-foreground">🔥 열화상 분석</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                DB에 저장된 열화상 이미지를 불러와 정밀 온도 분석 및 시각화를 수행합니다.
              </p>
            </Card>
          </Link>

          <Link href="/compare">
            <Card className="border-border bg-card p-6 transition-all hover:shadow-lg cursor-pointer">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <LineChart className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-card-foreground">📊 GPS 기반 비교</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                동일한 GPS 위치에서 촬영된 이미지들을 시계열로 비교하여 온도 변화를 분석합니다.
              </p>
            </Card>
          </Link>
        </div>
      </section>

      {/* 열화상 분석 도구 */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-6">
          <h3 className="mb-8 text-center text-2xl font-bold text-foreground">🔬 정밀 열화상 분석 도구</h3>
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
            <Link href="/thermal-analysis">
              <Card className="border-border bg-card p-6 transition-all hover:shadow-lg cursor-pointer">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                  <Database className="h-6 w-6 text-blue-600" />
                </div>
                <h4 className="mb-2 text-lg font-semibold text-card-foreground">DB 이미지 목록</h4>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  저장된 모든 열화상 이미지 조회 및 구간별 필터링
                </p>
              </Card>
            </Link>

            <Link href="/thermal-viewer">
              <Card className="border-border bg-card p-6 transition-all hover:shadow-lg cursor-pointer">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
                  <Palette className="h-6 w-6 text-purple-600" />
                </div>
                <h4 className="mb-2 text-lg font-semibold text-card-foreground">열화상 시각화</h4>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  10가지 컬러 팔레트로 온도 시각화 및 라인 측정
                </p>
              </Card>
            </Link>

            <Link href="/exif-test">
              <Card className="border-border bg-card p-6 transition-all hover:shadow-lg cursor-pointer">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                  <FileSearch className="h-6 w-6 text-green-600" />
                </div>
                <h4 className="mb-2 text-lg font-semibold text-card-foreground">메타데이터 분석</h4>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  카테고리별 정리된 정밀 메타데이터 확인
                </p>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-border bg-card/50">
        <div className="container mx-auto px-6 py-16">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-primary">100%</div>
              <div className="text-sm text-muted-foreground">자동 메타데이터 추출</div>
            </div>
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-accent">GPS 기반</div>
              <div className="text-sm text-muted-foreground">위치별 시계열 비교</div>
            </div>
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-primary">실시간</div>
              <div className="text-sm text-muted-foreground">온도 정보 추적</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">© 2025 반월 열병합 열배관 관리시스템. 반월고객지원센터</p>
            <div className="flex gap-6">
              <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
                문서
              </Link>
              <Link href="/support" className="text-sm text-muted-foreground hover:text-foreground">
                지원
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
