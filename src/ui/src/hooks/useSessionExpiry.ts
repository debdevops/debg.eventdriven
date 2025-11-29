/**
 * Hook to track session expiry countdown
 */

import { useEffect, useState } from 'react'

export function useSessionExpiry(expiresAtUtc: string | null) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    if (!expiresAtUtc) {
      setTimeRemaining(null)
      setIsExpired(false)
      return
    }

    const updateTimer = () => {
      const now = new Date().getTime()
      const expiryTime = new Date(expiresAtUtc).getTime()
      const remaining = expiryTime - now

      if (remaining <= 0) {
        setTimeRemaining(0)
        setIsExpired(true)
      } else {
        setTimeRemaining(remaining)
        setIsExpired(false)
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

  return { timeRemaining, isExpired, formatTimeRemaining }
}
