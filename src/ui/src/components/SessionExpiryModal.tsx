/**
 * Session Expiry Modal
 * Shown when session has expired - centered modal with backdrop
 */

import './SessionExpiryModal.css'

interface SessionExpiryModalProps {
  namespaceName: string
  onReconnect: () => void
  onSwitchNamespace: () => void
  isReconnecting?: boolean
}

export function SessionExpiryModal({
  namespaceName,
  onReconnect,
  onSwitchNamespace,
  isReconnecting = false
}: SessionExpiryModalProps) {
  return (
    <div className="session-expiry-backdrop" style={{ pointerEvents: 'auto' }}>
      <div 
        className="session-expiry-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-expiry-title"
        onClick={(e) => e.stopPropagation()}
        style={{ pointerEvents: 'auto', position: 'relative', zIndex: 10001 }}
      >
        <div className="session-expiry-icon">🔒</div>
        <h2 id="session-expiry-title" className="session-expiry-title">
          Session Expired
        </h2>
        <p className="session-expiry-message">
          Your connection to <strong>{namespaceName}</strong> has expired.
          Reconnect to continue working.
        </p>
        <div className="session-expiry-actions">
          <button
            className="btn-primary btn-reconnect"
            onClick={onReconnect}
            disabled={isReconnecting}
            autoFocus
          >
            {isReconnecting ? '⟳ Reconnecting...' : `Reconnect to ${namespaceName}`}
          </button>
          <button
            className="btn-secondary"
            onClick={onSwitchNamespace}
            disabled={isReconnecting}
          >
            Switch Namespace
          </button>
        </div>
      </div>
    </div>
  )
}
