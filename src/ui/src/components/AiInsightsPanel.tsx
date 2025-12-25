/**
 * AI Insights Panel - Display message anomaly analysis
 * Shows clusters and outliers with expandable message details
 * Separate sections for active queue vs DLQ
 */

import { useState } from 'react'
import './AiInsightsPanel.css'

interface MessageCluster {
  clusterId: string
  clusterName: string
  messageCount: number
  eventTypes: string[]
  patternDescription: string
  commonFields?: Record<string, unknown>
  correlationGroups?: string[][]
  sampleMessageIds?: string[]
  confidence: number
}

interface Outlier {
  messageId: string
  reason: string
  anomalyScore: number
  source: string
  eventType: string
  description: string
  sampleMessage?: any
}

interface Analysis {
  source: string
  totalMessages: number
  clusters: MessageCluster[]
  outliers: Outlier[]
  processingTimeMs: number
}

interface AiInsightsPanelProps {
  activeQueueAnalysis?: Analysis | null
  dlqAnalysis?: Analysis | null
  summary: string
  analyzedAt: string
  isLoading?: boolean
  onRefresh?: () => void
}

const ANOMALY_ICONS: Record<string, string> = {
  suspicious_amount: '💰',
  invalid_currency: '💱',
  missing_required_field: '❓',
  duplicate_flag: '📋',
  schema_violation: '⚠️',
  timestamp_anomaly: '🕐',
  high_retry_count: '🔄',
  malformed_payload: '🔥',
  'out-of-order-timestamp': '🕐',
  'negative-amount': '💰',
  'unexpected-event-type': '❓',
  'duplicate-correlation': '📋',
  'dlq-candidate': '☠️',
  dlq_candidate: '☠️',
  default: '⚡'
}

