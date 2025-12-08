/**
 * Namespace Summary Component
 */

import type { Namespace } from '../types'
import './NamespaceSummary.css'

interface NamespaceSummaryProps {
  namespace: Namespace
  onReconnect?: () => void
  reconnecting?: boolean
}

export function NamespaceSummary({ namespace }: NamespaceSummaryProps) {
  // Session info is now displayed in SessionHealthCard - no need for duplicate here
  
  return (
    <div className="namespace-summary">
      <div className="summary-stats">
        <div className="stat-item">
          <span className="stat-label">Queues</span>
          <span className="stat-value">{namespace.queues.length}</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Topics</span>
          <span className="stat-value">{namespace.topics.length}</span>
        </div>
      </div>
    </div>
  )
}
