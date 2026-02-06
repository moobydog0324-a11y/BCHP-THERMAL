import { NextRequest, NextResponse } from 'next/server'

/**
 * 업로드 테스트 API - 간단히 파일을 받아서 응답
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 테스트 업로드 API 호출됨')
    
    const formData = await request.formData()
    const file = formData.get('image_file') as File
    
    if (!file) {
      return NextResponse.json({
        success: false,
        error: '파일이 없습니다',
      }, { status: 400 })
    }

    console.log(`📁 파일 수신: ${file.name}, 크기: ${file.size} bytes`)

    return NextResponse.json({
      success: true,
      message: '테스트 업로드 성공',
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
      },
    })
  } catch (error) {
    console.error('테스트 업로드 오류:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    }, { status: 500 })
  }
}

