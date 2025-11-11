import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { dmsToDecimal, formatGPS } from '@/lib/utils/gps'

/**
 * 구역별 쿼리 테스트
 */
export async function GET() {
  try {
    const section = 'C-1'
    
    // 메타데이터 포함 쿼리
    const sql = `
      SELECT 
        ti.image_id,
        ti.capture_timestamp,
        ti.camera_model,
        im.metadata_json,
        im.thermal_data_json
      FROM thermal_images ti
      LEFT JOIN image_metadata im ON ti.image_id = im.image_id
      JOIN inspections i ON ti.inspection_id = i.inspection_id
      JOIN pipes p ON i.pipe_id = p.pipe_id
      WHERE p.section_category = $1
        AND ti.image_type = 'thermal'
      LIMIT 1
    `
    
    const result = await query(sql, [section])
    
    const row = result.rows[0]
    const metadata = row?.metadata_json
    const thermalData = row?.thermal_data_json
    
    // GPS 변환 테스트
    let gpsInfo = null
    if (metadata?.GPSLatitude && metadata?.GPSLongitude) {
      const lat = dmsToDecimal(metadata.GPSLatitude)
      const lon = dmsToDecimal(metadata.GPSLongitude)
      
      if (lat !== null && lon !== null) {
        gpsInfo = {
          latitude: lat,
          longitude: lon,
          formatted: formatGPS(lat, lon),
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      row_count: result.rowCount,
      has_metadata: !!metadata,
      gps_raw: {
        latitude: metadata?.GPSLatitude || null,
        longitude: metadata?.GPSLongitude || null,
      },
      gps_converted: gpsInfo,
      temperature: {
        range_min: thermalData?.CameraTemperatureRangeMin || metadata?.CameraTemperatureRangeMin || null,
        range_max: thermalData?.CameraTemperatureRangeMax || metadata?.CameraTemperatureRangeMax || null,
        atmospheric: thermalData?.AtmosphericTemperature || metadata?.AtmosphericTemperature || null,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

