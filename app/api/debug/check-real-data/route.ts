import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * GET /api/debug/check-real-data
 * 실제 업로드된 데이터인지 확인 (Supabase Storage URL 체크)
 */
export async function GET() {
  try {
    // 모든 이미지 URL 확인
    const result = await query(
      `SELECT 
        ti.image_id,
        ti.image_url,
        ti.thumbnail_url,
        ti.capture_timestamp,
        ti.image_type,
        i.inspector_name,
        i.inspection_date,
        p.pipe_code,
        p.section_category
       FROM thermal_images ti
       LEFT JOIN inspections i ON ti.inspection_id = i.inspection_id
       LEFT JOIN pipes p ON i.pipe_id = p.pipe_id
       ORDER BY ti.image_id DESC`
    )

    const images = result.rows.map((img) => ({
      ...img,
      is_real_upload: 
        img.image_url && 
        (img.image_url.includes('supabase.co') || img.image_url.includes('storage')),
      is_placeholder: 
        img.image_url && 
        (img.image_url.includes('placeholder') || img.image_url.includes('unsplash')),
      url_prefix: img.image_url ? img.image_url.substring(0, 50) + '...' : 'N/A',
    }))

    const realUploads = images.filter(img => img.is_real_upload)
    const placeholders = images.filter(img => img.is_placeholder)
    const others = images.filter(img => !img.is_real_upload && !img.is_placeholder)

    return NextResponse.json({
      success: true,
      data: {
        total: result.rowCount,
        real_uploads: {
          count: realUploads.length,
          data: realUploads,
        },
        placeholders: {
          count: placeholders.length,
          data: placeholders,
        },
        others: {
          count: others.length,
          data: others,
        },
        all_images: images,
      },
      message: realUploads.length > 0 
        ? `✅ ${realUploads.length}개의 실제 업로드된 이미지가 있습니다.`
        : placeholders.length > 0
        ? `⚠️ ${placeholders.length}개의 이미지가 placeholder(가짜 데이터)입니다.`
        : '❓ 이미지 데이터를 확인할 수 없습니다.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('데이터 확인 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '데이터 확인 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}



