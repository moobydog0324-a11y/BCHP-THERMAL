import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * 서버 및 DB 연결 상태 확인 API
 */
export async function GET() {
  try {
    // DB 연결 테스트
    const result = await query('SELECT NOW() as current_time, version() as db_version')
    
    return NextResponse.json({
      success: true,
      server: 'Next.js 서버 정상',
      database: 'PostgreSQL 연결 정상',
      db_time: result.rows[0].current_time,
      db_version: result.rows[0].db_version,
      env_check: {
        database_url: process.env.DATABASE_URL ? '✅ 설정됨' : '❌ 없음',
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ 설정됨' : '❌ 없음',
        supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ 설정됨' : '❌ 없음',
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Health check 오류:', error)
    return NextResponse.json(
      {
        success: false,
        server: 'Next.js 서버 정상',
        database: 'PostgreSQL 연결 실패',
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        env_check: {
          database_url: process.env.DATABASE_URL ? '✅ 설정됨' : '❌ 없음',
          supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ 설정됨' : '❌ 없음',
          supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ 설정됨' : '❌ 없음',
        },
      },
      { status: 500 }
    )
  }
}

