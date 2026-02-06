import { NextResponse } from 'next/server'

/**
 * GET /api/check-env
 * 환경 변수 확인 (디버그용)
 */
export async function GET() {
  try {
    const databaseUrl = process.env.DATABASE_URL
    
    // 보안을 위해 일부만 표시
    let maskedUrl = '설정되지 않음'
    if (databaseUrl) {
      // postgresql://user:password@host:port/database 형식 파싱
      try {
        const url = new URL(databaseUrl)
        maskedUrl = `${url.protocol}//${url.username}:****@${url.hostname}:${url.port}${url.pathname}`
      } catch {
        maskedUrl = '설정됨 (형식 확인 필요)'
      }
    }

    return NextResponse.json({
      success: true,
      database_url_exists: !!databaseUrl,
      database_url_masked: maskedUrl,
      database_url_length: databaseUrl?.length || 0,
      is_supabase: databaseUrl?.includes('supabase.com') || false,
      is_local: databaseUrl?.includes('localhost') || false,
      env_loaded: process.env.NODE_ENV,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    )
  }
}



















