import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Activity, Database, ImageIcon, LineChart } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Therma-Twin</h1>
              <p className="text-xs text-muted-foreground">열배관 건전성 관리</p>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" className="text-foreground">
                대시보드
              </Button>
            </Link>
            <Link href="/inspections">
              <Button variant="ghost" className="text-foreground">
                점검 기록
              </Button>
            </Link>
            <Link href="/compare">
              <Button variant="ghost" className="text-foreground">
                이미지 비교
              </Button>
            </Link>
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
                데이터 업로드
              </Button>
            </Link>
            <Link href="/compare">
              <Button
                size="lg"
                variant="outline"
                className="border-border text-foreground hover:bg-muted bg-transparent"
              >
                이미지 비교 시작
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-card p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-card-foreground">데이터 관리</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              배관 정보와 점검 이력을 체계적으로 관리하고 메타데이터를 추적합니다.
            </p>
          </Card>

          <Card className="border-border bg-card p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
              <ImageIcon className="h-6 w-6 text-accent" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-card-foreground">이미지 비교</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              동기화된 줌/팬 컨트롤로 과거와 현재 열화상 이미지를 나란히 비교합니다.
            </p>
          </Card>

          <Card className="border-border bg-card p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <LineChart className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-card-foreground">온도 분석</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              스팟, 영역, 라인 프로파일 도구로 정밀한 온도 데이터를 측정합니다.
            </p>
          </Card>

          <Card className="border-border bg-card p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
              <Activity className="h-6 w-6 text-accent" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-card-foreground">결함 예측</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              온도 변화 패턴을 분석하여 잠재적 결함을 조기에 감지합니다.
            </p>
          </Card>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-border bg-card/50">
        <div className="container mx-auto px-6 py-16">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-primary">99.2%</div>
              <div className="text-sm text-muted-foreground">결함 감지 정확도</div>
            </div>
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-accent">3배</div>
              <div className="text-sm text-muted-foreground">점검 효율 향상</div>
            </div>
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-primary">24시간</div>
              <div className="text-sm text-muted-foreground">실시간 모니터링</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">© 2025 Therma-Twin. 반월고객지원센터</p>
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
