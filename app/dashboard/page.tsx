'use client'

import { useState, useEffect } from 'react'
import AppNavbar from '@/components/AppNavbar'
import { Card } from '@/components/ui/card'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface DashboardStats {
  summary: {
    totalMarkers: number
    totalPipes: number
    maintenanceCount: number
    interestCount: number
  }
  markersByType: { marker_type: string; count: string }[]
  pipeAgeDistribution: { age_group: string; count: string }[]
  maintenanceMarkers: { tag_number: string; marker_type: string; maintenance_notes: string }[]
  maintenancePipes: { pipe_tag: string; category: string; maintenance_notes: string }[]
  interestMarkers: { tag_number: string; marker_type: string; special_notes: string }[]
  interestPipes: { pipe_tag: string; category: string; special_notes: string }[]
}

const AGE_COLORS: Record<string, string> = {
  '10년 이내': '#2ecc71',
  '10년 이상': '#f1c40f',
  '20년 이상': '#e74c3c',
  '30년 이상': '#8b0000',
  '미등록': '#95a5a6',
}

const TYPE_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#95a5a6']

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setStats(data.data)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="flex items-center justify-center h-96">
          <span className="text-muted-foreground">로딩 중...</span>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="flex items-center justify-center h-96">
          <span className="text-muted-foreground">데이터를 불러올 수 없습니다.</span>
        </div>
      </div>
    )
  }

  const pieData = stats.pipeAgeDistribution.map((d) => ({
    name: d.age_group,
    value: Number(d.count),
  }))

  const barData = stats.markersByType.map((d) => ({
    name: d.marker_type,
    수량: Number(d.count),
  }))

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />

      <main className="container mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">열배관 관리 대시보드</h1>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: '총 설비', value: stats.summary.totalMarkers, color: '#3498db' },
            { label: '총 배관', value: stats.summary.totalPipes, color: '#2ecc71' },
            { label: '정비대상', value: stats.summary.maintenanceCount, color: '#e74c3c' },
            { label: '관심구간', value: stats.summary.interestCount, color: '#f39c12' },
          ].map((item) => (
            <Card key={item.label} className="p-6">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="text-3xl font-bold mt-1" style={{ color: item.color }}>
                {item.value}
              </p>
            </Card>
          ))}
        </div>

        {/* 차트 */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h3 className="font-bold mb-4">배관 연령 분포</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={AGE_COLORS[entry.name] || '#95a5a6'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="font-bold mb-4">설비 유형별 현황</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="수량">
                  {barData.map((_, i) => (
                    <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* 정비/관심 테이블 */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="font-bold mb-4 text-red-500">정비대상 현황</h3>
            <div className="overflow-auto max-h-80">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">TAG</th>
                    <th className="text-left py-2 px-2">유형</th>
                    <th className="text-left py-2 px-2">내용</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.maintenanceMarkers.map((m) => (
                    <tr key={m.tag_number} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 font-medium">{m.tag_number}</td>
                      <td className="py-2 px-2">{m.marker_type}</td>
                      <td className="py-2 px-2">{m.maintenance_notes || '-'}</td>
                    </tr>
                  ))}
                  {stats.maintenancePipes.map((p) => (
                    <tr key={p.pipe_tag} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 font-medium">{p.pipe_tag}</td>
                      <td className="py-2 px-2">배관 ({p.category})</td>
                      <td className="py-2 px-2">{p.maintenance_notes || '-'}</td>
                    </tr>
                  ))}
                  {stats.maintenanceMarkers.length === 0 && stats.maintenancePipes.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-4 text-muted-foreground">정비대상 없음</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-bold mb-4 text-blue-500">관심구간 현황</h3>
            <div className="overflow-auto max-h-80">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">TAG</th>
                    <th className="text-left py-2 px-2">유형</th>
                    <th className="text-left py-2 px-2">내용</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.interestMarkers.map((m) => (
                    <tr key={m.tag_number} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 font-medium">{m.tag_number}</td>
                      <td className="py-2 px-2">{m.marker_type}</td>
                      <td className="py-2 px-2">{m.special_notes || '-'}</td>
                    </tr>
                  ))}
                  {stats.interestPipes.map((p) => (
                    <tr key={p.pipe_tag} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 font-medium">{p.pipe_tag}</td>
                      <td className="py-2 px-2">배관 ({p.category})</td>
                      <td className="py-2 px-2">{p.special_notes || '-'}</td>
                    </tr>
                  ))}
                  {stats.interestMarkers.length === 0 && stats.interestPipes.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-4 text-muted-foreground">관심구간 없음</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
