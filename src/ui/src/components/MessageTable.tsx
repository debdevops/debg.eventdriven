/**
 * Message Table Component with selection, sorting, actions, DLQ replay, and export
 * Enhanced with: ActionToolbar, DeliveryBadge, MessageDetailPanel, Select Mode
 */

import { useState, useMemo } from 'react'
import { ActionToolbar } from './ActionToolbar'
import { DeliveryBadge } from './DeliveryBadge'
import { MessageDetailPanel } from './MessageDetailPanel'
import { formatTimestamp, formatRelativeTime, truncate } from '../utils/formatters'
import { API_BASE_URL } from '../config/api'
import type { MessageEnvelope } from '../types'
import './MessageTable.css'

interface MessageTableProps {
  messages: MessageEnvelope[]
  sessionId: string
  entityName: string
  subscriptionName?: string
  isDLQ?: boolean
  onRefresh?: () => void
  frozenSnapshot?: boolean
  onToggleSnapshot?: () => void
}

export default function MessageTable({
  messages,
  sessionId,
  entityName,
  subscriptionName,
  isDLQ = false,
  onRefresh,
  frozenSnapshot = false,
  onToggleSnapshot
}: MessageTableProps) {
  const [sortField, setSortField] = useState<keyof MessageEnvelope>('sequenceNumber')
  const [sortAsc, setSortAsc] = useState(false) // Default: newest first
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDeliveryCount, setFilterDeliveryCount] = useState<number | null>(null)
  const [selectedMessages, setSelectedMessages] = useState<Set<number>>(new Set())
  const [correlationFilter, setCorrelationFilter] = useState<string>('')
  const [replayLoading, setReplayLoading] = useState(false)
  
  // Select mode and detail panel
  const [selectMode, setSelectMode] = useState(false)
  const [detailMessage, setDetailMessage] = useState<MessageEnvelope | null>(null)

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
    if (selectedMessages.size === filteredAndSortedMessages.length) {
      setSelectedMessages(new Set())
    } else {
      setSelectedMessages(new Set(filteredAndSortedMessages.map(m => m.sequenceNumber)))
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
    if (!confirm(`Replay ALL ${filteredAndSortedMessages.length} DLQ messages?`)) return
    
    setReplayLoading(true)
    try {
      const url = subscriptionName
        ? `${API_BASE_URL}/api/queue/${sessionId}/${entityName}/dlq/replay-all?subscriptionName=${subscriptionName}`
        : `${API_BASE_URL}/api/queue/${sessionId}/${entityName}/dlq/replay-all`

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxMessages: filteredAndSortedMessages.length })
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
    const blob = new Blob([JSON.stringify(filteredAndSortedMessages, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `messages-all-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRowClick = (message: MessageEnvelope) => {
    if (!selectMode) {
      setDetailMessage(message)
    }
  }

  const handlePreviousMessage = () => {
    if (!detailMessage) return
    const currentIndex = filteredAndSortedMessages.findIndex(m => m.sequenceNumber === detailMessage.sequenceNumber)
    if (currentIndex > 0) {
      setDetailMessage(filteredAndSortedMessages[currentIndex - 1])
    }
  }

  const handleNextMessage = () => {
    if (!detailMessage) return
    const currentIndex = filteredAndSortedMessages.findIndex(m => m.sequenceNumber === detailMessage.sequenceNumber)
    if (currentIndex < filteredAndSortedMessages.length - 1) {
      setDetailMessage(filteredAndSortedMessages[currentIndex + 1])
    }
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setCorrelationFilter('')
    setFilterDeliveryCount(null)
  }

  // Filter and sort messages
  const filteredAndSortedMessages = useMemo(() => {
    let filtered = messages

    // Apply search filter
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

    // Apply correlation filter
    if (correlationFilter) {
      filtered = filtered.filter(msg => 
        msg.correlationId?.toLowerCase().includes(correlationFilter.toLowerCase())
      )
    }

    // Apply delivery count filter
    if (filterDeliveryCount !== null) {
      filtered = filtered.filter(msg => msg.deliveryCount === filterDeliveryCount)
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (aVal === undefined || bVal === undefined) return 0
      if (aVal < bVal) return sortAsc ? -1 : 1
      if (aVal > bVal) return sortAsc ? 1 : -1
      return 0
    })

    return sorted
  }, [messages, searchTerm, correlationFilter, filterDeliveryCount, sortField, sortAsc])

  return (
    <div className="message-table-container">
      {/* Unified Action Toolbar */}
      <ActionToolbar
        entityName={entityName}
        entityType={isDLQ ? 'dlq' : subscriptionName ? 'subscription' : 'queue'}
        totalMessages={filteredAndSortedMessages.length}
        selectedCount={selectedMessages.size}
        onRefresh={onRefresh || (() => {})}
        onReplay={isDLQ ? handleReplaySelected : undefined}
        onReplayAll={isDLQ ? handleReplayAll : undefined}
        onExportSelected={handleExportSelected}
        onExportAll={handleExportAll}
        onClearFilters={handleClearFilters}
        refreshing={false}
        loading={replayLoading}
        frozenSnapshot={frozenSnapshot}
        onToggleSnapshot={onToggleSnapshot}
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
            {filteredAndSortedMessages.length} message{filteredAndSortedMessages.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {filteredAndSortedMessages.length === 0 ? (
        <div className="empty-messages">
          <p>{messages.length === 0 ? 'No messages to display' : 'No messages match your filters'}</p>
          {messages.length > 0 && (
            <button onClick={handleClearFilters} className="btn-outline">
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="message-table enhanced">
            <thead>
              <tr>
                {selectMode && (
                  <th className="checkbox-col">
                    <input
                      type="checkbox"
                      checked={selectedMessages.size === filteredAndSortedMessages.length && filteredAndSortedMessages.length > 0}
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
                <th className="preview-col">Preview</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedMessages.map(message => (
                <tr 
                  key={message.sequenceNumber} 
                  className={`message-row ${correlationFilter && message.correlationId?.toLowerCase().includes(correlationFilter.toLowerCase()) ? 'correlation-highlight' : ''} ${detailMessage?.sequenceNumber === message.sequenceNumber ? 'selected' : ''}`}
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
                  <td className="preview-col">
                    <div className="preview-content">
                      <div className="preview-id" title={message.messageId}>{truncate(message.messageId, 30)}</div>
                      <div className="preview-body">{truncate(message.body, 100)}</div>
                    </div>
                  </td>
                  <td className="actions-col" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setDetailMessage(message)}
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
      )}

      {/* Message Detail Panel - Slide out from right */}
      {detailMessage && (
        <MessageDetailPanel
          message={detailMessage}
          messages={filteredAndSortedMessages}
          onClose={() => setDetailMessage(null)}
          onPrevious={handlePreviousMessage}
          onNext={handleNextMessage}
          onResubmit={undefined}
          onDelete={undefined}
          onMoveToDLQ={undefined}
        />
      )}
    </div>
  )
}
