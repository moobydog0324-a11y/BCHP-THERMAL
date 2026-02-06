import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * 데이터베이스 연결 테스트
 */
export async function GET() {
  try {
    const startTime = Date.now()
    
    console.log('🔍 데이터베이스 연결 테스트 시작...')
    
    // 1. 기본 연결 테스트
    const timeResult = await query('SELECT NOW() as current_time')
    const connectionTime = Date.now() - startTime
    
    console.log(`✅ 데이터베이스 연결 성공 (${connectionTime}ms)`)
    
    // 2. 테이블 존재 확인
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `)
    
    const tables = tablesResult.rows.map(row => row.table_name)
    
    // 3. 각 테이블의 레코드 수 확인
    const counts: Record<string, number> = {}
    for (const table of tables) {
      try {
        const countResult = await query(`SELECT COUNT(*) as count FROM ${table}`)
        counts[table] = parseInt(countResult.rows[0].count)
      } catch (err) {
        counts[table] = -1 // 오류 발생
      }
    }
    
    const totalTime = Date.now() - startTime
    
    return NextResponse.json({
      success: true,
      message: '데이터베이스 연결 정상',
      current_time: timeResult.rows[0].current_time,
      connection_time_ms: connectionTime,
      total_time_ms: totalTime,
      database_info: {
        tables: tables,
        record_counts: counts,
        total_tables: tables.length,
      },
    })
  } catch (error) {
    console.error('❌ 데이터베이스 연결 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
