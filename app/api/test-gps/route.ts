import { NextResponse } from 'next/server'
import { dmsToDecimal, gpsToKey, formatGPS } from '@/lib/utils/gps'

/**
 * GPS 유틸리티 함수 테스트
 */
export async function GET() {
  try {
    const testLat = "37 deg 19' 6.44\" N"
    const testLon = "126 deg 45' 25.21\" E"

    const lat = dmsToDecimal(testLat)
    const lon = dmsToDecimal(testLon)

    if (lat === null || lon === null) {
      return NextResponse.json({
        success: false,
        error: 'GPS 변환 실패',
        input: { lat: testLat, lon: testLon },
      })
    }

    const key = gpsToKey(lat, lon, 4)
    const formatted = formatGPS(lat, lon)

    return NextResponse.json({
      success: true,
      input: {
        latitude_dms: testLat,
        longitude_dms: testLon,
      },
      output: {
        latitude_decimal: lat,
        longitude_decimal: lon,
        gps_key: key,
        formatted: formatted,
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

