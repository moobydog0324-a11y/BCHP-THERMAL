import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * POST /api/debug/fix-sections
 * section_category가 없는 배관에 자동으로 할당
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pipe_id, section_category } = body

    if (!pipe_id || !section_category) {
      return NextResponse.json(
        {
          success: false,
          error: 'pipe_id와 section_category가 필요합니다.',
        },
        { status: 400 }
      )
    }

    // 배관에 section_category 업데이트
    const result = await query(
      'UPDATE pipes SET section_category = $1 WHERE pipe_id = $2 RETURNING *',
      [section_category, pipe_id]
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '해당 배관을 찾을 수 없습니다.',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `배관 ${pipe_id}에 구역 ${section_category}가 설정되었습니다.`,
      data: result.rows[0],
    })
  } catch (error) {
    console.error('구역 수정 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '구역 설정 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/debug/fix-sections
 * section_category가 없는 배관 목록 조회
 */
export async function GET() {
  try {
    // section_category가 NULL인 배관 찾기
    const result = await query(
      `SELECT p.pipe_id, p.pipe_code, p.location, p.section_category,
              COUNT(i.inspection_id) as inspection_count,
              COUNT(ti.image_id) as image_count
       FROM pipes p
       LEFT JOIN inspections i ON p.pipe_id = i.pipe_id
       LEFT JOIN thermal_images ti ON i.inspection_id = ti.inspection_id
       WHERE p.section_category IS NULL OR p.section_category = ''
       GROUP BY p.pipe_id, p.pipe_code, p.location, p.section_category
       ORDER BY p.pipe_id`
    )

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
      message: result.rowCount === 0 
        ? '모든 배관에 구역이 설정되어 있습니다.' 
        : `${result.rowCount}개의 배관에 구역이 설정되지 않았습니다.`,
    })
  } catch (error) {
    console.error('배관 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '배관 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}



