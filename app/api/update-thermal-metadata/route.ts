import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * POST /api/update-thermal-metadata
 * thermal_data_json 업데이트 (실제 온도 데이터 추가용)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { image_id, thermal_data } = body

    if (!image_id || !thermal_data) {
      return NextResponse.json(
        { success: false, error: 'image_id와 thermal_data가 필요합니다.' },
        { status: 400 }
      )
    }

    // thermal_data_json 업데이트
    const result = await query(
      `UPDATE image_metadata
       SET thermal_data_json = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE image_id = $2
       RETURNING image_id`,
      [JSON.stringify(thermal_data), image_id]
    )

    if (result.rowCount === 0) {
      // 레코드가 없으면 INSERT
      await query(
        `INSERT INTO image_metadata (image_id, thermal_data_json)
         VALUES ($1, $2)
         ON CONFLICT (image_id) DO UPDATE
         SET thermal_data_json = $2,
             updated_at = CURRENT_TIMESTAMP`,
        [image_id, JSON.stringify(thermal_data)]
      )
    }

    return NextResponse.json({
      success: true,
      message: `이미지 ${image_id}의 thermal_data가 업데이트되었습니다.`,
    })
  } catch (error) {
    console.error('thermal_data 업데이트 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '업데이트 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

