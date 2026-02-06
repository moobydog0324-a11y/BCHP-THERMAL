import { NextRequest, NextResponse } from 'next/server'

const FLASK_SERVER = process.env.FLASK_SERVER_URL || 'http://localhost:5001'

/**
 * POST /api/exif/analyze
 * Flask 서버를 통해 이미지 메타데이터 분석
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 없습니다.' },
        { status: 400 }
      )
    }

    // Flask 서버로 전달
    const flaskFormData = new FormData()
    flaskFormData.append('file', file)

    const flaskResponse = await fetch(`${FLASK_SERVER}/analyze`, {
      method: 'POST',
      body: flaskFormData,
    })

    if (!flaskResponse.ok) {
      const error = await flaskResponse.json()
      return NextResponse.json(
        { success: false, error: error.error || 'Flask 서버 오류' },
        { status: flaskResponse.status }
      )
    }

    const result = await flaskResponse.json()
    return NextResponse.json(result)

  } catch (error) {
    console.error('ExifTool 분석 오류:', error)

    // Flask 서버 연결 오류
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Flask 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.',
          flask_url: FLASK_SERVER,
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/exif/analyze
 * Flask 서버 상태 확인
 */
export async function GET() {
  try {
    const response = await fetch(`${FLASK_SERVER}/`)
    const data = await response.json()

    return NextResponse.json({
      success: true,
      flask_server: FLASK_SERVER,
      flask_status: data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Flask 서버에 연결할 수 없습니다.',
        flask_server: FLASK_SERVER,
      },
      { status: 503 }
    )
  }
}


