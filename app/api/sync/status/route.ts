import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const result = await query(
      'SELECT * FROM sync_log ORDER BY started_at DESC LIMIT 20'
    )
    return NextResponse.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('동기화 상태 조회 오류:', error)
    return NextResponse.json({ success: false, error: '동기화 상태 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
