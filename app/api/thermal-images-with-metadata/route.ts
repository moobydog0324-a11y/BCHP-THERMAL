import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { ThermalImage } from '@/lib/types/database'
import {
  saveImageFile,
  generateThumbnail,
  validateFileSize,
  validateFileExtension,
} from '@/lib/utils/file-upload'

const FLASK_SERVER = process.env.FLASK_SERVER_URL || 'http://localhost:5001'

/**
 * POST /api/thermal-images-with-metadata
 * 메타데이터 자동 추출 + 이미지 업로드
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const inspection_id = formData.get('inspection_id') as string
    const image_type = formData.get('image_type') as 'thermal' | 'real'
    const imageFile = formData.get('image_file') as File
    const notes = formData.get('notes') as string
    let capture_timestamp = formData.get('capture_timestamp') as string

    // 필수 필드 검증
    if (!inspection_id || !image_type || !imageFile) {
      return NextResponse.json(
        {
          success: false,
          error: '점검 ID, 이미지 타입, 이미지 파일은 필수 항목입니다.',
        },
        { status: 400 }
      )
    }

    // 파일 크기 및 확장자 검증
    if (!validateFileSize(imageFile, 50)) {
      return NextResponse.json(
        { success: false, error: '파일 크기는 50MB를 초과할 수 없습니다.' },
        { status: 400 }
      )
    }

    if (!validateFileExtension(imageFile)) {
      return NextResponse.json(
        { success: false, error: '지원하지 않는 파일 형식입니다.' },
        { status: 400 }
      )
    }

    // 1. ExifTool로 메타데이터 추출
    let metadata = null
    let thermal_metadata = null

    try {
      const metadataFormData = new FormData()
      metadataFormData.append('file', imageFile)

      const flaskResponse = await fetch(`${FLASK_SERVER}/analyze`, {
        method: 'POST',
        body: metadataFormData,
      })

      if (flaskResponse.ok) {
        const result = await flaskResponse.json()
        if (result.success) {
          metadata = result.metadata
          thermal_metadata = result.thermal_data

          // 메타데이터에서 촬영 시간 추출 (사용자가 입력하지 않은 경우)
          if (!capture_timestamp && thermal_metadata?.DateTimeOriginal) {
            capture_timestamp = thermal_metadata.DateTimeOriginal.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
            console.log('📅 메타데이터에서 촬영 시간 추출:', capture_timestamp)
          }
        }
      }
    } catch (metadataError) {
      console.warn('⚠️ 메타데이터 추출 실패 (계속 진행):', metadataError)
    }

    // 촬영 시간이 없으면 현재 시간 사용
    if (!capture_timestamp) {
      capture_timestamp = new Date().toISOString()
      console.log('📅 촬영 시간 미지정, 현재 시간 사용')
    }

    // 2. 점검 정보 및 구간 조회
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

    const sectionCategory = inspectionResult.rows[0].section_category

    // 3. Supabase Storage에 파일 업로드
    const captureDate = new Date(capture_timestamp)
    const imageUpload = await saveImageFile(imageFile, image_type, captureDate, sectionCategory)
    const thumbnailUpload = await generateThumbnail(imageFile, image_type, captureDate, sectionCategory)

    // 4. DB에 이미지 정보 + 메타데이터 저장
    const file_size_bytes = imageFile.size
    const file_format = imageFile.type.split('/')[1] || 'jpg'

    // GPS 좌표 파싱 (DMS 포맷 -> 십진수)
    const parseCoordinate = (coord: any): number | null => {
      if (typeof coord === 'number') return coord
      if (typeof coord === 'string') {
        // 이미 십진수 문자열인 경우
        if (!isNaN(parseFloat(coord)) && !coord.includes('deg')) {
          return parseFloat(coord)
        }

        // DMS 포맷 파싱 (예: "37 deg 12' 34.56\" N")
        try {
          // 아주 단순한 정규식 예시 (ExifTool 포맷에 맞춰 조정 필요)
          // ExifTool JSON usually returns "35 deg 8' 2.40" N"
          const parts = coord.match(/(\d+)\s*deg\s*(\d+)'\s*([\d.]+)"\s*([NSEW])?/i)
          if (parts) {
            const d = parseFloat(parts[1])
            const m = parseFloat(parts[2])
            const s = parseFloat(parts[3])
            const ref = parts[4]?.toUpperCase()

            let decimal = d + m / 60 + s / 3600
            if (ref === 'S' || ref === 'W') {
              decimal = -decimal
            }
            return decimal
          }
        } catch (e) {
          console.error('GPS 파싱 오류:', e)
        }
      }
      return null
    }

    const gps_latitude = parseCoordinate(metadata?.GPSLatitude)
    const gps_longitude = parseCoordinate(metadata?.GPSLongitude)

    // 고도는 "54 m" 같은 문자열일 수 있음
    let gps_altitude = null
    if (metadata?.GPSAltitude) {
      if (typeof metadata.GPSAltitude === 'number') {
        gps_altitude = metadata.GPSAltitude
      } else if (typeof metadata.GPSAltitude === 'string') {
        gps_altitude = parseFloat(metadata.GPSAltitude.replace(/[^\d.-]/g, ''))
      }
    }

    const result = await query<ThermalImage>(
      `INSERT INTO thermal_images (
        inspection_id, image_url, thumbnail_url, 
        image_width, image_height, 
        capture_timestamp, file_size_bytes, file_format, image_type,
        camera_model,
        gps_latitude, gps_longitude, gps_altitude
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        inspection_id,
        imageUpload.url,
        thumbnailUpload.url,
        thermal_metadata?.ImageWidth || null,
        thermal_metadata?.ImageHeight || null,
        capture_timestamp,
        file_size_bytes,
        file_format,
        image_type,
        thermal_metadata?.Model || thermal_metadata?.Make || null,
        gps_latitude,
        gps_longitude,
        gps_altitude
      ]
    )

    // 5. 메타데이터를 별도 테이블에 저장 (선택사항)
    if (metadata) {
      try {
        await query(
          `INSERT INTO image_metadata (
            image_id, metadata_json, thermal_data_json,
            emissivity, object_distance, relative_humidity, reflected_apparent_temperature,
            gimbal_pitch, gimbal_roll, gimbal_yaw,
            flight_pitch, flight_roll, flight_yaw
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (image_id) DO UPDATE 
           SET 
             metadata_json = $2, 
             thermal_data_json = $3,
             emissivity = $4,
             object_distance = $5,
             relative_humidity = $6,
             reflected_apparent_temperature = $7,
             gimbal_pitch = $8,
             gimbal_roll = $9,
             gimbal_yaw = $10,
             flight_pitch = $11,
             flight_roll = $12,
             flight_yaw = $13`,
          [
            result.rows[0].image_id,
            JSON.stringify(metadata),
            JSON.stringify(thermal_metadata),
            // Extended Metadata Columns
            thermal_metadata?.Emissivity || null,
            thermal_metadata?.ObjectDistance || null,
            thermal_metadata?.RelativeHumidity || null,
            thermal_metadata?.ReflectedApparentTemperature || null,
            thermal_metadata?.GimbalPitchDegree || null,
            thermal_metadata?.GimbalRollDegree || null,
            thermal_metadata?.GimbalYawDegree || null,
            thermal_metadata?.FlightPitchDegree || null,
            thermal_metadata?.FlightRollDegree || null,
            thermal_metadata?.FlightYawDegree || null
          ]
        )
      } catch (metaError) {
        // 테이블이 없으면 무시 (선택사항)
        console.warn('메타데이터 저장 실패 (무시):', metaError)
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `${image_type === 'thermal' ? '열화상' : '실화상'} 이미지가 업로드되었습니다.`,
        data: result.rows[0],
        metadata_extracted: !!metadata,
        thermal_data: thermal_metadata,
        file_info: {
          original_name: imageFile.name,
          section: sectionCategory,
          storage_path: imageUpload.path,
          public_url: imageUpload.url,
          size: file_size_bytes,
          type: image_type,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('이미지 업로드 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '이미지 업로드 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}


