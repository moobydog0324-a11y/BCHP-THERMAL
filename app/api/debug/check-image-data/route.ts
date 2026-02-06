import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * GET /api/debug/check-image-data?image_id=2498
 * 특정 이미지의 데이터 구조 확인
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const imageId = searchParams.get('image_id') || '2498'

    // 1. 이미지 기본 정보
    const imageResult = await query(`
      SELECT 
        ti.image_id,
        p.section_category,
        ti.camera_model,
        ti.capture_timestamp,
        im.metadata_json,
        im.thermal_data_json
      FROM thermal_images ti
      LEFT JOIN image_metadata im ON ti.image_id = im.image_id
      JOIN inspections i ON ti.inspection_id = i.inspection_id
      JOIN pipes p ON i.pipe_id = p.pipe_id
      WHERE ti.image_id = $1
    `, [imageId])

    if (imageResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: '이미지를 찾을 수 없습니다'
      })
    }

    const img = imageResult.rows[0]
    const metadata = img.metadata_json
    const thermalData = img.thermal_data_json

    // 2. 온도 정보 추출 시뮬레이션
    const actualTempStats = thermalData?.actual_temp_stats
    const temperatureInfo = {
      range_min: actualTempStats?.min_temp 
        ? `${actualTempStats.min_temp.toFixed(1)}°C`
        : thermalData?.CameraTemperatureRangeMin || metadata?.CameraTemperatureRangeMin || null,
      range_max: actualTempStats?.max_temp 
        ? `${actualTempStats.max_temp.toFixed(1)}°C`
        : thermalData?.CameraTemperatureRangeMax || metadata?.CameraTemperatureRangeMax || null,
      avg_temp: actualTempStats?.avg_temp 
        ? `${actualTempStats.avg_temp.toFixed(1)}°C`
        : null,
      actual_temp_stats: actualTempStats || null,
    }

    return NextResponse.json({
      success: true,
      image_id: imageId,
      has_metadata_json: !!metadata,
      has_thermal_data_json: !!thermalData,
      has_actual_temp_stats: !!actualTempStats,
      metadata_keys: metadata ? Object.keys(metadata).slice(0, 10) : [],
      thermal_data_keys: thermalData ? Object.keys(thermalData).slice(0, 10) : [],
      actual_temp_stats: actualTempStats,
      temperature_info: temperatureInfo,
      raw_metadata: metadata ? JSON.stringify(metadata).substring(0, 500) : null,
      raw_thermal: thermalData ? JSON.stringify(thermalData).substring(0, 500) : null
    })

  } catch (error) {
    console.error('이미지 데이터 확인 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    )
  }
}

