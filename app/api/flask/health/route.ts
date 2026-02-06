import { NextResponse } from 'next/server'
import { checkFlaskHealth } from '@/lib/utils/flask-health'
import { ApiResponseHelper } from '@/lib/types/api'

/**
 * GET /api/flask/health
 * Flask 서버 헬스체크
 */
export async function GET() {
  try {
    const health = await checkFlaskHealth()
    
    return NextResponse.json(
      ApiResponseHelper.success(
        { health },
        'Flask 서버 헬스체크 완료'
      )
    )
  } catch (error) {
    console.error('Flask 헬스체크 오류:', error)
    
    return NextResponse.json(
      ApiResponseHelper.error(
        'Flask 헬스체크 중 오류가 발생했습니다.',
        'HEALTH_CHECK_ERROR'
      ),
      { status: 500 }
    )
  }
}



