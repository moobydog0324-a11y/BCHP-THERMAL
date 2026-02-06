import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * 비교 분석 데이터 디버그 API
 * DB에 저장된 이미지, 점검, 파이프 연결 상태를 확인
 */
export async function GET() {
  try {
    // 1. 전체 이미지 개수
    const imageCount = await query(`
      SELECT COUNT(*) as count, image_type 
      FROM thermal_images 
      GROUP BY image_type
    `)

    // 2. 구역별 이미지 개수
    const sectionImages = await query(`
      SELECT 
        p.section_category,
        ti.image_type,
        COUNT(*) as count
      FROM thermal_images ti
      JOIN inspections i ON ti.inspection_id = i.inspection_id
      JOIN pipes p ON i.pipe_id = p.pipe_id
      WHERE p.section_category IS NOT NULL
      GROUP BY p.section_category, ti.image_type
      ORDER BY p.section_category, ti.image_type
    `)

    // 3. section_category가 없는 파이프 확인
    const pipesWithoutSection = await query(`
      SELECT COUNT(*) as count
      FROM pipes
      WHERE section_category IS NULL
    `)

    // 4. 최근 업로드된 이미지 5개 (상세 정보)
    const recentImages = await query(`
      SELECT 
        ti.image_id,
        ti.image_type,
        ti.capture_timestamp,
        i.inspection_id,
        p.pipe_id,
        p.section_category,
        p.district
      FROM thermal_images ti
      LEFT JOIN inspections i ON ti.inspection_id = i.inspection_id
      LEFT JOIN pipes p ON i.pipe_id = p.pipe_id
      ORDER BY ti.created_at DESC
      LIMIT 5
    `)

    // 5. 점검과 파이프 연결 상태
    const inspectionStats = await query(`
      SELECT 
        COUNT(*) as total_inspections,
        COUNT(DISTINCT pipe_id) as unique_pipes,
        COUNT(CASE WHEN pipe_id IS NULL THEN 1 END) as inspections_without_pipe
      FROM inspections
    `)

    return NextResponse.json({
      success: true,
      debug_info: {
        image_counts: imageCount.rows,
        section_images: sectionImages.rows,
        pipes_without_section: pipesWithoutSection.rows[0],
        recent_images: recentImages.rows,
        inspection_stats: inspectionStats.rows[0],
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('디버그 데이터 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: '디버그 데이터 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    )
  }
}

