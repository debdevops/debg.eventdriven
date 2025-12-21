/**
 * EventType Chip Component
 * 
 * WHY: Visual event type scanning is 10x faster than reading JSON.
 * Color-coded for instant pattern recognition during incidents.
 */

import { extractEventType } from '../utils/eventTypeExtractor'
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
  
  const displayText = eventType.length > 30 ? `${eventType.substring(0, 30)}...` : eventType

  const paletteIndex = hashToPaletteIndex(eventType)
  
  return (
    <span
      className={`event-type-chip tone-${paletteIndex} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      title={eventType}
    >
      {displayText}
    </span>
  )
}

function hashToPaletteIndex(value: string): 0 | 1 | 2 | 3 | 4 | 5 {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  const idx = Math.abs(hash) % 6
  return idx as 0 | 1 | 2 | 3 | 4 | 5
}
