/**
 * 통일된 API 응답 타입 정의
 * 모든 API 엔드포인트는 이 타입을 따라야 합니다.
 */

/**
 * 성공 응답
 */
export type ApiSuccessResponse<T = unknown> = {
  success: true
  data: T
  message?: string
  metadata?: {
    count?: number
    page?: number
    total?: number
    [key: string]: any
  }
}

/**
 * 실패 응답
 */
export type ApiErrorResponse = {
  success: false
  error: string
  code?: string
  details?: any
  trace_id?: string
}

/**
 * 통합 API 응답 타입
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * 페이지네이션 메타데이터
 */
export type PaginationMetadata = {
  page: number
  page_size: number
  total_items: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

/**
 * 페이지네이션된 응답
 */
export type PaginatedResponse<T> = ApiSuccessResponse<T> & {
  metadata: PaginationMetadata
}

/**
 * API 에러 코드
 */
export enum ApiErrorCode {
  // 클라이언트 에러 (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  
  // 서버 에러 (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT = 'TIMEOUT',
  
  // 비즈니스 로직 에러
  METADATA_EXTRACTION_FAILED = 'METADATA_EXTRACTION_FAILED',
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
}

/**
 * API 응답 헬퍼 함수
 */
export class ApiResponseHelper {
  /**
   * 성공 응답 생성
   */
  static success<T>(data: T, message?: string, metadata?: any): ApiSuccessResponse<T> {
    return {
      success: true,
      data,
      ...(message && { message }),
      ...(metadata && { metadata }),
    }
  }

  /**
   * 에러 응답 생성
   */
  static error(
    error: string,
    code?: ApiErrorCode | string,
    details?: any,
    trace_id?: string
  ): ApiErrorResponse {
    return {
      success: false,
      error,
      ...(code && { code }),
      ...(details && { details }),
      ...(trace_id && { trace_id }),
    }
  }

  /**
   * 페이지네이션 응답 생성
   */
  static paginated<T>(
    data: T,
    pagination: PaginationMetadata,
    message?: string
  ): PaginatedResponse<T> {
    return {
      success: true,
      data,
      metadata: pagination,
      ...(message && { message }),
    }
  }
}



