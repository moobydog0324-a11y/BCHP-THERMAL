import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/debug/test-upload
 * 업로드 과정에서 메타데이터 추출 테스트
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ success: false, error: '파일이 없습니다' })
    }

    console.log('📁 테스트 파일:', file.name, file.size, 'bytes')

    // Flask 서버로 메타데이터 추출 요청
    const FLASK_SERVER = process.env.FLASK_SERVER_URL || 'http://localhost:5001'
    console.log('🔍 Flask 서버 URL:', FLASK_SERVER)

    const metadataFormData = new FormData()
    metadataFormData.append('file', file)

    console.log('📤 Flask 서버로 요청 전송 중...')

    const flaskResponse = await fetch(`${FLASK_SERVER}/analyze`, {
      method: 'POST',
      body: metadataFormData,
    })

    console.log('📥 Flask 응답:', flaskResponse.status, flaskResponse.statusText)

    if (!flaskResponse.ok) {
      const errorText = await flaskResponse.text()
      console.error('❌ Flask 에러:', errorText)
      return NextResponse.json({
        success: false,
        error: `Flask 응답 오류: ${flaskResponse.status}`,
        details: errorText
      })
    }

    const result = await flaskResponse.json()
    console.log('✅ Flask 응답 성공')
    console.log('메타데이터 있음:', !!result.metadata)
    console.log('열화상 데이터 있음:', !!result.thermal_data)
    console.log('actual_temp_stats 있음:', !!result.thermal_data?.actual_temp_stats)

    return NextResponse.json({
      success: true,
      has_metadata: !!result.metadata,
      has_thermal_data: !!result.thermal_data,
      has_temp_stats: !!result.thermal_data?.actual_temp_stats,
      metadata_keys: result.metadata ? Object.keys(result.metadata).slice(0, 20) : [],
      thermal_keys: result.thermal_data ? Object.keys(result.thermal_data).slice(0, 20) : [],
      temp_range: result.thermal_data?.actual_temp_stats ? {
        min: result.thermal_data.actual_temp_stats.min_temp,
        max: result.thermal_data.actual_temp_stats.max_temp,
        avg: result.thermal_data.actual_temp_stats.avg_temp
      } : null,
      gps: result.metadata?.GPSLatitude ? {
        lat: result.metadata.GPSLatitude,
        lon: result.metadata.GPSLongitude
      } : null
    })

  } catch (error) {
    console.error('❌ 테스트 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    )
  }
}





