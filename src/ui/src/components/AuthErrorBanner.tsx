/**
 * Auth Error Banner - Shown when reconnect fails due to authentication issues
 * Provides clear guidance and actionable buttons
 * Automatically disappears after successful reconnect
 */

import { useEffect, useState } from 'react'
import './AuthErrorBanner.css'

interface AuthErrorBannerProps {
  isVisible: boolean
  reason: string
  statusCode?: number
  timestamp: Date
  onReAddNamespace: () => void
}

export function AuthErrorBanner({
  isVisible,
  reason,
  statusCode,
  timestamp,
  onReAddNamespace
}: AuthErrorBannerProps) {
  const [show, setShow] = useState(isVisible)

  useEffect(() => {
    setShow(isVisible)
  }, [isVisible])

  if (!show) return null

  return (
    <div className="auth-error-banner persistent">
      <div className="auth-error-content">
        <div className="auth-error-icon">🔐</div>
        <div className="auth-error-text">
          <div className="auth-error-title">
            {reason === 'unauthorized' ? 'Session Expired' : 'Connection Error'}
          </div>
          <div className="auth-error-message">
            Your session has expired. Re-add the namespace to continue.
          </div>
          <div className="auth-error-meta">
            {statusCode && `Error ${statusCode} •`} {timestamp.toLocaleTimeString()} • {reason}
          </div>
        </div>
        <div className="auth-error-actions">
          <button 
            className="btn-auth-retry primary"
            onClick={onReAddNamespace}
            title="Open Add Namespace to re-authenticate"
          >
            Re-add Namespace
          </button>
        </div>
      </div>
    </div>
  )
}
