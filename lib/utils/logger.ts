/**
 * 구조화 로깅 유틸리티
 * JSON 포맷으로 로그를 출력하여 분석 및 모니터링이 용이하도록 함
 */

import { randomUUID } from 'crypto'

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export type LogContext = {
  trace_id?: string
  user_id?: string
  image_id?: number
  inspection_id?: number
  section?: string
  endpoint?: string
  method?: string
  [key: string]: any
}

export type LogEntry = {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  duration_ms?: number
  error?: {
    message: string
    stack?: string
    code?: string
  }
}

class Logger {
  private context: LogContext = {}

  /**
   * 기본 컨텍스트 설정
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context }
  }

  /**
   * 컨텍스트 초기화
   */
  clearContext(): void {
    this.context = {}
  }

  /**
   * trace_id 생성
   */
  generateTraceId(): string {
    return randomUUID()
  }

  /**
   * 로그 출력
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
    }

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      }
    }

    // 개발 환경에서는 콘솔에 예쁘게 출력
    if (process.env.NODE_ENV === 'development') {
      const emoji = {
        [LogLevel.DEBUG]: '🐛',
        [LogLevel.INFO]: 'ℹ️',
        [LogLevel.WARN]: '⚠️',
        [LogLevel.ERROR]: '❌',
      }[level]

      console.log(`${emoji} [${level.toUpperCase()}] ${message}`, context || '')
      if (error) {
        console.error(error)
      }
    } else {
      // 프로덕션에서는 JSON 형태로 출력
      console.log(JSON.stringify(entry))
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context)
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context, error)
  }

  /**
   * API 요청 로깅 헬퍼
   */
  logApiRequest(endpoint: string, method: string, context?: LogContext): void {
    this.info(`API Request: ${method} ${endpoint}`, {
      endpoint,
      method,
      ...context,
    })
  }

  /**
   * API 응답 로깅 헬퍼
   */
  logApiResponse(
    endpoint: string,
    method: string,
    status: number,
    duration_ms: number,
    context?: LogContext
  ): void {
    const level = status >= 500 ? LogLevel.ERROR : status >= 400 ? LogLevel.WARN : LogLevel.INFO

    this.log(level, `API Response: ${method} ${endpoint} - ${status}`, {
      endpoint,
      method,
      status,
      duration_ms,
      ...context,
    })
  }

  /**
   * 데이터베이스 쿼리 로깅
   */
  logQuery(query: string, duration_ms: number, rowCount?: number, context?: LogContext): void {
    this.debug('Database Query', {
      query: query.substring(0, 200), // 쿼리 일부만 로깅
      duration_ms,
      row_count: rowCount,
      ...context,
    })
  }

  /**
   * 이미지 업로드 로깅
   */
  logImageUpload(
    image_id: number,
    section: string,
    metadata_extracted: boolean,
    temperature_extracted: boolean,
    duration_ms: number,
    context?: LogContext
  ): void {
    this.info('Image Upload', {
      image_id,
      section,
      metadata_extracted,
      temperature_extracted,
      duration_ms,
      ...context,
    })
  }

  /**
   * 메타데이터 추출 로깅
   */
  logMetadataExtraction(
    image_id: number,
    success: boolean,
    duration_ms: number,
    has_gps: boolean,
    has_temperature: boolean,
    context?: LogContext
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR

    this.log(level, success ? 'Metadata Extraction Success' : 'Metadata Extraction Failed', {
      image_id,
      success,
      duration_ms,
      has_gps,
      has_temperature,
      ...context,
    })
  }

  /**
   * 배치 처리 로깅
   */
  logBatchProcessing(
    batch_type: string,
    total: number,
    processed: number,
    failed: number,
    duration_ms: number,
    context?: LogContext
  ): void {
    this.info('Batch Processing', {
      batch_type,
      total,
      processed,
      failed,
      success_rate: total > 0 ? Math.round((processed / total) * 100) : 0,
      duration_ms,
      ...context,
    })
  }
}

// 싱글톤 인스턴스
export const logger = new Logger()

/**
 * API 핸들러 래퍼 - trace_id 자동 생성 및 로깅
 */
export function withLogging<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  endpoint: string
): T {
  return (async (...args: any[]) => {
    const trace_id = logger.generateTraceId()
    logger.setContext({ trace_id, endpoint })

    const start = Date.now()
    const request = args[0] as Request
    const method = request?.method || 'UNKNOWN'

    logger.logApiRequest(endpoint, method, { trace_id })

    try {
      const response = await handler(...args)
      const duration_ms = Date.now() - start

      logger.logApiResponse(endpoint, method, response.status, duration_ms, { trace_id })

      return response
    } catch (error) {
      const duration_ms = Date.now() - start

      logger.error(`API Error: ${method} ${endpoint}`, error as Error, {
        trace_id,
        duration_ms,
      })

      throw error
    } finally {
      logger.clearContext()
    }
  }) as T
}

/**
 * 성능 측정 헬퍼
 */
export async function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const start = Date.now()

  try {
    const result = await fn()
    const duration_ms = Date.now() - start

    logger.debug(`Performance: ${operation}`, {
      operation,
      duration_ms,
      ...context,
    })

    return result
  } catch (error) {
    const duration_ms = Date.now() - start

    logger.error(`Performance Error: ${operation}`, error as Error, {
      operation,
      duration_ms,
      ...context,
    })

    throw error
  }
}



