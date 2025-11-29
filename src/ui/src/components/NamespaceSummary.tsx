/**
 * Namespace Summary Component
 */

import { useSessionExpiry } from '../hooks/useSessionExpiry'
import type { Namespace } from '../types'
import './NamespaceSummary.css'

interface NamespaceSummaryProps {
  namespace: Namespace
}

export function NamespaceSummary({ namespace }: NamespaceSummaryProps) {
  const { isExpired, formatTimeRemaining } = useSessionExpiry(namespace.expiresAtUtc)

  return (
    <div className="namespace-summary">
      <div className="summary-header">
        <h3>{namespace.friendlyName || 'Service Bus Namespace'}</h3>
      </div>

      <div className="summary-stats">
        <div className="stat-item">
          <span className="stat-label">Session Expires</span>
          <span className={`stat-value ${isExpired ? 'expired' : ''}`}>
            {formatTimeRemaining()}
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Queues</span>
          <span className="stat-value">{namespace.queues.length}</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Topics</span>
          <span className="stat-value">{namespace.topics.length}</span>
        </div>
      </div>

      {isExpired && (
        <div className="expiry-warning">
          ⚠️ Session expired - reconnect to continue
        </div>
      )}
    </div>
  )
}
