/**
 * EntityCard Component - Vibrant card-based entity display
 * Gradient backgrounds, message count badges, pulsing status indicators
 */

import './EntityCard.css'

interface EntityCardProps {
  name: string
  type: 'queue' | 'topic' | 'subscription'
  messageCount: number
  isSelected: boolean
  isDLQ: boolean
  onSelect: () => void
  subscriptionCount?: number
  isExpanded?: boolean
  isTemp?: boolean
  hasWarning?: boolean
}

export default function EntityCard({
  name,
  type,
  messageCount,
  isSelected,
  isDLQ,
  onSelect,
  subscriptionCount,
  isExpanded,
  isTemp,
  hasWarning: _hasWarning
}: EntityCardProps) {
  const getGradientClass = (): string => {
    if (isDLQ) return 'entity-card-dlq'
    
    switch (type) {
      case 'queue':
        return 'entity-card-queue'
      case 'topic':
        return 'entity-card-topic'
      case 'subscription':
        return 'entity-card-subscription'
      default:
        return 'entity-card-default'
    }
  }

  const getIcon = (): string => {
    if (isDLQ) return '💀'
    
    switch (type) {
      case 'queue':
        return '📥'
      case 'topic':
        return '📢'
      case 'subscription':
        return '🔔'
      default:
        return '📋'
    }
  }

  return (
    <div
      onClick={onSelect}
      className={`entity-card ${getGradientClass()} ${isSelected ? 'entity-card-selected' : ''} ${isExpanded ? 'entity-card-expanded' : ''}`}
      title={name}
    >
      {isSelected && (
        <span className="entity-card-selected-badge" aria-label="Selected">✓</span>
      )}
      {/* Message count badge */}
      {messageCount > 0 && (
        <div className="entity-card-badge">
          {messageCount}
        </div>
      )}

      {/* Icon and name */}
      <div className="entity-card-content">
        <span className="entity-card-icon">{getIcon()}</span>
        <h3 className="entity-card-name">{name}</h3>
      </div>

      {/* Footer with badges */}
      <div className="entity-card-footer">
        {subscriptionCount !== undefined && (
          <span className="entity-card-sub-badge">
            🔔 {subscriptionCount}
          </span>
        )}
        {isTemp && (
          <span className="entity-card-temp-badge" title="Temporary (auto-deletes in 15min)">
            ⏱️
          </span>
        )}
        {isExpanded !== undefined && (
          <span className="entity-card-expand-icon">
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
      </div>
    </div>
  )
}
