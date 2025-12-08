/**
 * Auth Error Banner - Shown when reconnect fails due to authentication issues
 * Provides clear guidance and actionable buttons
 * Automatically disappears after successful reconnect
 */

import { useEffect, useState } from 'react'
import './AuthErrorBanner.css'

interface AuthErrorBannerProps {
  isVisible: boolean
  message: string
  reason: string
  statusCode?: number
  timestamp: Date
  onDismiss: () => void
  onRetryReconnect: () => void
  isReconnecting: boolean
}

export function AuthErrorBanner({
  isVisible,
  message,
  reason,
  statusCode,
  timestamp,
  onDismiss,
  onRetryReconnect,
  isReconnecting
}: AuthErrorBannerProps) {
  const [show, setShow] = useState(isVisible)

  useEffect(() => {
    setShow(isVisible)
  }, [isVisible])

  if (!show) return null

  return (
    <div className="auth-error-banner">
      <div className="auth-error-content">
        <div className="auth-error-icon">🔴</div>
        <div className="auth-error-text">
          <div className="auth-error-title">
            {reason === 'unauthorized' ? '🔐 Authentication Failed' : '⚠️ Session Error'}
          </div>
          <div className="auth-error-message">{message}</div>
          <div className="auth-error-meta">
            {statusCode && `[${statusCode}]`} {timestamp.toLocaleTimeString()} • {reason}
          </div>
        </div>
        <div className="auth-error-actions">
          <button 
            className="btn-auth-retry"
            onClick={onRetryReconnect}
            disabled={isReconnecting}
            title="Attempt to reconnect and refresh credentials"
          >
            {isReconnecting ? '⟳ Reconnecting...' : '🔄 Reconnect'}
          </button>
          <button 
            className="btn-auth-dismiss"
            onClick={onDismiss}
            disabled={isReconnecting}
            title="Dismiss this message"
            aria-label="Close error message"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
