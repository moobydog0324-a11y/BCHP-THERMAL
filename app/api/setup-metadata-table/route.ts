import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * POST /api/setup-metadata-table
 * image_metadata 테이블 자동 생성
 */
export async function POST() {
  try {
    console.log('🔧 image_metadata 테이블 생성 시작...')

    // 1. 테이블 생성
    await query(`
      CREATE TABLE IF NOT EXISTS image_metadata (
        metadata_id SERIAL PRIMARY KEY,
        image_id INTEGER UNIQUE NOT NULL REFERENCES thermal_images(image_id) ON DELETE CASCADE,
        metadata_json JSONB,
        thermal_data_json JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ 테이블 생성 완료')

    // 2. 인덱스 생성
    await query(`CREATE INDEX IF NOT EXISTS idx_image_metadata_image ON image_metadata(image_id)`)
    console.log('✅ 인덱스 1 생성 완료')

    await query(`CREATE INDEX IF NOT EXISTS idx_metadata_json ON image_metadata USING gin(metadata_json)`)
    console.log('✅ 인덱스 2 생성 완료')

    await query(`CREATE INDEX IF NOT EXISTS idx_thermal_data_json ON image_metadata USING gin(thermal_data_json)`)
    console.log('✅ 인덱스 3 생성 완료')

    // 3. 테이블 설명 추가
    await query(`COMMENT ON TABLE image_metadata IS '열화상 이미지의 EXIF 메타데이터 저장'`)
    await query(`COMMENT ON COLUMN image_metadata.metadata_json IS 'ExifTool로 추출한 전체 메타데이터 (JSONB)'`)
    await query(`COMMENT ON COLUMN image_metadata.thermal_data_json IS '열화상 관련 주요 데이터 (온도, Planck 상수 등)'`)
    console.log('✅ 테이블 설명 추가 완료')

    // 4. 생성 확인
    const checkTable = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'image_metadata'
      )
    `)

    const tableExists = checkTable.rows[0].exists

    if (!tableExists) {
      throw new Error('테이블이 생성되었지만 확인할 수 없습니다.')
    }

    // 5. 컬럼 정보 가져오기
    const columns = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'image_metadata'
      ORDER BY ordinal_position
    `)

    console.log('🎉 image_metadata 테이블 설정 완료!')

    return NextResponse.json({
      success: true,
      message: 'image_metadata 테이블이 성공적으로 생성되었습니다! 🎉',
      table: {
        name: 'image_metadata',
        columns: columns.rows,
        indexes: [
          'idx_image_metadata_image',
          'idx_metadata_json (GIN)',
          'idx_thermal_data_json (GIN)'
        ]
      },
      next_steps: [
        '✅ 테이블 생성 완료',
        '이제 이미지를 업로드하면 자동으로 메타데이터가 저장됩니다!',
        'http://localhost:3000/upload 에서 테스트하세요.'
      ]
    })
  } catch (error) {
    console.error('❌ 테이블 생성 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        details: error instanceof Error ? error.stack : undefined,
        solution: 'pgAdmin 또는 DBeaver를 사용하여 scripts/05-add-metadata-table.sql 파일을 수동으로 실행해주세요.'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/setup-metadata-table
 * 현재 상태 확인
 */
export async function GET() {
  try {
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'image_metadata'
      )
    `)

    const tableExists = tableCheck.rows[0].exists

    if (tableExists) {
      const columns = await query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'image_metadata'
        ORDER BY ordinal_position
      `)

      return NextResponse.json({
        success: true,
        table_exists: true,
        message: '✅ image_metadata 테이블이 이미 존재합니다.',
        columns: columns.rows
      })
    } else {
      return NextResponse.json({
        success: false,
        table_exists: false,
        message: '⚠️ image_metadata 테이블이 생성되지 않았습니다.',
        action: 'POST 요청으로 테이블을 생성하세요.'
      })
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    )
  }
}


