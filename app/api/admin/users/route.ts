import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { hashPassword } from '@/lib/auth/password'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 })
  }

  try {
    const result = await query(
      'SELECT user_id, email, name, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
    )
    return NextResponse.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('사용자 조회 오류:', error)
    return NextResponse.json({ success: false, error: '사용자 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 })
  }

  try {
    const { email, name, password, role } = await request.json()

    if (!email || !name || !password) {
      return NextResponse.json({ success: false, error: '이메일, 이름, 비밀번호는 필수입니다.' }, { status: 400 })
    }

    const existing = await query('SELECT user_id FROM users WHERE email = $1', [email])
    if (existing.rowCount && existing.rowCount > 0) {
      return NextResponse.json({ success: false, error: '이미 존재하는 이메일입니다.' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const result = await query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, email, name, role, is_active, created_at`,
      [email, passwordHash, name, role || 'user']
    )

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('사용자 생성 오류:', error)
    return NextResponse.json({ success: false, error: '사용자 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
