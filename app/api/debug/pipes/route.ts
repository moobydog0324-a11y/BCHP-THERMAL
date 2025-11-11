import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * GET /api/debug/pipes
 * 모든 배관 데이터 및 테이블 구조 확인 (디버그용)
 */
export async function GET() {
  try {
    // 테이블 구조 확인
    const tableStructure = await query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'pipes'
      ORDER BY ordinal_position;
    `)

    // 모든 배관 데이터 조회
    const allPipes = await query('SELECT * FROM pipes ORDER BY pipe_id')

    // section_category별 그룹핑
    const byCategory = await query(`
      SELECT section_category, COUNT(*) as count, array_agg(pipe_code) as pipe_codes
      FROM pipes
      WHERE section_category IS NOT NULL
      GROUP BY section_category
      ORDER BY section_category
    `)

    return NextResponse.json({
      success: true,
      table_structure: tableStructure.rows,
      all_pipes: allPipes.rows,
      total_count: allPipes.rowCount,
      by_category: byCategory.rows,
    })
  } catch (error) {
    console.error('디버그 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    )
  }
}




