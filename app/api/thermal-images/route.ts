import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { ThermalImage } from '@/lib/types/database'
import {
  saveImageFile,
  generateThumbnail,
  validateFileSize,
  validateFileExtension,
} from '@/lib/utils/file-upload'

/**
 * GET /api/thermal-images
 * 열화상 이미지 데이터 조회 (메타데이터 포함)
 * 
 * 쿼리 파라미터:
 * - inspection_id: 특정 점검의 이미지만 조회
 * - with_metadata: true면 메타데이터도 함께 조회
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const inspectionId = searchParams.get('inspection_id')
    const withMetadata = searchParams.get('with_metadata') === 'true'

    let result

    if (withMetadata) {
      // 메타데이터 포함 조회
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
           LIMIT 100`
        )
      }
    } else {
      // 메타데이터 없이 조회 (기존 방식)
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
           LIMIT 100`
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
 * 새로운 이미지 데이터 업로드 (실제 파일 업로드 + 메타데이터 자동 추출)
 */
export async function POST(request: NextRequest) {
  try {
    // FormData로 파일 받기
    const formData = await request.formData()
    
    const inspection_id = formData.get('inspection_id') as string
    const image_type = formData.get('image_type') as 'thermal' | 'real'
    const imageFile = formData.get('image_file') as File
    let capture_timestamp = formData.get('capture_timestamp') as string
    const notes = formData.get('notes') as string

    const FLASK_SERVER = process.env.FLASK_SERVER_URL || 'http://localhost:5000'

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

    // 이미지 타입 검증
    if (image_type !== 'thermal' && image_type !== 'real') {
      return NextResponse.json(
        {
          success: false,
          error: '이미지 타입은 "thermal" 또는 "real"만 가능합니다.',
        },
        { status: 400 }
      )
    }

    // 점검 존재 여부 확인 및 구간 정보 가져오기
    const inspectionResult = await query(
      `SELECT i.inspection_id, p.section_category 
       FROM inspections i
       JOIN pipes p ON i.pipe_id = p.pipe_id
       WHERE i.inspection_id = $1`,
      [inspection_id]
    )

    if (!inspectionResult.rowCount || inspectionResult.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '존재하지 않는 점검 ID입니다.',
        },
        { status: 404 }
      )
    }

    const sectionCategory = inspectionResult.rows[0].section_category

    // 파일 크기 검증 (최대 50MB)
    if (!validateFileSize(imageFile, 50)) {
      return NextResponse.json(
        {
          success: false,
          error: '파일 크기는 50MB를 초과할 수 없습니다.',
        },
        { status: 400 }
      )
    }

    // 파일 확장자 검증
    if (!validateFileExtension(imageFile)) {
      return NextResponse.json(
        {
          success: false,
          error: '지원하지 않는 파일 형식입니다. (jpg, jpeg, png, tiff 허용)',
        },
        { status: 400 }
      )
    }

    // 🔍 파일 해시 계산 (중복 체크용)
    console.log('🔐 파일 해시 계산 중...')
    const fileBuffer = await imageFile.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    console.log(`🔐 파일 해시: ${fileHash.substring(0, 16)}...`)

    // 🚫 중복 파일 체크 (동일한 해시 + 파일명)
    const duplicateCheck = await query(
      `SELECT ti.image_id, ti.image_url, ti.capture_timestamp, p.section_category
       FROM thermal_images ti
       LEFT JOIN inspections i ON ti.inspection_id = i.inspection_id
       LEFT JOIN pipes p ON i.pipe_id = p.pipe_id
       LEFT JOIN image_metadata im ON ti.image_id = im.image_id
       WHERE im.file_hash = $1
       LIMIT 1`,
      [fileHash]
    )

    if (duplicateCheck.rowCount && duplicateCheck.rowCount > 0) {
      const duplicate = duplicateCheck.rows[0]
      console.warn(`⚠️ 중복 파일 감지: 이미 업로드된 이미지입니다.`)
      console.warn(`   기존 이미지 ID: ${duplicate.image_id}`)
      console.warn(`   구역: ${duplicate.section_category || '알 수 없음'}`)
      console.warn(`   촬영시간: ${duplicate.capture_timestamp}`)
      
      return NextResponse.json(
        {
          success: false,
          error: '이미 업로드된 이미지입니다.',
          duplicate: true,
          existing_image: {
            image_id: duplicate.image_id,
            image_url: duplicate.image_url,
            section_category: duplicate.section_category,
            capture_timestamp: duplicate.capture_timestamp,
          }
        },
        { status: 409 } // Conflict
      )
    }

    console.log('✅ 중복 체크 완료: 새로운 파일입니다.')

    // 🔥 메타데이터 추출 (ExifTool)
    let metadata = null
    let thermal_data = null
    
    try {
      console.log('🔍 ExifTool로 메타데이터 추출 시작...')
      console.log(`📁 파일 정보: ${imageFile.name}, 크기: ${imageFile.size} bytes`)
      
      const metadataFormData = new FormData()
      metadataFormData.append('file', imageFile)
      
      // 타임아웃 설정 (60초)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)
      
      try {
        const flaskResponse = await fetch(`${FLASK_SERVER}/analyze`, {
          method: 'POST',
          body: metadataFormData,
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        
        console.log(`📥 Flask 서버 응답: ${flaskResponse.status}`)
        
        if (flaskResponse.ok) {
          const result = await flaskResponse.json()
          console.log(`📊 메타데이터 결과:`, result.success ? '성공' : '실패')
          
          if (result.success) {
            metadata = result.metadata
            thermal_data = result.thermal_data
            console.log('✅ 메타데이터 추출 성공')
            
            // 촬영 시간이 없으면 메타데이터에서 추출
            if (!capture_timestamp && thermal_data?.DateTimeOriginal) {
              capture_timestamp = thermal_data.DateTimeOriginal.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
              console.log('📅 메타데이터에서 촬영 시간 추출:', capture_timestamp)
            }
          } else {
            console.warn('⚠️ 메타데이터 추출 실패:', result.error)
          }
        } else {
          console.warn('⚠️ Flask 서버 응답 오류:', flaskResponse.status)
          const errorText = await flaskResponse.text()
          console.warn('오류 내용:', errorText)
        }
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.warn('⚠️ 메타데이터 추출 타임아웃 (60초 초과) - 메타데이터 없이 계속 진행')
        } else {
          throw fetchError
        }
      }
    } catch (metadataError) {
      console.warn('⚠️ 메타데이터 추출 중 오류 (계속 진행):', metadataError)
    }

    // 촬영 시간이 여전히 없으면 현재 시간 사용
    if (!capture_timestamp) {
      capture_timestamp = new Date().toISOString()
      console.log('📅 촬영 시간 미지정, 현재 시간 사용')
    }

    // 촬영 날짜 파싱
    const captureDate = new Date(capture_timestamp)

    // Supabase Storage에 파일 업로드 (구간별로 분리)
    const imageUpload = await saveImageFile(imageFile, image_type, captureDate, sectionCategory)
    
    // 썸네일 생성
    const thumbnailUpload = await generateThumbnail(imageFile, image_type, captureDate, sectionCategory)

    // 파일 정보 추출
    const file_size_bytes = imageFile.size
    const file_format = imageFile.type.split('/')[1] || 'jpg'

    // DB에 이미지 정보 저장 (메타데이터 포함)
    const result = await query<ThermalImage>(
      `INSERT INTO thermal_images (
        inspection_id, image_url, thumbnail_url, 
        image_width, image_height, 
        capture_timestamp, file_size_bytes, file_format, image_type,
        camera_model
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        inspection_id,
        imageUpload.url,
        thumbnailUpload.url,
        thermal_data?.ImageWidth || null,
        thermal_data?.ImageHeight || null,
        capture_timestamp,
        file_size_bytes,
        file_format,
        image_type,
        thermal_data?.Model || thermal_data?.Make || null,
      ]
    )

    // 🔥 메타데이터를 별도 테이블에 저장 (파일 해시 포함)
    if (metadata && result.rows[0]) {
      try {
        await query(
          `INSERT INTO image_metadata (image_id, metadata_json, thermal_data_json, file_hash, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (image_id) DO UPDATE 
           SET metadata_json = $2, thermal_data_json = $3, file_hash = $4, updated_at = NOW()`,
          [
            result.rows[0].image_id,
            JSON.stringify(metadata),
            JSON.stringify(thermal_data),
            fileHash,
          ]
        )
        console.log(`✅ 메타데이터 DB 저장 완료 (image_id: ${result.rows[0].image_id})`)
      } catch (metaError) {
        // 테이블이 없으면 경고만 출력 (업로드는 성공)
        console.warn('⚠️ 메타데이터 저장 실패 (image_metadata 테이블이 없을 수 있음):', metaError)
      }
    } else if (result.rows[0]) {
      // 메타데이터가 없어도 파일 해시는 저장
      try {
        await query(
          `INSERT INTO image_metadata (image_id, file_hash, created_at, updated_at)
           VALUES ($1, $2, NOW(), NOW())
           ON CONFLICT (image_id) DO UPDATE 
           SET file_hash = $2, updated_at = NOW()`,
          [result.rows[0].image_id, fileHash]
        )
        console.log(`✅ 파일 해시 DB 저장 완료 (메타데이터 없음)`)
      } catch (hashError) {
        console.warn('⚠️ 파일 해시 저장 실패:', hashError)
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `${image_type === 'thermal' ? '열화상' : '실화상'} 이미지가 Supabase Storage에 성공적으로 업로드되었습니다.`,
        data: result.rows[0],
        metadata_extracted: !!metadata,
        thermal_data: thermal_data,
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
        error: error instanceof Error ? error.message : '이미지를 업로드하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

