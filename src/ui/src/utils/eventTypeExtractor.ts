/**
 * Event Type Extraction Utility
 * 
 * WHY: During incidents, engineers filter by event type immediately.
 * Safely extracts eventType from message body (JSON or text).
 * Handles malformed payloads gracefully - never crashes the grid.
 */

import type { MessageEnvelope } from '../types'

export interface ExtractedEventInfo {
  eventType: string | null
  isValid: boolean
  parseError?: string
}

/**
 * Extract event type from message body with safe parsing
 */
export function extractEventType(message: MessageEnvelope): ExtractedEventInfo {
  try {
    // Try parsing as JSON
    const parsed = JSON.parse(message.body)
    
    // Common patterns for event type field (case-insensitive)
    const eventType = 
      parsed.eventType ||
      parsed.EventType ||
      parsed.event_type ||
      parsed.type ||
      parsed.Type ||
      parsed['@type'] ||
      parsed.$type ||
      null

    return {
      eventType: eventType ? String(eventType) : null,
      isValid: true
    }
  } catch (error) {
    // If JSON parsing fails, treat as text and return null
    return {
      eventType: null,
      isValid: false,
      parseError: error instanceof Error ? error.message : 'Invalid JSON'
    }
  }
}

/**
 * Get color for event type chip (deterministic based on hash)
 */
export function getEventTypeColor(eventType: string): string {
  // Simple hash function for consistent colors
  let hash = 0
  for (let i = 0; i < eventType.length; i++) {
    hash = eventType.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const colors = [
    '#60a5fa', // blue
    '#34d399', // green
    '#fbbf24', // yellow
    '#f472b6', // pink
    '#a78bfa', // purple
    '#fb923c', // orange
    '#4ade80', // emerald
    '#22d3ee', // cyan
  ]
  
  return colors[Math.abs(hash) % colors.length]
}

/**
 * Compute age distribution buckets for messages
 * 
 * WHY: Incidents often show up as age spikes.
 * Client-side bucketing is instant, clicking filters the grid.
 */
export interface AgeDistribution {
  lessThan5m: number
  between5And30m: number
  between30And120m: number
  moreThan2h: number
}

export function computeAgeDistribution(messages: MessageEnvelope[]): AgeDistribution {
  const now = Date.now()
  const buckets: AgeDistribution = {
    lessThan5m: 0,
    between5And30m: 0,
    between30And120m: 0,
    moreThan2h: 0
  }

  messages.forEach(msg => {
    const ageMinutes = (now - new Date(msg.enqueuedTimeUtc).getTime()) / 60000
    
    if (ageMinutes < 5) {
      buckets.lessThan5m++
    } else if (ageMinutes < 30) {
      buckets.between5And30m++
    } else if (ageMinutes < 120) {
      buckets.between30And120m++
    } else {
      buckets.moreThan2h++
    }
  })

  return buckets
}
