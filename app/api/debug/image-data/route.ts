import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * GET /api/debug/image-data
 * 이미지 데이터의 상세 정보 및 관계 확인
 */
export async function GET() {
  try {
    // 모든 이미지와 관련 데이터를 함께 조회
    const result = await query(
      `SELECT 
        ti.image_id,
        ti.inspection_id,
        ti.image_type,
        ti.image_url,
        ti.capture_timestamp,
        i.pipe_id,
        i.inspector_name,
        i.inspection_date,
        p.pipe_id as pipe_id_check,
        p.pipe_code,
        p.location,
        p.section_category
       FROM thermal_images ti
       LEFT JOIN inspections i ON ti.inspection_id = i.inspection_id
       LEFT JOIN pipes p ON i.pipe_id = p.pipe_id
       ORDER BY ti.image_id DESC`
    )

    // 구역별로 그룹핑
    const groupedBySection: { [key: string]: any[] } = {}
    const orphanImages: any[] = [] // section_category가 없는 이미지

    result.rows.forEach((row) => {
      if (row.section_category) {
        if (!groupedBySection[row.section_category]) {
          groupedBySection[row.section_category] = []
        }
        groupedBySection[row.section_category].push(row)
      } else {
        orphanImages.push(row)
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        total_images: result.rowCount,
        all_images: result.rows,
        grouped_by_section: groupedBySection,
        orphan_images: orphanImages, // section_category가 없는 이미지들
        sections_with_images: Object.keys(groupedBySection),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('이미지 데이터 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '이미지 데이터 확인 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}



