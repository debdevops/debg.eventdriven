/**
 * SessionExpiredModal - Shows when session expires due to inactivity
 * Offers manual reconnect or switch namespace
 */

import { useSessionV2 } from '../contexts/SessionContextV2'
import './SessionExpiredModal.css'

interface SessionExpiredModalProps {
  isOpen: boolean
  onReconnect: () => void
  onSwitchNamespace: () => void
}

export function SessionExpiredModal({
  isOpen,
  onReconnect,
  onSwitchNamespace
}: SessionExpiredModalProps) {
  const { status } = useSessionV2()

  if (!isOpen) return null

  const isReconnecting = status === 'connecting'

  return (
    <div className="session-expired-overlay">
      <div className="session-expired-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>⏱️ Session Expired</h2>
          <p>Your session has expired due to inactivity.</p>
        </div>

        <div className="modal-body">
          <p>
            You have been inactive for more than 2 minutes. Your session has expired.
            Please reconnect to continue.
          </p>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-primary"
            onClick={onReconnect}
            disabled={isReconnecting}
            data-test="btn-reconnect"
          >
            {isReconnecting ? (
              <>
                <span className="spinner-small"></span>
                Reconnecting...
              </>
            ) : (
              '🔄 Reconnect'
            )}
          </button>
          <button
            className="btn btn-secondary"
            onClick={onSwitchNamespace}
            disabled={isReconnecting}
            data-test="btn-switch-namespace"
          >
            Switch Namespace
          </button>
        </div>
      </div>
    </div>
  )
}
