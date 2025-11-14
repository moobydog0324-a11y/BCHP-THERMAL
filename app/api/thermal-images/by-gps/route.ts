import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { dmsToDecimal, gpsToKey, formatGPS } from '@/lib/utils/gps'

/**
 * GET /api/thermal-images/by-gps
 * GPS 좌표 기반으로 이미지를 그룹핑하여 반환
 * 
 * Query params:
 * - section: 구역 필터 (선택사항)
 * - precision: GPS 그룹핑 정밀도 (기본값 4 = 약 11m 반경)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const section = searchParams.get('section')
    const precision = parseInt(searchParams.get('precision') || '4')

    console.log(`GPS 기반 이미지 조회 - 구역: ${section || '전체'}, 정밀도: ${precision}`)

    // 이미지 + 메타데이터 조회
    let sql = `
      SELECT 
        ti.*,
        im.metadata_json,
        im.thermal_data_json,
        p.section_category
      FROM thermal_images ti
      LEFT JOIN image_metadata im ON ti.image_id = im.image_id
      JOIN inspections i ON ti.inspection_id = i.inspection_id
      JOIN pipes p ON i.pipe_id = p.pipe_id
      WHERE ti.image_type = 'thermal'
        AND im.metadata_json IS NOT NULL
    `
    
    const queryParams: string[] = []
    
    if (section) {
      sql += ` AND p.section_category = $1`
      queryParams.push(section)
    }

    sql += ` ORDER BY ti.capture_timestamp DESC`

    const result = await query(sql, queryParams)

    console.log(`쿼리 결과: ${result.rowCount}개 이미지`)

    // GPS 좌표 추출 및 그룹핑
    const gpsGroups: Record<string, any[]> = {}
    const imagesByGps: any[] = []
    const errors: string[] = []

    result.rows.forEach((row) => {
      const metadata = row.metadata_json
      const thermalData = row.thermal_data_json

      // GPS 좌표 추출 및 변환
      const latDMS = metadata?.GPSLatitude
      const lonDMS = metadata?.GPSLongitude
      
      if (!latDMS || !lonDMS) {
        const msg = `이미지 ${row.image_id}: GPS 정보 없음`
        console.log(msg)
        errors.push(msg)
        return
      }

      const lat = dmsToDecimal(latDMS)
      const lon = dmsToDecimal(lonDMS)

      if (lat === null || lon === null) {
        const msg = `이미지 ${row.image_id}: GPS 변환 실패 (lat: ${latDMS}, lon: ${lonDMS})`
        console.log(msg)
        errors.push(msg)
        return
      }

      // GPS 키 생성 (그룹핑용)
      const gpsKey = gpsToKey(lat, lon, precision)

      // 고도 파싱
      let altitude = null
      if (metadata?.GPSAltitude) {
        const altStr = String(metadata.GPSAltitude)
        const altMatch = altStr.match(/([-\d.]+)\s*m/i)
        if (altMatch) {
          let altValue = parseFloat(altMatch[1])
          if (metadata.GPSAltitudeRef === 1 || metadata.GPSAltitudeRef === '1') {
            altValue = -Math.abs(altValue)
          } else {
            altValue = Math.abs(altValue)
          }
          altitude = `${altValue.toFixed(1)}m`
        }
      }

      // 온도 정보 추출 (카메라 기본값 제외)
      const temperatureInfo = {
        range_min: thermalData?.CameraTemperatureRangeMin || metadata?.CameraTemperatureRangeMin,
        range_max: thermalData?.CameraTemperatureRangeMax || metadata?.CameraTemperatureRangeMax,
      }

      const imageData = {
        ...row,
        gps: {
          latitude: lat,
          longitude: lon,
          formatted: formatGPS(lat, lon),
          altitude: altitude,
          key: gpsKey,
        },
        temperature: temperatureInfo,
      }

      // GPS 그룹에 추가
      if (!gpsGroups[gpsKey]) {
        gpsGroups[gpsKey] = []
      }
      gpsGroups[gpsKey].push(imageData)
      imagesByGps.push(imageData)
    })

    // 각 GPS 그룹 내에서 시간순 정렬
    Object.keys(gpsGroups).forEach((key) => {
      gpsGroups[key].sort((a, b) => 
        new Date(a.capture_timestamp).getTime() - new Date(b.capture_timestamp).getTime()
      )
    })

    // GPS 위치별 요약 정보
    const locations = Object.entries(gpsGroups).map(([gpsKey, images]) => {
      const firstImage = images[0]
      return {
        gps_key: gpsKey,
        gps: firstImage.gps,
        image_count: images.length,
        date_range: {
          earliest: images[0].capture_timestamp,
          latest: images[images.length - 1].capture_timestamp,
        },
        section_category: firstImage.section_category,
      }
    })

    // 위치별 이미지 개수 내림차순 정렬
    locations.sort((a, b) => b.image_count - a.image_count)

    console.log(`조회 결과: ${imagesByGps.length}개 이미지, ${locations.length}개 GPS 위치, ${errors.length}개 오류`)

    return NextResponse.json({
      success: true,
      data: {
        images: imagesByGps,
        groups: gpsGroups,
        locations: locations,
      },
      summary: {
        total_images: imagesByGps.length,
        total_locations: locations.length,
        total_queried: result.rowCount,
        skipped: result.rowCount - imagesByGps.length,
        precision: precision,
        precision_description: precision === 4 ? '약 11m 반경' : precision === 5 ? '약 1.1m 반경' : `소수점 ${precision}자리`,
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('GPS 기반 이미지 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'GPS 기반 이미지 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    )
  }
}

