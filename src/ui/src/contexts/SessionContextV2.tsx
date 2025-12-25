/**
 * SessionContextV2 (SessionController)
 *
 * HARDENING REQUIREMENTS
 * - Single authoritative session controller.
 * - Exact state machine (no other states allowed):
 *   idle | connected | idle-warning | expired | reconnecting | failed
 * - Only this controller creates/manages timers.
 * - Reconnect is atomic and deterministic.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { apiClient } from '../api/client'
import { AuthError } from '../api/errors'

export type SessionState = 'idle' | 'connected' | 'idle-warning' | 'expired' | 'reconnecting' | 'failed'
export type SessionStatus = 'connecting' | 'connected' | 'disconnected' | 'expired' | 'auth_required'
// Injected by Vite at build/dev time via `define` in vite.config.ts.
// Avoids `import.meta.env` so Jest/Node can parse this file.
declare const __VITE_TEST_MODE__: string | undefined

export interface SessionError {
  message: string
  reason: string
  isAuthError: boolean
  statusCode?: number
  timestamp: Date
}

export interface SessionReconnectData {
  sessionId: string
  expiresAtUtc: string
  entities: any
  lastSelection: string | null
}

type TimerId = ReturnType<typeof setTimeout>

interface SessionContextType {
  sessionState: SessionState
  status: SessionStatus
  isConnected: boolean
  canInteract: boolean
  error: SessionError | null

  connectedAt: Date | null
  idleSeconds: number
  uiNowMs: number

  // In-memory-only metadata
  setConnectionString: (connectionString: string | null) => void
  setSessionMeta: (meta: { sessionId: string | null; expiresAtUtc: string | null }) => void
  setLastSelection: (selection: string | null) => void

  // Deterministic actions
  reconnect: (applyUpdates: (data: SessionReconnectData) => Promise<void>) => Promise<void>
  markExpired: (reason?: { message?: string; reason?: string; statusCode?: number }) => void
  markConnected: () => void
  markIdle: () => void
  markFailed: (message: string) => void
  resetIdle: () => void

  // Timer API (controller-owned)
  scheduleTimeout: (name: string, delayMs: number, fn: () => void) => void
  scheduleInterval: (name: string, intervalMs: number, fn: () => void) => void
  clearTimer: (name: string) => void
  clearAllTimers: () => void

  // Abort signal for non-apiClient fetch calls
  getAbortSignal: () => AbortSignal
}

const SessionContextV2 = createContext<SessionContextType | null>(null)

interface SessionProviderProps {
  children: React.ReactNode
  toast: {
    info: (msg: string) => void
    success: (msg: string) => void
    error: (msg: string) => void
    warning: (msg: string) => void
  }
}

const IDLE_EXPIRE_MS = 10 * 60 * 1000 // 10 minutes
const IDLE_WARNING_MS = IDLE_EXPIRE_MS - 30 * 1000 // warn 30s before expiry

export function SessionProviderV2({ children, toast }: SessionProviderProps) {
  const [sessionState, setSessionState] = useState<SessionState>('idle')
  const [error, setError] = useState<SessionError | null>(null)
  const [connectedAt, setConnectedAt] = useState<Date | null>(null)
  const [idleSeconds, setIdleSeconds] = useState(0)
  const [uiNowMs, setUiNowMs] = useState(() => Date.now())

  // Keep a ref so timer callbacks can reliably check current state.
  const sessionStateRef = useRef<SessionState>('idle')
  useEffect(() => {
    sessionStateRef.current = sessionState
  }, [sessionState])

  const reconnectInProgressRef = useRef(false)

  // In-memory-only metadata
  const connectionStringRef = useRef<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const expiresAtUtcRef = useRef<string | null>(null)
  const lastSelectionRef = useRef<string | null>(null)

  // Abort signal for non-apiClient fetch calls
  const abortControllerRef = useRef<AbortController>(new AbortController())

  // Controller-owned timers
  const timersRef = useRef<Map<string, TimerId>>(new Map())
  const lastActivityMsRef = useRef<number>(Date.now())

  const isConnected = sessionState !== 'idle'

  const isIdleTimerEligible = useCallback(() => {
    const s = sessionStateRef.current
    return s === 'connected' || s === 'idle-warning'
  }, [])

  const clearTimer = useCallback((name: string) => {
    const existing = timersRef.current.get(name)
    if (!existing) return
    clearTimeout(existing)
    clearInterval(existing as any)
    timersRef.current.delete(name)
  }, [])

  const scheduleTimeout = useCallback(
    (name: string, delayMs: number, fn: () => void) => {
      clearTimer(name)
      const id = setTimeout(() => {
        timersRef.current.delete(name)
        fn()
      }, delayMs)
      timersRef.current.set(name, id)
    },
    [clearTimer]
  )

  const scheduleInterval = useCallback(
    (name: string, intervalMs: number, fn: () => void) => {
      clearTimer(name)
      const id = setInterval(fn, intervalMs) as unknown as TimerId
      timersRef.current.set(name, id)
    },
    [clearTimer]
  )

  const clearAllTimers = useCallback(() => {
    for (const [name, id] of timersRef.current.entries()) {
      clearTimeout(id)
      clearInterval(id as any)
      timersRef.current.delete(name)
    }
  }, [])

  const getAbortSignal = useCallback(() => abortControllerRef.current.signal, [])

  const resetAbortController = useCallback(() => {
    try {
      abortControllerRef.current.abort('session-reset')
    } catch {
      // ignore
    }
    abortControllerRef.current = new AbortController()
  }, [])

  const setConnectionString = useCallback((connectionString: string | null) => {
    connectionStringRef.current = connectionString
  }, [])

  const setSessionMeta = useCallback((meta: { sessionId: string | null; expiresAtUtc: string | null }) => {
    sessionIdRef.current = meta.sessionId
    expiresAtUtcRef.current = meta.expiresAtUtc
  }, [])

  const setLastSelection = useCallback((selection: string | null) => {
    lastSelectionRef.current = selection
  }, [])

  const resetIdle = useCallback(() => {
    // Critical: Do NOT create any timers unless a namespace has connected successfully.
    if (!isIdleTimerEligible()) return

    lastActivityMsRef.current = Date.now()
    setIdleSeconds(0)

    scheduleTimeout('idle-warning', IDLE_WARNING_MS, () => {
      setSessionState(prev => (prev === 'connected' ? 'idle-warning' : prev))
    })

    scheduleTimeout('idle-expire', IDLE_EXPIRE_MS, () => {
      setSessionState(prev => {
        if (prev === 'connected' || prev === 'idle-warning') {
          setError({
            message: 'Session expired due to inactivity.',
            reason: 'idle',
            isAuthError: false,
            timestamp: new Date()
          })
          return 'expired'
        }
        return prev
      })
    })
  }, [scheduleTimeout])

  const markFailed = useCallback(
    (message: string) => {
      setError({ message, reason: 'failed', isAuthError: false, timestamp: new Date() })
      setSessionState('failed')
      clearAllTimers()
    },
    [clearAllTimers]
  )

  const markConnected = useCallback(() => {
    setError(null)
    setConnectedAt(new Date())
    sessionStateRef.current = 'connected'
    setSessionState('connected')
    resetIdle()
  }, [resetIdle])

  const markIdle = useCallback(() => {
    // Explicit disconnect/idle: remove ALL timers and prevent any idle->expired transitions.
    clearAllTimers()
    setError(null)
    setConnectedAt(null)
    setIdleSeconds(0)
    lastActivityMsRef.current = Date.now()

    // Clear in-memory credentials so reconnect UI isn't available from idle.
    connectionStringRef.current = null
    sessionIdRef.current = null
    expiresAtUtcRef.current = null
    lastSelectionRef.current = null

    apiClient.abortAllRequests('session-idle')
    apiClient.resetClient()
    resetAbortController()

    sessionStateRef.current = 'idle'
    setSessionState('idle')
  }, [clearAllTimers, resetAbortController])

  const markExpired = useCallback(
    (reason?: { message?: string; reason?: string; statusCode?: number }) => {
      setSessionState(prev => (prev === 'expired' ? prev : 'expired'))
      setError({
        message: reason?.message || 'Session expired. Re-authentication required.',
        reason: reason?.reason || 'unauthorized',
        isAuthError: true,
        statusCode: reason?.statusCode,
        timestamp: new Date()
      })

      clearAllTimers()
      apiClient.abortAllRequests('session-expired')
      resetAbortController()
    },
    [clearAllTimers, resetAbortController]
  )

  // Single controller integration with ApiClient.
  useEffect(() => {
    apiClient.setAuthErrorHandler(() => markExpired({ reason: 'unauthorized', statusCode: 401 }))
    apiClient.setSuccessHandler(() => {
      if (sessionState === 'connected' || sessionState === 'idle-warning') resetIdle()
    })
  }, [markExpired, resetIdle, sessionState])

  // User activity resets idle; clears idle-warning immediately.
  useEffect(() => {
    const onActivity = () => {
      lastActivityMsRef.current = Date.now()
      if (!isIdleTimerEligible()) return
      if (sessionStateRef.current === 'idle-warning') setSessionState('connected')
      resetIdle()
    }

    const events = ['mousemove', 'keydown', 'scroll', 'mousedown', 'touchstart', 'click'] as const
    events.forEach(e => document.addEventListener(e, onActivity, { passive: true }))
    const onVisibility = () => {
      if (!document.hidden) onActivity()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      events.forEach(e => document.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [resetIdle, isIdleTimerEligible])

  // Controller-owned UI tick.
  useEffect(() => {
    if (!isIdleTimerEligible()) {
      clearTimer('ui-tick')
      return
    }

    scheduleInterval('ui-tick', 1000, () => {
      setUiNowMs(Date.now())
      setIdleSeconds(Math.floor((Date.now() - lastActivityMsRef.current) / 1000))
    })
    return () => clearTimer('ui-tick')
  }, [scheduleInterval, clearTimer, isIdleTimerEligible, sessionState])

  // Schedule expiry based on expiresAtUtc.
  useEffect(() => {
    clearTimer('session-expires-at')
    const expiresAtUtc = expiresAtUtcRef.current
    if (!isIdleTimerEligible()) return
    if (!expiresAtUtc) return
    const delta = new Date(expiresAtUtc).getTime() - Date.now()
    if (Number.isFinite(delta) && delta > 0) {
      scheduleTimeout('session-expires-at', delta, () => markExpired({ reason: 'expired' }))
    }
  }, [clearTimer, scheduleTimeout, markExpired, isIdleTimerEligible])

  const status = useMemo<SessionStatus>(() => {
    const map: Record<SessionState, SessionStatus> = {
      idle: 'disconnected',
      connected: 'connected',
      'idle-warning': 'connected',
      expired: 'auth_required',
      reconnecting: 'connecting',
      failed: 'disconnected'
    }
    return map[sessionState]
  }, [sessionState])

  const canInteract = sessionState === 'connected' || sessionState === 'idle-warning'

  const reconnect = useCallback(
    async (applyUpdates: (data: SessionReconnectData) => Promise<void>) => {
      if (reconnectInProgressRef.current) return
      if (!connectionStringRef.current) {
        markFailed('Reconnect failed: missing connection string')
        return
      }

      reconnectInProgressRef.current = true
      setSessionState('reconnecting')
      setError(null)

      try {
        // 1. Abort all in-flight requests.
        apiClient.abortAllRequests('reconnect-start')
        resetAbortController()

        // 5. Clear all timers.
        clearAllTimers()

        // 6. Reset ApiClient.
        apiClient.resetClient()

        // 8. Re-authenticate.
        const connectResp = await apiClient.connect(connectionStringRef.current)

        // 9. Reload namespace/entities.
        const entities = await apiClient.listEntities(connectResp.sessionId)

        setSessionMeta({ sessionId: connectResp.sessionId, expiresAtUtc: connectResp.expiresAtUtc })
        resetIdle()

        await applyUpdates({
          sessionId: connectResp.sessionId,
          expiresAtUtc: connectResp.expiresAtUtc,
          entities,
          lastSelection: lastSelectionRef.current
        })

        // 12. Only then → connected.
        setConnectedAt(new Date())
        setSessionState('connected')
        setError(null)
        toast.success('✓ Reconnected successfully')
      } catch (err) {
        if (err instanceof AuthError) {
          markExpired({ message: err.message, reason: 'unauthorized', statusCode: 401 })
        } else {
          const msg = err instanceof Error ? err.message : 'Reconnect failed'
          markFailed(msg)
          toast.error('Reconnection failed')
        }
      } finally {
        reconnectInProgressRef.current = false
      }
    },
    [clearAllTimers, markExpired, markFailed, resetAbortController, resetIdle, setSessionMeta, toast]
  )

  // IMPORTANT: No idle/expiry timers are created on initial load.
  // Timers start only after markConnected() is called.

  useEffect(() => {
    const testMode =
      (typeof __VITE_TEST_MODE__ !== 'undefined' && __VITE_TEST_MODE__) ||
      (typeof process !== 'undefined' && (process as any).env?.VITE_TEST_MODE) ||
      'false'
    if (testMode !== 'true') return
    const handler = () => markExpired({ message: 'Forced expiry (test)', reason: 'test' })
    window.addEventListener('sb-expire-session', handler)
    return () => window.removeEventListener('sb-expire-session', handler)
  }, [markExpired])

  const value: SessionContextType = useMemo(
    () => ({
      sessionState,
      status,
      isConnected,
      canInteract,
      error,
      connectedAt,
      idleSeconds,
      uiNowMs,
      setConnectionString,
      setSessionMeta,
      setLastSelection,
      reconnect,
      markExpired,
      markConnected,
      markIdle,
      markFailed,
      resetIdle,
      scheduleTimeout,
      scheduleInterval,
      clearTimer,
      clearAllTimers,
      getAbortSignal
    }),
    [
      sessionState,
      status,
      isConnected,
      canInteract,
      error,
      connectedAt,
      idleSeconds,
      uiNowMs,
      setConnectionString,
      setSessionMeta,
      setLastSelection,
      reconnect,
      markExpired,
      markConnected,
      markIdle,
      markFailed,
      resetIdle,
      scheduleTimeout,
      scheduleInterval,
      clearTimer,
      clearAllTimers,
      getAbortSignal
    ]
  )

  return <SessionContextV2.Provider value={value}>{children}</SessionContextV2.Provider>
}

export function useSessionV2() {
  const context = useContext(SessionContextV2)
  if (!context) throw new Error('useSessionV2 must be used within SessionProviderV2')
  return context
}

export const useSession = useSessionV2
