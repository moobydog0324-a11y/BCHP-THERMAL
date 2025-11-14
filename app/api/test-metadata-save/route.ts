import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * GET /api/test-metadata-save
 * 메타데이터 저장 상태 점검
 */
export async function GET(request: NextRequest) {
  const results = {
    table_exists: false,
    recent_images_count: 0,
    images_with_metadata: 0,
    images_without_metadata: 0,
    sample_images: [] as any[],
    flask_server_status: 'unknown' as string,
  }

  try {
    // 1. image_metadata 테이블 존재 확인
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'image_metadata'
      ) as exists
    `)
    results.table_exists = tableCheck.rows[0].exists

    if (!results.table_exists) {
      return NextResponse.json({
        success: false,
        message: 'image_metadata 테이블이 없습니다!',
        action: '05-add-metadata-table.sql 스크립트를 실행하거나 /api/setup-metadata-table을 호출하세요',
        results,
      })
    }

    // 2. 최근 업로드된 이미지 개수
    const recentImagesResult = await query(`
      SELECT COUNT(*) as count
      FROM thermal_images
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `)
    results.recent_images_count = parseInt(recentImagesResult.rows[0].count)

    // 3. 메타데이터 있는 이미지 vs 없는 이미지
    const withMetadata = await query(`
      SELECT COUNT(*) as count
      FROM thermal_images ti
      INNER JOIN image_metadata im ON ti.image_id = im.image_id
    `)
    results.images_with_metadata = parseInt(withMetadata.rows[0].count)

    const totalImages = await query(`SELECT COUNT(*) as count FROM thermal_images`)
    const totalCount = parseInt(totalImages.rows[0].count)
    results.images_without_metadata = totalCount - results.images_with_metadata

    // 4. 샘플 이미지 (최근 5개)
    const sampleResult = await query(`
      SELECT 
        ti.image_id,
        ti.image_url,
        ti.camera_model,
        ti.capture_timestamp,
        ti.created_at,
        CASE WHEN im.image_id IS NOT NULL THEN true ELSE false END as has_metadata,
        im.thermal_data_json->>'Model' as extracted_model,
        im.thermal_data_json->'actual_temp_stats' as actual_temp
      FROM thermal_images ti
      LEFT JOIN image_metadata im ON ti.image_id = im.image_id
      ORDER BY ti.created_at DESC
      LIMIT 5
    `)
    results.sample_images = sampleResult.rows

    // 5. Flask 서버 상태 확인
    try {
      const FLASK_SERVER = process.env.FLASK_SERVER_URL || 'http://localhost:5000'
      const flaskResponse = await fetch(`${FLASK_SERVER}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      })
      
      if (flaskResponse.ok) {
        const flaskData = await flaskResponse.json()
        results.flask_server_status = flaskData.status || 'running'
      } else {
        results.flask_server_status = `error (${flaskResponse.status})`
      }
    } catch (flaskError) {
      results.flask_server_status = 'offline or timeout'
    }

    return NextResponse.json({
      success: true,
      message: '메타데이터 저장 상태 점검 완료',
      results,
      recommendations: generateRecommendations(results),
    })
  } catch (error) {
    console.error('메타데이터 테스트 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        results,
      },
      { status: 500 }
    )
  }
}

function generateRecommendations(results: any): string[] {
  const recommendations: string[] = []

  if (!results.table_exists) {
    recommendations.push('❌ image_metadata 테이블이 없습니다. /api/setup-metadata-table을 호출하세요.')
  }

  if (results.flask_server_status !== 'running') {
    recommendations.push(`⚠️ Flask 서버 상태: ${results.flask_server_status}. RUN-FLASK.bat를 실행하세요.`)
  }

  if (results.recent_images_count === 0) {
    recommendations.push('ℹ️ 최근 1시간 내 업로드된 이미지가 없습니다.')
  }

  if (results.images_without_metadata > 0 && results.recent_images_count > 0) {
    recommendations.push(`⚠️ ${results.images_without_metadata}개의 이미지에 메타데이터가 없습니다.`)
  }

  if (results.sample_images.length > 0) {
    const recentWithoutMeta = results.sample_images.filter((img: any) => !img.has_metadata)
    if (recentWithoutMeta.length > 0) {
      recommendations.push('⚠️ 최근 업로드된 이미지 중 일부에 메타데이터가 없습니다.')
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ 모든 시스템이 정상 작동 중입니다!')
  }

  return recommendations
}





