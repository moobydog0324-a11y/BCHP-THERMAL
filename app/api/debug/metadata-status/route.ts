import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * 이미지별 메타데이터 저장 상태 확인
 */
export async function GET() {
  try {
    // 전체 이미지 개수
    const totalImages = await query(`SELECT COUNT(*) as count FROM thermal_images`)
    
    // 메타데이터 있는 이미지 개수
    const withMetadata = await query(`
      SELECT COUNT(*) as count 
      FROM thermal_images ti
      JOIN image_metadata im ON ti.image_id = im.image_id
      WHERE im.metadata_json IS NOT NULL
    `)
    
    // 메타데이터 없는 이미지 목록
    const withoutMetadata = await query(`
      SELECT 
        ti.image_id,
        ti.image_url,
        ti.capture_timestamp,
        ti.camera_model,
        ti.created_at,
        p.section_category
      FROM thermal_images ti
      LEFT JOIN image_metadata im ON ti.image_id = im.image_id
      LEFT JOIN inspections i ON ti.inspection_id = i.inspection_id
      LEFT JOIN pipes p ON i.pipe_id = p.pipe_id
      WHERE im.metadata_json IS NULL
      ORDER BY ti.created_at DESC
      LIMIT 10
    `)

    const total = parseInt(totalImages.rows[0].count)
    const withMeta = parseInt(withMetadata.rows[0].count)
    const withoutMeta = total - withMeta

    return NextResponse.json({
      success: true,
      summary: {
        total_images: total,
        with_metadata: withMeta,
        without_metadata: withoutMeta,
        percentage_complete: total > 0 ? Math.round((withMeta / total) * 100) : 0,
      },
      images_without_metadata: withoutMetadata.rows,
      message: withoutMeta > 0 
        ? `${withoutMeta}개 이미지에 메타데이터가 누락되어 있습니다.`
        : '모든 이미지에 메타데이터가 저장되어 있습니다.',
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

