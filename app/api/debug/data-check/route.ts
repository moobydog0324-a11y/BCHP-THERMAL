import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * GET /api/debug/data-check
 * 데이터베이스 상태 및 데이터 확인
 */
export async function GET() {
  try {
    // 1. 배관(pipes) 데이터 확인
    const pipesResult = await query(
      'SELECT pipe_id, pipe_code, location, section_category FROM pipes ORDER BY pipe_id'
    )

    // 2. 점검(inspections) 데이터 확인
    const inspectionsResult = await query(
      `SELECT i.inspection_id, i.pipe_id, i.inspector_name, i.inspection_date, p.section_category 
       FROM inspections i 
       LEFT JOIN pipes p ON i.pipe_id = p.pipe_id 
       ORDER BY i.inspection_id DESC 
       LIMIT 10`
    )

    // 3. 이미지(thermal_images) 데이터 확인
    const imagesResult = await query(
      `SELECT ti.image_id, ti.inspection_id, ti.image_type, ti.capture_timestamp, 
              ti.image_url, i.pipe_id, p.section_category
       FROM thermal_images ti
       LEFT JOIN inspections i ON ti.inspection_id = i.inspection_id
       LEFT JOIN pipes p ON i.pipe_id = p.pipe_id
       ORDER BY ti.image_id DESC
       LIMIT 10`
    )

    // 4. 구역별 이미지 개수
    const sectionCountResult = await query(
      `SELECT p.section_category, ti.image_type, COUNT(*) as image_count
       FROM thermal_images ti
       JOIN inspections i ON ti.inspection_id = i.inspection_id
       JOIN pipes p ON i.pipe_id = p.pipe_id
       GROUP BY p.section_category, ti.image_type
       ORDER BY p.section_category, ti.image_type`
    )

    return NextResponse.json({
      success: true,
      data: {
        pipes: {
          count: pipesResult.rowCount,
          data: pipesResult.rows,
        },
        inspections: {
          count: inspectionsResult.rowCount,
          recent: inspectionsResult.rows,
        },
        images: {
          count: imagesResult.rowCount,
          recent: imagesResult.rows,
        },
        section_summary: {
          data: sectionCountResult.rows,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('데이터 체크 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '데이터 확인 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}



