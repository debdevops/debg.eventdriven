/**
 * useIdleDetection - Tracks user activity and idle time
 * 
 * Monitors: mousemove, keydown, scroll, mousedown, touchstart, visibilitychange
 * Returns: current idle time in seconds, activity status
 */

import { useState, useEffect, useRef, useCallback } from 'react'

interface IdleDetectionOptions {
  idleThresholdSeconds?: number // Default: 120 (2 minutes)
  warningThresholdSeconds?: number // Default: 30 (show final warning)
  onIdleStart?: () => void
  onActivity?: () => void
  onIdleWarning?: () => void
  onIdleCritical?: () => void
}

export function useIdleDetection(options: IdleDetectionOptions = {}) {
  const {
    idleThresholdSeconds = 120,
    warningThresholdSeconds = 30,
    onIdleStart,
    onActivity,
    onIdleWarning,
    onIdleCritical
  } = options

  const [idleSeconds, setIdleSeconds] = useState(0)
  const [isIdle, setIsIdle] = useState(false)
  const [isWarning, setIsWarning] = useState(false)
  const [isCritical, setIsCritical] = useState(false)

  const lastActivityRef = useRef(Date.now())
  const intervalRef = useRef<NodeJS.Timeout>()
  const hasWarned = useRef(false)
  const hasCritical = useRef(false)

  // Reset activity timer
  const resetActivity = useCallback(() => {
    const now = Date.now()
    lastActivityRef.current = now
    
    // Only trigger callbacks if state actually changed
    if (isIdle || isWarning || isCritical) {
      setIsIdle(false)
      setIsWarning(false)
      setIsCritical(false)
      setIdleSeconds(0)
      hasWarned.current = false
      hasCritical.current = false
      onActivity?.()
    }
  }, [isIdle, isWarning, isCritical, onActivity])

  // Activity event handlers
  useEffect(() => {
    const activityEvents = [
      'mousemove',
      'keydown',
      'scroll',
      'mousedown',
      'touchstart',
      'click'
    ] as const

    activityEvents.forEach(event => {
      document.addEventListener(event, resetActivity, { passive: true })
    })

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        resetActivity()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetActivity)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [resetActivity])

  // Idle timer - check every second
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const now = Date.now()
      const secondsSinceActivity = Math.floor((now - lastActivityRef.current) / 1000)
      setIdleSeconds(secondsSinceActivity)

      // Idle threshold reached
      if (secondsSinceActivity >= idleThresholdSeconds && !isIdle) {
        setIsIdle(true)
        onIdleStart?.()
      }

      // Warning threshold (e.g., 2 minutes idle = show warning)
      if (secondsSinceActivity >= idleThresholdSeconds && !hasWarned.current) {
        setIsWarning(true)
        hasWarned.current = true
        onIdleWarning?.()
      }

      // Critical threshold: idleThresholdSeconds + 30 seconds (e.g., 2 min + 30s)
      const criticalPoint = idleThresholdSeconds + warningThresholdSeconds
      if (secondsSinceActivity >= criticalPoint && !hasCritical.current) {
        setIsCritical(true)
        hasCritical.current = true
        onIdleCritical?.()
      }
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [idleThresholdSeconds, warningThresholdSeconds, isIdle, onIdleStart, onIdleWarning, onIdleCritical])

  return {
    idleSeconds,
    isIdle,
    isWarning,
    isCritical,
    resetActivity
  }
}
