import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { ThermalImage } from '@/lib/types/database'

/**
 * GET /api/thermal-images
 * 열화상 이미지 데이터 조회 (메타데이터 포함)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const inspectionId = searchParams.get('inspection_id')
    const withMetadata = searchParams.get('with_metadata') === 'true'

    let result

    if (withMetadata) {
      if (inspectionId) {
        result = await query(
          `SELECT 
            ti.*,
            im.metadata_json,
            im.thermal_data_json,
            p.section_category
           FROM thermal_images ti
           LEFT JOIN image_metadata im ON ti.image_id = im.image_id
           LEFT JOIN inspections i ON ti.inspection_id = i.inspection_id
           LEFT JOIN pipes p ON i.pipe_id = p.pipe_id
           WHERE ti.inspection_id = $1
           ORDER BY ti.capture_timestamp DESC`,
          [inspectionId]
        )
      } else {
        result = await query(
          `SELECT 
            ti.*,
            im.metadata_json,
            im.thermal_data_json,
            p.section_category
           FROM thermal_images ti
           LEFT JOIN image_metadata im ON ti.image_id = im.image_id
           LEFT JOIN inspections i ON ti.inspection_id = i.inspection_id
           LEFT JOIN pipes p ON i.pipe_id = p.pipe_id
           ORDER BY ti.capture_timestamp DESC
           LIMIT 1000`
        )
      }
    } else {
      if (inspectionId) {
        result = await query<ThermalImage>(
          `SELECT * FROM thermal_images 
           WHERE inspection_id = $1
           ORDER BY capture_timestamp DESC`,
          [inspectionId]
        )
      } else {
        result = await query<ThermalImage>(
          `SELECT * FROM thermal_images 
           ORDER BY capture_timestamp DESC
           LIMIT 1000`
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
      with_metadata: withMetadata,
    })
  } catch (error) {
    console.error('열화상 이미지 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: '열화상 이미지를 조회하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/thermal-images
 * 새로운 이미지 데이터 등록 (R2 업로드 후 메타데이터 저장)
 * - 클라이언트에서 이미지를 R2에 업로드한 후 호출함
 * - JSON Payload를 받음 (FormData 아님)
 */
