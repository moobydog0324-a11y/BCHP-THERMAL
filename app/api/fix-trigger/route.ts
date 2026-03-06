import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

function verifyAdminSecret(request: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    console.error('[SECURITY] ADMIN_SECRET 환경변수가 설정되지 않았습니다.')
    return false
  }
  return request.headers.get('x-admin-secret') === adminSecret
}

export async function GET(request: NextRequest) {
  if (!verifyAdminSecret(request)) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 401 })
  }

  try {
    await query(`
      CREATE OR REPLACE FUNCTION sync_gps_from_metadata() RETURNS trigger AS $$
      BEGIN
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)
    return NextResponse.json({ success: true, message: "Trigger fixed" })
  } catch (e: unknown) {
    console.error('[fix-trigger] 오류:', e)
    return NextResponse.json(
      { success: false, error: 'DB 트리거 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
