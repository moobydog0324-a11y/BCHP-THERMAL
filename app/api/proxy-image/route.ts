import { NextRequest, NextResponse } from 'next/server'

// 허용된 도메인 화이트리스트 (SSRF 방지)
const ALLOWED_DOMAINS = [
    process.env.R2_PUBLIC_DOMAIN?.replace(/^https?:\/\//, '') ?? '',
    'pub-2965ab72a82848f5a3befdcd50762733.r2.dev',
    'mqsjmbcxedagcewxxbuf.supabase.co',
].filter(Boolean)

function isAllowedUrl(rawUrl: string): boolean {
    try {
        const parsed = new URL(rawUrl)
        // HTTP/HTTPS만 허용 (file:, ftp: 등 차단)
        if (!['http:', 'https:'].includes(parsed.protocol)) return false
        // 내부 IP 대역 차단
        const hostname = parsed.hostname
        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.startsWith('10.') ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('169.254.') ||
            hostname === '0.0.0.0'
        ) return false
        // 화이트리스트 도메인 확인
        return ALLOWED_DOMAINS.some(domain => domain && hostname.endsWith(domain))
    } catch {
        return false
    }
}

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url')

    if (!url) {
        return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
    }

    // SSRF 방지: 허용된 도메인만 프록시 허용
    if (!isAllowedUrl(url)) {
        return NextResponse.json({ error: '허용되지 않는 이미지 URL입니다.' }, { status: 403 })
    }

    try {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(10000), // 10초 타임아웃
        })
        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch image: ${response.statusText}` },
                { status: response.status }
            )
        }

        // Content-Type 검증 (이미지만 허용)
        const contentType = response.headers.get('Content-Type') || ''
        if (!contentType.startsWith('image/')) {
            return NextResponse.json({ error: '이미지 파일만 프록시 가능합니다.' }, { status: 415 })
        }

        const blob = await response.blob()
        const headers = new Headers()
        headers.set('Content-Type', contentType)
        headers.set('Cache-Control', 'public, max-age=31536000, immutable')

        return new NextResponse(blob, {
            status: 200,
            headers
        })
    } catch (error) {
        // 내부 에러 메시지 숨김
        console.error('proxy-image error:', error)
        return NextResponse.json({ error: '이미지를 불러올 수 없습니다.' }, { status: 500 })
    }
}
