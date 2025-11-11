import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * GET /api/debug/schema-check
 * 테이블 스키마 확인 (section_category 컬럼 존재 여부)
 */
export async function GET() {
  try {
    // pipes 테이블의 컬럼 정보 확인
    const pipesSchemaResult = await query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'pipes'
       ORDER BY ordinal_position`
    )

    // thermal_images 테이블의 컬럼 정보 확인
    const imagesSchemaResult = await query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'thermal_images'
       ORDER BY ordinal_position`
    )

    // section_category 컬럼 존재 여부
    const hasSectionCategory = pipesSchemaResult.rows.some(
      row => row.column_name === 'section_category'
    )

    // image_type 컬럼 존재 여부
    const hasImageType = imagesSchemaResult.rows.some(
      row => row.column_name === 'image_type'
    )

    return NextResponse.json({
      success: true,
      data: {
        pipes_table: {
          columns: pipesSchemaResult.rows,
          has_section_category: hasSectionCategory,
        },
        thermal_images_table: {
          columns: imagesSchemaResult.rows,
          has_image_type: hasImageType,
        },
        needs_migration: !hasSectionCategory || !hasImageType,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('스키마 확인 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '스키마 확인 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}



