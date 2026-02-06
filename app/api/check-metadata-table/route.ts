import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * GET /api/check-metadata-table
 * image_metadata 테이블 존재 여부 및 구조 확인
 */
export async function GET() {
  try {
    // 1. 테이블 존재 확인
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'image_metadata'
      );
    `)

    const tableExists = tableCheck.rows[0].exists

    if (!tableExists) {
      return NextResponse.json({
        success: false,
        table_exists: false,
        message: 'image_metadata 테이블이 생성되지 않았습니다.',
        action_needed: '05-add-metadata-table.sql 스크립트를 실행해야 합니다.'
      })
    }

    // 2. 테이블 구조 확인
    const columns = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'image_metadata'
      ORDER BY ordinal_position;
    `)

    // 3. 레코드 수 확인
    const countCheck = await query('SELECT COUNT(*) as count FROM image_metadata')
    const recordCount = parseInt(countCheck.rows[0].count)

    // 4. 메타데이터가 있는 레코드 확인
    const withData = await query(`
      SELECT COUNT(*) as count 
      FROM image_metadata 
      WHERE thermal_data_json IS NOT NULL
    `)
    const withMetadataCount = parseInt(withData.rows[0].count)

    // 5. 샘플 데이터 확인 (최근 3개)
    const samples = await query(`
      SELECT 
        im.metadata_id,
        im.image_id,
        ti.image_url,
        im.thermal_data_json->>'GPSLatitude' as gps_lat,
        im.thermal_data_json->>'GPSLongitude' as gps_lon,
        im.thermal_data_json->>'DateTimeOriginal' as datetime,
        im.thermal_data_json->>'Model' as camera_model,
        im.created_at
      FROM image_metadata im
      JOIN thermal_images ti ON im.image_id = ti.image_id
      ORDER BY im.created_at DESC
      LIMIT 3
    `)

    return NextResponse.json({
      success: true,
      table_exists: true,
      structure: {
        columns: columns.rows,
        column_count: columns.rowCount
      },
      data: {
        total_records: recordCount,
        records_with_thermal_data: withMetadataCount,
        percentage: recordCount > 0 ? Math.round((withMetadataCount / recordCount) * 100) : 0
      },
      samples: samples.rows,
      status: {
        ready: tableExists && recordCount >= 0,
        has_data: recordCount > 0,
        metadata_extraction_working: withMetadataCount > 0
      }
    })
  } catch (error) {
    console.error('메타데이터 테이블 확인 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}


