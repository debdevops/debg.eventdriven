/**
 * Message Table Component with selection, sorting, actions, DLQ replay, and export
 * Enhanced with: ActionToolbar, DeliveryBadge, Pagination, Select Mode, Anomaly Detection
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - C3: Debounced search/filter inputs (prevents excessive re-renders)
 * - C1: Virtual scrolling with @tanstack/react-virtual (renders only visible rows)
 * - C2: Memoized MessageRow component (prevents unnecessary row re-renders)
 * 
 * PERFORMANCE TARGETS:
 * - < 50ms render time for 1000+ messages
 * - 60fps smooth scrolling
 * - ~80% reduction in component re-renders
 */

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
// import { useVirtualizer } from '@tanstack/react-virtual' // Disabled for layout fix
import { ActionToolbar } from '@/shared/ui/organisms/ActionToolbar'
import { Pagination } from '@/shared/ui/molecules/Pagination'
import { QueueHealthHeader } from '@/features/namespaces/components/QueueHealthHeader'
import { MessageAgeDistribution } from '@/shared/ui/molecules/MessageAgeDistribution'
import { MessageFiltersBar } from './MessageFiltersBar'
import { MessageRow } from './MessageRow'
import { useDebounce } from "@/shared/hooks/useDebounce"
import { extractEventType, type AgeDistribution } from "@/shared/lib/utils/eventTypeExtractor"
import { API_BASE_URL } from "@/shared/config/api"
import type { MessageEnvelope } from '../types'
import type { DlqMessageClassification } from "@/shared/lib/services/dlqReplayAdvisor"
import './MessageTable.css'
import './AnomalyBadge.css'

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
  const [filterDeliveryCount, setFilterDeliveryCount] = useState<number | null>(null)
  
  // Select mode
  const [selectMode, setSelectMode] = useState(false)

  // Performance: Debounce search/filter inputs to prevent excessive re-renders
  // 300ms delay provides responsive feel while avoiding render thrashing
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const debouncedCorrelationFilter = useDebounce(correlationFilter, 300)
  const debouncedEventTypeFilter = useDebounce(eventTypeFilter, 300)

  // C1: Virtualization - Container ref for virtual scrolling
  const tableContainerRef = useRef<HTMLDivElement>(null)

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

  // C2: MEMOIZED EVENT HANDLERS - prevents MessageRow re-renders
  const handleDownload = useCallback((message: MessageEnvelope) => {
    if (snapshotLocked) return
    const blob = new Blob([JSON.stringify(message, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `message-${message.messageId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [snapshotLocked])

  const handleSort = useCallback((field: keyof MessageEnvelope) => {
    if (snapshotLocked) return
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }, [snapshotLocked, sortField, sortAsc])

  const handleSelectMessage = useCallback((seqNum: number) => {
    if (snapshotLocked) return
    setSelectedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(seqNum)) {
        newSet.delete(seqNum)
      } else {
        newSet.add(seqNum)
      }
      return newSet
    })
  }, [snapshotLocked])

  const handleRowClick = useCallback((message: MessageEnvelope) => {
    if (!selectMode && onMessageSelect) {
      onMessageSelect(message)
    }
  }, [selectMode, onMessageSelect])

  const handleEventTypeClick = useCallback((eventType: string) => {
    if (snapshotLocked) return
    setEventTypeFilter(eventType)
  }, [snapshotLocked])

  const handleClearFilters = useCallback(() => {
    if (snapshotLocked) return
    setSearchTerm('')
    setCorrelationFilter('')
    setEventTypeFilter('')
    setAgeBucketFilter(null)
  }, [snapshotLocked])

  const handleAgeBucketClick = useCallback((bucket: keyof AgeDistribution) => {
    if (snapshotLocked) return
    setAgeBucketFilter(prev => prev === bucket ? null : bucket)
  }, [snapshotLocked])

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

  // STEP 1: Base filters (search, correlation, eventType) - using debounced values for performance
  const baseFilteredMessages = useMemo(() => {
    let filtered = messages

    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase()
      filtered = filtered.filter(msg => 
        msg.messageId.toLowerCase().includes(term) ||
        msg.body?.toLowerCase().includes(term) ||
        msg.subject?.toLowerCase().includes(term) ||
        msg.correlationId?.toLowerCase().includes(term) ||
        JSON.stringify(msg.applicationProperties || {}).toLowerCase().includes(term)
      )
    }

    if (debouncedCorrelationFilter) {
      filtered = filtered.filter(msg => 
        msg.correlationId?.toLowerCase().includes(debouncedCorrelationFilter.toLowerCase())
      )
    }

    if (debouncedEventTypeFilter) {
      filtered = filtered.filter(msg => {
        const { eventType } = extractEventType(msg)
        return eventType?.toLowerCase().includes(debouncedEventTypeFilter.toLowerCase())
      })
    }

    return filtered
  }, [messages, debouncedSearchTerm, debouncedCorrelationFilter, debouncedEventTypeFilter])

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
   * C1: VIRTUALIZATION TEMPORARILY DISABLED FOR LAYOUT FIX
   * 
   * Issue: Virtual scrolling with position:absolute breaks table layout
   * Solution: Render all rows with proper table structure, re-enable later with CSS Grid
   * 
   * TODO: Implement CSS Grid-based virtualization for proper column alignment
   */
  
  // const rowVirtualizer = useVirtualizer({
  //   count: sortedMessages.length,
  //   getScrollElement: () => tableContainerRef.current,
  //   estimateSize: () => 48,
  //   overscan: 5,
  // })

  // handleSelectAll depends on sortedMessages, so must come after it's defined
  const handleSelectAll = useCallback(() => {
    if (snapshotLocked) return
    if (selectedMessages.size === sortedMessages.length) {
      setSelectedMessages(new Set())
    } else {
      setSelectedMessages(new Set(sortedMessages.map(m => m.sequenceNumber)))
    }
  }, [snapshotLocked, selectedMessages.size, sortedMessages])

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
        filterDeliveryCount={filterDeliveryCount}
        resultCount={baseFilteredMessages.length}
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
        onFilterDeliveryCountChange={(v) => {
          if (snapshotLocked) return
          setFilterDeliveryCount(v)
        }}
      />

      {/* C1: Virtualized table container with flexible height for scrolling */}
      <div className="table-wrapper" ref={tableContainerRef} style={{ 
        flex: '1 1 auto',
        minHeight: '400px',
        maxHeight: '70vh',
        overflow: 'auto',
        position: 'relative' 
      }}>
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
          <table className="message-table virtualized" style={{ 
            width: '100%',
            tableLayout: 'fixed'
          }}>
              <colgroup>
                {selectMode && <col style={{ width: '32px' }} />}
                {isDLQ && dlqClassifications && <col style={{ width: '110px' }} />}
                <col style={{ width: '40px' }} /> {/* Anomaly indicator */}
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
            <thead style={{ 
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: 'var(--surface)'
            }}>
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
                <th className="anomaly-col" title="Anomaly indicators">⚠️</th>
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
            {/* 
              RENDER ALL ROWS (Virtualization disabled for layout fix)
              Showing all messages with proper table structure
            */}
            <tbody>
              {sortedMessages.map(message => {
                const isSelected = selectedMessages.has(message.sequenceNumber)
                const dlqClassification = isDLQ && dlqClassifications 
                  ? dlqClassifications.get(message.messageId) 
                  : undefined

                return (
                  <MessageRow
                    key={message.sequenceNumber}
                    message={message}
                    selectMode={selectMode}
                    isSelected={isSelected}
                    isDLQ={isDLQ}
                    correlationFilter={correlationFilter}
                    snapshotLocked={snapshotLocked}
                    disabled={disabled}
                    dlqClassification={dlqClassification}
                    onRowClick={handleRowClick}
                    onSelectMessage={handleSelectMessage}
                    onMessageSelect={onMessageSelect}
                    onDownload={handleDownload}
                    onEventTypeClick={handleEventTypeClick}
                  />
                )
              })}
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
