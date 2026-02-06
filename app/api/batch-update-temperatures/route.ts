import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

const FLASK_SERVER = process.env.FLASK_SERVER_URL || 'http://localhost:5001'

/**
 * POST /api/batch-update-temperatures
 * 모든 이미지의 온도 데이터를 일괄 재추출
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { batch_size = 10, auto_continue = true } = body // 배치 크기와 자동 계속 여부

    console.log('🔄 온도 데이터 일괄 재추출 시작...')

    // 1. 온도 데이터가 없는 이미지 조회 (전체)
    const result = await query(`
      SELECT 
        ti.image_id,
        ti.image_url,
        ti.section_category,
        im.thermal_data_json
      FROM thermal_images ti
      LEFT JOIN image_metadata im ON ti.image_id = im.image_id
      WHERE ti.image_type = 'thermal'
      ORDER BY ti.image_id ASC
    `)

    const allImages = result.rows.filter(row => {
      const thermalData = row.thermal_data_json
      return !thermalData || !thermalData.actual_temp_stats
    })

    console.log(`📊 전체 대상: ${allImages.length}개 이미지`)

    // 배치 크기만큼만 처리
    const images = allImages.slice(0, batch_size)

    console.log(`📊 처리 대상: ${images.length}개 이미지`)

    if (images.length === 0) {
      return NextResponse.json({
        success: true,
        message: '모든 이미지가 이미 처리되었습니다.',
        processed: 0,
        failed: 0,
        total: 0
      })
    }

    // 2. 각 이미지 처리
    let processed = 0
    let failed = 0
    const results = []

    for (const img of images) {
      try {
        console.log(`  [${processed + failed + 1}/${images.length}] 처리 중: ${img.image_id}`)

        // 이미지 다운로드
        const imageResponse = await fetch(img.image_url, {
          signal: AbortSignal.timeout(30000)
        })

        if (!imageResponse.ok) {
          throw new Error(`이미지 다운로드 실패: ${imageResponse.status}`)
        }

        const imageBlob = await imageResponse.blob()
        const imageFile = new File([imageBlob], `temp_${img.image_id}.jpg`, { type: 'image/jpeg' })

        // Flask 서버로 분석 요청
        const formData = new FormData()
        formData.append('file', imageFile)

        const flaskResponse = await fetch(`${FLASK_SERVER}/analyze`, {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(90000)
        })

        if (!flaskResponse.ok) {
          throw new Error(`Flask 분석 실패: ${flaskResponse.status}`)
        }

        const analysisResult = await flaskResponse.json()

        if (analysisResult.success) {
          const metadata = analysisResult.metadata
          const thermalData = analysisResult.thermal_data

          // DB 업데이트 - metadata_json과 thermal_data_json 모두 저장
          await query(
            `INSERT INTO image_metadata (image_id, metadata_json, thermal_data_json, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             ON CONFLICT (image_id) 
             DO UPDATE SET 
               metadata_json = $2,
               thermal_data_json = $3,
               updated_at = NOW()`,
            [img.image_id, JSON.stringify(metadata || {}), JSON.stringify(thermalData || {})]
          )

          const stats = thermalData?.actual_temp_stats
          const hasGPS = metadata?.GPSLatitude && metadata?.GPSLongitude

          if (stats || hasGPS) {
            const message = []
            if (stats) message.push(`${stats.min_temp}°C ~ ${stats.max_temp}°C`)
            if (hasGPS) message.push('GPS ✓')

            console.log(`  ✅ 완료: ${message.join(', ')}`)
            results.push({
              image_id: img.image_id,
              section: img.section_category,
              success: true,
              min_temp: stats?.min_temp,
              max_temp: stats?.max_temp,
              avg_temp: stats?.avg_temp,
              has_gps: hasGPS
            })
          } else {
            console.log(`  ⚠️ 온도/GPS 데이터 없음`)
            results.push({
              image_id: img.image_id,
              section: img.section_category,
              success: false,
              error: '온도/GPS 데이터 없음'
            })
            failed++
          }

          processed++
        } else {
          throw new Error('분석 실패')
        }

      } catch (error) {
        console.error(`  ❌ 오류: ${img.image_id}`, error)
        results.push({
          image_id: img.image_id,
          section: img.section_category,
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        })
        failed++
      }

      // 서버 부하 방지를 위한 짧은 대기
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    console.log(`✅ 완료: ${processed}개 성공, ${failed}개 실패`)

    // 남은 이미지 개수 확인
    const remaining = allImages.length - images.length

    return NextResponse.json({
      success: true,
      message: `${processed}개 이미지 처리 완료`,
      processed,
      failed,
      total: images.length,
      total_pending: allImages.length,
      remaining: remaining,
      has_more: remaining > 0,
      results
    })

  } catch (error) {
    console.error('일괄 처리 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/batch-update-temperatures
 * 처리 대상 이미지 개수 조회
 */
export async function GET() {
  try {
    const result = await query(`
      SELECT COUNT(*) as count
      FROM thermal_images ti
      LEFT JOIN image_metadata im ON ti.image_id = im.image_id
      WHERE ti.image_type = 'thermal'
        AND (im.thermal_data_json IS NULL 
             OR im.thermal_data_json::jsonb->>'actual_temp_stats' IS NULL)
    `)

    const count = parseInt(result.rows[0].count)

    return NextResponse.json({
      success: true,
      pending_count: count,
      message: `${count}개 이미지가 온도 데이터 추출 대기 중입니다.`
    })

  } catch (error) {
    console.error('개수 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

