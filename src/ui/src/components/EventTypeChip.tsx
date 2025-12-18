/**
 * EventType Chip Component
 * 
 * WHY: Visual event type scanning is 10x faster than reading JSON.
 * Color-coded for instant pattern recognition during incidents.
 */

import { extractEventType, getEventTypeColor } from '../utils/eventTypeExtractor'
import type { MessageEnvelope } from '../types'
import './EventTypeChip.css'

interface EventTypeChipProps {
  message: MessageEnvelope
  onClick?: () => void
}

export function EventTypeChip({ message, onClick }: EventTypeChipProps) {
  const { eventType } = extractEventType(message)
  
  if (!eventType) {
    return (
      <span className="event-type-chip unknown" title="No event type found">
        —
      </span>
    )
  }
  
  const color = getEventTypeColor(eventType)
  const displayText = eventType.length > 30 ? `${eventType.substring(0, 30)}...` : eventType
  
  return (
    <span
      className={`event-type-chip ${onClick ? 'clickable' : ''}`}
      style={{ 
        backgroundColor: `${color}20`,
        color: color,
        borderColor: `${color}40`
      }}
      onClick={onClick}
      title={eventType}
    >
      {displayText}
    </span>
  )
}
