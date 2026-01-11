/**
 * AI Insights Inspector - Tabbed interface with grids
 * Shows Overview, Patterns, and Anomalies in inspector format
 */

import { useState, useMemo } from 'react'
import { Pagination } from '@/shared/ui/molecules/Pagination'
import { AISuggestionsPanel } from './AISuggestionsPanel'
import { AnomalyActionButtons } from './AnomalyActionButtons'
import { BulkAnomalyActions } from './BulkAnomalyActions'
import { apiClient } from "@/shared/api/client"
import { uiLogger } from "@/shared/lib/utils/logger"
import type { MessageEnvelope } from '../types'
import type { AnomalyType as RemediationActionType } from "@/shared/types/remediation"
import './AiInsightsInspector.css'

interface MessageCluster {
  eventType: string
  size: number
  sampleMessage: unknown
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
  confidence?: number
  expected?: string
  actual?: string
  reason?: string
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
  onApplyAiPattern?: (patternId: string, label: string, messageIds: string[]) => void
}

type TabType = 'overview' | 'patterns' | 'anomalies'

export function AiInsightsInspector({
  aiInsights,
  sessionId,
  entityName,
  subscriptionName,
  isDLQ,
  onMessageSelect,
  onRefresh,
  onApplyAiPattern
}: AiInsightsInspectorProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [patternPage, setPatternPage] = useState(1)
  const [patternPageSize, setPatternPageSize] = useState(50)
  const [anomalyPage, setAnomalyPage] = useState(1)
  const [anomalyPageSize, setAnomalyPageSize] = useState(50)
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null)
  const [selectedAnomalies, setSelectedAnomalies] = useState<Set<string>>(new Set())

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

  interface RawCluster {
    eventType?: string
    size?: number | string
    sampleMessage?: unknown
    commonFields?: string[] | string
  }

  const normalizeCluster = (cluster: RawCluster, source: string): (MessageCluster & { source: string }) => {
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
      clusters.push(...aiInsights.activeQueueAnalysis.clusters.map((c) => normalizeCluster(c as RawCluster, 'Active Queue')))
    }
    
    if (aiInsights.dlqAnalysis?.clusters) {
      clusters.push(...aiInsights.dlqAnalysis.clusters.map((c) => normalizeCluster(c as RawCluster, 'DLQ')))
    }
    
    return clusters.sort((a, b) => b.size - a.size)
  }, [aiInsights])

  // Combine all outliers with confidence filtering (>= 60%)
  const allOutliers = useMemo(() => {
    const outliers: Outlier[] = []
    
    if (aiInsights.activeQueueAnalysis?.outliers) {
      outliers.push(...aiInsights.activeQueueAnalysis.outliers
        .filter(o => !o.confidence || o.confidence >= 60)
        .map(o => ({
          ...o,
          source: o.source || 'Active Queue',
          anomalyType: o.anomalyType || 'unknown',
          severity: getSeverity(o.anomalyType),
          correlationId: o.correlationId || 'N/A',
          description: o.description || 'No description',
          confidence: o.confidence || 100,
          reason: o.reason || o.description || 'No reason provided',
          expected: o.expected,
          actual: o.actual
        })))
    }
    
    if (aiInsights.dlqAnalysis?.outliers) {
      outliers.push(...aiInsights.dlqAnalysis.outliers
        .filter(o => !o.confidence || o.confidence >= 60)
        .map(o => ({
          ...o,
          source: o.source || 'DLQ',
          anomalyType: o.anomalyType || 'unknown',
          severity: getSeverity(o.anomalyType),
          correlationId: o.correlationId || 'N/A',
          description: o.description || 'No description',
          confidence: o.confidence || 100,
          reason: o.reason || o.description || 'No reason provided',
          expected: o.expected,
          actual: o.actual
        })))
    }
    
    return outliers.sort((a, b) => {
      // Sort by severity, then confidence
      const sevOrder = { High: 3, Medium: 2, Low: 1 }
      const sevDiff = (sevOrder[b.severity as keyof typeof sevOrder] || 2) - (sevOrder[a.severity as keyof typeof sevOrder] || 2)
      if (sevDiff !== 0) return sevDiff
      return (b.confidence || 100) - (a.confidence || 100)
    })
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
      const message = messages.find((m) => m.messageId === outlier.messageId)
      if (message) {
        onMessageSelect(message)
      } else {
        alert('Message not found in current peek window')
      }
    } catch (err) {
      uiLogger.error('Failed to load message', err)
      alert('Failed to load message details')
    } finally {
      setLoadingMessage(null)
    }
  }

  const totalAnalyzed = 
    (aiInsights.activeQueueAnalysis?.totalMessages || 0) +
    (aiInsights.dlqAnalysis?.totalMessages || 0)

  // Map anomaly type strings to AnomalyType
  const mapAnomalyTypeToAnomalyType = (anomalyType: string): RemediationActionType => {
    const type = anomalyType.toUpperCase()
    if (type.includes('RETRY')) return 'HIGH_RETRY_COUNT'
    if (type.includes('DUPLICATE')) return 'DUPLICATE_FLAG'
    if (type.includes('AMOUNT') || type.includes('SUSPICIOUS')) return 'SUSPICIOUS_AMOUNT'
    if (type.includes('MALFORMED') || type.includes('PAYLOAD')) return 'MALFORMED_PAYLOAD'
    if (type.includes('TIMESTAMP')) return 'TIMESTAMP_ANOMALY'
    if (type.includes('MISSING')) return 'MISSING_FIELD'
    if (type.includes('INVALID')) return 'INVALID_VALUE'
    if (type.includes('TYPE') || type.includes('MISMATCH')) return 'TYPE_MISMATCH'
    return 'unknown' // default
  }

  const handleToggleAnomaly = (messageId: string) => {
    setSelectedAnomalies(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  const handleToggleAll = () => {
    if (selectedAnomalies.size === paginatedAnomalies.length) {
      setSelectedAnomalies(new Set())
    } else {
      setSelectedAnomalies(new Set(paginatedAnomalies.map(a => a.messageId)))
    }
  }

  return (
    <div className="ai-insights-inspector">
      {/* AI Suggestions Panel */}
      <AISuggestionsPanel
        sessionId={sessionId}
        queueName={entityName}
        onApplySuggestion={(suggestion) => {
          uiLogger.info('Applied AI suggestion:', suggestion)
          onRefresh?.()
        }}
      />

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
              <h4>Analysis Summary</h4>
              <p>{aiInsights.summary}</p>
              <div className="analysis-meta">
                <span>Analyzed at: {new Date(aiInsights.analyzedAt).toLocaleString()}</span>
                <span className="confidence-note">• Only showing patterns with high confidence (≥60%)</span>
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
                  {paginatedPatterns.map((cluster, idx) => {
                    // Generate pattern ID from eventType and source
                    const patternId = `${cluster.eventType}-${cluster.source}`
                    
                    // Find all loaded messages matching this pattern's eventType
                    // (This would need to be enhanced if we have access to actual message IDs from AI service)
                    const matchingMessageIds: string[] = []
                    
                    const handlePatternClick = () => {
                      if (onApplyAiPattern && matchingMessageIds.length > 0) {
                        onApplyAiPattern(
                          patternId,
                          `${cluster.eventType} (${cluster.source})`,
                          matchingMessageIds
                        )
                      }
                    }
                    
                    return (
                      <tr 
                        key={idx}
                        className="pattern-row"
                        onClick={handlePatternClick}
                        title="Click to filter messages by this pattern"
                      >
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
                    )
                  })}
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
            <div className="anomalies-note">
              💡 Showing only high-confidence anomalies (≥60%). Lower confidence patterns are filtered out to avoid false alarms.
            </div>
            
            {/* Bulk Actions Bar */}
            {selectedAnomalies.size > 0 && (
              <BulkAnomalyActions
                sessionId={sessionId}
                queueName={entityName}
                selectedAnomalyIds={Array.from(selectedAnomalies)}
                onClearSelection={() => setSelectedAnomalies(new Set())}
                onActionComplete={() => {
                  setSelectedAnomalies(new Set())
                  onRefresh?.()
                }}
              />
            )}
            
            <div className="grid-container">
              <table className="inspector-grid">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedAnomalies.size === paginatedAnomalies.length && paginatedAnomalies.length > 0}
                        onChange={handleToggleAll}
                        title="Select all anomalies on this page"
                      />
                    </th>
                    <th>Root Cause</th>
                    <th>Impact</th>
                    <th>Message ID</th>
                    <th>Source</th>
                    <th>Event Type</th>
                    <th>Why Flagged</th>
                    <th>Confidence</th>
                    <th>Expected vs Actual</th>
                    <th style={{ width: '100px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAnomalies.map((outlier, idx) => (
                    <tr
                      key={idx}
                      className={`anomaly-row ${loadingMessage === outlier.messageId ? 'loading' : ''} ${selectedAnomalies.has(outlier.messageId) ? 'selected' : ''}`}
                    >
                      <td onClick={(e) => {
                        e.stopPropagation()
                        handleToggleAnomaly(outlier.messageId)
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedAnomalies.has(outlier.messageId)}
                          onChange={() => handleToggleAnomaly(outlier.messageId)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="reason-cell" onClick={() => handleAnomalyClick(outlier)} title="Click to inspect message">
                        {outlier.reason || outlier.description}
                      </td>
                      <td onClick={() => handleAnomalyClick(outlier)} title="Click to inspect message">
                        <span className={`severity-badge ${getSeverityClass(outlier.severity || 'Medium')}`}>
                          {outlier.severity || 'Medium'}
                        </span>
                      </td>
                      <td onClick={() => handleAnomalyClick(outlier)} title="Click to inspect message">
                        <code className="message-id">
                          {(outlier.messageId || 'N/A').substring(0, 20)}...
                        </code>
                      </td>
                      <td onClick={() => handleAnomalyClick(outlier)} title="Click to inspect message">
                        {outlier.source}
                      </td>
                      <td onClick={() => handleAnomalyClick(outlier)} title="Click to inspect message">
                        {outlier.eventType || 'Unknown'}
                      </td>
                      <td onClick={() => handleAnomalyClick(outlier)} title="Click to inspect message">
                        <span className="anomaly-type-badge">
                          {outlier.anomalyType || 'unknown'}
                        </span>
                      </td>
                      <td onClick={() => handleAnomalyClick(outlier)} title="Click to inspect message">
                        <span className="confidence-badge" title={`AI is ${outlier.confidence || 100}% confident this is anomalous`}>
                          {outlier.confidence || 100}%
                        </span>
                      </td>
                      <td className="comparison-cell" onClick={() => handleAnomalyClick(outlier)} title="Click to inspect message">
                        {outlier.expected || outlier.actual ? (
                          <div className="comparison">
                            {outlier.expected && (
                              <div className="comparison-item">
                                <span className="comparison-label">Expected:</span>
                                <code>{outlier.expected.substring(0, 30)}</code>
                              </div>
                            )}
                            {outlier.actual && (
                              <div className="comparison-item">
                                <span className="comparison-label">Actual:</span>
                                <code>{outlier.actual.substring(0, 30)}</code>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="no-comparison">—</span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <AnomalyActionButtons
                          anomalyType={mapAnomalyTypeToAnomalyType(outlier.anomalyType)}
                          messageId={outlier.messageId}
                          sessionId={sessionId}
                          queueName={entityName}
                          compact={true}
                          onActionComplete={() => {
                            uiLogger.info('Remediation action completed for', outlier.messageId)
                            onRefresh?.()
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {allOutliers.length === 0 && (
                <div className="empty-grid">✅ No high-confidence anomalies detected - all messages appear normal</div>
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
