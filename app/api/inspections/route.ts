import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { Inspection } from '@/lib/types/database'

/**
 * GET /api/inspections
 * 모든 점검 데이터 조회 (옵션: pipe_id 필터링)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const pipeId = searchParams.get('pipe_id')

    let result

    if (pipeId) {
      // 특정 배관의 점검 기록만 조회
      result = await query<Inspection>(
        `SELECT i.*, p.pipe_code, p.location 
         FROM inspections i
         LEFT JOIN pipes p ON i.pipe_id = p.pipe_id
         WHERE i.pipe_id = $1
         ORDER BY i.inspection_date DESC`,
        [pipeId]
      )
    } else {
      // 모든 점검 기록 조회
      result = await query<Inspection>(
        `SELECT i.*, p.pipe_code, p.location 
         FROM inspections i
         LEFT JOIN pipes p ON i.pipe_id = p.pipe_id
         ORDER BY i.inspection_date DESC`
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    })
  } catch (error) {
    console.error('점검 데이터 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: '점검 데이터를 조회하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inspections
 * 새로운 점검 데이터 생성
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      pipe_id,
      inspection_date,
      inspector_name,
      weather_condition,
      ambient_temp_celsius,
      notes,
      status = 'completed',
    } = body

    // 필수 필드 검증
    if (!pipe_id || !inspection_date || !inspector_name) {
      return NextResponse.json(
        {
          success: false,
          error: '배관 ID, 점검 일시, 점검자는 필수 항목입니다.',
        },
        { status: 400 }
      )
    }

    // 배관 존재 여부 확인
    const pipeExists = await query(
      'SELECT pipe_id FROM pipes WHERE pipe_id = $1',
      [pipe_id]
    )

    if (!pipeExists.rowCount || pipeExists.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '존재하지 않는 배관 ID입니다.',
        },
        { status: 404 }
      )
    }

    // 새 점검 데이터 삽입
    const result = await query<Inspection>(
      `INSERT INTO inspections (
        pipe_id, inspection_date, inspector_name, 
        weather_condition, ambient_temp_celsius, notes, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        pipe_id,
        inspection_date,
        inspector_name,
        weather_condition || null,
        ambient_temp_celsius || null,
        notes || null,
        status,
      ]
    )

    return NextResponse.json(
      {
        success: true,
        message: '점검 데이터가 성공적으로 생성되었습니다.',
        data: result.rows[0],
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('점검 데이터 생성 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: '점검 데이터를 생성하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}













