import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { BapPipe } from '@/lib/types/database'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await query<BapPipe>(
      'SELECT * FROM bap_pipes WHERE bap_pipe_id = $1',
      [id]
    )

    if (!result.rowCount || result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: '배관을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('배관 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '배관 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const fields: string[] = []
    const values: unknown[] = []
    let idx = 1

    const allowedFields = [
      'pipe_tag', 'lat1', 'lng1', 'lat2', 'lng2',
      'color', 'thickness', 'spec', 'depth', 'category', 'culvert',
      'construction_history', 'construction_link',
      'is_maintenance', 'maintenance_notes',
      'is_interest', 'special_notes', 'replacement_year', 'pipe_id',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        fields.push(`${field} = $${idx++}`)
        values.push(body[field])
      }
    }

    if (fields.length === 0) {
      return NextResponse.json(
        { success: false, error: '수정할 필드가 없습니다.' },
        { status: 400 }
      )
    }

    values.push(id)
    const result = await query<BapPipe>(
      `UPDATE bap_pipes SET ${fields.join(', ')} WHERE bap_pipe_id = $${idx} RETURNING *`,
      values
    )

    if (!result.rowCount || result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: '배관을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('배관 수정 오류:', error)
    return NextResponse.json(
      { success: false, error: '배관 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await query(
      'DELETE FROM bap_pipes WHERE bap_pipe_id = $1 RETURNING bap_pipe_id',
      [id]
    )

    if (!result.rowCount || result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: '배관을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, message: '배관이 삭제되었습니다.' })
  } catch (error) {
    console.error('배관 삭제 오류:', error)
    return NextResponse.json(
      { success: false, error: '배관 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
