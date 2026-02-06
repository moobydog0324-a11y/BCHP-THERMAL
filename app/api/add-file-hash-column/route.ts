import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * POST /api/add-file-hash-column
 * image_metadata 테이블에 file_hash 컬럼 추가
 */
export async function POST() {
  try {
    console.log('🔍 file_hash 컬럼 추가 시작...')

    // 1. 컬럼 존재 확인
    const columnCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'image_metadata' 
          AND column_name = 'file_hash'
      );
    `)

    if (columnCheck.rows[0].exists) {
      console.log('✅ file_hash 컬럼이 이미 존재합니다.')
      return NextResponse.json({
        success: true,
        message: 'file_hash 컬럼이 이미 존재합니다.',
        already_exists: true,
      })
    }

    // 2. file_hash 컬럼 추가
    console.log('📝 file_hash 컬럼 추가 중...')
    await query(`
      ALTER TABLE image_metadata 
      ADD COLUMN file_hash TEXT;
    `)

    // 3. 인덱스 추가
    console.log('📝 file_hash 인덱스 추가 중...')
    await query(`
      CREATE INDEX IF NOT EXISTS idx_file_hash 
        ON image_metadata(file_hash) 
        WHERE file_hash IS NOT NULL;
    `)

    console.log('✅ file_hash 컬럼 및 인덱스 추가 완료!')

    return NextResponse.json({
      success: true,
      message: 'file_hash 컬럼이 성공적으로 추가되었습니다.',
      added_now: true,
    })

  } catch (error) {
    console.error('❌ 컬럼 추가 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '컬럼 추가 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const columnCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'image_metadata' 
          AND column_name = 'file_hash'
      );
    `)

    return NextResponse.json({
      success: true,
      column_exists: columnCheck.rows[0].exists,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '확인 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}



