/**
 * AI Insights Inspector - Tabbed interface with grids
 * Shows Overview, Patterns, and Anomalies in inspector format
 */

import { useState, useMemo } from 'react'
import { Pagination } from './Pagination'
import { apiClient } from '../api/client'
import type { MessageEnvelope } from '../types'
import './AiInsightsInspector.css'

interface MessageCluster {
  eventType: string
  size: number
  sampleMessage: any
  commonFields: string[]
}

interface Outlier {
  messageId: string
  eventType: string
  anomalyType: string
  description: string
  source: string
  correlationId?: string
  severity?: string
}

interface Analysis {
  source: string
  totalMessages: number
  clusters: MessageCluster[]
  outliers: Outlier[]
  processingTimeMs: number
}

interface AiInsightsData {
  activeQueueAnalysis?: Analysis | null
  dlqAnalysis?: Analysis | null
  summary: string
  analyzedAt: string
}

interface AiInsightsInspectorProps {
  aiInsights: AiInsightsData
  sessionId: string
  entityName: string
  subscriptionName?: string
  isDLQ?: boolean
  onMessageSelect?: (message: MessageEnvelope) => void
  onRefresh?: () => void
}

type TabType = 'overview' | 'patterns' | 'anomalies'

export function AiInsightsInspector({
  aiInsights,
  sessionId,
  entityName,
  subscriptionName,
  isDLQ,
  onMessageSelect,
  onRefresh
}: AiInsightsInspectorProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [patternPage, setPatternPage] = useState(1)
  const [patternPageSize, setPatternPageSize] = useState(50)
  const [anomalyPage, setAnomalyPage] = useState(1)
  const [anomalyPageSize, setAnomalyPageSize] = useState(50)
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null)

  // Helper functions (must be defined before useMemo)
  const getSeverity = (anomalyType?: string | null): string => {
    const type = (anomalyType || '').toLowerCase()
    if (!type) return 'Medium'
    if (type.includes('missing_field')) return 'High'
    if (type.includes('invalid_value')) return 'High'
    if (type.includes('type_mismatch')) return 'Medium'
    if (type.includes('duplicate')) return 'Low'
    return 'Medium'
  }

  const getSeverityClass = (severity: string): string => {
    switch (severity) {
      case 'High': return 'severity-high'
      case 'Medium': return 'severity-medium'
      case 'Low': return 'severity-low'
      default: return 'severity-medium'
    }
  }

  const normalizeCommonFields = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.filter(v => typeof v === 'string') as string[]
    if (typeof value === 'string') return value ? [value] : []
    return []
  }

  const safeStringify = (value: unknown): string => {
    try {
      if (typeof value === 'string') return value
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }

  const normalizeCluster = (cluster: any, source: string): (MessageCluster & { source: string }) => {
    return {
      eventType: cluster?.eventType || 'Unknown',
      size: typeof cluster?.size === 'number' ? cluster.size : Number(cluster?.size || 0),
      sampleMessage: cluster?.sampleMessage ?? null,
      commonFields: normalizeCommonFields(cluster?.commonFields),
      source
    }
  }

  // Combine all clusters
  const allClusters = useMemo(() => {
    const clusters: (MessageCluster & { source: string })[] = []
    
    if (aiInsights.activeQueueAnalysis?.clusters) {
      clusters.push(...aiInsights.activeQueueAnalysis.clusters.map((c: any) => normalizeCluster(c, 'Active Queue')))
    }
    
    if (aiInsights.dlqAnalysis?.clusters) {
      clusters.push(...aiInsights.dlqAnalysis.clusters.map((c: any) => normalizeCluster(c, 'DLQ')))
    }
    
    return clusters.sort((a, b) => b.size - a.size)
  }, [aiInsights])

  // Combine all outliers
  const allOutliers = useMemo(() => {
    const outliers: Outlier[] = []
    
    if (aiInsights.activeQueueAnalysis?.outliers) {
      outliers.push(...aiInsights.activeQueueAnalysis.outliers.map(o => ({
        ...o,
        source: o.source || 'Active Queue',
        anomalyType: o.anomalyType || 'unknown',
        severity: getSeverity(o.anomalyType),
        correlationId: o.correlationId || 'N/A',
        description: o.description || 'No description'
      })))
    }
    
    if (aiInsights.dlqAnalysis?.outliers) {
      outliers.push(...aiInsights.dlqAnalysis.outliers.map(o => ({
        ...o,
        source: o.source || 'DLQ',
        anomalyType: o.anomalyType || 'unknown',
        severity: getSeverity(o.anomalyType),
        correlationId: o.correlationId || 'N/A',
        description: o.description || 'No description'
      })))
    }
    
    return outliers
  }, [aiInsights])

  // Paginated patterns
  const paginatedPatterns = useMemo(() => {
    const start = (patternPage - 1) * patternPageSize
    return allClusters.slice(start, start + patternPageSize)
  }, [allClusters, patternPage, patternPageSize])

  // Paginated anomalies
  const paginatedAnomalies = useMemo(() => {
    const start = (anomalyPage - 1) * anomalyPageSize
    return allOutliers.slice(start, start + anomalyPageSize)
  }, [allOutliers, anomalyPage, anomalyPageSize])

  const handleAnomalyClick = async (outlier: Outlier) => {
    if (!onMessageSelect) return

    setLoadingMessage(outlier.messageId)
    try {
      const outlierIsDLQ = (outlier.source || '').toLowerCase().includes('dlq')
      const fetchIsDLQ = outlierIsDLQ || Boolean(isDLQ)

      // Fetch the actual message
      const response = await apiClient.peekMessages(
        sessionId,
        entityName,
        100,
        subscriptionName,
        fetchIsDLQ
      )
      
      const messages = response.messages || []
      const message = messages.find((m: any) => m.messageId === outlier.messageId)
      if (message) {
        onMessageSelect(message)
      } else {
        alert('Message not found in current peek window')
      }
    } catch (err) {
      console.error('Failed to load message:', err)
      alert('Failed to load message details')
    } finally {
      setLoadingMessage(null)
    }
  }

  const totalAnalyzed = 
    (aiInsights.activeQueueAnalysis?.totalMessages || 0) +
    (aiInsights.dlqAnalysis?.totalMessages || 0)

  return (
    <div className="ai-insights-inspector">
      {/* Tabs */}
      <div className="inspector-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'patterns' ? 'active' : ''}`}
          onClick={() => setActiveTab('patterns')}
        >
          Patterns ({allClusters.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'anomalies' ? 'active' : ''}`}
          onClick={() => setActiveTab('anomalies')}
        >
          Anomalies ({allOutliers.length})
        </button>

        {onRefresh && (
          <button className="refresh-btn-inspector" onClick={onRefresh} title="Refresh analysis">
            🔄 Refresh
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="overview-stats">
              <div className="stat-card">
                <div className="stat-value">{totalAnalyzed}</div>
                <div className="stat-label">Messages Analyzed</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{allClusters.length}</div>
                <div className="stat-label">Patterns Found</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{allOutliers.length}</div>
                <div className="stat-label">Anomalies Detected</div>
              </div>
            </div>

            <div className="overview-summary">
              <h4>Summary</h4>
              <p>{aiInsights.summary}</p>
              <div className="analysis-meta">
                <span>Analyzed at: {new Date(aiInsights.analyzedAt).toLocaleString()}</span>
              </div>
            </div>

            {aiInsights.activeQueueAnalysis && (
              <div className="source-breakdown">
                <h4>Active Queue</h4>
                <div className="breakdown-stats">
                  <span>{aiInsights.activeQueueAnalysis.totalMessages} messages</span>
                  <span>{aiInsights.activeQueueAnalysis.clusters.length} patterns</span>
                  <span>{aiInsights.activeQueueAnalysis.outliers.length} anomalies</span>
                  <span className="processing-time">
                    {aiInsights.activeQueueAnalysis.processingTimeMs}ms
                  </span>
                </div>
              </div>
            )}

            {aiInsights.dlqAnalysis && (
              <div className="source-breakdown">
                <h4>Dead Letter Queue</h4>
                <div className="breakdown-stats">
                  <span>{aiInsights.dlqAnalysis.totalMessages} messages</span>
                  <span>{aiInsights.dlqAnalysis.clusters.length} patterns</span>
                  <span>{aiInsights.dlqAnalysis.outliers.length} anomalies</span>
                  <span className="processing-time">
                    {aiInsights.dlqAnalysis.processingTimeMs}ms
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'patterns' && (
          <div className="patterns-tab">
            <div className="grid-container">
              <table className="inspector-grid">
                <thead>
                  <tr>
                    <th>Event Type</th>
                    <th>Source</th>
                    <th>Count</th>
                    <th>Common Fields</th>
                    <th>Sample</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPatterns.map((cluster, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className="event-type-badge">{cluster.eventType}</span>
                      </td>
                      <td>{cluster.source}</td>
                      <td>
                        <span className="count-badge">{cluster.size}</span>
                      </td>
                      <td>
                        <div className="common-fields">
                          {(Array.isArray(cluster.commonFields) ? cluster.commonFields : []).slice(0, 3).map((field, i) => (
                            <span key={i} className="field-tag">{field}</span>
                          ))}
                          {(Array.isArray(cluster.commonFields) ? cluster.commonFields : []).length > 3 && (
                            <span className="field-tag more">
                              +{(Array.isArray(cluster.commonFields) ? cluster.commonFields : []).length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <code className="sample-preview">
                          {safeStringify(cluster.sampleMessage).substring(0, 50)}...
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {allClusters.length === 0 && (
                <div className="empty-grid">No patterns detected</div>
              )}
            </div>

            {allClusters.length > 0 && (
              <Pagination
                currentPage={patternPage}
                totalItems={allClusters.length}
                pageSize={patternPageSize}
                onPageChange={setPatternPage}
                onPageSizeChange={(size) => {
                  setPatternPageSize(size)
                  setPatternPage(1)
                }}
              />
            )}
          </div>
        )}

        {activeTab === 'anomalies' && (
          <div className="anomalies-tab">
            <div className="grid-container">
              <table className="inspector-grid">
                <thead>
                  <tr>
                    <th>Message ID</th>
                    <th>Source</th>
                    <th>Event Type</th>
                    <th>Anomaly Type</th>
                    <th>Severity</th>
                    <th>Correlation ID</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAnomalies.map((outlier, idx) => (
                    <tr
                      key={idx}
                      onClick={() => handleAnomalyClick(outlier)}
                      className={`anomaly-row ${loadingMessage === outlier.messageId ? 'loading' : ''}`}
                      title="Click to inspect message"
                    >
                      <td>
                        <code className="message-id">
                          {(outlier.messageId || 'N/A').substring(0, 20)}...
                        </code>
                      </td>
                      <td>{outlier.source}</td>
                      <td>{outlier.eventType || 'Unknown'}</td>
                      <td>
                        <span className="anomaly-type-badge">
                          {outlier.anomalyType || 'unknown'}
                        </span>
                      </td>
                      <td>
                        <span className={`severity-badge ${getSeverityClass(outlier.severity || 'Medium')}`}>
                          {outlier.severity || 'Medium'}
                        </span>
                      </td>
                      <td>
                        <code className="correlation-id">
                          {outlier.correlationId === 'N/A' 
                            ? 'N/A' 
                            : (outlier.correlationId || '').substring(0, 15) + '...'}
                        </code>
                      </td>
                      <td className="description-cell">{outlier.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {allOutliers.length === 0 && (
                <div className="empty-grid">No anomalies detected</div>
              )}
            </div>

            {allOutliers.length > 0 && (
              <Pagination
                currentPage={anomalyPage}
                totalItems={allOutliers.length}
                pageSize={anomalyPageSize}
                onPageChange={setAnomalyPage}
                onPageSizeChange={(size) => {
                  setAnomalyPageSize(size)
                  setAnomalyPage(1)
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
