/**
 * MetricsPanel - Real-time Queue Health Dashboard
 * Displays active message count, DLQ count, scheduled messages, and other metrics
 * Auto-refreshes every 10 seconds (configurable)
 */

import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../config/api'
import { useSessionV2 } from '../contexts/SessionContextV2'
import './MetricsPanel.css'

interface MetricsPanelProps {
  sessionId: string
  entityName: string
  subscriptionName?: string
}

interface MetricsData {
  entityName: string
  entityType: string
  subscriptionName?: string
  activeMessageCount: number
  deadLetterMessageCount: number
  scheduledMessageCount?: number
  transferMessageCount?: number
  transferDeadLetterMessageCount?: number
  sizeInBytes?: number
  updatedAt: string
  accessedAt: string
}

export function MetricsPanel({ sessionId, entityName, subscriptionName }: MetricsPanelProps) {
  const { status, scheduleInterval, clearTimer, getAbortSignal, markExpired } = useSessionV2()
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh] = useState(true)

  const fetchMetrics = useCallback(async (silent = false) => {
    if (status !== 'connected') {
      return
    }

    try {
      if (!silent) {
        setLoading(true)
      }
      setError(null)

      const url = subscriptionName
        ? `${API_BASE_URL}/api/namespace/${sessionId}/${entityName}/metrics?subscriptionName=${subscriptionName}`
        : `${API_BASE_URL}/api/namespace/${sessionId}/${entityName}/metrics`

      const response = await fetch(url, { signal: getAbortSignal() })

      if (!response.ok) {
        // Silently ignore 401 errors during background refresh
        if (response.status === 401) {
          markExpired({ reason: 'unauthorized', statusCode: 401 })
          if (silent) return
        }
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      setMetrics(data)
      // setLastRefresh(new Date())
    } catch (err) {
      // Only show error for non-silent requests
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to fetch metrics')
      }
      console.error('Metrics fetch failed:', err)
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [sessionId, entityName, subscriptionName, status, getAbortSignal, markExpired])

  // Initial fetch
  useEffect(() => {
    if (status === 'connected') {
      fetchMetrics(false) // Not silent for initial load
    }
  }, [fetchMetrics, status])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const timerKey = `metrics-auto-refresh-${sessionId}-${entityName}-${subscriptionName || 'none'}`
    if (!autoRefresh || status !== 'connected') {
      clearTimer(timerKey)
      return
    }

    scheduleInterval(timerKey, 10000, () => {
      if (document.hidden || status !== 'connected') return
      fetchMetrics(true)
    })

    return () => clearTimer(timerKey)
  }, [autoRefresh, status, scheduleInterval, clearTimer, fetchMetrics, sessionId, entityName, subscriptionName])

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  /* const _getMetricClass = (value: number, type: string): string => {
    if (type === 'dlq' && value > 0) return 'critical'
    if (type === 'active' && value > 100) return 'warning'
    if (type === 'scheduled' && value > 0) return 'info'
    return 'success'
  } */

  if (loading && !metrics) {
    return (
      <div className="metrics-panel">
        <div className="metrics-loading">Loading metrics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="metrics-panel">
        <div className="metrics-error">
          ⚠️ Failed to load metrics: {error}
        </div>
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="metrics-panel-compact">
      <div className="metrics-inline">
        <div className="metric-inline-item">
          <span className="metric-inline-label">Active:</span>
          <span className={`metric-inline-value ${metrics.activeMessageCount > 100 ? 'warning' : 'success'}`}>
            {metrics.activeMessageCount}
          </span>
        </div>

        {/* Dead Letter */}
        <div className="metric-inline-item">
          <span className="metric-inline-label">DLQ:</span>
          <span className={`metric-inline-value ${metrics.deadLetterMessageCount > 0 ? 'critical' : 'success'}`}>
            💀 {metrics.deadLetterMessageCount}
          </span>
        </div>

        {/* Scheduled Messages */}
        {metrics.scheduledMessageCount !== undefined && (
          <div className="metric-inline-item">
            <span className="metric-inline-label">Scheduled:</span>
            <span className="metric-inline-value info">
              ⏰ {metrics.scheduledMessageCount}
            </span>
          </div>
        )}

        {/* Queue Size */}
        {metrics.sizeInBytes !== undefined && (
          <div className="metric-inline-item">
            <span className="metric-inline-label">Size:</span>
            <span className="metric-inline-value">
              {formatBytes(metrics.sizeInBytes)}
            </span>
          </div>
        )}
        
      </div>
    </div>
  )
}
