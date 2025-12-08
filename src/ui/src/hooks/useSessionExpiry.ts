/**
 * Hook to track session expiry countdown with 3-stage warnings
 * Stage 1: Toast notification at 2 minutes remaining
 * Stage 2: Banner warning at 30 seconds remaining
 * Stage 3: Modal dialog when expired
 */

import { useEffect, useState, useRef } from 'react'

export type ExpiryStage = 'none' | 'toast' | 'banner' | 'expired'

export function useSessionExpiry(expiresAtUtc: string | null) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isExpired, setIsExpired] = useState(false)
  const [stage, setStage] = useState<ExpiryStage>('none')
  
  // Track if we've already shown warnings to avoid duplicates
  const toastShownRef = useRef(false)
  const bannerShownRef = useRef(false)
  const modalShownRef = useRef(false)

  useEffect(() => {
    if (!expiresAtUtc) {
      setTimeRemaining(null)
      setIsExpired(false)
      setStage('none')
      toastShownRef.current = false
      bannerShownRef.current = false
      return
    }

    const updateTimer = () => {
      const now = new Date().getTime()
      const expiryTime = new Date(expiresAtUtc).getTime()
      const remaining = expiryTime - now

      setTimeRemaining(remaining)

      if (remaining <= 0) {
        // Session expired
        setIsExpired(true)
        if (!modalShownRef.current) {
          setStage('expired')
          modalShownRef.current = true
        }
      } else {
        setIsExpired(false)
        modalShownRef.current = false
        
        // Determine stage based on time remaining
        if (remaining <= 30000) {
          // 30 seconds or less - show banner (stage stays at banner once set)
          if (!bannerShownRef.current) {
            setStage('banner')
            bannerShownRef.current = true
          }
        } else if (remaining <= 120000) {
          // 2 minutes or less - show toast once, then clear stage
          if (!toastShownRef.current) {
            setStage('toast')
            toastShownRef.current = true
          } else if (stage === 'toast') {
            // Clear toast stage after it's been triggered
            setStage('none')
          }
        } else {
          // More than 2 minutes - healthy state, reset all flags
          setStage('none')
          toastShownRef.current = false
          bannerShownRef.current = false
        }
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [expiresAtUtc])

  const formatTimeRemaining = (): string => {
    if (timeRemaining === null) return '--'
    if (timeRemaining <= 0) return 'Expired'

    const minutes = Math.floor(timeRemaining / 60000)
    const seconds = Math.floor((timeRemaining % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const getStatusType = (): 'connected' | 'expiring' | 'expired' | 'connecting' => {
    if (isExpired) return 'expired'
    if (timeRemaining && timeRemaining <= 120000) return 'expiring' // 2 minutes
    return 'connected'
  }

  return { 
    timeRemaining, 
    isExpired, 
    formatTimeRemaining,
    stage,
    statusType: getStatusType()
  }
}
