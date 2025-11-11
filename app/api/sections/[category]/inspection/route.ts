import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { Pipe, Inspection } from '@/lib/types/database'

type RouteContext = {
  params: Promise<{ category: string }> | { category: string }
}

/**
 * POST /api/sections/[category]/inspection
 * 특정 구간 카테고리에 대한 점검 자동 생성
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // params가 Promise인지 확인하고 처리
    const params = await Promise.resolve(context.params)
    const { category } = params
    
    console.log('=== 점검 생성 시작 ===')
    console.log('요청 URL:', request.url)
    console.log('구간 카테고리:', category)
    
    const body = await request.json()
    console.log('요청 본문:', body)
    
    const { inspector_name, weather_condition, ambient_temp_celsius, notes } = body

    // 필수 필드 검증
    if (!inspector_name) {
      console.error('오류: 점검자 이름 누락')
      return NextResponse.json(
        {
          success: false,
          error: '점검자 이름은 필수 항목입니다.',
        },
        { status: 400 }
      )
    }

    // 해당 구간의 배관 조회
    console.log('배관 조회 중... section_category =', category)
    let pipeResult = await query<Pipe>(
      'SELECT * FROM pipes WHERE section_category = $1 LIMIT 1',
      [category]
    )

    console.log('배관 조회 결과:', {
      rowCount: pipeResult.rowCount,
      hasRows: pipeResult.rows.length > 0
    })

    let pipe: Pipe

    if (!pipeResult.rowCount || pipeResult.rowCount === 0) {
      // 배관이 없으면 자동 생성
      console.log(`배관 없음. ${category} 배관 자동 생성 시작...`)
      
      try {
        const createResult = await query<Pipe>(
          `INSERT INTO pipes (pipe_code, location, section_category, notes, material, diameter_mm)
           VALUES ($1, $2, $3, $4, 'Steel', 150.00)
           RETURNING *`,
          [
            `PIPE-${category}`,
            `반월공단 ${category} 구간`,
            category,
            `${category} 구간 자동 생성`
          ]
        )

        pipe = createResult.rows[0]
        console.log('배관 자동 생성 완료:', {
          pipe_id: pipe.pipe_id,
          pipe_code: pipe.pipe_code
        })
      } catch (createError) {
        console.error('배관 생성 오류:', createError)
        return NextResponse.json(
          {
            success: false,
            error: `배관 생성 실패: ${createError instanceof Error ? createError.message : '알 수 없는 오류'}`,
          },
          { status: 500 }
        )
      }
    } else {
      pipe = pipeResult.rows[0]
      console.log('기존 배관 사용:', {
        pipe_id: pipe.pipe_id,
        pipe_code: pipe.pipe_code
      })
    }

    // 새 점검 생성
    console.log('점검 생성 시작... pipe_id =', pipe.pipe_id)
    try {
      const inspectionResult = await query<Inspection>(
        `INSERT INTO inspections (
          pipe_id, inspection_date, inspector_name, 
          weather_condition, ambient_temp_celsius, notes, status
        )
        VALUES ($1, NOW(), $2, $3, $4, $5, 'in_progress')
        RETURNING *`,
        [
          pipe.pipe_id,
          inspector_name,
          weather_condition || null,
          ambient_temp_celsius || null,
          notes || null,
        ]
      )

      console.log('점검 생성 완료:', {
        inspection_id: inspectionResult.rows[0].inspection_id,
        pipe_id: inspectionResult.rows[0].pipe_id
      })
      console.log('=== 점검 생성 성공 ===')

      return NextResponse.json(
        {
          success: true,
          message: `구간 ${category} 점검이 생성되었습니다.`,
          data: {
            inspection: inspectionResult.rows[0],
            pipe: pipe,
          },
        },
        { status: 201 }
      )
    } catch (inspectionError) {
      console.error('점검 생성 오류:', inspectionError)
      return NextResponse.json(
        {
          success: false,
          error: `점검 생성 실패: ${inspectionError instanceof Error ? inspectionError.message : '알 수 없는 오류'}`,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('=== 전체 오류 ===')
    console.error('오류 타입:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('오류 메시지:', error instanceof Error ? error.message : String(error))
    console.error('오류 스택:', error instanceof Error ? error.stack : 'No stack trace')
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '점검을 생성하는 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sections/[category]/inspection
 * 특정 구간의 최신 점검 조회
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await Promise.resolve(context.params)
    const { category } = params

    console.log('점검 조회 요청 - 구간:', category)

    // 해당 구간의 배관 조회
    const pipeResult = await query<Pipe>(
      'SELECT * FROM pipes WHERE section_category = $1 LIMIT 1',
      [category]
    )

    if (!pipeResult.rowCount || pipeResult.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `구간 ${category}에 해당하는 배관이 없습니다.`,
        },
        { status: 404 }
      )
    }

    const pipe = pipeResult.rows[0]

    // 최신 점검 조회
    const inspectionResult = await query<Inspection>(
      `SELECT * FROM inspections 
       WHERE pipe_id = $1 
       ORDER BY inspection_date DESC 
       LIMIT 1`,
      [pipe.pipe_id]
    )

    return NextResponse.json({
      success: true,
      data: {
        pipe: pipe,
        latest_inspection: inspectionResult.rows[0] || null,
      },
    })
  } catch (error) {
    console.error('점검 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: '점검을 조회하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
