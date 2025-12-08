/**
 * SessionContext - Idle-based session management with robust reconnection
 * 
 * Features:
 * - Activity-based session (no forced timeout)
 * - 2-minute idle detection with warnings
 * - Automatic keepalive while active
 * - Comprehensive reconnect with state restoration
 * - Clean UI state management
 */

import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { useIdleDetection } from '../hooks/useIdleDetection'
import { AuthError } from '../api/errors'

type SessionStatus = 'connecting' | 'connected' | 'expired' | 'auth_required'

interface SessionError {
  message: string
  reason: string
  isAuthError: boolean
  timestamp: Date
}

interface SessionContextType {
  status: SessionStatus
  error: SessionError | null
  isIdle: boolean
  idleSeconds: number
  showIdleWarning: boolean
  showIdleCritical: boolean
  connectedAt: Date | null
  reconnect: (sessionId: string, reloadCallback: () => Promise<void>) => Promise<void>
  clearError: () => void
  resetActivity: () => void
  markExpired: () => void
  registerTimer: (name: string, timerId: NodeJS.Timeout) => void
  clearAllTimers: () => void
}

const SessionContext = createContext<SessionContextType | null>(null)

interface SessionProviderProps {
  children: React.ReactNode
  toast: {
    info: (msg: string) => void
    success: (msg: string) => void
    error: (msg: string) => void
    warning: (msg: string) => void
  }
}

const IDLE_THRESHOLD = 120 // 2 minutes
const KEEPALIVE_INTERVAL = 240000 // 4 minutes in ms

export function SessionProvider({ children, toast }: SessionProviderProps) {
  const [status, setStatus] = useState<SessionStatus>('connected')
  const [error, setError] = useState<SessionError | null>(null)
  const [connectedAt, setConnectedAt] = useState<Date | null>(new Date())
  const [showIdleWarning, setShowIdleWarning] = useState(false)
  const [showIdleCritical, setShowIdleCritical] = useState(false)
  
  const reconnectInProgressRef = useRef(false)
  const timerRegistry = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const keepaliveIntervalRef = useRef<NodeJS.Timeout>()
  const toastShownRef = useRef(false)
  const criticalShownRef = useRef(false)

  // Idle detection with callbacks
  const {
    idleSeconds,
    isIdle,
    resetActivity: resetIdleActivity
  } = useIdleDetection({
    idleThresholdSeconds: IDLE_THRESHOLD,
    warningThresholdSeconds: 30,
    onIdleStart: () => {
      console.log('[Session] User became idle')
    },
    onActivity: () => {
      console.log('[Session] User activity detected')
      setShowIdleWarning(false)
      setShowIdleCritical(false)
      toastShownRef.current = false
      criticalShownRef.current = false
    },
    onIdleWarning: () => {
      if (!toastShownRef.current) {
        console.log('[Session] Idle warning triggered')
        setShowIdleWarning(true)
        toast.warning('Session will expire soon due to inactivity')
        toastShownRef.current = true
      }
    },
    onIdleCritical: () => {
      if (!criticalShownRef.current) {
        console.log('[Session] Critical idle warning')
        setShowIdleCritical(true)
        criticalShownRef.current = true
      }
    }
  })

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const markExpired = useCallback(() => {
    setStatus('expired')
  }, [])

  const resetActivity = useCallback(() => {
    resetIdleActivity()
  }, [resetIdleActivity])

  // Register timer for cleanup
  const registerTimer = useCallback((name: string, timerId: NodeJS.Timeout) => {
    timerRegistry.current.set(name, timerId)
  }, [])

  // Clear all tracked timers
  const clearAllTimers = useCallback(() => {
    console.log(`[Session] Clearing ${timerRegistry.current.size} timers`)
    timerRegistry.current.forEach((timerId) => {
      clearInterval(timerId as any)
      clearTimeout(timerId as any)
    })
    timerRegistry.current.clear()
  }, [])

  // Keepalive heartbeat (only while active)
  useEffect(() => {
    if (status !== 'connected' || isIdle) {
      return
    }

    const sendKeepalive = async () => {
      try {
        // TODO: Implement actual keepalive endpoint if backend supports it
        // await apiClient.post('/session/keepalive')
        console.log('[Session] Keepalive heartbeat (not implemented in backend yet)')
      } catch (err) {
        console.error('[Session] Keepalive failed:', err)
      }
    }

    keepaliveIntervalRef.current = setInterval(sendKeepalive, KEEPALIVE_INTERVAL)

    return () => {
      if (keepaliveIntervalRef.current) {
        clearInterval(keepaliveIntervalRef.current)
      }
    }
  }, [status, isIdle])

  /**
   * Comprehensive reconnect with full state restoration
   */
  const reconnect = useCallback(async (
    sessionId: string, 
    reloadCallback: () => Promise<void>
  ) => {
    // Prevent duplicate reconnects
    if (reconnectInProgressRef.current || status === 'connecting') {
      console.log('[Session] Reconnect already in progress')
      return
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('[Session] RECONNECT FLOW START')
    console.log(`[Session] Session ID: ${sessionId}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    reconnectInProgressRef.current = true
    setStatus('connecting')
    setError(null)
    setShowIdleWarning(false)
    setShowIdleCritical(false)

    try {
      // Step 1: Notify user
      toast.info('Reconnecting to Service Bus...')
      console.log('[Session] Step 1: Showing progress')

      // Step 2: Clear all existing timers/intervals
      clearAllTimers()
      console.log('[Session] Step 2: Timers cleared')

      // Step 3: Brief pause for cleanup
      await new Promise(resolve => setTimeout(resolve, 150))

      // Step 4: Execute reload (namespace + entities + messages)
      console.log('[Session] Step 3: Executing full reload')
      await reloadCallback()
      console.log('[Session] ✓ Reload successful')

      // Step 5: Mark success and reset activity
      setStatus('connected')
      setError(null)
      setConnectedAt(new Date())
      resetIdleActivity()
      toastShownRef.current = false
      criticalShownRef.current = false

      console.log('[Session] Step 4: Reconnect complete')
      toast.success('Reconnected successfully')

    } catch (err) {
      console.error('[Session] ✗ RECONNECT FAILED:', err)

      // Handle auth errors
      if (err instanceof AuthError) {
        const authError: SessionError = {
          message: err.getUserFriendlyMessage(),
          reason: err.reason,
          isAuthError: true,
          timestamp: err.timestamp
        }
        
        setError(authError)
        setStatus('auth_required')
        toast.error(authError.message)
      } else {
        // Generic errors
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        const genericError: SessionError = {
          message: `Reconnect failed: ${errorMsg}`,
          reason: 'network_error',
          isAuthError: false,
          timestamp: new Date()
        }
        
        setError(genericError)
        setStatus('expired')
        toast.error(genericError.message)
      }
    } finally {
      reconnectInProgressRef.current = false
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('[Session] RECONNECT FLOW END')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }
  }, [status, toast, clearAllTimers, resetIdleActivity])

  const value: SessionContextType = {
    status,
    error,
    isIdle,
    idleSeconds,
    showIdleWarning,
    showIdleCritical,
    connectedAt,
    reconnect,
    clearError,
    resetActivity,
    markExpired,
    registerTimer,
    clearAllTimers
  }

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within SessionProvider')
  }
  return context
}
