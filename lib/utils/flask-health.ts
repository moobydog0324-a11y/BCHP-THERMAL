/**
 * Flask 서버 헬스체크 유틸리티
 */

type FlaskHealthStatus = {
  status: 'ok' | 'degraded' | 'down'
  timestamp: number
  checks?: {
    exiftool: {
      status: string
      path?: string
      version?: string
    }
    flir_library: {
      status: string
      version: string
    }
  }
  response_time_ms?: number
  error?: string
}

// 헬스체크 캐시 (1분간 유효)
let healthCache: {
  status: FlaskHealthStatus | null
  timestamp: number
} = {
  status: null,
  timestamp: 0,
}

const CACHE_TTL_MS = 60 * 1000 // 1분
const HEALTH_CHECK_TIMEOUT_MS = 3000 // 3초

/**
 * Flask 서버 헬스체크 수행
 * @param forceRefresh - 캐시 무시하고 강제로 새로 체크
 */
export async function checkFlaskHealth(forceRefresh = false): Promise<FlaskHealthStatus> {
  const FLASK_SERVER = process.env.FLASK_SERVER_URL || 'http://localhost:5001'

  // 캐시 확인
  const now = Date.now()
  if (!forceRefresh && healthCache.status && (now - healthCache.timestamp) < CACHE_TTL_MS) {
    return healthCache.status
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)

    const response = await fetch(`${FLASK_SERVER}/health`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      const status: FlaskHealthStatus = {
        status: data.status || 'ok',
        timestamp: data.timestamp || Date.now() / 1000,
        checks: data.checks,
        response_time_ms: data.response_time_ms,
      }

      // 캐시 업데이트
      healthCache = {
        status,
        timestamp: now,
      }

      return status
    } else if (response.status === 503) {
      // 서비스 Degraded
      const data = await response.json()
      const status: FlaskHealthStatus = {
        status: 'degraded',
        timestamp: Date.now() / 1000,
        checks: data.checks,
        error: 'Service degraded',
      }

      healthCache = { status, timestamp: now }
      return status
    } else {
      throw new Error(`HTTP ${response.status}`)
    }
  } catch (error) {
    const status: FlaskHealthStatus = {
      status: 'down',
      timestamp: Date.now() / 1000,
      error: error instanceof Error ? error.message : 'Unknown error',
    }

    // Down 상태는 짧게 캐싱 (10초)
    healthCache = {
      status,
      timestamp: now - (CACHE_TTL_MS - 10000),
    }

    return status
  }
}

/**
 * Flask 서버가 사용 가능한지 확인
 */
export async function isFlaskAvailable(): Promise<boolean> {
  const health = await checkFlaskHealth()
  return health.status === 'ok'
}

/**
 * Flask 서버 상태를 사람이 읽을 수 있는 메시지로 변환
 */
export function getHealthMessage(health: FlaskHealthStatus): string {
  switch (health.status) {
    case 'ok':
      return '✅ Flask 서버가 정상 작동 중입니다.'
    case 'degraded':
      return '⚠️ Flask 서버가 제한적으로 작동 중입니다. 일부 기능이 느리거나 불안정할 수 있습니다.'
    case 'down':
      return '❌ Flask 서버에 연결할 수 없습니다. 메타데이터 자동 추출 기능을 사용할 수 없습니다.'
    default:
      return '❓ Flask 서버 상태를 확인할 수 없습니다.'
  }
}

/**
 * 캐시 무효화
 */
export function invalidateHealthCache(): void {
  healthCache = {
    status: null,
    timestamp: 0,
  }
}



