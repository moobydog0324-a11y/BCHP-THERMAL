import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * GET /api/debug/check-metadata-status
 * 메타데이터 저장 상태를 진단하는 API
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const section = searchParams.get('section') || 'C-1'
    const limit = parseInt(searchParams.get('limit') || '5')

    // 1. 이미지 테이블에서 데이터 확인
    const imagesResult = await query(`
      SELECT 
        ti.image_id,
        p.section_category,
        ti.image_type,
        ti.camera_model,
        ti.capture_timestamp
      FROM thermal_images ti
      JOIN inspections i ON ti.inspection_id = i.inspection_id
      JOIN pipes p ON i.pipe_id = p.pipe_id
      WHERE p.section_category = $1
        AND ti.image_type = 'thermal'
      ORDER BY ti.image_id DESC
      LIMIT $2
    `, [section, limit])

    console.log(`📊 ${section} 구역의 이미지 ${imagesResult.rowCount}개 발견`)

    // 2. 각 이미지의 메타데이터 확인
    const diagnostics = []
    for (const row of imagesResult.rows) {
      const metaResult = await query(`
        SELECT 
          image_id,
          metadata_json IS NOT NULL as has_metadata_json,
          thermal_data_json IS NOT NULL as has_thermal_data_json,
          CASE 
            WHEN metadata_json IS NOT NULL THEN 
              CASE 
                WHEN metadata_json::text LIKE '%GPSLatitude%' THEN true 
                ELSE false 
              END
            ELSE false
          END as has_gps,
          CASE 
            WHEN thermal_data_json IS NOT NULL THEN 
              CASE 
                WHEN thermal_data_json::text LIKE '%actual_temp_stats%' THEN true 
                ELSE false 
              END
            ELSE false
          END as has_temperature,
          created_at,
          updated_at
        FROM image_metadata
        WHERE image_id = $1
      `, [row.image_id])

      diagnostics.push({
        image_id: row.image_id,
        camera_model: row.camera_model,
        capture_timestamp: row.capture_timestamp,
        metadata_exists_in_table: metaResult.rowCount > 0,
        metadata_details: metaResult.rowCount > 0 ? metaResult.rows[0] : null
      })
    }

    // 3. 전체 통계
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_images,
        COUNT(im.image_id) as images_with_metadata,
        COUNT(*) - COUNT(im.image_id) as images_without_metadata
      FROM thermal_images ti
      JOIN inspections i ON ti.inspection_id = i.inspection_id
      JOIN pipes p ON i.pipe_id = p.pipe_id
      LEFT JOIN image_metadata im ON ti.image_id = im.image_id
      WHERE p.section_category = $1
        AND ti.image_type = 'thermal'
    `, [section])

    return NextResponse.json({
      success: true,
      section: section,
      statistics: statsResult.rows[0],
      sample_diagnostics: diagnostics,
      summary: {
        total_checked: diagnostics.length,
        with_metadata: diagnostics.filter(d => d.metadata_exists_in_table).length,
        without_metadata: diagnostics.filter(d => !d.metadata_exists_in_table).length,
      }
    })

  } catch (error) {
    console.error('메타데이터 상태 확인 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    )
  }
}

