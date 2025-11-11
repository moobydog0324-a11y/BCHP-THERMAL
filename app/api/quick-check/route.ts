import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * GET /api/quick-check
 * 빠른 시스템 상태 확인
 */
export async function GET() {
  try {
    // 1. 데이터베이스 연결 확인
    const dbCheck = await query('SELECT NOW()')
    
    // 2. 각 테이블 레코드 수 확인
    const pipes = await query('SELECT COUNT(*) as count, ARRAY_AGG(DISTINCT section_category) as sections FROM pipes')
    const inspections = await query('SELECT COUNT(*) as count FROM inspections')
    const images = await query('SELECT COUNT(*) as count, COUNT(DISTINCT inspection_id) as unique_inspections FROM thermal_images')
    const metadata = await query('SELECT COUNT(*) as count FROM image_metadata WHERE thermal_data_json IS NOT NULL')
    
    // 3. 구역별 이미지 개수
    const sectionImages = await query(`
      SELECT p.section_category, COUNT(ti.image_id) as image_count
      FROM pipes p
      LEFT JOIN inspections i ON p.pipe_id = i.pipe_id
      LEFT JOIN thermal_images ti ON i.inspection_id = ti.inspection_id
      GROUP BY p.section_category
      ORDER BY p.section_category
    `)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        current_time: dbCheck.rows[0].now,
      },
      counts: {
        pipes: parseInt(pipes.rows[0].count),
        available_sections: pipes.rows[0].sections?.filter(Boolean) || [],
        inspections: parseInt(inspections.rows[0].count),
        images: parseInt(images.rows[0].count),
        unique_inspections: parseInt(images.rows[0].unique_inspections),
        images_with_metadata: parseInt(metadata.rows[0].count),
      },
      section_breakdown: sectionImages.rows,
      health_check: {
        has_pipes: parseInt(pipes.rows[0].count) > 0,
        has_images: parseInt(images.rows[0].count) > 0,
        metadata_extraction_working: parseInt(metadata.rows[0].count) > 0,
      }
    })
  } catch (error) {
    console.error('빠른 확인 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}


