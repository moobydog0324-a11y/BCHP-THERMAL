import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { query } from '@/lib/db/connection'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 })
  }

  try {
    const { direction, sheet } = await request.json()

    if (!direction || !['to_sheets', 'from_sheets', 'both'].includes(direction)) {
      return NextResponse.json(
        { success: false, error: 'direction은 to_sheets, from_sheets, both 중 하나여야 합니다.' },
        { status: 400 }
      )
    }

    // 동기화 로그 기록
    const logResult = await query(
      `INSERT INTO sync_log (direction, sheet_name, status)
       VALUES ($1, $2, 'running')
       RETURNING sync_id`,
      [direction, sheet || 'all']
    )

    const syncId = logResult.rows[0].sync_id

    // TODO: 실제 Google Sheets API 연동은 googleapis 패키지 설치 후 구현
    // lib/sync/sync-engine.ts에서 처리
    // 현재는 로그만 기록

    await query(
      `UPDATE sync_log SET status = 'completed', completed_at = NOW(), rows_synced = 0
       WHERE sync_id = $1`,
      [syncId]
    )

    return NextResponse.json({
      success: true,
      message: 'Google Sheets 동기화가 완료되었습니다. (googleapis 설치 후 실제 동기화 가능)',
      syncId,
    })
  } catch (error) {
    console.error('동기화 오류:', error)
    return NextResponse.json(
      { success: false, error: '동기화 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
