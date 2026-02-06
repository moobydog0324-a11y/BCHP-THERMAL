/**
 * 메트릭 수집 유틸리티
 * 시스템 성능 및 비즈니스 메트릭 추적
 */

export enum MetricType {
  COUNTER = 'counter',      // 누적 카운터 (예: 업로드 수)
  GAUGE = 'gauge',          // 현재 값 (예: 활성 사용자 수)
  HISTOGRAM = 'histogram',  // 분포 (예: 응답 시간)
  SUMMARY = 'summary',      // 요약 통계 (예: 95% 지연시간)
}

type MetricValue = {
  timestamp: number
  value: number
  labels?: Record<string, string>
}

type MetricSummary = {
  name: string
  type: MetricType
  description: string
  values: MetricValue[]
  summary?: {
    count: number
    sum: number
    min: number
    max: number
    avg: number
    p50?: number
    p95?: number
    p99?: number
  }
}

class MetricsCollector {
  private metrics: Map<string, MetricSummary> = new Map()

  /**
   * 카운터 증가
   */
  incrementCounter(
    name: string,
    value: number = 1,
    labels?: Record<string, string>,
    description?: string
  ): void {
    const metric = this.getOrCreateMetric(name, MetricType.COUNTER, description)
    metric.values.push({
      timestamp: Date.now(),
      value,
      labels,
    })

    this.updateSummary(name)
  }

  /**
   * 게이지 값 설정
   */
  setGauge(
    name: string,
    value: number,
    labels?: Record<string, string>,
    description?: string
  ): void {
    const metric = this.getOrCreateMetric(name, MetricType.GAUGE, description)
    metric.values = [
      {
        timestamp: Date.now(),
        value,
        labels,
      },
    ]

    this.updateSummary(name)
  }

  /**
   * 히스토그램 값 기록 (주로 지연시간)
   */
  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
    description?: string
  ): void {
    const metric = this.getOrCreateMetric(name, MetricType.HISTOGRAM, description)
    metric.values.push({
      timestamp: Date.now(),
      value,
      labels,
    })

    this.updateSummary(name)

    // 오래된 값 정리 (최근 1시간만 유지)
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    metric.values = metric.values.filter((v) => v.timestamp > oneHourAgo)
  }

  /**
   * 메트릭 조회
   */
  getMetric(name: string): MetricSummary | undefined {
    return this.metrics.get(name)
  }

  /**
   * 모든 메트릭 조회
   */
  getAllMetrics(): MetricSummary[] {
    return Array.from(this.metrics.values())
  }

  /**
   * 메트릭 초기화
   */
  reset(name?: string): void {
    if (name) {
      this.metrics.delete(name)
    } else {
      this.metrics.clear()
    }
  }

  /**
   * Prometheus 포맷으로 내보내기
   */
  exportPrometheus(): string {
    let output = ''

    for (const metric of this.metrics.values()) {
      output += `# HELP ${metric.name} ${metric.description}\n`
      output += `# TYPE ${metric.name} ${metric.type}\n`

      if (metric.type === MetricType.GAUGE) {
        const latest = metric.values[metric.values.length - 1]
        if (latest) {
          const labels = latest.labels ? this.formatLabels(latest.labels) : ''
          output += `${metric.name}${labels} ${latest.value}\n`
        }
      } else if (metric.type === MetricType.COUNTER) {
        const sum = metric.values.reduce((acc, v) => acc + v.value, 0)
        output += `${metric.name}_total ${sum}\n`
      } else if (metric.type === MetricType.HISTOGRAM && metric.summary) {
        output += `${metric.name}_count ${metric.summary.count}\n`
        output += `${metric.name}_sum ${metric.summary.sum}\n`
        output += `${metric.name}_min ${metric.summary.min}\n`
        output += `${metric.name}_max ${metric.summary.max}\n`
        output += `${metric.name}_avg ${metric.summary.avg}\n`
        if (metric.summary.p95) {
          output += `${metric.name}_p95 ${metric.summary.p95}\n`
        }
      }

      output += '\n'
    }

    return output
  }

  /**
   * JSON 포맷으로 내보내기
   */
  exportJSON(): Record<string, MetricSummary> {
    const result: Record<string, MetricSummary> = {}

    for (const [name, metric] of this.metrics.entries()) {
      result[name] = metric
    }

    return result
  }

  // ========== 내부 메서드 ==========

  private getOrCreateMetric(
    name: string,
    type: MetricType,
    description?: string
  ): MetricSummary {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        type,
        description: description || '',
        values: [],
      })
    }

    return this.metrics.get(name)!
  }

  private updateSummary(name: string): void {
    const metric = this.metrics.get(name)
    if (!metric || metric.values.length === 0) return

    const values = metric.values.map((v) => v.value)
    const count = values.length
    const sum = values.reduce((acc, v) => acc + v, 0)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = sum / count

    const summary: MetricSummary['summary'] = {
      count,
      sum,
      min,
      max,
      avg,
    }

    // 히스토그램인 경우 백분위수 계산
    if (metric.type === MetricType.HISTOGRAM) {
      const sorted = [...values].sort((a, b) => a - b)
      summary.p50 = this.percentile(sorted, 50)
      summary.p95 = this.percentile(sorted, 95)
      summary.p99 = this.percentile(sorted, 99)
    }

    metric.summary = summary
  }

  private percentile(sortedValues: number[], p: number): number {
    const index = Math.ceil((sortedValues.length * p) / 100) - 1
    return sortedValues[index] || 0
  }

  private formatLabels(labels: Record<string, string>): string {
    const pairs = Object.entries(labels).map(([k, v]) => `${k}="${v}"`)
    return `{${pairs.join(',')}}`
  }
}

