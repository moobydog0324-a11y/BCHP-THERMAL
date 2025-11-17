import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { Pipe } from '@/lib/types/database'

/**
 * GET /api/pipes
 * 모든 배관 데이터 조회
 */
export async function GET() {
  try {
    const result = await query<Pipe>(
      `SELECT * FROM pipes ORDER BY created_at DESC`
    )

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    })
  } catch (error) {
    console.error('배관 데이터 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: '배관 데이터를 조회하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/pipes
 * 새로운 배관 데이터 생성
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      pipe_code,
      location,
      material,
      diameter_mm,
      length_m,
      installation_date,
      notes,
    } = body

    // 필수 필드 검증
    if (!pipe_code || !location) {
      return NextResponse.json(
        {
          success: false,
          error: '배관 코드와 위치는 필수 항목입니다.',
        },
        { status: 400 }
      )
    }

    // 배관 코드 중복 체크
    const existingPipe = await query(
      'SELECT pipe_id FROM pipes WHERE pipe_code = $1',
      [pipe_code]
    )

    if (existingPipe.rowCount && existingPipe.rowCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: '이미 존재하는 배관 코드입니다.',
        },
        { status: 409 }
      )
    }

    // 새 배관 데이터 삽입
    const result = await query<Pipe>(
      `INSERT INTO pipes (
        pipe_code, location, material, diameter_mm, 
        length_m, installation_date, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        pipe_code,
        location,
        material || null,
        diameter_mm || null,
        length_m || null,
        installation_date || null,
        notes || null,
      ]
    )

    return NextResponse.json(
      {
        success: true,
        message: '배관 데이터가 성공적으로 생성되었습니다.',
        data: result.rows[0],
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('배관 데이터 생성 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: '배관 데이터를 생성하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}













