/**
 * Session Health Card
 * Displays detailed session status in the sidebar
 */

import './SessionHealthCard.css'

interface SessionHealthCardProps {
  sessionState: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'EXPIRED'
  timeRemaining: number
  onExtend: () => void
  namespaceName: string
  extending?: boolean
}

interface StateConfig {
  color: string
  icon: string
  label: string
  showExtend: boolean
}

const stateConfig: Record<string, StateConfig> = {
  HEALTHY: {
    color: 'green',
    icon: '✓',
    label: 'Connected',
    showExtend: false
  },
  WARNING: {
    color: 'yellow',
    icon: '⚠',
    label: 'Expiring Soon',
    showExtend: true
  },
  CRITICAL: {
    color: 'orange',
    icon: '⚠',
    label: 'Expires Imminently',
    showExtend: true
  },
  EXPIRED: {
    color: 'red',
    icon: '✕',
    label: 'Expired',
    showExtend: false
  }
}

export function SessionHealthCard({ 
  sessionState, 
  timeRemaining, 
  onExtend, 
  namespaceName,
  extending = false
}: SessionHealthCardProps) {
  const formatTime = (seconds: number): string => {
    // Handle negative or zero values
    if (seconds <= 0) return 'Expired'
    
    const mins = Math.floor(seconds / 60)
    const secs = Math.max(0, seconds % 60) // Ensure secs is never negative
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const config = stateConfig[sessionState]

  return (
    <div className="session-health-card">
      <div className="session-health-header">
        <div className="session-health-namespace">
          <div className={`session-health-dot session-health-dot-${config.color}`} />
          <span className="session-health-namespace-name">{namespaceName}</span>
        </div>
        <span className={`session-health-badge session-health-badge-${config.color}`}>
          {config.label}
        </span>
      </div>

      <div className="session-health-timer">
        <span className="session-health-timer-label">Session expires in</span>
        <span className={`session-health-timer-value session-health-timer-${
          sessionState === 'CRITICAL' ? 'critical' :
          sessionState === 'WARNING' ? 'warning' :
          'normal'
        }`}>
          {formatTime(timeRemaining)}
        </span>
      </div>

      {config.showExtend && (
        <button
          onClick={onExtend}
          disabled={extending}
          className="session-health-extend-btn"
          title={extending ? 'Extending session...' : 'Reset session timer to 10 minutes'}
        >
          {extending ? (
            <>
              <span className="session-health-spinner">⟳</span>
              {' '}Extending...
            </>
          ) : (
            'Extend Session'
          )}
        </button>
      )}
    </div>
  )
}
