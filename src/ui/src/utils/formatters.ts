/**
 * Utility functions for formatting data
 */

/**
 * Format UTC timestamp to local readable string
 */
export function formatTimestamp(utcString: string): string {
  try {
    const date = new Date(utcString)
    return date.toLocaleString()
  } catch {
    return utcString
  }
}

/**
 * Format timestamp as relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(utcString: string): string {
  try {
    const date = new Date(utcString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  } catch {
    return utcString
  }
}

/**
 * Truncate long strings with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength) + '...'
}

/**
 * Format JSON with pretty print
 */
export function formatJSON(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

/**
 * Parse message body (handles JSON or plain text)
 */
export function parseMessageBody(body: string): { formatted: string; isJson: boolean } {
  try {
    const parsed = JSON.parse(body)
    return { formatted: JSON.stringify(parsed, null, 2), isJson: true }
  } catch {
    return { formatted: body, isJson: false }
  }
}
