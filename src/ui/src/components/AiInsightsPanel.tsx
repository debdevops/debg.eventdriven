/**
 * AI Insights Panel - Display message anomaly analysis
 * Shows clusters and outliers from FastAPI AI service
 * Separate sections for active queue vs DLQ
 */

import { useState } from 'react'
import './AiInsightsPanel.css'

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
  missing_field: '🔴',
  invalid_value: '⚠️',
  type_mismatch: '❌',
  duplicate: '🔄',
  structural: '🏗️',
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
  const [activeTab, setActiveTab] = useState<'overview' | 'clusters' | 'outliers'>('overview')

  const totalClusters = (activeQueueAnalysis?.clusters.length || 0) + (dlqAnalysis?.clusters.length || 0)
  const totalOutliers = (activeQueueAnalysis?.outliers.length || 0) + (dlqAnalysis?.outliers.length || 0)
  const totalMessages = (activeQueueAnalysis?.totalMessages || 0) + (dlqAnalysis?.totalMessages || 0)

  const renderCluster = (cluster: MessageCluster, index: number, source: string) => (
    <div key={`${source}-cluster-${index}`} className="cluster-card">
      <div className="cluster-header">
        <span className="cluster-type">{cluster.eventType}</span>
        <span className="cluster-size">{cluster.size} messages</span>
      </div>
      <div className="cluster-fields">
        <strong>Common fields:</strong>
        <div className="field-tags">
          {cluster.commonFields.slice(0, 8).map(field => (
            <span key={field} className="field-tag">{field}</span>
          ))}
          {cluster.commonFields.length > 8 && (
            <span className="field-tag more">+{cluster.commonFields.length - 8} more</span>
          )}
        </div>
      </div>
    </div>
  )

  const renderOutlier = (outlier: Outlier, index: number) => {
    const icon = ANOMALY_ICONS[outlier.anomalyType] || ANOMALY_ICONS.default
    const sourceLabel = outlier.source === 'DeadLetterQueue' ? 'DLQ' : 'Active'
    
    return (
      <div key={`outlier-${index}`} className={`outlier-card ${outlier.source.toLowerCase()}`}>
        <div className="outlier-header">
          <span className="outlier-icon">{icon}</span>
          <div className="outlier-info">
            <span className="outlier-type">{outlier.eventType}</span>
            <span className="outlier-source-badge">{sourceLabel}</span>
          </div>
          <span className="outlier-anomaly-type">{outlier.anomalyType.replace('_', ' ')}</span>
        </div>
        <p className="outlier-description">{outlier.description}</p>
        <code className="outlier-id">{outlier.messageId}</code>
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
              <div className="stat">
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
              className={`tab-btn ${activeTab === 'clusters' ? 'active' : ''}`}
              onClick={() => setActiveTab('clusters')}
            >
              Patterns ({totalClusters})
            </button>
            <button
              className={`tab-btn ${activeTab === 'outliers' ? 'active' : ''}`}
              onClick={() => setActiveTab('outliers')}
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
                      <span>{activeQueueAnalysis.totalMessages} messages</span>
                      <span>{activeQueueAnalysis.clusters.length} patterns</span>
                      <span>{activeQueueAnalysis.outliers.length} anomalies</span>
                    </div>
                  </div>
                )}
                {dlqAnalysis && (
                  <div className="analysis-section">
                    <h4 className="section-title">
                      <span className="section-icon">💀</span>
                      Dead Letter Queue
                    </h4>
                    <div className="section-stats">
                      <span>{dlqAnalysis.totalMessages} messages</span>
                      <span>{dlqAnalysis.clusters.length} patterns</span>
                      <span>{dlqAnalysis.outliers.length} anomalies</span>
                    </div>
                  </div>
                )}
                {!activeQueueAnalysis && !dlqAnalysis && (
                  <p className="empty-state">No analysis available. Run analysis on a queue to see insights.</p>
                )}
              </div>
            )}

            {activeTab === 'clusters' && (
              <div className="clusters-tab">
                {activeQueueAnalysis && activeQueueAnalysis.clusters.length > 0 && (
                  <div className="cluster-group">
                    <h4 className="group-title">Active Queue Patterns</h4>
                    <div className="cluster-list">
                      {activeQueueAnalysis.clusters.map((cluster, idx) =>
                        renderCluster(cluster, idx, 'active')
                      )}
                    </div>
                  </div>
                )}
                {dlqAnalysis && dlqAnalysis.clusters.length > 0 && (
                  <div className="cluster-group">
                    <h4 className="group-title">DLQ Patterns</h4>
                    <div className="cluster-list">
                      {dlqAnalysis.clusters.map((cluster, idx) =>
                        renderCluster(cluster, idx, 'dlq')
                      )}
                    </div>
                  </div>
                )}
                {totalClusters === 0 && (
                  <p className="empty-state">No patterns detected</p>
                )}
              </div>
            )}

            {activeTab === 'outliers' && (
              <div className="outliers-tab">
                {totalOutliers > 0 ? (
                  <div className="outlier-list">
                    {activeQueueAnalysis?.outliers.map((outlier, idx) =>
                      renderOutlier(outlier, idx)
                    )}
                    {dlqAnalysis?.outliers.map((outlier, idx) =>
                      renderOutlier(outlier, idx + (activeQueueAnalysis?.outliers.length || 0))
                    )}
                  </div>
                ) : (
                  <p className="empty-state">✅ No anomalies detected - all messages look healthy!</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
