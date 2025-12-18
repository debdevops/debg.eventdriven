/**
 * Message Table Component with selection, sorting, actions, DLQ replay, and export
 * Enhanced with: ActionToolbar, DeliveryBadge, Pagination, Select Mode
 */

import { useState, useMemo } from 'react'
import { ActionToolbar } from './ActionToolbar'
import { DeliveryBadge } from './DeliveryBadge'
import { Pagination } from './Pagination'
import { QueueHealthHeader } from './QueueHealthHeader'
import { MessageAgeDistribution } from './MessageAgeDistribution'
import { EventTypeChip } from './EventTypeChip'
import { formatTimestamp, formatRelativeTime, truncate } from '../utils/formatters'
import { extractEventType, type AgeDistribution } from '../utils/eventTypeExtractor'
import { API_BASE_URL } from '../config/api'
import type { MessageEnvelope } from '../types'
import './MessageTable.css'

interface MessageTableProps {
  messages: MessageEnvelope[]
  sessionId: string
  entityName: string
  subscriptionName?: string
  isDLQ?: boolean
  dlqCount?: number
  onRefresh?: () => void
  frozenSnapshot?: boolean
  onToggleSnapshot?: () => void
  onAiInsights?: () => void
  aiInsightsLoading?: boolean
  hasAiInsights?: boolean
  onMessageSelect?: (message: MessageEnvelope) => void
}

