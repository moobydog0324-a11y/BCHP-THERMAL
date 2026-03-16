import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * GET /api/thermal-images/:id
 * 단일 열화상 이미지 조회 (메타데이터 포함)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const imageId = parseInt(id, 10)

    if (isNaN(imageId) || imageId <= 0) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 이미지 ID입니다.' },
        { status: 400 }
      )
    }

    const result = await query(
      `SELECT 
        ti.*,
        im.metadata_json,
        im.thermal_data_json,
        p.section_category
       FROM thermal_images ti
       LEFT JOIN image_metadata im ON ti.image_id = im.image_id
       LEFT JOIN inspections i ON ti.inspection_id = i.inspection_id
       LEFT JOIN pipes p ON i.pipe_id = p.pipe_id
       WHERE ti.image_id = $1
       LIMIT 1`,
      [imageId]
    )

    if (!result.rowCount || result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    })
  } catch (error) {
    console.error('단일 이미지 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '이미지를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
