/**
 * Queue Health Header
 *
 * WHY: During incidents, engineers need instant queue health visibility.
 * Shows critical metrics without scrolling: status, active count, DLQ warnings, oldest message age, anomaly count.
 * Zero grid impact - renders once, updates only on message refresh.
 */

import { useMemo } from 'react'
import type { MessageEnvelope } from '../../types'
import { computeDlqHealth, formatAgeMinutes } from '../../utils/dlqHealth'
import { getAnomalyInfo } from '../../components/AnomalyBadge'
import './QueueHealthHeader.css'

interface QueueHealthHeaderProps {
  messages: MessageEnvelope[]
  dlqCount: number
  activeCount: number
  oldestDlqEnqueuedTimeUtc?: string | null
  sampledDlqMessages?: MessageEnvelope[] | null
  entityName: string
  isDLQ?: boolean
}

type HealthStatus = 'healthy' | 'warning' | 'critical'

interface HealthMetrics {
  status: HealthStatus
  activeCount: number
  dlqCount: number
  oldestDlqAgeMinutes: number | null
  statusReason: string
  whyTooltip: string
  anomalyCount: number
}

export function QueueHealthHeader({ messages, dlqCount, activeCount, oldestDlqEnqueuedTimeUtc, sampledDlqMessages, isDLQ }: QueueHealthHeaderProps) {
  const metrics = useMemo((): HealthMetrics => {
    const dlqHealth = computeDlqHealth({
      dlqCount,
      activeCount,
      oldestDlqEnqueuedTimeUtc,
      sampledDlqMessages: sampledDlqMessages ?? (isDLQ ? messages : null)
    })

    // Count messages with anomaly indicators
    const anomalyCount = messages.filter(m => {
      const info = getAnomalyInfo(m.applicationProperties)
      return info?.isAnomaly
    }).length

    const status: HealthStatus = dlqHealth.severity === 'HEALTHY'
      ? 'healthy'
      : dlqHealth.severity === 'WARNING'
        ? 'warning'
        : 'critical'

    const statusReason = dlqHealth.why

    return {
      status,
      activeCount,
      dlqCount,
      oldestDlqAgeMinutes: dlqHealth.oldestDlqAgeMinutes,
      statusReason,
      whyTooltip: dlqHealth.whyTooltip,
      anomalyCount
    }
  }, [messages, dlqCount, activeCount, oldestDlqEnqueuedTimeUtc, sampledDlqMessages, isDLQ])

  const statusIcon = {
    healthy: '✓',
    warning: '⚠',
    critical: '✕'
  }[metrics.status]

  const statusLabel = {
    healthy: 'Healthy',
    warning: 'Warning',
    critical: 'Critical'
  }[metrics.status]

  const dlqMetricClass = metrics.status === 'critical' ? 'critical' : metrics.status === 'warning' ? 'warning' : ''

  return (
    <div className={`queue-health-header ${metrics.status}`} title={metrics.whyTooltip}>
      <div className="health-status-badge">
        <span className="status-icon">{statusIcon}</span>
        <span className="status-label">{statusLabel}</span>
      </div>

      <div className="health-metrics">
        <div className="metric">
          <span className="metric-label">Active</span>
          <span className="metric-value">{metrics.activeCount}</span>
        </div>

        {!isDLQ && (
          <div className={`metric ${dlqMetricClass}`}>
            <span className="metric-label">DLQ</span>
            <span className="metric-value">{metrics.dlqCount}</span>
          </div>
        )}

        {metrics.oldestDlqAgeMinutes !== null && (
          <div className="metric">
            <span className="metric-label">Oldest DLQ</span>
            <span className="metric-value">{formatAgeMinutes(metrics.oldestDlqAgeMinutes)}</span>
          </div>
        )}

        {/* Anomaly count indicator */}
        {metrics.anomalyCount > 0 && (
          <div className="metric anomaly-metric" title={`${metrics.anomalyCount} messages with anomaly indicators detected`}>
            <span className="metric-label">⚠️ Anomalies</span>
            <span className="metric-value anomaly-value">{metrics.anomalyCount}</span>
          </div>
        )}
      </div>

      <div className="health-reason">
        <span className="reason-text">{metrics.statusReason}</span>
      </div>
    </div>
  )
}
