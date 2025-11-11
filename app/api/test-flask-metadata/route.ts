import { NextRequest, NextResponse } from 'next/server'

/**
 * Flask 서버 메타데이터 추출 테스트
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({
        success: false,
        error: '파일이 없습니다',
      }, { status: 400 })
    }

    console.log(`🧪 Flask 테스트: ${file.name}, ${file.size} bytes`)

    const FLASK_SERVER = process.env.FLASK_SERVER_URL || 'http://localhost:5000'
    
    // Flask로 전송
    const flaskFormData = new FormData()
    flaskFormData.append('file', file)
    
    console.log(`📤 Flask 서버로 전송: ${FLASK_SERVER}/analyze`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30초
    
    try {
      const flaskResponse = await fetch(`${FLASK_SERVER}/analyze`, {
        method: 'POST',
        body: flaskFormData,
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      console.log(`📥 Flask 응답: ${flaskResponse.status}`)
      
      if (!flaskResponse.ok) {
        const errorText = await flaskResponse.text()
        return NextResponse.json({
          success: false,
          error: `Flask 서버 오류: ${flaskResponse.status}`,
          details: errorText,
        })
      }
      
      const result = await flaskResponse.json()
      console.log(`📊 메타데이터 추출 결과:`, result.success ? '성공' : '실패')
      
      return NextResponse.json({
        success: true,
        flask_response: result,
        metadata_exists: !!result.metadata,
        thermal_data_exists: !!result.thermal_data,
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          error: '타임아웃 (30초 초과)',
        })
      }
      throw fetchError
    }
  } catch (error) {
    console.error('❌ 테스트 오류:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    }, { status: 500 })
  }
}

