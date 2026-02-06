import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * POST /api/thermal-images/by-gps-location
 * GPS 좌표가 유사한 위치의 이미지 찾기 (시계열 비교용)
 * 
 * Body:
 * - section: 구역 (예: 'A-1')
 * - latitude: 위도
 * - longitude: 경도
 * - tolerance: 허용 오차 (미터 단위, 기본값: 5m)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { section, latitude, longitude, tolerance = 5 } = body

    if (!section || !latitude || !longitude) {
      return NextResponse.json(
        { success: false, error: '구역, 위도, 경도는 필수 항목입니다.' },
        { status: 400 }
      )
    }

    // GPS 좌표가 유사한 이미지 찾기
    // tolerance를 위도/경도 차이로 변환 (대략적으로 1도 = 111km)
    const latTolerance = tolerance / 111000
    const lonTolerance = tolerance / (111000 * Math.cos(latitude * Math.PI / 180))

    const result = await query(
      `SELECT 
        ti.*,
        im.metadata_json,
        im.thermal_data_json,
        p.section_category,
        -- GPS 좌표 추출
        im.thermal_data_json->>'GPSLatitude' as gps_latitude,
        im.thermal_data_json->>'GPSLongitude' as gps_longitude,
        im.thermal_data_json->>'GPSPosition' as gps_position
       FROM thermal_images ti
       LEFT JOIN image_metadata im ON ti.image_id = im.image_id
       JOIN inspections i ON ti.inspection_id = i.inspection_id
       JOIN pipes p ON i.pipe_id = p.pipe_id
       WHERE p.section_category = $1
         AND im.thermal_data_json IS NOT NULL
         AND im.thermal_data_json->>'GPSLatitude' IS NOT NULL
         AND im.thermal_data_json->>'GPSLongitude' IS NOT NULL
       ORDER BY ti.capture_timestamp ASC`,
      [section]
    )

    // 좌표 파싱 및 거리 계산
    const targetLat = parseFloat(latitude)
    const targetLon = parseFloat(longitude)
    
    const matchedImages = result.rows.filter((row: any) => {
      const gpsLat = row.gps_latitude
      const gpsLon = row.gps_longitude
      
      if (!gpsLat || !gpsLon) return false
      
      // DMS(도분초) 형식 파싱: "37 deg 19' 0.41" N"
      const parsedLat = parseDMS(gpsLat)
      const parsedLon = parseDMS(gpsLon)
      
      if (parsedLat === null || parsedLon === null) return false
      
      // 위도/경도 차이 계산
      const latDiff = Math.abs(parsedLat - targetLat)
      const lonDiff = Math.abs(parsedLon - targetLon)
      
      return latDiff <= latTolerance && lonDiff <= lonTolerance
    })

    // 날짜별로 그룹핑
    const groupedByDate: { [key: string]: any[] } = {}
    matchedImages.forEach((img: any) => {
      const date = img.capture_timestamp.split('T')[0]
      if (!groupedByDate[date]) {
        groupedByDate[date] = []
      }
      groupedByDate[date].push(img)
    })

    return NextResponse.json({
      success: true,
      location: {
        latitude: targetLat,
        longitude: targetLon,
        section: section,
        tolerance_meters: tolerance,
      },
      total_matches: matchedImages.length,
      dates: Object.keys(groupedByDate).sort(),
      grouped_by_date: groupedByDate,
      all_images: matchedImages,
    })
  } catch (error) {
    console.error('GPS 기반 이미지 검색 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '이미지 검색 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

/**
 * DMS (도분초) 형식을 십진수 좌표로 변환
 * 예: "37 deg 19' 0.41\" N" -> 37.31678
 */
function parseDMS(dmsString: string): number | null {
  try {
    // "37 deg 19' 0.41" N" 형식 파싱
    const matches = dmsString.match(/(\d+)\s*deg\s*(\d+)'\s*([\d.]+)/)
    if (!matches) return null
    
    const degrees = parseFloat(matches[1])
    const minutes = parseFloat(matches[2])
    const seconds = parseFloat(matches[3])
    
    let decimal = degrees + minutes / 60 + seconds / 3600
    
    // S(남위) 또는 W(서경)이면 음수
    if (dmsString.includes('S') || dmsString.includes('W')) {
      decimal = -decimal
    }
    
    return decimal
  } catch (error) {
    console.error('DMS 파싱 오류:', error, dmsString)
    return null
  }
}

/**
 * GET /api/thermal-images/by-gps-location
 * 모든 GPS 위치 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const section = searchParams.get('section')

    let sql = `
      SELECT 
        p.section_category,
        im.thermal_data_json->>'GPSLatitude' as gps_latitude,
        im.thermal_data_json->>'GPSLongitude' as gps_longitude,
        im.thermal_data_json->>'GPSPosition' as gps_position,
        COUNT(ti.image_id) as image_count,
        MIN(ti.capture_timestamp) as first_capture,
        MAX(ti.capture_timestamp) as last_capture
      FROM thermal_images ti
      LEFT JOIN image_metadata im ON ti.image_id = im.image_id
      JOIN inspections i ON ti.inspection_id = i.inspection_id
      JOIN pipes p ON i.pipe_id = p.pipe_id
      WHERE im.thermal_data_json IS NOT NULL
        AND im.thermal_data_json->>'GPSLatitude' IS NOT NULL
    `

    const params: any[] = []
    
    if (section) {
      sql += ` AND p.section_category = $1`
      params.push(section)
    }

    sql += `
      GROUP BY p.section_category, gps_latitude, gps_longitude, gps_position
      ORDER BY p.section_category, image_count DESC
    `

    const result = await query(sql, params)

    // 좌표를 십진수로 변환
    const locations = result.rows.map((row: any) => ({
      ...row,
      latitude_decimal: parseDMS(row.gps_latitude || ''),
      longitude_decimal: parseDMS(row.gps_longitude || ''),
    }))

    return NextResponse.json({
      success: true,
      count: result.rowCount,
      locations: locations,
    })
  } catch (error) {
    console.error('GPS 위치 목록 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: '위치 목록 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}


