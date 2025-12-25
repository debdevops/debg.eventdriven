/**
 * Message Table Component with selection, sorting, actions, DLQ replay, and export
 * Enhanced with: ActionToolbar, DeliveryBadge, Pagination, Select Mode
 */

import { useEffect, useState, useMemo } from 'react'
import { ActionToolbar } from './ActionToolbar'
import { DeliveryBadge } from './DeliveryBadge'
import { Pagination } from './Pagination'
import { QueueHealthHeader } from './QueueHealthHeader'
import { MessageAgeDistribution } from './MessageAgeDistribution'
import { EventTypeChip } from './EventTypeChip'
import { MessageFiltersBar } from '../features/shared/MessageFiltersBar'
import { formatTimestamp, formatRelativeTime } from '../utils/formatters'
import { extractEventType, type AgeDistribution } from '../utils/eventTypeExtractor'
import { API_BASE_URL } from '../config/api'
import type { MessageEnvelope } from '../types'
import type { DlqMessageClassification } from '../services/dlqReplayAdvisor'
import './MessageTable.css'

interface MessageTableProps {
  messages: MessageEnvelope[] // INSPECTOR MODE: loaded (peeked) messages, NOT total in queue
  totalMessageCount?: number // Total messages in queue (informational only, not paginated)
  activeCount: number // Active message count for DLQ ratio health
  sessionId: string
  entityName: string
  subscriptionName?: string
  isDLQ?: boolean
  dlqCount?: number
  oldestDlqEnqueuedTimeUtc?: string | null
  sampledDlqMessages?: MessageEnvelope[] | null
  onRefresh?: () => void
  onLoadNextBatch?: () => void // Load next batch using last sequence number
  disabled?: boolean
  frozenSnapshot?: boolean
  onToggleSnapshot?: () => void
  onMessageSelect?: (message: MessageEnvelope) => void
  peekSize?: number
  onPeekSizeChange?: (size: number) => void
  // AI Pattern filter - if set, only show messages with these IDs
  aiPatternFilter?: { patternId: string; label: string; messageIds: string[] } | null
  // DLQ classifications (advisory only)
  dlqClassifications?: Map<string, DlqMessageClassification> | null
}

