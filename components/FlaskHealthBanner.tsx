"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

type HealthStatus = 'ok' | 'degraded' | 'down' | 'checking'

export function FlaskHealthBanner() {
  const [status, setStatus] = useState<HealthStatus>('checking')
  const [message, setMessage] = useState<string>('Flask 서버 상태 확인 중...')
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const checkHealth = async () => {
    try {
      const response = await fetch('/api/flask/health')
      const data = await response.json()

      if (data.success) {
        const health = data.health
        setStatus(health.status)
        
        switch (health.status) {
          case 'ok':
            setMessage('✅ Flask 서버가 정상 작동 중입니다. 메타데이터 자동 추출을 사용할 수 있습니다.')
            break
          case 'degraded':
            setMessage('⚠️ Flask 서버가 제한적으로 작동 중입니다. 일부 기능이 느리거나 불안정할 수 있습니다.')
            break
          case 'down':
            setMessage('❌ Flask 서버에 연결할 수 없습니다. 메타데이터 자동 추출 기능을 사용할 수 없습니다.')
            break
        }
        
        setLastChecked(new Date())
      } else {
        setStatus('down')
        setMessage('❌ Flask 서버 상태를 확인할 수 없습니다.')
      }
    } catch (error) {
      setStatus('down')
      setMessage('❌ Flask 서버에 연결할 수 없습니다. 메타데이터 자동 추출 기능을 사용할 수 없습니다.')
    }
  }

  useEffect(() => {
    checkHealth()
    
    // 1분마다 자동 체크
    const interval = setInterval(checkHealth, 60000)
    
    return () => clearInterval(interval)
  }, [])

  // 정상 상태이거나 체크 중이면 배너 숨김
  if (status === 'ok' || status === 'checking') {
    return null
  }

  const statusConfig = {
    degraded: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-500',
      textColor: 'text-yellow-900 dark:text-yellow-100',
      iconColor: 'text-yellow-600'
    },
    down: {
      icon: XCircle,
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-500',
      textColor: 'text-red-900 dark:text-red-100',
      iconColor: 'text-red-600'
    }
  }

  const config = statusConfig[status as 'degraded' | 'down']
  if (!config) return null

  const Icon = config.icon

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border-2 p-4 mb-6`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 ${config.iconColor} flex-shrink-0`} />
        
        <div className="flex-1">
          <p className={`text-sm font-medium ${config.textColor}`}>
            {message}
          </p>
          
          {status === 'down' && (
            <p className={`text-xs mt-2 ${config.textColor} opacity-80`}>
              💡 Flask 서버 없이도 업로드는 가능하지만, GPS와 온도 정보가 자동으로 추출되지 않습니다.
              <br />
              서버를 시작하려면: <code className="bg-black/10 px-1 rounded">cd python-backend && python app.py</code>
            </p>
          )}
          
          {lastChecked && (
            <p className={`text-xs mt-2 ${config.textColor} opacity-60`}>
              마지막 확인: {lastChecked.toLocaleTimeString('ko-KR')}
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={checkHealth}
          className={config.textColor}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}



