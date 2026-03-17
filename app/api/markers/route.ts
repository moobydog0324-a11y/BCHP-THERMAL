import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { Marker } from '@/lib/types/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const markerType = searchParams.get('type')
    const maintenance = searchParams.get('maintenance')
    const interest = searchParams.get('interest')

    let sql = 'SELECT * FROM markers WHERE 1=1'
    const params: (string | boolean)[] = []
    let idx = 1

    if (markerType) {
      sql += ` AND marker_type = $${idx++}`
      params.push(markerType)
    }
    if (maintenance === 'true') {
      sql += ` AND is_maintenance = TRUE`
    }
    if (interest === 'true') {
      sql += ` AND is_interest = TRUE`
    }

    sql += ' ORDER BY created_at DESC'

    const result = await query<Marker>(sql, params)

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    })
  } catch (error) {
    console.error('마커 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '마커 데이터를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      tag_number, lat, lng, spec, marker_type,
      construction_history, construction_link,
      is_maintenance, maintenance_notes,
      is_interest, special_notes,
      steam_open, pipe_asset, contact_info, self_boiler, nav_address,
    } = body

    if (!tag_number || lat == null || lng == null || !marker_type) {
      return NextResponse.json(
        { success: false, error: 'TAG번호, 위도, 경도, 분류는 필수 항목입니다.' },
        { status: 400 }
      )
    }

    const existing = await query('SELECT marker_id FROM markers WHERE tag_number = $1', [tag_number])
    if (existing.rowCount && existing.rowCount > 0) {
      return NextResponse.json(
        { success: false, error: '이미 존재하는 TAG번호입니다.' },
        { status: 409 }
      )
    }

    const result = await query<Marker>(
      `INSERT INTO markers (
        tag_number, lat, lng, spec, marker_type,
        construction_history, construction_link,
        is_maintenance, maintenance_notes,
        is_interest, special_notes,
        steam_open, pipe_asset, contact_info, self_boiler, nav_address
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [
        tag_number, lat, lng, spec || null, marker_type,
        construction_history || null, construction_link || null,
        is_maintenance || false, maintenance_notes || null,
        is_interest || false, special_notes || null,
        steam_open || null, pipe_asset || null, contact_info || null,
        self_boiler || null, nav_address || null,
      ]
    )

    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: 201 }
    )
  } catch (error) {
    console.error('마커 생성 오류:', error)
    return NextResponse.json(
      { success: false, error: '마커를 생성하는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
