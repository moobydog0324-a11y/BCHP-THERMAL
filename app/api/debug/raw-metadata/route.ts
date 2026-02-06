import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * 특정 이미지의 원본 메타데이터를 그대로 반환 (파싱 없이)
 * Query: ?image_id=586
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const imageId = searchParams.get('image_id')

    if (!imageId) {
      return NextResponse.json({
        success: false,
        error: 'image_id 파라미터가 필요합니다',
      })
    }

    // DB에서 원본 메타데이터 그대로 가져오기
    const result = await query<any>(`
      SELECT 
        ti.image_id,
        ti.image_url,
        ti.capture_timestamp,
        ti.camera_model,
        ti.created_at,
        im.metadata_json,
        im.thermal_data_json,
        im.created_at as metadata_saved_at,
        im.updated_at as metadata_updated_at
      FROM thermal_images ti
      LEFT JOIN image_metadata im ON ti.image_id = im.image_id
      WHERE ti.image_id = $1
    `, [imageId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `이미지 ID ${imageId}를 찾을 수 없습니다`,
      })
    }

    const row = result.rows[0]
    const metadata = row.metadata_json
    const thermalData = row.thermal_data_json

    // GPS 필드만 추출 (파싱 없이 원본 그대로)
    const gpsRaw = metadata ? {
      GPSLatitude: metadata.GPSLatitude,
      GPSLatitudeRef: metadata.GPSLatitudeRef,
      GPSLongitude: metadata.GPSLongitude,
      GPSLongitudeRef: metadata.GPSLongitudeRef,
      GPSAltitude: metadata.GPSAltitude,
      GPSAltitudeRef: metadata.GPSAltitudeRef,
    } : null

    // 온도 필드만 추출 (파싱 없이 원본 그대로)
    const tempRaw = {
      from_metadata: metadata ? {
        CameraTemperatureRangeMin: metadata.CameraTemperatureRangeMin,
        CameraTemperatureRangeMax: metadata.CameraTemperatureRangeMax,
        AtmosphericTemperature: metadata.AtmosphericTemperature,
        ReflectedApparentTemperature: metadata.ReflectedApparentTemperature,
        RelativeHumidity: metadata.RelativeHumidity,
      } : null,
      from_thermal_data: thermalData ? {
        actual_temp_stats: thermalData.actual_temp_stats,
        CameraTemperatureRangeMin: thermalData.CameraTemperatureRangeMin,
        CameraTemperatureRangeMax: thermalData.CameraTemperatureRangeMax,
      } : null,
    }

    return NextResponse.json({
      success: true,
      image_info: {
        image_id: row.image_id,
        image_url: row.image_url,
        capture_timestamp: row.capture_timestamp,
        camera_model: row.camera_model,
        image_created_at: row.created_at,
        metadata_saved_at: row.metadata_saved_at,
        metadata_updated_at: row.metadata_updated_at,
      },
      raw_gps: gpsRaw,
      raw_temperature: tempRaw,
      metadata_exists: !!metadata,
      thermal_data_exists: !!thermalData,
      warning: '⚠️ 이것은 DB에 저장된 원본 데이터입니다. 이 값이 계속 바뀌면 안됩니다!',
    })
  } catch (error) {
    console.error('원본 메타데이터 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    )
  }
}












