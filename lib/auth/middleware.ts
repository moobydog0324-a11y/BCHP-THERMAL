import { NextRequest, NextResponse } from 'next/server'
import { getSession, SessionPayload } from './session'

type AuthenticatedHandler = (
  request: NextRequest,
  context: { user: SessionPayload; params?: Record<string, string> }
) => Promise<NextResponse>

export function requireAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const resolvedParams = context?.params ? await context.params : undefined
    return handler(request, { user: session, params: resolvedParams })
  }
}

export function requireAdmin(handler: AuthenticatedHandler) {
  return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    if (session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const resolvedParams = context?.params ? await context.params : undefined
    return handler(request, { user: session, params: resolvedParams })
  }
}
