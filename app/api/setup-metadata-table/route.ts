import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * POST /api/setup-metadata-table
 * image_metadata 테이블 생성 및 상태 확인
 */
export async function POST() {
  try {
    console.log('🔍 image_metadata 테이블 설정 시작...')

    // 1. 테이블 존재 확인
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'image_metadata'
      );
    `)

    const tableExists = tableCheck.rows[0].exists

    if (tableExists) {
      console.log('✅ image_metadata 테이블이 이미 존재합니다.')
      
      // 컬럼 확인
      const columns = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'image_metadata'
        ORDER BY ordinal_position;
      `)

      const columnNames = columns.rows.map((r: any) => r.column_name)

      // 데이터 개수
      const count = await query('SELECT COUNT(*) FROM image_metadata')

      return NextResponse.json({
        success: true,
        message: 'image_metadata 테이블이 이미 존재합니다.',
        table_exists: true,
        columns: columnNames,
        record_count: parseInt(count.rows[0].count),
      })
    }

    // 2. 테이블이 없으면 생성
    console.log('📝 image_metadata 테이블 생성 중...')

    await query(`
      CREATE TABLE IF NOT EXISTS image_metadata (
        metadata_id SERIAL PRIMARY KEY,
        image_id INTEGER UNIQUE NOT NULL REFERENCES thermal_images(image_id) ON DELETE CASCADE,
        
        -- 전체 메타데이터 (JSON)
        metadata_json JSONB,
        
        -- 열화상 관련 주요 데이터만 추출 (JSON)
        thermal_data_json JSONB,
        
        -- 파일 해시 (중복 방지)
        file_hash TEXT,
        
        -- 생성 시간
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    console.log('✅ image_metadata 테이블 생성 완료')

    // 3. 인덱스 생성
    console.log('📝 인덱스 생성 중...')

    await query(`
      CREATE INDEX IF NOT EXISTS idx_image_metadata_image 
        ON image_metadata(image_id);
    `)

    await query(`
      CREATE INDEX IF NOT EXISTS idx_metadata_json 
        ON image_metadata USING gin(metadata_json);
    `)

    await query(`
      CREATE INDEX IF NOT EXISTS idx_thermal_data_json 
        ON image_metadata USING gin(thermal_data_json);
    `)

    await query(`
      CREATE INDEX IF NOT EXISTS idx_file_hash 
        ON image_metadata(file_hash) 
        WHERE file_hash IS NOT NULL;
    `)

    console.log('✅ 인덱스 생성 완료')

    // 4. 기존 이미지에 대한 빈 메타데이터 레코드 생성 (선택사항)
    const existingImages = await query(`
      SELECT image_id FROM thermal_images
      WHERE image_id NOT IN (SELECT image_id FROM image_metadata)
      LIMIT 10
    `)

    if (existingImages.rowCount && existingImages.rowCount > 0) {
      console.log(`📝 기존 이미지 ${existingImages.rowCount}개에 대한 메타데이터 레코드 생성...`)

      for (const row of existingImages.rows) {
        await query(`
          INSERT INTO image_metadata (image_id, metadata_json, thermal_data_json)
          VALUES ($1, '{}', '{}')
          ON CONFLICT (image_id) DO NOTHING
        `, [row.image_id])
      }

      console.log('✅ 메타데이터 레코드 생성 완료')
    }

    return NextResponse.json({
      success: true,
      message: 'image_metadata 테이블이 성공적으로 생성되었습니다.',
      table_exists: true,
      created_now: true,
      existing_images_processed: existingImages.rowCount || 0,
    })

  } catch (error) {
    console.error('❌ 테이블 설정 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '테이블 설정 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/setup-metadata-table
 * 테이블 상태 확인만
 */
export async function GET() {
  try {
    // 1. 테이블 존재 확인
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'image_metadata'
      );
    `)

    const tableExists = tableCheck.rows[0].exists

    if (!tableExists) {
      return NextResponse.json({
        success: true,
        table_exists: false,
        message: 'image_metadata 테이블이 없습니다. POST 요청으로 생성하세요.',
      })
    }

    // 2. 컬럼 정보
    const columns = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'image_metadata'
      ORDER BY ordinal_position;
    `)

    // 3. 데이터 통계
    const count = await query('SELECT COUNT(*) FROM image_metadata')
    
    const withData = await query(`
      SELECT COUNT(*) FROM image_metadata
      WHERE metadata_json IS NOT NULL 
        AND metadata_json::text != '{}'
    `)

    const withGPS = await query(`
      SELECT COUNT(*) FROM image_metadata
      WHERE metadata_json->>'GPSLatitude' IS NOT NULL
    `)

    const withTemp = await query(`
      SELECT COUNT(*) FROM image_metadata
      WHERE thermal_data_json->'actual_temp_stats' IS NOT NULL
    `)

    return NextResponse.json({
      success: true,
      table_exists: true,
      columns: columns.rows,
      statistics: {
        total_records: parseInt(count.rows[0].count),
        with_metadata: parseInt(withData.rows[0].count),
        with_gps: parseInt(withGPS.rows[0].count),
        with_temperature: parseInt(withTemp.rows[0].count),
      },
    })

  } catch (error) {
    console.error('❌ 테이블 상태 확인 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '테이블 상태 확인 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
