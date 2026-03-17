import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/health']

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'bchp-therma-default-secret-change-in-production'
  return new TextEncoder().encode(secret)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 정적 파일, 공개 경로는 통과
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-icon') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get('session')?.value

  if (!token) {
    // API 요청은 401 반환
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }
    // 페이지 요청은 로그인으로 리다이렉트
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    await jwtVerify(token, getSecretKey())
    return NextResponse.next()
  } catch {
    // 토큰 만료/무효 시
    const response = pathname.startsWith('/api/')
      ? NextResponse.json({ success: false, error: '세션이 만료되었습니다.' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url))

    response.cookies.delete('session')
    return response
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