export default function AiInsightsPanel({
  activeQueueAnalysis,
  dlqAnalysis,
  summary,
  analyzedAt,
  isLoading = false,
  onRefresh
}: AiInsightsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'patterns' | 'anomalies'>('overview')
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set())
  const [expandedOutliers, setExpandedOutliers] = useState<Set<string>>(new Set())

  const totalClusters = (activeQueueAnalysis?.clusters.length || 0) + (dlqAnalysis?.clusters.length || 0)
  const totalOutliers = (activeQueueAnalysis?.outliers.length || 0) + (dlqAnalysis?.outliers.length || 0)
  const totalMessages = (activeQueueAnalysis?.totalMessages || 0) + (dlqAnalysis?.totalMessages || 0)

  const toggleCluster = (key: string) => {
    setExpandedClusters(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const toggleOutlier = (key: string) => {
    setExpandedOutliers(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const formatMessageBody = (body: any): string => {
    if (!body) return '(empty)'
    if (typeof body === 'string') {
      try {
        return JSON.stringify(JSON.parse(body), null, 2)
      } catch {
        return body
      }
    }
    return JSON.stringify(body, null, 2)
  }

  const renderCluster = (cluster: MessageCluster, index: number, source: string) => {
    const key = `${source}-cluster-${cluster.clusterId}-${index}`
    const isOpen = expandedClusters.has(key)
    
    return (
      <div key={key} className={`cluster-card ${isOpen ? 'expanded' : ''}`}>
        <div className="cluster-header" onClick={() => toggleCluster(key)}>
          <div className="cluster-main">
            <span className="cluster-expand-icon">{isOpen ? '▼' : '▶'}</span>
            <span className="cluster-type-badge">{cluster.clusterName}</span>
            <span className="cluster-size">{cluster.messageCount} messages</span>
          </div>
          <span className="cluster-source-badge">{source === 'active' ? '📥' : '💀'}</span>
        </div>
        
        {isOpen && (
          <div className="cluster-details">
            <div className="cluster-info">
              <p className="pattern-description">{cluster.patternDescription}</p>
              <p className="confidence-badge">
                Confidence: {(cluster.confidence * 100).toFixed(0)}%
              </p>
            </div>
            
            {cluster.sampleMessageIds && cluster.sampleMessageIds.length > 0 && (
              <div className="sample-ids-section">
                <strong>Sample Message IDs:</strong>
                <div className="sample-ids-list">
                  {cluster.sampleMessageIds.map(id => (
                    <code key={id} className="sample-id">{id}</code>
                  ))}
                </div>
              </div>
            )}
            
            {cluster.commonFields && Object.keys(cluster.commonFields).length > 0 && (
              <div className="cluster-fields">
                <strong>Common Fields:</strong>
                <div className="field-tags">
                  {Object.keys(cluster.commonFields).map(field => (
                    <span key={field} className="field-tag">{field}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderOutlier = (outlier: Outlier, index: number) => {
    const key = `outlier-${outlier.messageId}-${index}`
    const isOpen = expandedOutliers.has(key)
    // Normalize the anomaly type key for icon lookup
    const normalizedType = outlier.reason?.toLowerCase().replace(/ /g, '_').replace(/-/g, '_') || 'default'
    const icon = ANOMALY_ICONS[normalizedType] || ANOMALY_ICONS[outlier.reason?.toLowerCase()] || ANOMALY_ICONS.default
    const sourceLabel = outlier.source === 'DeadLetterQueue' ? 'DLQ' : 'Active'
    const severityClass = outlier.anomalyScore >= 0.9 ? 'critical' : 
                          outlier.anomalyScore >= 0.7 ? 'high' : 
                          outlier.anomalyScore >= 0.5 ? 'medium' : 'low'
    
    return (
      <div key={key} className={`outlier-card ${isOpen ? 'expanded' : ''} severity-${severityClass}`}>
        <div className="outlier-header" onClick={() => toggleOutlier(key)}>
          <div className="outlier-main">
            <span className="outlier-expand-icon">{isOpen ? '▼' : '▶'}</span>
            <span className="outlier-icon">{icon}</span>
            <span className="outlier-type-badge">{outlier.eventType || 'Unknown'}</span>
            <span className="outlier-anomaly-type">{outlier.reason?.replace(/_/g, ' ').replace(/-/g, ' ')}</span>
          </div>
          <div className="outlier-badges">
            <span className={`severity-badge ${severityClass}`}>
              {Math.round(outlier.anomalyScore * 100)}%
            </span>
            <span className="outlier-source-badge">{sourceLabel}</span>
          </div>
        </div>
        
        <div className="outlier-summary">
          <p className="outlier-description">{outlier.description}</p>
          <code className="outlier-id" title="Message ID">{outlier.messageId}</code>
        </div>
        
        {isOpen && outlier.sampleMessage && (
          <div className="outlier-details">
            <div className="message-detail-grid">
              <div className="detail-row">
                <span className="detail-label">Message ID</span>
                <code className="detail-value">{outlier.sampleMessage.message_id || outlier.messageId}</code>
              </div>
              <div className="detail-row">
                <span className="detail-label">Event Type</span>
                <code className="detail-value">{outlier.sampleMessage.event_type || outlier.eventType || 'N/A'}</code>
              </div>
              <div className="detail-row">
                <span className="detail-label">Timestamp</span>
                <code className="detail-value">
                  {outlier.sampleMessage.timestamp 
                    ? new Date(outlier.sampleMessage.timestamp).toLocaleString()
                    : 'N/A'}
                </code>
              </div>
              <div className="detail-row">
                <span className="detail-label">Correlation ID</span>
                <code className="detail-value">{outlier.sampleMessage.correlation_id || 'N/A'}</code>
              </div>
            </div>
            
            {outlier.sampleMessage.applicationProperties && 
             Object.keys(outlier.sampleMessage.applicationProperties).length > 0 && (
              <div className="app-properties-section">
                <strong>Application Properties:</strong>
                <div className="properties-grid">
                  {Object.entries(outlier.sampleMessage.applicationProperties).map(([k, v]) => (
                    <div key={k} className="property-row">
                      <span className="property-key">{k}</span>
                      <span className="property-value">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {outlier.sampleMessage.payload && (
              <div className="message-body-preview">
                <strong>Message Payload:</strong>
                <pre className="body-content">{formatMessageBody(outlier.sampleMessage.payload)}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`ai-insights-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="panel-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-left">
          <span className="panel-icon">🤖</span>
          <h3 className="panel-title">AI Insights</h3>
          {!isExpanded && totalOutliers > 0 && (
            <span className="badge-warning">{totalOutliers} anomalies</span>
          )}
        </div>
        <div className="header-right">
          {isLoading && <span className="loading-spinner">⏳</span>}
          {onRefresh && !isLoading && (
            <button
              className="refresh-btn"
              onClick={e => {
                e.stopPropagation()
                onRefresh()
              }}
              title="Refresh analysis"
            >
              🔄
            </button>
          )}
          <button className="expand-toggle" title={isExpanded ? 'Collapse' : 'Expand'}>
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="panel-content">
          <div className="analysis-summary">
            <p className="summary-text">{summary}</p>
            <div className="summary-stats">
              <div className="stat">
                <span className="stat-value">{totalMessages}</span>
                <span className="stat-label">Messages Analyzed</span>
              </div>
              <div className="stat">
                <span className="stat-value">{totalClusters}</span>
                <span className="stat-label">Patterns Found</span>
              </div>
              <div className="stat anomaly-stat">
                <span className="stat-value">{totalOutliers}</span>
                <span className="stat-label">Anomalies</span>
              </div>
            </div>
            <p className="analyzed-at">Last analyzed: {new Date(analyzedAt).toLocaleString()}</p>
          </div>

          <div className="tab-navigation">
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
              Patterns ({totalClusters})
            </button>
            <button
              className={`tab-btn ${activeTab === 'anomalies' ? 'active' : ''}`}
              onClick={() => setActiveTab('anomalies')}
            >
              Anomalies ({totalOutliers})
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'overview' && (
              <div className="overview-tab">
                {activeQueueAnalysis && (
                  <div className="analysis-section">
                    <h4 className="section-title">
                      <span className="section-icon">📥</span>
                      Active Queue
                    </h4>
                    <div className="section-stats">
                      <span className="section-stat">
                        <strong>{activeQueueAnalysis.totalMessages}</strong> messages
                      </span>
                      <span className="section-stat">
                        <strong>{activeQueueAnalysis.clusters.length}</strong> patterns
                      </span>
                      <span className="section-stat anomaly">
                        <strong>{activeQueueAnalysis.outliers.length}</strong> anomalies
                      </span>
                    </div>
                    {activeQueueAnalysis.processingTimeMs > 0 && (
                      <span className="processing-time">
                        Analyzed in {activeQueueAnalysis.processingTimeMs}ms
                      </span>
                    )}
                  </div>
                )}
                {dlqAnalysis && (
                  <div className="analysis-section dlq">
                    <h4 className="section-title">
                      <span className="section-icon">💀</span>
                      Dead Letter Queue
                    </h4>
                    <div className="section-stats">
                      <span className="section-stat">
                        <strong>{dlqAnalysis.totalMessages}</strong> messages
                      </span>
                      <span className="section-stat">
                        <strong>{dlqAnalysis.clusters.length}</strong> patterns
                      </span>
                      <span className="section-stat anomaly">
                        <strong>{dlqAnalysis.outliers.length}</strong> anomalies
                      </span>
                    </div>
                    {dlqAnalysis.processingTimeMs > 0 && (
                      <span className="processing-time">
                        Analyzed in {dlqAnalysis.processingTimeMs}ms
                      </span>
                    )}
                  </div>
                )}
                {!activeQueueAnalysis && !dlqAnalysis && (
                  <p className="empty-state">No analysis available. Click the AI button to analyze messages.</p>
                )}
              </div>
            )}

            {activeTab === 'patterns' && (
              <div className="patterns-tab">
                <p className="tab-hint">Click on a pattern to see a sample message</p>
                {activeQueueAnalysis && activeQueueAnalysis.clusters.length > 0 && (
                  <div className="cluster-group">
                    <h4 className="group-title">📥 Active Queue Patterns</h4>
                    <div className="cluster-list">
                      {activeQueueAnalysis.clusters.map((cluster, idx) =>
                        renderCluster(cluster, idx, 'active')
                      )}
                    </div>
                  </div>
                )}
                {dlqAnalysis && dlqAnalysis.clusters.length > 0 && (
                  <div className="cluster-group">
                    <h4 className="group-title">💀 DLQ Patterns</h4>
                    <div className="cluster-list">
                      {dlqAnalysis.clusters.map((cluster, idx) =>
                        renderCluster(cluster, idx, 'dlq')
                      )}
                    </div>
                  </div>
                )}
                {totalClusters === 0 && (
                  <p className="empty-state">No patterns detected in the analyzed messages.</p>
                )}
              </div>
            )}

            {activeTab === 'anomalies' && (
              <div className="anomalies-tab">
                {totalOutliers > 0 ? (
                  <>
                    <p className="tab-hint">Click on an anomaly to see message details</p>
                    <div className="outlier-list">
                      {activeQueueAnalysis?.outliers.map((outlier, idx) =>
                        renderOutlier(outlier, idx)
                      )}
                      {dlqAnalysis?.outliers.map((outlier, idx) =>
                        renderOutlier(outlier, idx + (activeQueueAnalysis?.outliers.length || 0))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="empty-state success">
                    <span className="success-icon">✅</span>
                    <p>No anomalies detected - all messages look healthy!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