// 싱글톤 인스턴스
export const metrics = new MetricsCollector()

// ========== 사전 정의된 메트릭 ==========

/**
 * 이미지 업로드 카운터
 */
export function recordImageUpload(section: string, success: boolean): void {
  metrics.incrementCounter(
    'thermal_images_uploaded_total',
    1,
    { section, status: success ? 'success' : 'failed' },
    'Total number of thermal images uploaded'
  )
}

/**
 * 메타데이터 추출 성공률
 */
export function recordMetadataExtraction(success: boolean, has_gps: boolean, has_temp: boolean): void {
  metrics.incrementCounter(
    'metadata_extraction_total',
    1,
    {
      status: success ? 'success' : 'failed',
      has_gps: has_gps.toString(),
      has_temp: has_temp.toString(),
    },
    'Total metadata extraction attempts'
  )
}

/**
 * API 응답 지연시간
 */
export function recordApiLatency(endpoint: string, method: string, latency_ms: number): void {
  metrics.recordHistogram(
    'api_request_duration_ms',
    latency_ms,
    { endpoint, method },
    'API request duration in milliseconds'
  )
}

/**
 * Flask 서버 상태
 */
export function recordFlaskHealth(status: 'ok' | 'degraded' | 'down'): void {
  const statusValue = { ok: 1, degraded: 0.5, down: 0 }[status]
  
  metrics.setGauge(
    'flask_server_health',
    statusValue,
    { status },
    'Flask server health status (1=ok, 0.5=degraded, 0=down)'
  )
}

/**
 * 배치 처리 성공률
 */
export function recordBatchProcessing(
  batch_type: string,
  total: number,
  succeeded: number,
  failed: number
): void {
  const success_rate = total > 0 ? (succeeded / total) * 100 : 0

  metrics.recordHistogram(
    'batch_processing_success_rate',
    success_rate,
    { batch_type },
    'Batch processing success rate percentage'
  )

  metrics.incrementCounter('batch_processing_items_total', succeeded, {
    batch_type,
    status: 'success',
  })

  metrics.incrementCounter('batch_processing_items_total', failed, {
    batch_type,
    status: 'failed',
  })
}

/**
 * GPS 포함 이미지 비율
 */
export function recordGPSCoverage(total_images: number, images_with_gps: number): void {
  const coverage = total_images > 0 ? (images_with_gps / total_images) * 100 : 0

  metrics.setGauge(
    'gps_coverage_percentage',
    coverage,
    undefined,
    'Percentage of images with GPS data'
  )
}



