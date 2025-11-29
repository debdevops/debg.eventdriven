/**
 * Message Table Component with selection, sorting, and actions
 */

import { useState, useMemo } from 'react'
import { MessageModal } from './MessageModal'
import { formatTimestamp, formatRelativeTime, truncate } from '../utils/formatters'
import type { MessageEnvelope } from '../types'
import './MessageTable.css'

interface MessageTableProps {
  messages: MessageEnvelope[]
}

export default function MessageTable({
  messages
}: MessageTableProps) {
  const [modalMessage, setModalMessage] = useState<MessageEnvelope | null>(null)
  const [sortField, setSortField] = useState<keyof MessageEnvelope>('sequenceNumber')
  const [sortAsc, setSortAsc] = useState(false) // Default: newest first
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDeliveryCount, setFilterDeliveryCount] = useState<number | null>(null)

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

  const getMessageSize = (message: MessageEnvelope): string => {
    const sizeBytes = JSON.stringify(message).length
    if (sizeBytes < 1024) return `${sizeBytes} B`
    return `${(sizeBytes / 1024).toFixed(2)} KB`
  }

  const getDeliveryBadgeClass = (count: number): string => {
    if (count === 0) return 'delivery-badge-success'
    if (count === 1) return 'delivery-badge-warning'
    return 'delivery-badge-danger'
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
        JSON.stringify(msg.applicationProperties || {}).toLowerCase().includes(term)
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
  }, [messages, searchTerm, filterDeliveryCount, sortField, sortAsc])

  return (
    <div className="message-table-container">
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
            <button onClick={() => { setSearchTerm(''); setFilterDeliveryCount(null); }} className="btn-outline">
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="message-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('messageId')} className="sortable">
                  Message ID {sortField === 'messageId' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('sequenceNumber')} className="sortable">
                  Seq# {sortField === 'sequenceNumber' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('enqueuedTimeUtc')} className="sortable">
                  Enqueued {sortField === 'enqueuedTimeUtc' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('deliveryCount')} className="sortable">
                  Delivery {sortField === 'deliveryCount' && (sortAsc ? '▲' : '▼')}
                </th>
                <th>Size</th>
                <th>Preview</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedMessages.map(message => (
                <tr key={message.sequenceNumber}>
                  <td className="message-id" title={message.messageId}>
                    {truncate(message.messageId, 20)}
                  </td>
                  <td>{message.sequenceNumber}</td>
                  <td title={formatTimestamp(message.enqueuedTimeUtc)}>
                    {formatRelativeTime(message.enqueuedTimeUtc)}
                  </td>
                  <td>
                    <span className={`delivery-badge ${getDeliveryBadgeClass(message.deliveryCount)}`}>
                      {message.deliveryCount}
                    </span>
                  </td>
                  <td className="message-size">{getMessageSize(message)}</td>
                  <td className="message-preview">{truncate(message.body, 60)}</td>
                  <td className="action-buttons">
                    <button
                      onClick={() => setModalMessage(message)}
                      className="btn-sm btn-outline"
                      title="View full message"
                    >
                      👁 View
                    </button>
                    <button
                      onClick={() => handleDownload(message)}
                      className="btn-sm btn-outline"
                      title="Download as JSON"
                    >
                      ⬇ JSON
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalMessage && (
        <MessageModal
          message={modalMessage}
          onClose={() => setModalMessage(null)}
        />
      )}
    </div>
  )
}
