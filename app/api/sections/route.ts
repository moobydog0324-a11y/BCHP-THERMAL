import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { Pipe } from '@/lib/types/database'

/**
 * GET /api/sections
 * 모든 구간 카테고리 조회
 */
export async function GET() {
  try {
    // 구간 카테고리 목록 (고정)
    const sections = [
      'A-1', 'A-2',
      'B-1', 'B-2',
      'C-1', 'C-2',
      'D-1', 'D-2',
      'E-1', 'E-2',
      'F-1', 'F-2',
      'G-1', 'G-2',
    ]

    // 각 구간별 배관 정보 조회
    const sectionsWithPipes = await Promise.all(
      sections.map(async (section) => {
        const result = await query<Pipe>(
          `SELECT * FROM pipes WHERE section_category = $1 LIMIT 1`,
          [section]
        )

        return {
          section_category: section,
          pipe: result.rows[0] || null,
          has_pipe: result.rowCount ? result.rowCount > 0 : false,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: sectionsWithPipes,
    })
  } catch (error) {
    console.error('구간 카테고리 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: '구간 카테고리를 조회하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}