export async function POST(request: NextRequest) {
  try {
    // JSON Payload 처리
    const body = await request.json()
    const {
      inspection_id,
      image_type,
      image_url, // R2 URL
      file_size,
      original_filename,
      capture_timestamp,
      notes,
      exif_data, // 클라이언트에서 추출한 EXIF 데이터
      thermal_data // ✅ 클라이언트가 전달한 열화상 데이터 (온도 포함)
    } = body

    // 필수 필드 검증
    if (!inspection_id || !image_type || !image_url) {
      return NextResponse.json(
        { success: false, error: '점검 ID, 이미지 타입, 이미지 URL은 필수 항목입니다.' },
        { status: 400 }
      )
    }

    // 이미지 타입 검증
    if (image_type !== 'thermal' && image_type !== 'real') {
      return NextResponse.json(
        { success: false, error: '이미지 타입은 "thermal" 또는 "real"만 가능합니다.' },
        { status: 400 }
      )
    }

    // 파일 이름에서 파일 포맷 추출
    const file_format = original_filename?.split('.').pop()?.toLowerCase() || 'jpg'

    // 점검 존재 여부 확인
    const inspectionResult = await query(
      `SELECT i.inspection_id, p.section_category 
       FROM inspections i
       JOIN pipes p ON i.pipe_id = p.pipe_id
       WHERE i.inspection_id = $1`,
      [inspection_id]
    )

    if (!inspectionResult.rowCount || inspectionResult.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: '존재하지 않는 점검 ID입니다.' },
        { status: 404 }
      )
    }

    // 중복 체크 (URL 기준)
    const duplicateCheck = await query(
      `SELECT image_id FROM thermal_images WHERE image_url = $1 LIMIT 1`,
      [image_url]
    )
    if (duplicateCheck.rowCount && duplicateCheck.rowCount > 0) {
      return NextResponse.json(
        { success: false, error: '이미 등록된 이미지 URL입니다.', duplicate: true },
        { status: 409 }
      )
    }

    // 메타데이터 가공
    const metadata = exif_data || {}
    const final_thermal_data = thermal_data || {} // 받아온 열화상 데이터 사용

    // 온도 통계 추출 (DB 컬럼용)
    let range_min = null
    let range_max = null
    let avg_temp = null

    if (final_thermal_data.actual_temp_stats) {
      range_min = final_thermal_data.actual_temp_stats.min_temp
      range_max = final_thermal_data.actual_temp_stats.max_temp
      avg_temp = final_thermal_data.actual_temp_stats.avg_temp
    }

    // EXIF에서 촬영 시간 파싱 (없으면 입력받은 값 또는 현재 시간)
    let final_timestamp = capture_timestamp
    if (!final_timestamp && metadata.DateTimeOriginal) {
      // EXIF 날짜 포맷 (YYYY:MM:DD HH:MM:SS) -> ISO 변환 시도
      try {
        // 날짜 구분자가 : 인 경우 처리
        if (typeof metadata.DateTimeOriginal === 'string') {
          const parts = metadata.DateTimeOriginal.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
          if (parts) {
            final_timestamp = `${parts[1]}-${parts[2]}-${parts[3]}T${parts[4]}:${parts[5]}:${parts[6]}`
          } else {
            const d = new Date(metadata.DateTimeOriginal)
            if (!isNaN(d.getTime())) final_timestamp = d.toISOString()
          }
        } else if (metadata.DateTimeOriginal instanceof Date) {
          final_timestamp = metadata.DateTimeOriginal.toISOString()
        }
      } catch (e) {
        console.warn('날짜 파싱 실패:', e)
      }
    }
    if (!final_timestamp) final_timestamp = new Date().toISOString()

    // DB 저장
    const result = await query<ThermalImage>(
      `INSERT INTO thermal_images (
        inspection_id, image_url, thumbnail_url, 
        image_width, image_height, 
        capture_timestamp, file_size_bytes, file_format, image_type,
        camera_model,
        range_min, range_max, avg_temp 
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        inspection_id,
        image_url,
        image_url, // 썸네일은 원본 URL 사용
        metadata.ExifImageWidth || metadata.ImageWidth || null,
        metadata.ExifImageHeight || metadata.ImageHeight || null,
        final_timestamp,
        file_size || 0,
        file_format,
        image_type,
        metadata.Model || metadata.Make || null,
        range_min, // $11
        range_max, // $12
        avg_temp   // $13
      ]
    )

    // 메타데이터 테이블 저장
    if (result.rows[0]) {
      try {
        await query(
          `INSERT INTO image_metadata (image_id, metadata_json, thermal_data_json, created_at, updated_at)
                 VALUES ($1, $2, $3, NOW(), NOW())
                 ON CONFLICT (image_id) DO UPDATE 
                 SET metadata_json = $2, thermal_data_json = $3, updated_at = NOW()`,
          [
            result.rows[0].image_id,
            JSON.stringify(metadata),
            JSON.stringify(final_thermal_data)
          ]
        )
      } catch (e) {
        console.error('메타데이터 저장 실패:', e)
      }
    }

    return NextResponse.json({
      success: true,
      message: '이미지 정보가 성공적으로 등록되었습니다.',
      data: result.rows[0],
      temperature_extracted: false, // Flask 서버 미사용으로 인해 false
      file_info: {
        public_url: image_url,
        original_name: original_filename
      }
    }, { status: 201 })

  } catch (error) {
    console.error('이미지 정보 등록 실패:', error)
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'

    // DB 에러 상세 구분
    if (errorMessage.includes('violates foreign key')) {
      return NextResponse.json({ success: false, error: 'DB 제약조건 위반 (잘못된 pipe_id 등)' }, { status: 500 })
    }

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
