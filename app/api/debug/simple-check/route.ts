import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * 간단한 데이터 존재 여부만 확인
 */
export async function GET() {
  try {
    // 1. 이미지 개수
    const images = await query(`SELECT COUNT(*) as count FROM thermal_images`)
    
    // 2. 점검 개수
    const inspections = await query(`SELECT COUNT(*) as count FROM inspections`)
    
    // 3. 파이프 개수
    const pipes = await query(`SELECT COUNT(*) as count FROM pipes`)
    
    // 4. 최근 이미지 1개만
    const recentImage = await query(`
      SELECT 
        image_id, 
        image_type, 
        inspection_id,
        capture_timestamp
      FROM thermal_images 
      ORDER BY created_at DESC 
      LIMIT 1
    `)

    // 5. section_category 확인
    const sections = await query(`
      SELECT DISTINCT section_category 
      FROM pipes 
      WHERE section_category IS NOT NULL
      ORDER BY section_category
    `)

    return NextResponse.json({
      success: true,
      counts: {
        images: parseInt(images.rows[0].count),
        inspections: parseInt(inspections.rows[0].count),
        pipes: parseInt(pipes.rows[0].count),
      },
      recent_image: recentImage.rows[0] || null,
      available_sections: sections.rows.map(r => r.section_category),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Simple check 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    )
  }
}

