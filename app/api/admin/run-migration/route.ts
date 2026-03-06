import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import fs from 'fs'
import path from 'path'

/**
 * Admin Secret 헤더 검증 (Broken Access Control 방지)
 * 요청 헤더에 x-admin-secret: <ADMIN_SECRET 환경변수 값> 필요
 */
function verifyAdminSecret(request: NextRequest): boolean {
    const adminSecret = process.env.ADMIN_SECRET
    if (!adminSecret) {
        // ADMIN_SECRET 미설정 시 항상 거부 (fail-secure)
        console.error('[SECURITY] ADMIN_SECRET 환경변수가 설정되지 않았습니다.')
        return false
    }
    const provided = request.headers.get('x-admin-secret')
    return provided === adminSecret
}

export async function GET(request: NextRequest) {
    // 인증 검사
    if (!verifyAdminSecret(request)) {
        return NextResponse.json(
            { success: false, error: '접근 권한이 없습니다.' },
            { status: 401 }
        )
    }

    try {
        const sqlPath = path.join(process.cwd(), 'scripts', '06-add-advanced-schema.sql')
        const sql = fs.readFileSync(sqlPath, 'utf8')

        await query(sql)

        return NextResponse.json({ success: true, message: 'Migration applied successfully' })
    } catch (error) {
        console.error('[admin/run-migration] 오류:', error)
        return NextResponse.json(
            { success: false, error: '마이그레이션 실행 중 오류가 발생했습니다.' },
            { status: 500 }
        )
    }
}
