import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { dmsToDecimal, formatGPS } from '@/lib/utils/gps'

/**
 * GET /api/thermal-images/by-section/[section]
 * 특정 구역의 열화상 이미지 조회 (GPS + 온도 정보 포함)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ section: string }> }
) {
  try {
    const { section } = await params
    const searchParams = request.nextUrl.searchParams
    const imageType = searchParams.get('image_type') // 'thermal' 또는 'real'

    console.log(`구역별 이미지 조회 - 구역: ${section}, 타입: ${imageType || '전체'}`)

    // 이미지 + 메타데이터 조회
    let sql = `
      SELECT 
        ti.image_id,
        ti.inspection_id,
        ti.image_url,
        ti.thumbnail_url,
        ti.image_width,
        ti.image_height,
        ti.camera_model,
        ti.capture_timestamp,
        ti.file_size_bytes,
        ti.file_format,
        ti.image_type,
        ti.created_at,
        im.metadata_json,
        im.thermal_data_json,
        p.section_category
      FROM thermal_images ti
      LEFT JOIN image_metadata im ON ti.image_id = im.image_id
      JOIN inspections i ON ti.inspection_id = i.inspection_id
      JOIN pipes p ON i.pipe_id = p.pipe_id
      WHERE p.section_category = $1
    `
    
    const queryParams: (string | number)[] = [section]

    // 이미지 타입 필터 추가
    if (imageType && (imageType === 'thermal' || imageType === 'real')) {
      sql += ` AND ti.image_type = $2`
      queryParams.push(imageType)
    }

    sql += ` ORDER BY ti.capture_timestamp DESC`

    const result = await query<any>(sql, queryParams)

    console.log(`조회 결과: ${result.rowCount}개 이미지`)

    // 에러 추적을 위한 카운터
    let processedCount = 0
    let errorCount = 0

    // GPS 및 온도 정보 추가 처리
    const enhancedImages = result.rows.map((row) => {
      try {
        processedCount++
      const metadata = row.metadata_json
      const thermalData = row.thermal_data_json

      // GPS 정보 추출 및 변환
      let gpsInfo = null
      if (metadata?.GPSLatitude && metadata?.GPSLongitude) {
        const lat = dmsToDecimal(metadata.GPSLatitude)
        const lon = dmsToDecimal(metadata.GPSLongitude)
        
        if (lat !== null && lon !== null) {
          gpsInfo = {
            latitude: lat,
            longitude: lon,
            formatted: formatGPS(lat, lon),
            altitude: metadata.GPSAltitude,
          }
        }
      }

      // 온도 정보 추출
      const temperatureInfo = {
        range_min: thermalData?.CameraTemperatureRangeMin || metadata?.CameraTemperatureRangeMin || null,
        range_max: thermalData?.CameraTemperatureRangeMax || metadata?.CameraTemperatureRangeMax || null,
        atmospheric: thermalData?.AtmosphericTemperature || metadata?.AtmosphericTemperature || null,
        reflected: thermalData?.ReflectedApparentTemperature || metadata?.ReflectedApparentTemperature || null,
        humidity: thermalData?.RelativeHumidity || metadata?.RelativeHumidity || null,
      }

        // 기본 이미지 정보 + GPS + 온도
        return {
          image_id: row.image_id,
          inspection_id: row.inspection_id,
          image_url: row.image_url,
          thumbnail_url: row.thumbnail_url,
          image_width: row.image_width,
          image_height: row.image_height,
          camera_model: row.camera_model,
          capture_timestamp: row.capture_timestamp,
          file_size_bytes: row.file_size_bytes,
          file_format: row.file_format,
          image_type: row.image_type,
          created_at: row.created_at,
          section_category: row.section_category,
          gps: gpsInfo,
          temperature: temperatureInfo,
          has_metadata: !!metadata,
        }
      } catch (rowError) {
        errorCount++
        console.error(`이미지 처리 오류 (ID: ${row.image_id}):`, rowError)
        // 오류가 발생한 경우 기본 정보만 반환
        return {
          image_id: row.image_id,
          inspection_id: row.inspection_id,
          image_url: row.image_url,
          thumbnail_url: row.thumbnail_url,
          capture_timestamp: row.capture_timestamp,
          error: true,
        }
      }
    })

    console.log(`처리 완료: ${processedCount}개 중 ${errorCount}개 오류`)

    return NextResponse.json({
      success: true,
      data: enhancedImages,
      count: result.rowCount,
      section: section,
      image_type: imageType || 'all',
    })
  } catch (error) {
    console.error('구역별 이미지 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: '구역별 이미지를 조회하는 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    )
  }
}
