import { NextRequest, NextResponse } from 'next/server'
import { metrics } from '@/lib/utils/metrics'

/**
 * GET /api/metrics
 * 메트릭 조회 (Prometheus 또는 JSON 포맷)
 * 
 * Query Parameters:
 * - format: 'prometheus' | 'json' (기본값: json)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'json'

    if (format === 'prometheus') {
      const output = metrics.exportPrometheus()
      
      return new NextResponse(output, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      })
    } else {
      const output = metrics.exportJSON()
      
      return NextResponse.json({
        success: true,
        data: output,
        timestamp: Date.now(),
      })
    }
  } catch (error) {
    console.error('메트릭 조회 오류:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: '메트릭을 조회하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/metrics
 * 메트릭 초기화 (개발 환경에서만 사용)
 */
export async function DELETE(request: NextRequest) {
  // 프로덕션에서는 차단
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        success: false,
        error: 'Production 환경에서는 메트릭 초기화가 불가능합니다.',
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const metricName = body.metric_name

    if (metricName) {
      metrics.reset(metricName)
    } else {
      metrics.reset()
    }

    return NextResponse.json({
      success: true,
      message: metricName
        ? `메트릭 '${metricName}'이(가) 초기화되었습니다.`
        : '모든 메트릭이 초기화되었습니다.',
    })
  } catch (error) {
    console.error('메트릭 초기화 오류:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: '메트릭을 초기화하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}



