/**
 * SessionStatusIndicator - Single unified session status component
 * Shows: Namespace • Status • Active time
 * Replaces all redundant session indicators across the app
 */

import { useMemo } from 'react'
import './SessionStatusIndicator.css'

interface SessionStatusIndicatorProps {
  namespaceName: string
  connectedAt: Date
  isConnected: boolean
  isExpired?: boolean
  uiNowMs?: number
}

export function SessionStatusIndicator({ 
  namespaceName, 
  connectedAt, 
  isConnected,
  isExpired = false,
  uiNowMs
}: SessionStatusIndicatorProps) {
  const activeTime = useMemo(() => {
    if (!isConnected || isExpired) return '00:00:00'
    const now = uiNowMs ?? Date.now()
    const elapsed = Math.max(0, Math.floor((now - connectedAt.getTime()) / 1000))

    const hours = Math.floor(elapsed / 3600)
    const minutes = Math.floor((elapsed % 3600) / 60)
    const seconds = elapsed % 60

    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0')
    ].join(':')
  }, [uiNowMs, connectedAt, isConnected, isExpired])

  const getStatusLabel = () => {
    if (isExpired) return 'Expired'
    if (!isConnected) return 'Connecting...'
    return 'Connected'
  }

  const getStatusClass = () => {
    if (isExpired) return 'status-expired'
    if (!isConnected) return 'status-connecting'
    return 'status-connected'
  }

  return (
    <div className="session-status-indicator">
      <div className="namespace-name" title={namespaceName}>
        {namespaceName}
      </div>
      <div className="separator">•</div>
      <div className={`status-label ${getStatusClass()}`}>
        <span className={`status-dot ${getStatusClass()}`} />
        {getStatusLabel()}
      </div>
      {isConnected && !isExpired && (
        <>
          <div className="separator">•</div>
          <div className="active-time">
            Active {activeTime}
          </div>
        </>
      )}
    </div>
  )
}
