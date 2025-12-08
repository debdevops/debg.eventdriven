/**
 * Status Dot Indicator
 * Shows connection status with color-coded dot
 * Note: Idle-based session management (no timer needed)
 */

import './StatusDot.css'

type ConnectionStatus = 'connected' | 'expired' | 'connecting'

interface StatusDotProps {
  status: ConnectionStatus
  expiresAtUtc: string | null
  namespaceName: string
  onReconnect: () => void
}

export function StatusDot({
  status,
  namespaceName,
  onReconnect
}: StatusDotProps) {
  const getTooltipText = () => {
    switch (status) {
      case 'connected':
        return `Connected to ${namespaceName}`
      case 'expired':
        return 'Session expired • Click to reconnect'
      case 'connecting':
        return 'Connecting...'
    }
  }

  const handleClick = () => {
    if (status === 'expired') {
      onReconnect()
    }
  }

  return (
    <div className="status-dot-wrapper">
      <button
        className={`status-dot-button ${status}`}
        onClick={handleClick}
        title={getTooltipText()}
        aria-label={getTooltipText()}
      >
        <span className={`status-dot ${status}`} />
      </button>
    </div>
  )
}
