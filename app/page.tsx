import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Activity, Database, ImageIcon, LineChart, Thermometer, Shield, Zap, BarChart3 } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <Image
              src="/gs-logo-real.png"
              alt="GS반월열병합발전"
              width={220}
              height={50}
              priority
              className="object-contain"
            />
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/data">
              <Button variant="ghost" className="text-foreground">
                💾 데이터관리
              </Button>
            </Link>
            <Link href="/compare">
              <Button variant="ghost" className="text-foreground">
                📊 비교분석
              </Button>
            </Link>
            <Link href="/thermal-analysis">
              <Button variant="ghost" className="text-foreground">
                🔥 열화상분석
              </Button>
            </Link>
            <Link href="/upload">
              <Button variant="ghost" className="text-foreground">
                📤 업로드
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

      {/* Hero Section — GS Branding */}
      <section className="relative overflow-hidden">
        {/* 배경 그라데이션 */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#00B050]/5 via-background to-[#005DAA]/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00B050]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#005DAA]/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

        <div className="container relative mx-auto px-6 pt-16 pb-12">
          <div className="mx-auto max-w-4xl text-center">
            {/* 회사 배지 */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#00B050]/30 bg-[#00B050]/5 px-5 py-2">
              <div className="h-2 w-2 rounded-full bg-[#00B050] animate-pulse" />
              <span className="text-sm font-medium text-[#00B050]">GS반월열병합발전 열배관 관리시스템</span>
            </div>

            <h2 className="mb-6 text-5xl font-bold leading-tight text-balance text-foreground">
              열화상 데이터로
              <br />
              <span className="bg-gradient-to-r from-[#00B050] to-[#005DAA] bg-clip-text text-transparent">배관 결함을 예측</span>하세요
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-muted-foreground text-pretty max-w-2xl mx-auto">
              시간 경과에 따른 열화상 이미지를 비교하고 온도 변화를 분석하여
              배관 시스템의 잠재적 결함을 조기에 발견합니다.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/upload">
                <Button size="lg" className="bg-gradient-to-r from-[#00B050] to-[#008040] text-white hover:from-[#009040] hover:to-[#007030] shadow-lg shadow-[#00B050]/20">
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
          </div>
        </div>
      </section>

      {/* 핵심 수치 */}
      <section className="border-y border-border bg-card/50">
        <div className="container mx-auto px-6 py-6">
          <div className="grid grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-[#00B050]">FLIR</div>
              <div className="text-xs text-muted-foreground mt-1">열화상 카메라 지원</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#005DAA]">GPS</div>
              <div className="text-xs text-muted-foreground mt-1">위치 기반 비교 분석</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-500">ROI</div>
              <div className="text-xs text-muted-foreground mt-1">영역별 정밀 온도 분석</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-500">24/7</div>
              <div className="text-xs text-muted-foreground mt-1">실시간 모니터링</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-6 py-12">
        <h3 className="mb-8 text-center text-2xl font-bold text-foreground">주요 기능</h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/data" className="flex h-full w-full">
            <Card className="flex flex-col h-full w-full border-2 border-border bg-card p-6 shadow-md transition-all hover:-translate-y-1 hover:shadow-xl hover:border-[#00B050]/30 cursor-pointer">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#00B050]/10">
                <Database className="h-6 w-6 text-[#00B050]" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-card-foreground">💾 데이터 관리</h3>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                GPS, 온도, 메타데이터가 포함된 모든 열화상 이미지를 한눈에 확인하고 관리합니다.
              </p>
            </Card>
          </Link>

          <Link href="/upload" className="flex h-full w-full">
            <Card className="flex flex-col h-full w-full border-2 border-border bg-card p-6 shadow-md transition-all hover:-translate-y-1 hover:shadow-xl hover:border-purple-500/30 cursor-pointer">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
                <ImageIcon className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-card-foreground">📤 이미지 업로드</h3>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                열화상 이미지 업로드 시 자동으로 GPS 좌표, 온도, 카메라 정보를 추출하여 저장합니다.
              </p>
            </Card>
          </Link>

          <Link href="/thermal-analysis" className="flex h-full w-full">
            <Card className="flex flex-col h-full w-full border-2 border-border bg-card p-6 shadow-md transition-all hover:-translate-y-1 hover:shadow-xl hover:border-orange-500/30 cursor-pointer">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10">
                <Thermometer className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-card-foreground">🔥 열화상 분석</h3>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                DB에 저장된 열화상 이미지를 불러와 정밀 온도 분석 및 시각화를 수행합니다.
              </p>
            </Card>
          </Link>

          <Link href="/compare" className="flex h-full w-full">
            <Card className="flex flex-col h-full w-full border-2 border-border bg-card p-6 shadow-md transition-all hover:-translate-y-1 hover:shadow-xl hover:border-[#005DAA]/30 cursor-pointer">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#005DAA]/10">
                <LineChart className="h-6 w-6 text-[#005DAA]" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-card-foreground">📊 GPS 기반 비교</h3>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                동일한 GPS 위치에서 촬영된 이미지들을 시계열로 비교하여 온도 변화를 분석합니다.
              </p>
            </Card>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="/gs-logo-real.png"
                alt="GS반월열병합발전"
                width={160}
                height={36}
                className="object-contain"
              />
              <span className="text-sm text-muted-foreground">© 2025 반월고객지원센터</span>
            </div>
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
