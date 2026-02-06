import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * GET /api/debug/db-status
 * DB 메타데이터 저장 상태 확인
 */
export async function GET() {
  try {
    // 1. 전체 통계
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_images,
        COUNT(im.metadata_json) as has_metadata_json,
        COUNT(im.thermal_data_json) as has_thermal_data_json,
        COUNT(*) - COUNT(im.metadata_json) as missing_metadata,
        COUNT(*) - COUNT(im.thermal_data_json) as missing_thermal_data
      FROM thermal_images ti
      LEFT JOIN image_metadata im ON ti.image_id = im.image_id
      WHERE ti.image_type = 'thermal'
    `)

    // 2. 샘플 이미지 5개
    const samplesResult = await query(`
      SELECT 
        ti.image_id,
        ti.camera_model,
        ti.capture_timestamp,
        ti.created_at,
        im.metadata_json IS NOT NULL as has_metadata,
        im.thermal_data_json IS NOT NULL as has_thermal,
        CASE 
          WHEN im.thermal_data_json IS NOT NULL THEN 
            im.thermal_data_json::text LIKE '%actual_temp_stats%'
          ELSE false
        END as has_temp_stats,
        CASE 
          WHEN im.metadata_json IS NOT NULL THEN 
            im.metadata_json::text LIKE '%GPSLatitude%'
          ELSE false
        END as has_gps
      FROM thermal_images ti
      LEFT JOIN image_metadata im ON ti.image_id = im.image_id
      WHERE ti.image_type = 'thermal'
      ORDER BY ti.created_at DESC
      LIMIT 5
    `)

    // 3. 최신 이미지 1개 상세
    const latestResult = await query(`
      SELECT 
        ti.image_id,
        ti.created_at,
        im.metadata_json,
        im.thermal_data_json
      FROM thermal_images ti
      LEFT JOIN image_metadata im ON ti.image_id = im.image_id
      WHERE ti.image_type = 'thermal'
      ORDER BY ti.created_at DESC
      LIMIT 1
    `)

    const latest = latestResult.rows[0]
    const latestDetail = latest ? {
      image_id: latest.image_id,
      created_at: latest.created_at,
      has_metadata_json: !!latest.metadata_json,
      has_thermal_data_json: !!latest.thermal_data_json,
      metadata_keys: latest.metadata_json ? Object.keys(latest.metadata_json).slice(0, 10) : [],
      thermal_keys: latest.thermal_data_json ? Object.keys(latest.thermal_data_json).slice(0, 10) : [],
      has_actual_temp_stats: latest.thermal_data_json?.actual_temp_stats ? true : false,
      has_gps: latest.metadata_json?.GPSLatitude ? true : false
    } : null

    return NextResponse.json({
      success: true,
      statistics: statsResult.rows[0],
      samples: samplesResult.rows,
      latest_image: latestDetail,
      summary: {
        total: parseInt(statsResult.rows[0].total_images),
        with_metadata: parseInt(statsResult.rows[0].has_metadata_json),
        with_thermal: parseInt(statsResult.rows[0].has_thermal_data_json),
        missing_metadata: parseInt(statsResult.rows[0].missing_metadata),
        missing_thermal: parseInt(statsResult.rows[0].missing_thermal_data),
        percentage_with_metadata: ((parseInt(statsResult.rows[0].has_metadata_json) / parseInt(statsResult.rows[0].total_images)) * 100).toFixed(1) + '%',
        percentage_with_thermal: ((parseInt(statsResult.rows[0].has_thermal_data_json) / parseInt(statsResult.rows[0].total_images)) * 100).toFixed(1) + '%'
      }
    })

  } catch (error) {
    console.error('DB 상태 확인 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    )
  }
}





