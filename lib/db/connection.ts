import { Pool, PoolClient, QueryResult } from 'pg'

// PostgreSQL 연결 풀 생성 (싱글톤 패턴)
let pool: Pool | null = null

/**
 * PostgreSQL 연결 풀을 가져오거나 생성합니다.
 * 
 * @returns {Pool} PostgreSQL 연결 풀 인스턴스
 */
function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL

    if (!connectionString) {
      throw new Error('DATABASE_URL 환경 변수가 설정되지 않았습니다.')
    }

    pool = new Pool({
      connectionString,
      max: 20, // 최대 연결 수
      idleTimeoutMillis: 60000, // 유휴 연결 타임아웃 (60초)
      connectionTimeoutMillis: 60000, // 연결 타임아웃 (60초)
      statement_timeout: 120000, // SQL 쿼리 타임아웃 (120초)
      ssl: {
        // 운영 환경에서는 SSL 인증서 검증 활성화 (MITM 방지)
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    })

    console.log('✅ PostgreSQL 연결 풀 생성 완료')
    console.log(`   최대 연결: ${pool.options.max}`)
    console.log(`   연결 타임아웃: ${pool.options.connectionTimeoutMillis}ms`)
    console.log(`   쿼리 타임아웃: ${pool.options.statement_timeout}ms`)

    // 연결 에러 핸들링
    pool.on('error', (err) => {
      console.error('PostgreSQL 풀에서 예상치 못한 오류 발생:', err)
    })
  }

  return pool
}

/**
 * SQL 쿼리를 실행합니다.
 * 
 * @param {string} text - SQL 쿼리 문자열
 * @param {any[]} params - 쿼리 파라미터
 * @returns {Promise<QueryResult>} 쿼리 결과
 */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool()
  const start = Date.now()

  try {
    const result = await pool.query<T>(text, params)
    const duration = Date.now() - start

    // 개발 환경에서 쿼리 로깅
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query:', {
        text,
        duration: `${duration}ms`,
        rows: result.rowCount,
      })
    }

    return result
  } catch (error) {
    console.error('쿼리 실행 오류:', error)
    throw error
  }
}

/**
 * 트랜잭션을 실행합니다.
 * 
 * @param {Function} callback - 트랜잭션 내에서 실행할 함수
 * @returns {Promise<T>} 콜백 함수의 반환값
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('트랜잭션 오류:', error)
    throw error
  } finally {
    client.release()
  }
}

/**
 * 데이터베이스 연결을 테스트합니다.
 * 
 * @returns {Promise<boolean>} 연결 성공 여부
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW()')
    console.log('✅ 데이터베이스 연결 성공:', result.rows[0])
    return true
  } catch (error) {
    console.error('❌ 데이터베이스 연결 실패:', error)
    return false
  }
}

/**
 * 연결 풀을 종료합니다. (주로 테스트나 앱 종료 시 사용)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    console.log('데이터베이스 연결 풀이 종료되었습니다.')
  }
}

