'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/AuthContext'

const NAV_ITEMS = [
  { href: '/data', label: '데이터관리', icon: '💾' },
  { href: '/compare', label: '비교분석', icon: '📊' },
  { href: '/thermal-analysis', label: '열화상분석', icon: '🔥' },
  { href: '/upload', label: '업로드', icon: '📤' },
  { href: '/pipe-map', label: '배관지도', icon: '🗺️' },
  { href: '/dashboard', label: '대시보드', icon: '📋' },
]

export default function AppNavbar() {
  const pathname = usePathname()
  const { user, isAdmin, logout } = useAuth()

  return (
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

        <nav className="flex items-center gap-2">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={pathname === item.href ? 'default' : 'ghost'}
                size="sm"
                className="text-sm"
              >
                {item.icon} {item.label}
              </Button>
            </Link>
          ))}

          {isAdmin && (
            <Link href="/admin">
              <Button
                variant={pathname === '/admin' ? 'default' : 'ghost'}
                size="sm"
                className="text-sm"
              >
                ⚙️ 관리
              </Button>
            </Link>
          )}

          {user && (
            <div className="ml-4 flex items-center gap-2 border-l border-border pl-4">
              <span className="text-sm text-muted-foreground">
                {user.name} ({user.role === 'admin' ? '관리자' : '사용자'})
              </span>
              <Button variant="ghost" size="sm" onClick={logout}>
                로그아웃
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
