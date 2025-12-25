/**
 * Anomaly Badge Component
 * 
 * Displays visual indicators for anomalous messages based on applicationProperties.
 * Used in MessageTable to highlight test-generated anomalies.
 */

import './AnomalyBadge.css'

/**
 * Anomaly types and their visual configuration
 */
const ANOMALY_CONFIG: Record<string, { 
  icon: string
  label: string
  color: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}> = {
  'SUSPICIOUS_AMOUNT': {
    icon: '💰',
    label: 'Suspicious Amount',
    color: 'anomaly-high',
    severity: 'high'
  },
  'INVALID_CURRENCY': {
    icon: '💱',
    label: 'Invalid Currency',
    color: 'anomaly-medium',
    severity: 'medium'
  },
  'MISSING_REQUIRED_FIELD': {
    icon: '❓',
    label: 'Missing Field',
    color: 'anomaly-high',
    severity: 'high'
  },
  'DUPLICATE_FLAG': {
    icon: '📋',
    label: 'Duplicate',
    color: 'anomaly-low',
    severity: 'low'
  },
  'SCHEMA_VIOLATION': {
    icon: '⚠️',
    label: 'Schema Error',
    color: 'anomaly-high',
    severity: 'high'
  },
  'TIMESTAMP_ANOMALY': {
    icon: '🕐',
    label: 'Time Anomaly',
    color: 'anomaly-medium',
    severity: 'medium'
  },
  'HIGH_RETRY_COUNT': {
    icon: '🔄',
    label: 'High Retries',
    color: 'anomaly-medium',
    severity: 'medium'
  },
  'MALFORMED_PAYLOAD': {
    icon: '🔥',
    label: 'Malformed',
    color: 'anomaly-critical',
    severity: 'critical'
  },
  // UI-generated anomaly types
  'out-of-order-timestamp': {
    icon: '🕐',
    label: 'Time Anomaly',
    color: 'anomaly-medium',
    severity: 'medium'
  },
  'negative-amount': {
    icon: '💰',
    label: 'Negative Amount',
    color: 'anomaly-high',
    severity: 'high'
  },
  'unexpected-event-type': {
    icon: '❓',
    label: 'Unknown Event',
    color: 'anomaly-medium',
    severity: 'medium'
  },
  'duplicate-correlation': {
    icon: '📋',
    label: 'Duplicate',
    color: 'anomaly-low',
    severity: 'low'
  },
  'dlq-candidate': {
    icon: '☠️',
    label: 'DLQ Candidate',
    color: 'anomaly-critical',
    severity: 'critical'
  }
}

interface AnomalyBadgeProps {
  anomalyType: string
  severity?: string
  description?: string
  compact?: boolean
}

export function AnomalyBadge({ 
  anomalyType, 
  severity,
  description,
  compact = false 
}: AnomalyBadgeProps) {
  const config = ANOMALY_CONFIG[anomalyType] ?? {
    icon: '⚠️',
    label: anomalyType,
    color: 'anomaly-medium',
    severity: 'medium'
  }
  
  // Override color based on severity if provided
  const colorClass = severity 
    ? `anomaly-${severity.toLowerCase()}`
    : config.color
  
  const title = description || `${config.label}: ${anomalyType}`
  
  if (compact) {
    return (
      <span 
        className={`anomaly-badge-compact ${colorClass}`}
        title={title}
      >
        {config.icon}
      </span>
    )
  }
  
  return (
    <span 
      className={`anomaly-badge ${colorClass}`}
      title={title}
    >
      <span className="anomaly-icon">{config.icon}</span>
      <span className="anomaly-label">{config.label}</span>
    </span>
  )
}

/**
 * Extracts anomaly info from message applicationProperties
 */
export function getAnomalyInfo(applicationProperties: Record<string, unknown> | undefined): {
  isAnomaly: boolean
  anomalyType?: string
  severity?: string
  description?: string
} | null {
  if (!applicationProperties) return null
  
  // Check for backend-generated anomalies
  const isAnomaly = applicationProperties['IsAnomaly'] === true
  const anomalyType = applicationProperties['AnomalyType'] as string | undefined
  const severity = applicationProperties['AnomalySeverity'] as string | undefined
  const description = applicationProperties['AnomalyDescription'] as string | undefined
  
  // Check for UI-generated anomalies (from GenerateMessagesModal)
  const uiAnomalyType = applicationProperties['anomalyType'] as string | undefined
  const forceDlq = applicationProperties['ForceDlq'] === 'true' || applicationProperties['ForceDlq'] === true
  
  if (isAnomaly && anomalyType) {
    return { isAnomaly: true, anomalyType, severity, description }
  }
  
  if (uiAnomalyType) {
    return { 
      isAnomaly: true, 
      anomalyType: uiAnomalyType,
      severity: forceDlq ? 'critical' : 'medium'
    }
  }
  
  if (forceDlq) {
    return { isAnomaly: true, anomalyType: 'dlq-candidate', severity: 'critical' }
  }
  
  return null
}

/**
 * Check if message has any anomaly indicators
 */
export function hasAnomalyIndicator(applicationProperties: Record<string, unknown> | undefined): boolean {
  return getAnomalyInfo(applicationProperties) !== null
}
