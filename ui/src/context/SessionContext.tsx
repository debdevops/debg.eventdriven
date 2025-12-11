import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { connectSession, Credentials, resetClient, setCredentials } from '../services/ApiClient'

type SessionState = {
  sessionId: string | null
  idleSeconds: number
  status: 'disconnected' | 'connecting' | 'connected' | 'expiring' | 'expired'
  connect: (creds: Credentials) => Promise<void>
  reset: () => void
}

const Ctx = createContext<SessionState | undefined>(undefined)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [idleSeconds, setIdleSeconds] = useState(0)
  const [status, setStatus] = useState<SessionState['status']>('disconnected')
  const timerRef = useRef<number | null>(null)

  // Idle timers: 2:00 toast, 2:30 banner, 3:00 modal (stubbed states)
  useEffect(() => {
    if (status !== 'connected') return
    timerRef.current && window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => setIdleSeconds(s => s + 1), 1000)
    return () => { if (timerRef.current) window.clearInterval(timerRef.current) }
  }, [status])

  useEffect(() => {
    if (idleSeconds === 120) setStatus('expiring')
    if (idleSeconds >= 180) setStatus('expired')
  }, [idleSeconds])

  useEffect(() => {
    // Test hook for E2E
    ;(window as any).__TEST_FORCE_SESSION_EXPIRE = () => {
      setIdleSeconds(180)
    }
  }, [])

  const connect = async (creds: Credentials) => {
    setStatus('connecting')
    setCredentials(creds)
    const { sessionId } = await connectSession(creds)
    setSessionId(sessionId)
    setIdleSeconds(0)
    setStatus('connected')
  }

  const reset = () => {
    resetClient()
    setSessionId(null)
    setIdleSeconds(0)
    setStatus('disconnected')
  }

  const value = useMemo<SessionState>(() => ({ sessionId, idleSeconds, status, connect, reset }), [sessionId, idleSeconds, status])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
