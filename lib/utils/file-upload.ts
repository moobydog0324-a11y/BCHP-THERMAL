import { supabase, STORAGE_BUCKET } from '@/lib/supabase/client'

/**
 * Supabase Storage 경로 생성
 * 예: A-1/2025/01/15/thermal
 * 
 * @param imageType - 이미지 타입 ('thermal' 또는 'real')
 * @param date - 날짜 (기본값: 현재 날짜)
 * @param section - 구간 카테고리 (예: 'A-1', 'B-2')
 * @returns 저장 경로
 */
export function generateDateBasedPath(
  imageType: 'thermal' | 'real',
  date: Date = new Date(),
  section?: string
): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  
  if (section) {
    return `${section}/${year}/${month}/${day}/${imageType}`
  }
  
  return `${year}/${month}/${day}/${imageType}`
}

/**
 * 고유한 파일명 생성
 * 예: thermal_1736908800000_abc123.jpg
 * 
 * @param originalName - 원본 파일명
 * @param imageType - 이미지 타입
 * @returns 고유한 파일명
 */
export function generateUniqueFilename(
  originalName: string,
  imageType: 'thermal' | 'real'
): string {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 8)
  const extension = originalName.substring(originalName.lastIndexOf('.'))
  
  return `${imageType}_${timestamp}_${randomStr}${extension}`
}

/**
 * Supabase Storage에 파일 업로드
 * 
 * @param file - 업로드할 파일 (File 객체)
 * @param imageType - 이미지 타입 ('thermal' 또는 'real')
 * @param captureDate - 촬영 날짜 (기본값: 현재 날짜)
 * @param section - 구간 카테고리 (예: 'A-1', 'B-2')
 * @returns 업로드된 파일의 공개 URL
 */
export async function saveImageFile(
  file: File,
  imageType: 'thermal' | 'real',
  captureDate?: Date,
  section?: string
): Promise<{ url: string; path: string }> {
  try {
    // 1. 구간별/날짜별 폴더 경로 생성
    const dateBasedPath = generateDateBasedPath(imageType, captureDate, section)
    
    // 2. 고유한 파일명 생성
    const filename = generateUniqueFilename(file.name, imageType)
    
    // 3. Supabase Storage 전체 경로
    const storagePath = `${dateBasedPath}/${filename}`
    
    // 4. 파일 업로드
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      })
    
    if (error) {
      console.error('Supabase Storage 업로드 오류:', error)
      throw new Error(`파일 업로드에 실패했습니다: ${error.message}`)
    }
    
    // 5. 공개 URL 생성
    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath)
    
    return {
      url: publicUrlData.publicUrl,
      path: storagePath,
    }
  } catch (error) {
    console.error('파일 저장 오류:', error)
    throw new Error('파일 저장에 실패했습니다.')
  }
}

/**
 * 썸네일 생성 (현재는 원본 이미지와 동일)
 * 
 * @param file - 원본 파일
 * @param imageType - 이미지 타입
 * @param captureDate - 촬영 날짜
 * @param section - 구간 카테고리
 * @returns 썸네일 URL
 */
export async function generateThumbnail(
  file: File,
  imageType: 'thermal' | 'real',
  captureDate?: Date,
  section?: string
): Promise<{ url: string; path: string }> {
  // TODO: 추후 이미지 리사이징 구현 (sharp 등)
  // 현재는 원본 이미지와 동일한 URL 반환
  return await saveImageFile(file, imageType, captureDate, section)
}

/**
 * 파일 크기 검증
 * 
 * @param file - 파일 객체
 * @param maxSizeMB - 최대 파일 크기 (MB)
 * @returns 검증 통과 여부
 */
export function validateFileSize(file: File, maxSizeMB: number = 50): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024
  return file.size <= maxSizeBytes
}

/**
 * 파일 확장자 검증
 * 
 * @param file - 파일 객체
 * @param allowedExtensions - 허용된 확장자 목록
 * @returns 검증 통과 여부
 */
export function validateFileExtension(
  file: File,
  allowedExtensions: string[] = ['.jpg', '.jpeg', '.png', '.tiff', '.tif']
): boolean {
  const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
  return allowedExtensions.includes(extension)
}
