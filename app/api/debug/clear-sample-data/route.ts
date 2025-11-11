import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

/**
 * POST /api/debug/clear-sample-data
 * 샘플 데이터(가짜 데이터) 삭제
 * ⚠️ 주의: 이 작업은 되돌릴 수 없습니다!
 */
export async function POST() {
  try {
    // 트랜잭션으로 모든 데이터 삭제
    await query('BEGIN')

    // 1. 온도 데이터 삭제
    const tempResult = await query('DELETE FROM temperature_readings')
    
    // 2. 분석 포인트 삭제
    const pointsResult = await query('DELETE FROM analysis_points')
    
    // 3. 결함 예측 삭제
    const defectsResult = await query('DELETE FROM defect_predictions')
    
    // 4. 이미지 삭제
    const imagesResult = await query('DELETE FROM thermal_images')
    
    // 5. 점검 삭제
    const inspectionsResult = await query('DELETE FROM inspections')
    
    // 6. 배관 삭제
    const pipesResult = await query('DELETE FROM pipes')

    await query('COMMIT')

    return NextResponse.json({
      success: true,
      message: '✅ 모든 데이터가 삭제되었습니다.',
      deleted: {
        temperature_readings: tempResult.rowCount,
        analysis_points: pointsResult.rowCount,
        defect_predictions: defectsResult.rowCount,
        thermal_images: imagesResult.rowCount,
        inspections: inspectionsResult.rowCount,
        pipes: pipesResult.rowCount,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    await query('ROLLBACK')
    console.error('데이터 삭제 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '데이터 삭제 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/debug/clear-sample-data
 * 삭제 가능한 데이터 개수 확인
 */
export async function GET() {
  try {
    const pipesResult = await query('SELECT COUNT(*) FROM pipes')
    const inspectionsResult = await query('SELECT COUNT(*) FROM inspections')
    const imagesResult = await query('SELECT COUNT(*) FROM thermal_images')

    return NextResponse.json({
      success: true,
      data: {
        pipes: parseInt(pipesResult.rows[0].count),
        inspections: parseInt(inspectionsResult.rows[0].count),
        thermal_images: parseInt(imagesResult.rows[0].count),
      },
      message: '⚠️ POST 요청으로 모든 데이터를 삭제할 수 있습니다.',
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



