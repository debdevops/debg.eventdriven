/**
 * Queue Health Header
 * 
 * WHY: During incidents, engineers need instant queue health visibility.
 * Shows critical metrics without scrolling: status, active count, DLQ warnings, oldest message age.
 * Zero grid impact - renders once, updates only on message refresh.
 */

import { useMemo } from 'react'
import type { MessageEnvelope } from '../types'
import './QueueHealthHeader.css'

interface QueueHealthHeaderProps {
  messages: MessageEnvelope[]
  dlqCount: number
  entityName: string
  isDLQ?: boolean
}

type HealthStatus = 'healthy' | 'warning' | 'critical'

interface HealthMetrics {
  status: HealthStatus
  activeCount: number
  oldestAgeMinutes: number
  dlqCount: number
  statusReason: string
}

export function QueueHealthHeader({ messages, dlqCount, isDLQ }: QueueHealthHeaderProps) {
  const metrics = useMemo((): HealthMetrics => {
    const activeCount = messages.length
    
    // Calculate oldest message age
    let oldestAgeMinutes = 0
    if (messages.length > 0) {
      const oldestMsg = messages.reduce((oldest, msg) => 
        new Date(msg.enqueuedTimeUtc) < new Date(oldest.enqueuedTimeUtc) ? msg : oldest
      )
      oldestAgeMinutes = Math.floor((Date.now() - new Date(oldestMsg.enqueuedTimeUtc).getTime()) / 60000)
    }

    // Determine health status
    let status: HealthStatus = 'healthy'
    let statusReason = 'Queue operating normally'

    // Critical: Any DLQ messages (hard warning)
    if (dlqCount > 0 && !isDLQ) {
      status = 'critical'
      statusReason = `${dlqCount} failed message${dlqCount > 1 ? 's' : ''} in Dead Letter Queue require attention`
    }
    // Warning: Messages older than 2 hours
    else if (oldestAgeMinutes > 120) {
      status = 'warning'
      statusReason = `Oldest message is ${Math.floor(oldestAgeMinutes / 60)}h old - possible processing delay`
    }
    // Warning: High message backlog (>100 for production queues)
    else if (activeCount > 100) {
      status = 'warning'
      statusReason = `${activeCount} messages waiting - backlog building`
    }

    return {
      status,
      activeCount,
      oldestAgeMinutes,
      dlqCount,
      statusReason
    }
  }, [messages, dlqCount, isDLQ])

  const formatAge = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`
  }

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

  return (
    <div className={`queue-health-header ${metrics.status}`}>
      <div className="health-status-badge">
        <span className="status-icon">{statusIcon}</span>
        <span className="status-label">{statusLabel}</span>
      </div>
      
      <div className="health-metrics">
        <div className="metric">
          <span className="metric-label">Active</span>
          <span className="metric-value">{metrics.activeCount}</span>
        </div>
        
        {metrics.oldestAgeMinutes > 0 && (
          <div className="metric">
            <span className="metric-label">Oldest</span>
            <span className="metric-value">{formatAge(metrics.oldestAgeMinutes)}</span>
          </div>
        )}
        
        {!isDLQ && (
          <div className={`metric ${metrics.dlqCount > 0 ? 'critical' : ''}`}>
            <span className="metric-label">DLQ</span>
            <span className="metric-value">{metrics.dlqCount}</span>
          </div>
        )}
      </div>
      
      <div className="health-reason">
        <span className="reason-text">{metrics.statusReason}</span>
      </div>
    </div>
  )
}
