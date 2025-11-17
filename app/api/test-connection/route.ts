import { NextResponse } from 'next/server'
import { testConnection, query } from '@/lib/db/connection'

/**
 * GET /api/test-connection
 * 데이터베이스 연결 및 테이블 존재 여부 확인
 */
export async function GET() {
  try {
    console.log('=== 데이터베이스 연결 테스트 시작 ===')
    
    // 1. 기본 연결 테스트
    const isConnected = await testConnection()
    console.log('기본 연결 상태:', isConnected)

    if (!isConnected) {
      return NextResponse.json(
        {
          success: false,
          error: '데이터베이스 연결 실패',
        },
        { status: 500 }
      )
    }

    // 2. pipes 테이블 존재 확인
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'pipes'
      );
    `)
    console.log('pipes 테이블 존재:', tableCheck.rows[0].exists)

    // 3. section_category 컬럼 존재 확인
    const columnCheck = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'pipes' AND column_name = 'section_category';
    `)
    console.log('section_category 컬럼:', columnCheck.rows)

    // 4. 샘플 데이터 조회
    const sampleData = await query('SELECT * FROM pipes LIMIT 5')
    console.log('샘플 배관 데이터:', sampleData.rows)

    // 5. inspections 테이블 확인
    const inspectionsTable = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'inspections'
      );
    `)
    console.log('inspections 테이블 존재:', inspectionsTable.rows[0].exists)

    console.log('=== 데이터베이스 연결 테스트 완료 ===')

    return NextResponse.json({
      success: true,
      connection: isConnected,
      tables: {
        pipes_exists: tableCheck.rows[0].exists,
        inspections_exists: inspectionsTable.rows[0].exists,
      },
      columns: {
        section_category_exists: columnCheck.rowCount ? columnCheck.rowCount > 0 : false,
        section_category_info: columnCheck.rows[0] || null,
      },
      sample_pipes: sampleData.rows,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('=== 데이터베이스 테스트 오류 ===')
    console.error('오류:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}













