import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * GET /api/thermal-images/temperature-grid?image_id=XXX
 * 특정 이미지의 온도 배열(gzip+base64) 데이터를 반환
 * ROI 영역 분석 시 프론트엔드에서 직접 온도 계산에 사용
 */
export async function GET(request: NextRequest) {
    const imageId = request.nextUrl.searchParams.get('image_id')

    if (!imageId) {
        return NextResponse.json(
            { success: false, error: 'image_id 파라미터가 필요합니다.' },
            { status: 400 }
        )
    }

    // image_id 유효성 검사 (숫자만 허용)
    const numericId = parseInt(imageId, 10)
    if (isNaN(numericId) || numericId <= 0) {
        return NextResponse.json(
            { success: false, error: '유효하지 않은 image_id입니다.' },
            { status: 400 }
        )
    }

    try {
        const result = await query(
            `SELECT 
         im.thermal_data_json
       FROM image_metadata im
       WHERE im.image_id = $1`,
            [numericId]
        )

        if (!result.rows[0]) {
            return NextResponse.json(
                { success: false, error: '해당 이미지의 메타데이터가 없습니다.' },
                { status: 404 }
            )
        }

        const thermalData = result.rows[0].thermal_data_json

        if (!thermalData?.actual_temp_stats?.temperature_grid) {
            return NextResponse.json(
                {
                    success: false,
                    error: '해당 이미지의 온도 배열 데이터가 없습니다. 온도 데이터 재추출을 실행해주세요.',
                },
                { status: 404 }
            )
        }

        const grid = thermalData.actual_temp_stats.temperature_grid

        return NextResponse.json({
            success: true,
            temperature_grid: {
                data: grid.data,
                width: grid.width,
                height: grid.height,
                dtype: grid.dtype,
                encoding: grid.encoding,
            },
            stats: {
                min_temp: thermalData.actual_temp_stats.min_temp,
                max_temp: thermalData.actual_temp_stats.max_temp,
                avg_temp: thermalData.actual_temp_stats.avg_temp,
            },
        })
    } catch (error) {
        console.error('온도 배열 조회 오류:', error)
        return NextResponse.json(
            { success: false, error: '온도 배열을 조회하는 중 오류가 발생했습니다.' },
            { status: 500 }
        )
    }
}
