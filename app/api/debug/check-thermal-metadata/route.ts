import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * 실제 열화상 메타데이터 필드 확인
 */
export async function GET() {
  try {
    // 메타데이터가 있는 이미지 하나를 가져와서 어떤 필드들이 있는지 확인
    const result = await query<any>(`
      SELECT 
        ti.image_id,
        ti.image_url,
        ti.camera_model,
        im.metadata_json,
        im.thermal_data_json
      FROM thermal_images ti
      JOIN image_metadata im ON ti.image_id = im.image_id
      WHERE im.metadata_json IS NOT NULL
      AND ti.image_type = 'thermal'
      LIMIT 3
    `)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: '메타데이터가 있는 이미지를 찾을 수 없습니다.',
      })
    }

      // 각 이미지의 메타데이터 분석
    const analysis = result.rows.map((row) => {
      const metadata = row.metadata_json
      const thermalData = row.thermal_data_json

      // GPS 관련 필드 찾기
      const gpsFields: any = {}
      if (metadata) {
        Object.keys(metadata).forEach((key) => {
          if (
            key.toLowerCase().includes('gps') ||
            key.toLowerCase().includes('altitude') ||
            key.toLowerCase().includes('latitude') ||
            key.toLowerCase().includes('longitude')
          ) {
            gpsFields[key] = metadata[key]
          }
        })
      }

      // 온도 관련 필드 찾기
      const temperatureFields: any = {
        camera_model: row.camera_model,
      }

      // metadata_json에서 온도 관련 필드 추출
      if (metadata) {
        Object.keys(metadata).forEach((key) => {
          if (
            key.toLowerCase().includes('temp') ||
            key.toLowerCase().includes('thermal') ||
            key.toLowerCase().includes('planck') ||
            key.toLowerCase().includes('range') ||
            key.toLowerCase().includes('max') ||
            key.toLowerCase().includes('min')
          ) {
            temperatureFields[`metadata.${key}`] = metadata[key]
          }
        })
      }

      // thermal_data_json에서 온도 관련 필드 추출
      if (thermalData) {
        Object.keys(thermalData).forEach((key) => {
          if (
            key.toLowerCase().includes('temp') ||
            key.toLowerCase().includes('thermal') ||
            key.toLowerCase().includes('planck') ||
            key.toLowerCase().includes('range') ||
            key.toLowerCase().includes('max') ||
            key.toLowerCase().includes('min')
          ) {
            temperatureFields[`thermal_data.${key}`] = thermalData[key]
          }
        })
      }

      return {
        image_id: row.image_id,
        image_url: row.image_url,
        gps_fields: gpsFields,
        temperature_fields: temperatureFields,
        all_metadata_keys: metadata ? Object.keys(metadata) : [],
        all_thermal_keys: thermalData ? Object.keys(thermalData) : [],
      }
    })

    return NextResponse.json({
      success: true,
      count: result.rows.length,
      images: analysis,
      explanation: {
        camera_range: 'CameraTemperatureRangeMin/Max는 카메라의 측정 범위 설정값입니다',
        actual_temp: '실제 이미지의 최고/최저 온도는 별도 필드에 있을 수 있습니다',
        check_fields: '위 temperature_fields를 확인하여 실제 온도 값을 찾아보세요',
      },
    })
  } catch (error) {
    console.error('메타데이터 확인 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    )
  }
}



