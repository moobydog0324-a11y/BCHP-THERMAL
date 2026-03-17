import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET() {
  try {
    const [
      markerStats,
      pipeStats,
      maintenanceMarkers,
      interestMarkers,
      pipeAgeDistribution,
      maintenancePipes,
      interestPipes,
    ] = await Promise.all([
      // 설비 유형별 통계
      query(`
        SELECT marker_type, COUNT(*) as count
        FROM markers
        GROUP BY marker_type
        ORDER BY count DESC
      `),
      // 배관 총 개수
      query('SELECT COUNT(*) as total FROM bap_pipes'),
      // 정비대상 마커
      query(`
        SELECT tag_number, marker_type, lat, lng, maintenance_notes
        FROM markers WHERE is_maintenance = TRUE
        ORDER BY updated_at DESC LIMIT 20
      `),
      // 관심구간 마커
      query(`
        SELECT tag_number, marker_type, lat, lng, special_notes
        FROM markers WHERE is_interest = TRUE
        ORDER BY updated_at DESC LIMIT 20
      `),
      // 배관 연령 분포
      query(`
        SELECT
          CASE
            WHEN replacement_year IS NULL THEN '미등록'
            WHEN EXTRACT(YEAR FROM NOW()) - replacement_year >= 30 THEN '30년 이상'
            WHEN EXTRACT(YEAR FROM NOW()) - replacement_year >= 20 THEN '20년 이상'
            WHEN EXTRACT(YEAR FROM NOW()) - replacement_year >= 10 THEN '10년 이상'
            ELSE '10년 이내'
          END as age_group,
          COUNT(*) as count
        FROM bap_pipes
        GROUP BY age_group
        ORDER BY count DESC
      `),
      // 정비대상 배관
      query(`
        SELECT pipe_tag, category, lat1, lng1, lat2, lng2, maintenance_notes
        FROM bap_pipes WHERE is_maintenance = TRUE
        ORDER BY updated_at DESC LIMIT 20
      `),
      // 관심구간 배관
      query(`
        SELECT pipe_tag, category, lat1, lng1, lat2, lng2, special_notes
        FROM bap_pipes WHERE is_interest = TRUE
        ORDER BY updated_at DESC LIMIT 20
      `),
    ])

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalMarkers: markerStats.rows.reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.count), 0),
          totalPipes: Number(pipeStats.rows[0]?.total || 0),
          maintenanceCount: maintenanceMarkers.rowCount! + maintenancePipes.rowCount!,
          interestCount: interestMarkers.rowCount! + interestPipes.rowCount!,
        },
        markersByType: markerStats.rows,
        pipeAgeDistribution: pipeAgeDistribution.rows,
        maintenanceMarkers: maintenanceMarkers.rows,
        interestMarkers: interestMarkers.rows,
        maintenancePipes: maintenancePipes.rows,
        interestPipes: interestPipes.rows,
      },
    })
  } catch (error) {
    console.error('대시보드 통계 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '통계 데이터를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
