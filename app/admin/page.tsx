'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppNavbar from '@/components/AppNavbar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth/AuthContext'

interface UserRow {
  user_id: number
  email: string
  name: string
  role: string
  is_active: boolean
  last_login: string | null
}

interface SyncLogRow {
  sync_id: number
  direction: string
  sheet_name: string
  rows_synced: number
  status: string
  started_at: string
  completed_at: string | null
  error_message: string | null
}

export default function AdminPage() {
  const { isAdmin, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLogRow[]>([])
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: 'user' })
  const [syncing, setSyncing] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (data.success) setUsers(data.data)
    } catch (error) {
      console.error('사용자 조회 오류:', error)
    }
  }, [])

  const fetchSyncLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/status')
      const data = await res.json()
      if (data.success) setSyncLogs(data.data)
    } catch {
      // sync API가 아직 없을 수 있음
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/')
      return
    }
    if (isAdmin) {
      fetchUsers()
      fetchSyncLogs()
    }
  }, [isAdmin, authLoading, router, fetchUsers, fetchSyncLogs])

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.name || !newUser.password) return
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      const data = await res.json()
      if (data.success) {
        setNewUser({ email: '', name: '', password: '', role: 'user' })
        fetchUsers()
      }
    } catch (error) {
      console.error('사용자 생성 오류:', error)
    }
  }

  const handleSync = async (direction: string) => {
    setSyncing(true)
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction, sheet: 'all' }),
      })
      fetchSyncLogs()
    } catch (error) {
      console.error('동기화 오류:', error)
    } finally {
      setSyncing(false)
    }
  }

  if (authLoading) return null

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="container mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">관리자 설정</h1>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 사용자 관리 */}
          <Card className="p-6">
            <h3 className="font-bold mb-4">사용자 관리</h3>

            <div className="space-y-3 mb-4 border-b pb-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">이메일</Label>
                  <Input
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="email@example.com"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">이름</Label>
                  <Input
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="홍길동"
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">비밀번호</Label>
                  <Input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">권한</Label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full h-9 rounded-md border border-input px-3 text-sm"
                  >
                    <option value="user">사용자</option>
                    <option value="admin">관리자</option>
                  </select>
                </div>
              </div>
              <Button size="sm" onClick={handleCreateUser}>사용자 추가</Button>
            </div>

            <div className="overflow-auto max-h-60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">이메일</th>
                    <th className="text-left py-2">이름</th>
                    <th className="text-left py-2">권한</th>
                    <th className="text-left py-2">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id} className="border-b">
                      <td className="py-2">{u.email}</td>
                      <td className="py-2">{u.name}</td>
                      <td className="py-2">{u.role === 'admin' ? '관리자' : '사용자'}</td>
                      <td className="py-2">{u.is_active ? '활성' : '비활성'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Google Sheets 동기화 */}
          <Card className="p-6">
            <h3 className="font-bold mb-4">Google Sheets 동기화</h3>
            <div className="flex gap-2 mb-4">
              <Button size="sm" onClick={() => handleSync('from_sheets')} disabled={syncing}>
                {syncing ? '동기화 중...' : 'Sheets → DB'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleSync('to_sheets')} disabled={syncing}>
                DB → Sheets
              </Button>
            </div>

            <h4 className="text-sm font-medium mb-2">동기화 이력</h4>
            <div className="overflow-auto max-h-60">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1">방향</th>
                    <th className="text-left py-1">시트</th>
                    <th className="text-left py-1">건수</th>
                    <th className="text-left py-1">상태</th>
                    <th className="text-left py-1">시간</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map((log) => (
                    <tr key={log.sync_id} className="border-b">
                      <td className="py-1">{log.direction === 'from_sheets' ? '← Sheets' : '→ Sheets'}</td>
                      <td className="py-1">{log.sheet_name}</td>
                      <td className="py-1">{log.rows_synced}</td>
                      <td className="py-1">
                        <span className={log.status === 'completed' ? 'text-green-500' : log.status === 'failed' ? 'text-red-500' : ''}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-1">{new Date(log.started_at).toLocaleString('ko-KR')}</td>
                    </tr>
                  ))}
                  {syncLogs.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">동기화 이력 없음</td></tr>
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