export default function MessageTable({
  messages,
  sessionId,
  entityName,
  subscriptionName,
  isDLQ = false,
  dlqCount = 0,
  onRefresh,
  frozenSnapshot = false,
  onToggleSnapshot,
  onAiInsights,
  aiInsightsLoading = false,
  hasAiInsights = false,
  onMessageSelect
}: MessageTableProps) {
  const [sortField, setSortField] = useState<keyof MessageEnvelope>('sequenceNumber')
  const [sortAsc, setSortAsc] = useState(false) // Default: newest first
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDeliveryCount, setFilterDeliveryCount] = useState<number | null>(null)
  const [selectedMessages, setSelectedMessages] = useState<Set<number>>(new Set())
  const [correlationFilter, setCorrelationFilter] = useState<string>('')
  const [replayLoading, setReplayLoading] = useState(false)
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('')
  const [ageBucketFilter, setAgeBucketFilter] = useState<keyof AgeDistribution | null>(null)
  
  // Select mode and pagination
  const [selectMode, setSelectMode] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const handleDownload = (message: MessageEnvelope) => {
    const blob = new Blob([JSON.stringify(message, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `message-${message.messageId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSort = (field: keyof MessageEnvelope) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  const handleSelectAll = () => {
    if (selectedMessages.size === sortedMessages.length) {
      setSelectedMessages(new Set())
    } else {
      setSelectedMessages(new Set(sortedMessages.map(m => m.sequenceNumber)))
    }
  }

  const handleSelectMessage = (seqNum: number) => {
    const newSet = new Set(selectedMessages)
    if (newSet.has(seqNum)) {
      newSet.delete(seqNum)
    } else {
      newSet.add(seqNum)
    }
    setSelectedMessages(newSet)
  }

  const handleReplaySelected = async () => {
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
    setSearchTerm('')
    setCorrelationFilter('')
    setFilterDeliveryCount(null)
    setEventTypeFilter('')
    setAgeBucketFilter(null)
    setCurrentPage(1)
  }

  const handleAgeBucketClick = (bucket: keyof AgeDistribution) => {
    setAgeBucketFilter(ageBucketFilter === bucket ? null : bucket)
    setCurrentPage(1)
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

  // STEP 1: Base filters (search, correlation, delivery, eventType)
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

    if (filterDeliveryCount !== null) {
      filtered = filtered.filter(msg => msg.deliveryCount === filterDeliveryCount)
    }

    if (eventTypeFilter) {
      filtered = filtered.filter(msg => {
        const { eventType } = extractEventType(msg)
        return eventType?.toLowerCase().includes(eventTypeFilter.toLowerCase())
      })
    }

    return filtered
  }, [messages, searchTerm, correlationFilter, filterDeliveryCount, eventTypeFilter])

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

  // STEP 4: Sort age-filtered results
  const sortedMessages = useMemo(() => {
    return [...ageFilteredMessages].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (aVal === undefined || bVal === undefined) return 0
      if (aVal < bVal) return sortAsc ? -1 : 1
      if (aVal > bVal) return sortAsc ? 1 : -1
      return 0
    })
  }, [ageFilteredMessages, sortField, sortAsc])

  // STEP 5: Paginate - applied LAST to ensure page size is authoritative
  const paginatedMessages = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return sortedMessages.slice(start, end)
  }, [sortedMessages, currentPage, pageSize])

  return (
    <div className="message-table-container">
      {/* Queue Health Header - shows stats for base-filtered view */}
      <QueueHealthHeader 
        messages={baseFilteredMessages}
        dlqCount={dlqCount}
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
        onAiInsights={onAiInsights}
        refreshing={false}
        loading={replayLoading}
        frozenSnapshot={frozenSnapshot}
        onToggleSnapshot={onToggleSnapshot}
        aiInsightsLoading={aiInsightsLoading}
        hasAiInsights={hasAiInsights}
        selectMode={selectMode}
        onToggleSelectMode={() => setSelectMode(!selectMode)}
        onSelectAll={handleSelectAll}
        onClearSelection={() => setSelectedMessages(new Set())}
      />

      {/* Search and Filter Controls */}
      <div className="search-filter-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search messages (ID, body, subject, properties...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="clear-search"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <div className="search-box" style={{maxWidth: '300px'}}>
          <input
            type="text"
            placeholder="Filter by Correlation ID..."
            value={correlationFilter}
            onChange={(e) => setCorrelationFilter(e.target.value)}
            className="search-input"
          />
          {correlationFilter && (
            <button 
              onClick={() => setCorrelationFilter('')} 
              className="clear-search"
              title="Clear correlation filter"
            >
              ✕
            </button>
          )}
        </div>
        <div className="search-box" style={{maxWidth: '250px'}}>
          <input
            type="text"
            placeholder="Filter by Event Type..."
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="search-input"
          />
          {eventTypeFilter && (
            <button 
              onClick={() => setEventTypeFilter('')} 
              className="clear-search"
              title="Clear event type filter"
            >
              ✕
            </button>
          )}
        </div>
        <div className="filter-controls">
          <select
            value={filterDeliveryCount === null ? '' : filterDeliveryCount}
            onChange={(e) => setFilterDeliveryCount(e.target.value === '' ? null : Number(e.target.value))}
            className="filter-select"
          >
            <option value="">All Deliveries</option>
            <option value="0">First Delivery</option>
            <option value="1">1 Retry</option>
            <option value="2">2+ Retries</option>
          </select>
          <span className="result-count">
            {sortedMessages.length} message{sortedMessages.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

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
        <>
          <div className="table-wrapper">
            <table className="message-table">
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
                <th onClick={() => handleSort('sequenceNumber')} className="sortable seq-col">
                  Seq# {sortField === 'sequenceNumber' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('enqueuedTimeUtc')} className="sortable time-col">
                  Enqueued {sortField === 'enqueuedTimeUtc' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('deliveryCount')} className="sortable delivery-col">
                  Delivery {sortField === 'deliveryCount' && (sortAsc ? '▲' : '▼')}
                </th>
                <th className="eventtype-col">Event Type</th>
                <th className="id-col">Message ID</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMessages.map(message => (
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
                  <td className="seq-col">{message.sequenceNumber}</td>
                  <td className="time-col" title={formatTimestamp(message.enqueuedTimeUtc)}>
                    {formatRelativeTime(message.enqueuedTimeUtc)}
                  </td>
                  <td className="delivery-col">
                    <DeliveryBadge count={message.deliveryCount} size="small" />
                  </td>
                  <td className="eventtype-col">
                    <EventTypeChip 
                      message={message}
                      onClick={() => {
                        const { eventType } = extractEventType(message)
                        if (eventType) setEventTypeFilter(eventType)
                      }}
                    />
                  </td>
                  <td className="id-col" title={message.messageId}>
                    {truncate(message.messageId, 35)}
                  </td>
                  <td className="actions-col" onClick={(e) => e.stopPropagation()}>
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
                    >
                      📄
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={sortedMessages.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setCurrentPage(1)
          }}
        />
      </>
      )}
    </div>
  )
}
