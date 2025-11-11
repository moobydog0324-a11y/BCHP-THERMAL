import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { Pipe } from '@/lib/types/database'

/**
 * GET /api/sections/[category]
 * 특정 구간 카테고리의 배관 정보 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params

    console.log('조회 중인 카테고리:', category)

    // 해당 구간의 배관 조회
    const pipeResult = await query<Pipe>(
      'SELECT * FROM pipes WHERE section_category = $1 LIMIT 1',
      [category]
    )

    console.log('조회 결과:', pipeResult.rowCount, 'rows')

    if (!pipeResult.rowCount || pipeResult.rowCount === 0) {
      // 배관이 없으면 자동 생성
      console.log(`배관이 없음. ${category} 배관 자동 생성 중...`)
      
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

      return NextResponse.json({
        success: true,
        message: `${category} 구간 배관이 자동으로 생성되었습니다.`,
        data: createResult.rows[0],
        auto_created: true,
      })
    }

    return NextResponse.json({
      success: true,
      data: pipeResult.rows[0],
      auto_created: false,
    })
  } catch (error) {
    console.error('구간 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '구간을 조회하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}