export default function MessageTable({
  messages,
  totalMessageCount,
  activeCount,
  sessionId,
  entityName,
  subscriptionName,
  isDLQ = false,
  dlqCount = 0,
  oldestDlqEnqueuedTimeUtc = null,
  sampledDlqMessages = null,
  onRefresh,
  onLoadNextBatch,
  disabled = false,
  frozenSnapshot = false,
  onToggleSnapshot,
  onMessageSelect,
  peekSize = 50,
  onPeekSizeChange,
  aiPatternFilter = null,
  dlqClassifications = null
}: MessageTableProps) {
  const snapshotLocked = frozenSnapshot

  const [sortField, setSortField] = useState<keyof MessageEnvelope>('sequenceNumber')
  const [sortAsc, setSortAsc] = useState(false) // Default: newest first
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMessages, setSelectedMessages] = useState<Set<number>>(new Set())
  const [correlationFilter, setCorrelationFilter] = useState<string>('')
  const [replayLoading, setReplayLoading] = useState(false)
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('')
  const [ageBucketFilter, setAgeBucketFilter] = useState<keyof AgeDistribution | null>(null)
  
  // Select mode
  const [selectMode, setSelectMode] = useState(false)

  // Reset view-local UI state on selection changes (entity/subscription/view).
  // Keeps behavior deterministic when switching between entities without remounting.
  useEffect(() => {
    setSortField('sequenceNumber')
    setSortAsc(false)
    setSearchTerm('')
    setSelectedMessages(new Set())
    setCorrelationFilter('')
    setEventTypeFilter('')
    setAgeBucketFilter(null)
    setSelectMode(false)
    setReplayLoading(false)
  }, [entityName, subscriptionName, isDLQ])
  
  /**
   * INSPECTOR MODE ARCHITECTURE:
   * Grid renders ALL loaded messages without pagination slicing.
   * peekSize is preference for NEXT peek cycle, not current render.
   * Pagination is informational footer only.
   */

  const handleDownload = (message: MessageEnvelope) => {
    if (snapshotLocked) return
    const blob = new Blob([JSON.stringify(message, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `message-${message.messageId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSort = (field: keyof MessageEnvelope) => {
    if (snapshotLocked) return
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  const handleSelectAll = () => {
    if (snapshotLocked) return
    if (selectedMessages.size === sortedMessages.length) {
      setSelectedMessages(new Set())
    } else {
      setSelectedMessages(new Set(sortedMessages.map(m => m.sequenceNumber)))
    }
  }

  const handleSelectMessage = (seqNum: number) => {
    if (snapshotLocked) return
    const newSet = new Set(selectedMessages)
    if (newSet.has(seqNum)) {
      newSet.delete(seqNum)
    } else {
      newSet.add(seqNum)
    }
    setSelectedMessages(newSet)
  }

  const handleReplaySelected = async () => {
    if (snapshotLocked) return
    if (selectedMessages.size === 0) return
    
    setReplayLoading(true)
    try {
      const url = subscriptionName
        ? `${API_BASE_URL}/api/queue/${sessionId}/${entityName}/dlq/replay?subscriptionName=${subscriptionName}`
        : `${API_BASE_URL}/api/queue/${sessionId}/${entityName}/dlq/replay`

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequenceNumbers: Array.from(selectedMessages) })
      })

      if (response.ok) {
        const result = await response.json()
        alert(`✅ Replayed ${result.successCount} messages successfully!`)
        setSelectedMessages(new Set())
        onRefresh?.()
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (err) {
      alert(`❌ Failed to replay messages: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setReplayLoading(false)
    }
  }

  const handleReplayAll = async () => {
    if (snapshotLocked) return
    if (!confirm(`Replay ALL ${sortedMessages.length} DLQ messages?`)) return
    
    setReplayLoading(true)
    try {
      const url = subscriptionName
        ? `${API_BASE_URL}/api/queue/${sessionId}/${entityName}/dlq/replay-all?subscriptionName=${subscriptionName}`
        : `${API_BASE_URL}/api/queue/${sessionId}/${entityName}/dlq/replay-all`

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxMessages: sortedMessages.length })
      })

      if (response.ok) {
        const result = await response.json()
        alert(`✅ Replayed ${result.replayed} messages, ${result.failed} failed`)
        onRefresh?.()
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (err) {
      alert(`❌ Failed to replay all: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setReplayLoading(false)
    }
  }

  const handleExportSelected = () => {
    if (snapshotLocked) return
    const selected = messages.filter(m => selectedMessages.has(m.sequenceNumber))
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `messages-export-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportAll = () => {
    if (snapshotLocked) return
    const blob = new Blob([JSON.stringify(sortedMessages, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `messages-all-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRowClick = (message: MessageEnvelope) => {
    if (!selectMode && onMessageSelect) {
      onMessageSelect(message)
    }
  }

  const handleClearFilters = () => {
    if (snapshotLocked) return
    setSearchTerm('')
    setCorrelationFilter('')
    setEventTypeFilter('')
    setAgeBucketFilter(null)
  }

  const handleAgeBucketClick = (bucket: keyof AgeDistribution) => {
    if (snapshotLocked) return
    setAgeBucketFilter(ageBucketFilter === bucket ? null : bucket)
  }
  /**
   * IMMUTABLE DATA PIPELINE - prevents pagination bugs
   * 
   * Step 1: Apply base filters (everything except age)
   * Step 2: Compute age buckets from base-filtered data
   * Step 3: Apply age filter to base-filtered data
   * Step 4: Sort the age-filtered results
   * Step 5: Paginate sorted results
   * 
   * WHY: Age Distribution must aggregate base-filtered data,
   * not age-filtered data, so clicking buckets shows accurate counts.
   * Pagination is applied LAST to ensure page size is authoritative.
   */

  // STEP 1: Base filters (search, correlation, eventType)
  const baseFilteredMessages = useMemo(() => {
    let filtered = messages

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(msg => 
        msg.messageId.toLowerCase().includes(term) ||
        msg.body?.toLowerCase().includes(term) ||
        msg.subject?.toLowerCase().includes(term) ||
        msg.correlationId?.toLowerCase().includes(term) ||
        JSON.stringify(msg.applicationProperties || {}).toLowerCase().includes(term)
      )
    }

    if (correlationFilter) {
      filtered = filtered.filter(msg => 
        msg.correlationId?.toLowerCase().includes(correlationFilter.toLowerCase())
      )
    }

    if (eventTypeFilter) {
      filtered = filtered.filter(msg => {
        const { eventType } = extractEventType(msg)
        return eventType?.toLowerCase().includes(eventTypeFilter.toLowerCase())
      })
    }

    return filtered
  }, [messages, searchTerm, correlationFilter, eventTypeFilter])

  // STEP 2: Age buckets computed from base-filtered data (not age-filtered)
  // This ensures bucket counts are accurate when age filter is active

  // STEP 3: Apply age filter to base-filtered data
  const ageFilteredMessages = useMemo(() => {
    if (!ageBucketFilter) return baseFilteredMessages

    const now = Date.now()
    return baseFilteredMessages.filter(msg => {
      const ageMinutes = (now - new Date(msg.enqueuedTimeUtc).getTime()) / 60000
      if (ageBucketFilter === 'lessThan5m') return ageMinutes < 5
      if (ageBucketFilter === 'between5And30m') return ageMinutes >= 5 && ageMinutes < 30
      if (ageBucketFilter === 'between30And120m') return ageMinutes >= 30 && ageMinutes < 120
      if (ageBucketFilter === 'moreThan2h') return ageMinutes >= 120
      return true
    })
  }, [baseFilteredMessages, ageBucketFilter])

  // STEP 3b: Apply AI pattern filter (if active)
  const aiPatternFilteredMessages = useMemo(() => {
    if (!aiPatternFilter || aiPatternFilter.messageIds.length === 0) {
      return ageFilteredMessages
    }
    
    // Create a Set for O(1) lookup performance
    const patternIdSet = new Set(aiPatternFilter.messageIds)
    return ageFilteredMessages.filter(msg => patternIdSet.has(msg.messageId))
  }, [ageFilteredMessages, aiPatternFilter])

  // STEP 4: Sort age-filtered results
  const sortedMessages = useMemo(() => {
    return [...aiPatternFilteredMessages].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (aVal === undefined || bVal === undefined) return 0
      if (aVal < bVal) return sortAsc ? -1 : 1
      if (aVal > bVal) return sortAsc ? 1 : -1
      return 0
    })
  }, [aiPatternFilteredMessages, sortField, sortAsc])

  /**
   * INSPECTOR MODE: No pagination slicing.
   * All sortedMessages render in grid.
   * peekSize is for next fetch, not current display.
   */

  return (
    <div className="message-table-container">
      {/* Queue Health Header - shows stats for base-filtered view */}
      <QueueHealthHeader 
        messages={baseFilteredMessages}
        dlqCount={dlqCount}
        activeCount={activeCount}
        oldestDlqEnqueuedTimeUtc={oldestDlqEnqueuedTimeUtc}
        sampledDlqMessages={sampledDlqMessages}
        entityName={entityName}
        isDLQ={isDLQ}
      />

      {/* Age Distribution - aggregates base-filtered data (excludes age filter) */}
      <MessageAgeDistribution
        messages={baseFilteredMessages}
        onBucketClick={handleAgeBucketClick}
        activeBucket={ageBucketFilter}
      />

      {/* Unified Action Toolbar */}
      <ActionToolbar
        entityName={entityName}
        entityType={isDLQ ? 'dlq' : subscriptionName ? 'subscription' : 'queue'}
        totalMessages={sortedMessages.length}
        selectedCount={selectedMessages.size}
        onRefresh={onRefresh || (() => {})}
        onReplay={isDLQ ? handleReplaySelected : undefined}
        onReplayAll={isDLQ ? handleReplayAll : undefined}
        onExportSelected={handleExportSelected}
        onExportAll={handleExportAll}
        onClearFilters={handleClearFilters}
        refreshing={false}
        loading={replayLoading}
        disabled={disabled || snapshotLocked}
        frozenSnapshot={frozenSnapshot}
        onToggleSnapshot={onToggleSnapshot}
        selectMode={selectMode}
        onToggleSelectMode={() => {
          if (snapshotLocked) return
          setSelectMode(!selectMode)
        }}
        onSelectAll={handleSelectAll}
        onClearSelection={() => {
          if (snapshotLocked) return
          setSelectedMessages(new Set())
        }}
      />

      <MessageFiltersBar
        searchTerm={searchTerm}
        correlationFilter={correlationFilter}
        eventTypeFilter={eventTypeFilter}
        disabled={snapshotLocked}
        onSearchTermChange={(v) => {
          if (snapshotLocked) return
          setSearchTerm(v)
        }}
        onClearSearchTerm={() => {
          if (snapshotLocked) return
          setSearchTerm('')
        }}
        onCorrelationFilterChange={(v) => {
          if (snapshotLocked) return
          setCorrelationFilter(v)
        }}
        onClearCorrelationFilter={() => {
          if (snapshotLocked) return
          setCorrelationFilter('')
        }}
        onEventTypeFilterChange={(v) => {
          if (snapshotLocked) return
          setEventTypeFilter(v)
        }}
        onClearEventTypeFilter={() => {
          if (snapshotLocked) return
          setEventTypeFilter('')
        }}
      />

      <div className="table-wrapper">
        {sortedMessages.length === 0 ? (
          <div className="empty-messages">
            <p>{messages.length === 0 ? 'No messages to display' : 'No messages match your filters'}</p>
            {messages.length > 0 && (
              <button onClick={handleClearFilters} className="btn-outline">
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <table className="message-table">
              <colgroup>
                {selectMode && <col style={{ width: '32px' }} />}
                {isDLQ && dlqClassifications && <col style={{ width: '110px' }} />}
                <col style={{ width: '26px' }} />
                <col style={{ width: '60px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '90px' }} />
                {isDLQ && <col style={{ width: '160px' }} />}
                {isDLQ && <col style={{ width: '240px' }} />}
                <col style={{ width: '160px' }} />
                {/* Preview takes remaining width */}
                <col />
                <col style={{ width: '220px' }} />
                <col style={{ width: '72px' }} />
              </colgroup>
            <thead>
              <tr>
                {selectMode && (
                  <th className="checkbox-col">
                    <input
                      type="checkbox"
                      checked={selectedMessages.size === sortedMessages.length && sortedMessages.length > 0}
                      onChange={handleSelectAll}
                      title="Select all"
                    />
                  </th>
                )}
                {isDLQ && dlqClassifications && (
                  <th className="dlq-status-col" title="AI Replay Advisor classification">
                    AI Status
                  </th>
                )}
                <th className="chevron-col" aria-label="Row details"></th>
                <th onClick={() => handleSort('sequenceNumber')} className="sortable seq-col">
                  Seq# {sortField === 'sequenceNumber' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('enqueuedTimeUtc')} className="sortable time-col">
                  Enqueued {sortField === 'enqueuedTimeUtc' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('deliveryCount')} className="sortable delivery-col">
                  Delivery {sortField === 'deliveryCount' && (sortAsc ? '▲' : '▼')}
                </th>
                {isDLQ && (
                  <>
                    <th className="dlq-reason-col">DeadLetterReason</th>
                    <th className="dlq-error-col">DeadLetterErrorDescription</th>
                  </>
                )}
                <th className="eventtype-col">Event Type</th>
                <th className="preview-col">Message Preview</th>
                <th className="id-col">Message ID</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedMessages.map(message => (
                <tr 
                  key={message.sequenceNumber} 
                  className={`message-row ${correlationFilter && message.correlationId?.toLowerCase().includes(correlationFilter.toLowerCase()) ? 'correlation-highlight' : ''}`}
                  onClick={() => handleRowClick(message)}
                  style={{ cursor: selectMode ? 'default' : 'pointer' }}
                >
                  {selectMode && (
                    <td className="checkbox-col" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedMessages.has(message.sequenceNumber)}
                        onChange={() => handleSelectMessage(message.sequenceNumber)}
                      />
                    </td>
                  )}
                  {isDLQ && dlqClassifications && (
                    <td className="dlq-status-col">
                      <div className="dlq-status-content">
                        {(() => {
                          const classification = dlqClassifications.get(message.messageId)
                          if (!classification) return '—'
                          
                          const icon = classification.classification === 'SAFE_TO_REPLAY'
                            ? '✅'
                            : classification.classification === 'NEEDS_INVESTIGATION'
                            ? '🔍'
                            : '⛔'
                          
                          const className = `dlq-status-badge ${classification.classification.toLowerCase().replace(/_/g, '-')}`
                          
                          return (
                            <div>
                              <span
                                className={className}
                                title={`${classification.classification} - ${classification.confidence}% confidence - ${classification.explanation}`}
                              >
                                {icon}
                              </span>
                              {/* {classification.riskSignals && classification.riskSignals.length > 0 && (
                                <div className="dlq-risk-signals">
                                  <RiskSignalGroup signals={classification.riskSignals} maxDisplay={2} />
                                </div>
                              )} */}
                            </div>
                          )
                        })()}
                      </div>
                    </td>
                  )}
                  <td className={`chevron-col ${selectMode ? 'disabled' : ''}`} aria-hidden="true">
                    <span className="row-chevron">›</span>
                  </td>
                  <td className="seq-col">{message.sequenceNumber}</td>
                  <td className="time-col" title={formatTimestamp(message.enqueuedTimeUtc)}>
                    {formatRelativeTime(message.enqueuedTimeUtc)}
                  </td>
                  <td className="delivery-col">
                    {isDLQ ? (
                      <span className="dlq-delivery-count" title={`DeliveryCount: ${message.deliveryCount}`}>
                        {message.deliveryCount}
                      </span>
                    ) : (
                      <DeliveryBadge count={message.deliveryCount} size="small" />
                    )}
                  </td>
                  {isDLQ && (
                    <>
                      <td className="dlq-reason-col" title={message.deadLetterReason || ''}>
                        <span className="dlq-text-ellipsis">{message.deadLetterReason || '—'}</span>
                      </td>
                      <td className="dlq-error-col" title={message.deadLetterErrorDescription || ''}>
                        <span className="dlq-text-ellipsis">{message.deadLetterErrorDescription || '—'}</span>
                      </td>
                    </>
                  )}
                  <td className="eventtype-col">
                    <EventTypeChip 
                      message={message}
                      onClick={() => {
                        if (snapshotLocked) return
                        const { eventType } = extractEventType(message)
                        if (eventType) setEventTypeFilter(eventType)
                      }}
                    />
                  </td>
                  <td className="preview-col" title={message.previewText || ''}>
                    <span className="message-preview">{message.previewText || '—'}</span>
                  </td>
                  <td className="id-col" title={message.messageId}>
                    <span className="message-id">{message.messageId}</span>
                  </td>
                  <td className="actions-col" onClick={(e) => e.stopPropagation()}>
                    <div className="action-buttons">
                      <button
                        onClick={() => onMessageSelect && onMessageSelect(message)}
                        className="btn-icon-only"
                        title="View details"
                      >
                        👁
                      </button>
                      <button
                        onClick={() => handleDownload(message)}
                        className="btn-icon-only"
                        title="Download as JSON"
                        disabled={snapshotLocked || disabled}
                      >
                        📄
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* INSPECTOR MODE Footer - pinned to grid bottom (not overlay) */}
      <Pagination
        filteredCount={sortedMessages.length}
        loadedCount={messages.length}
        totalQueueCount={totalMessageCount}
        peekSize={peekSize}
        onPeekSizeChange={onPeekSizeChange}
        onLoadNextBatch={onLoadNextBatch}
        disabled={disabled || snapshotLocked}
      />

    </div>
  )
}
