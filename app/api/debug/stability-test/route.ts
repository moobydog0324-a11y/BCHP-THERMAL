import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * 동일 이미지의 메타데이터 안정성 테스트
 * 같은 이미지를 3번 조회해서 값이 동일한지 확인
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const section = searchParams.get('section') || 'C-1'
    const captureDate = searchParams.get('date') || '2025-10-23'

    // 특정 날짜의 이미지 하나 선택
    const result = await query<any>(`
      SELECT 
        ti.image_id,
        ti.image_url,
        ti.capture_timestamp,
        ti.created_at as image_uploaded_at,
        im.metadata_json,
        im.thermal_data_json,
        im.created_at as metadata_created_at,
        im.updated_at as metadata_updated_at
      FROM thermal_images ti
      LEFT JOIN image_metadata im ON ti.image_id = im.image_id
      JOIN inspections i ON ti.inspection_id = i.inspection_id
      JOIN pipes p ON i.pipe_id = p.pipe_id
      WHERE p.section_category = $1
        AND ti.capture_timestamp::date = $2::date
        AND ti.image_type = 'thermal'
      ORDER BY ti.capture_timestamp
      LIMIT 1
    `, [section, captureDate])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `${section} 구역의 ${captureDate} 날짜에 해당하는 이미지가 없습니다`,
      })
    }

    const row = result.rows[0]
    const metadata = row.metadata_json
    const thermalData = row.thermal_data_json

    // 핵심 정보 추출
    const analysis = {
      test_info: {
        test_time: new Date().toISOString(),
        note: '이 API를 3번 호출해서 결과가 동일한지 확인하세요',
      },
      image_info: {
        image_id: row.image_id,
        image_url: row.image_url,
        capture_timestamp: row.capture_timestamp,
        image_uploaded_at: row.image_uploaded_at,
      },
      metadata_timestamps: {
        created_at: row.metadata_created_at,
        updated_at: row.metadata_updated_at,
        warning: row.metadata_created_at !== row.metadata_updated_at 
          ? '⚠️ 메타데이터가 업데이트된 적이 있습니다!'
          : '✅ 메타데이터는 한 번만 저장되었습니다',
      },
      temperature_data: thermalData?.actual_temp_stats ? {
        min_temp: thermalData.actual_temp_stats.min_temp,
        max_temp: thermalData.actual_temp_stats.max_temp,
        avg_temp: thermalData.actual_temp_stats.avg_temp,
        pixel_count: thermalData.actual_temp_stats.pixel_count,
        source: 'DB에 저장된 원본 값',
      } : null,
      gps_data: metadata ? {
        GPSLatitude: metadata.GPSLatitude,
        GPSLongitude: metadata.GPSLongitude,
        GPSAltitude: metadata.GPSAltitude,
        GPSAltitudeRef: metadata.GPSAltitudeRef,
      } : null,
      has_metadata: !!metadata,
      has_thermal_data: !!thermalData,
    }

    return NextResponse.json({
      success: true,
      data: analysis,
      instruction: {
        step1: '이 URL을 브라우저에서 3번 새로고침하세요',
        step2: 'temperature_data 값이 3번 모두 동일한지 확인하세요',
        step3_pass: '모두 같으면: DB는 정상, 프론트엔드 문제',
        step3_fail: '다르면: DB가 계속 재저장되고 있음 (심각)',
      },
    })
  } catch (error) {
    console.error('안정성 테스트 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    )
  }
}







