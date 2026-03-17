import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { verifyPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { User } from '@/lib/types/database'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      )
    }

    const result = await query<User>(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [email]
    )

    if (!result.rowCount || result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    const user = result.rows[0]
    const isValid = await verifyPassword(password, user.password_hash)

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    // 마지막 로그인 시간 업데이트
    await query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [user.user_id])

    // 세션 생성
    await createSession({
      userId: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role,
    })

    return NextResponse.json({
      success: true,
      data: {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('로그인 오류:', error)
    return NextResponse.json(
      { success: false, error: '로그인 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
