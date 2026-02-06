import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * 메타데이터에 GPS와 온도 정보가 있는지 확인
 */
export async function GET() {
  try {
    // 최근 이미지 1개의 전체 메타데이터 조회
    const result = await query(`
      SELECT 
        ti.image_id,
        ti.capture_timestamp,
        ti.camera_model,
        im.metadata_json,
        im.thermal_data_json
      FROM thermal_images ti
      LEFT JOIN image_metadata im ON ti.image_id = im.image_id
      WHERE im.metadata_json IS NOT NULL
      ORDER BY ti.created_at DESC
      LIMIT 1
    `)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: '메타데이터가 있는 이미지를 찾을 수 없습니다.',
      })
    }

    const image = result.rows[0]
    const metadata = image.metadata_json
    const thermalData = image.thermal_data_json

    // GPS 정보 확인
    const gpsInfo = {
      has_gps: !!(metadata.GPSLatitude || metadata.GPSLongitude),
      latitude: metadata.GPSLatitude,
      longitude: metadata.GPSLongitude,
      gps_fields: Object.keys(metadata).filter(k => k.startsWith('GPS')),
    }

    // 온도 정보 확인 (FLIR 카메라의 경우)
    const tempFields = Object.keys(metadata).filter(k => 
      k.toLowerCase().includes('temp') || 
      k.toLowerCase().includes('thermal')
    )

    const thermalInfo = {
      has_thermal: thermalData !== null || tempFields.length > 0,
      thermal_fields: tempFields,
      thermal_data: thermalData,
      sample_values: tempFields.reduce((acc, field) => {
        acc[field] = metadata[field]
        return acc
      }, {} as Record<string, any>),
    }

    // 전체 메타데이터 키 목록
    const allKeys = Object.keys(metadata)

    return NextResponse.json({
      success: true,
      image_id: image.image_id,
      camera_model: image.camera_model,
      capture_timestamp: image.capture_timestamp,
      gps_info: gpsInfo,
      thermal_info: thermalInfo,
      metadata_keys_count: allKeys.length,
      metadata_keys_sample: allKeys.slice(0, 50), // 처음 50개만
      full_metadata_preview: {
        ...Object.fromEntries(
          Object.entries(metadata).slice(0, 20)
        ),
        '... 더 많은 필드들': `총 ${allKeys.length}개 필드`
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

