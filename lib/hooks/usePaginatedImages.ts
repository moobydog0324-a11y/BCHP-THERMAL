/**
 * 페이지네이션 이미지 훅
 * 무한 스크롤 또는 페이지 버튼 방식 지원
 */

import { useState, useEffect, useCallback } from 'react'

export type ThermalImage = {
  image_id: number
  inspection_id: number
  image_url: string
  thumbnail_url: string
  capture_timestamp: string
  image_type: 'thermal' | 'real'
  section_category: string
  camera_model: string
  gps: any
  temperature: any
  has_metadata: boolean
  metadata_json?: any
  thermal_data_json?: any
}

type UsePaginatedImagesOptions = {
  pageSize?: number
  enabled?: boolean
}

type UsePaginatedImagesReturn = {
  images: ThermalImage[]
  loading: boolean
  error: string | null
  hasMore: boolean
  page: number
  totalPages: number
  totalCount: number
  loadMore: () => void
  goToPage: (page: number) => void
  refresh: () => void
}

/**
 * 페이지네이션된 이미지 조회 훅
 * 
 * @param sections - 조회할 섹션 배열 (예: ['A-1', 'B-2'])
 * @param options - 옵션 { pageSize, enabled }
 * @returns 이미지 목록 및 페이지네이션 상태
 */
export function usePaginatedImages(
  sections: string[],
  options: UsePaginatedImagesOptions = {}
): UsePaginatedImagesReturn {
  const { pageSize = 50, enabled = true } = options

  const [images, setImages] = useState<ThermalImage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const totalPages = Math.ceil(totalCount / pageSize)

  const fetchImages = useCallback(
    async (pageNum: number) => {
      if (!enabled || sections.length === 0) return

      try {
        setLoading(true)
        setError(null)

        const allImages: ThermalImage[] = []

        // 각 섹션에서 이미지 가져오기
        for (const section of sections) {
          const response = await fetch(
            `/api/thermal-images/by-section/${section}?image_type=thermal`
          )
          const result = await response.json()

          if (result.success && result.data.length > 0) {
            allImages.push(...result.data)
          }
        }

        // 최신순 정렬
        allImages.sort(
          (a, b) =>
            new Date(b.capture_timestamp).getTime() -
            new Date(a.capture_timestamp).getTime()
        )

        // 페이지네이션
        const start = (pageNum - 1) * pageSize
        const end = start + pageSize
        const paginatedImages = allImages.slice(start, end)

        setImages(paginatedImages)
        setTotalCount(allImages.length)
        setHasMore(end < allImages.length)
      } catch (err) {
        setError(err instanceof Error ? err.message : '이미지를 불러오는 중 오류가 발생했습니다.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    },
    [sections, pageSize, enabled]
  )

  useEffect(() => {
    fetchImages(page)
  }, [fetchImages, page])

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage((prev) => prev + 1)
    }
  }, [loading, hasMore])

  const goToPage = useCallback((pageNum: number) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setPage(pageNum)
    }
  }, [totalPages])

  const refresh = useCallback(() => {
    setPage(1)
    fetchImages(1)
  }, [fetchImages])

  return {
    images,
    loading,
    error,
    hasMore,
    page,
    totalPages,
    totalCount,
    loadMore,
    goToPage,
    refresh,
  }
}



