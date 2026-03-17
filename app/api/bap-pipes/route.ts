import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { BapPipe } from '@/lib/types/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const maintenance = searchParams.get('maintenance')
    const interest = searchParams.get('interest')

    let sql = 'SELECT * FROM bap_pipes WHERE 1=1'
    const params: string[] = []
    let idx = 1

    if (category) {
      sql += ` AND category = $${idx++}`
      params.push(category)
    }
    if (maintenance === 'true') {
      sql += ' AND is_maintenance = TRUE'
    }
    if (interest === 'true') {
      sql += ' AND is_interest = TRUE'
    }

    sql += ' ORDER BY created_at DESC'

    const result = await query<BapPipe>(sql, params)

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    })
  } catch (error) {
    console.error('배관 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '배관 데이터를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      pipe_tag, lat1, lng1, lat2, lng2,
      color, thickness, spec, depth, category, culvert,
      construction_history, construction_link,
      is_maintenance, maintenance_notes,
      is_interest, special_notes, replacement_year, pipe_id,
    } = body

    if (!pipe_tag || lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
      return NextResponse.json(
        { success: false, error: '파이프태그와 시작/종료 좌표는 필수 항목입니다.' },
        { status: 400 }
      )
    }

    const existing = await query('SELECT bap_pipe_id FROM bap_pipes WHERE pipe_tag = $1', [pipe_tag])
    if (existing.rowCount && existing.rowCount > 0) {
      return NextResponse.json(
        { success: false, error: '이미 존재하는 파이프 태그입니다.' },
        { status: 409 }
      )
    }

    const result = await query<BapPipe>(
      `INSERT INTO bap_pipes (
        pipe_tag, lat1, lng1, lat2, lng2,
        color, thickness, spec, depth, category, culvert,
        construction_history, construction_link,
        is_maintenance, maintenance_notes,
        is_interest, special_notes, replacement_year, pipe_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *`,
      [
        pipe_tag, lat1, lng1, lat2, lng2,
        color || null, thickness || 1.5, spec || null, depth || null,
        category || null, culvert || null,
        construction_history || null, construction_link || null,
        is_maintenance || false, maintenance_notes || null,
        is_interest || false, special_notes || null,
        replacement_year || null, pipe_id || null,
      ]
    )

    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: 201 }
    )
  } catch (error) {
    console.error('배관 생성 오류:', error)
    return NextResponse.json(
      { success: false, error: '배관을 생성하는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
