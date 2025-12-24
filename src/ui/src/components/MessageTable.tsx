/**
 * Message Table Component with selection, sorting, actions, DLQ replay, and export
 * Enhanced with: ActionToolbar, DeliveryBadge, Pagination, Select Mode
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ActionToolbar } from './ActionToolbar'
import { DeliveryBadge } from './DeliveryBadge'
import { Pagination } from './Pagination'
import { QueueHealthHeader } from './QueueHealthHeader'
import { MessageAgeDistribution } from './MessageAgeDistribution'
import { EventTypeChip } from './EventTypeChip'
import { RiskSignalGroup } from './RiskSignalBadge'
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
  onAiInsights?: () => void
  aiInsightsLoading?: boolean
  hasAiInsights?: boolean
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
  onAiInsights,
  aiInsightsLoading = false,
  hasAiInsights = false,
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
  const [filterDeliveryCount, setFilterDeliveryCount] = useState<number | null>(null)
  const [selectedMessages, setSelectedMessages] = useState<Set<number>>(new Set())
  const [correlationFilter, setCorrelationFilter] = useState<string>('')
  const [replayLoading, setReplayLoading] = useState(false)
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('')
  const [ageBucketFilter, setAgeBucketFilter] = useState<keyof AgeDistribution | null>(null)

  // FIX(tooltip): stable payload tooltip rendered via Portal (not inside table DOM).
  // Spec: ~300ms delay, closes on row leave, fixed-position overlay.
  const [payloadTooltip, setPayloadTooltip] = useState<{
    content: string
    anchorRect: DOMRect
  } | null>(null)
  const showTimerRef = useRef<number | null>(null)
  const hideTimerRef = useRef<number | null>(null)

  const clearTooltipTimers = () => {
    if (showTimerRef.current != null) {
      window.clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  const scheduleShowTooltip = (content: string, anchorEl: HTMLElement) => {
    clearTooltipTimers()
    showTimerRef.current = window.setTimeout(() => {
      // Only one tooltip at a time.
      setPayloadTooltip({ content, anchorRect: anchorEl.getBoundingClientRect() })
      showTimerRef.current = null
    }, 300)
  }

  const scheduleHideTooltip = () => {
    clearTooltipTimers()
    hideTimerRef.current = window.setTimeout(() => {
      setPayloadTooltip(null)
      hideTimerRef.current = null
    }, 0)
  }

  useEffect(() => {
    return () => {
      clearTooltipTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // Select mode
  const [selectMode, setSelectMode] = useState(false)
  
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
    setFilterDeliveryCount(null)
    setEventTypeFilter('')
    setAgeBucketFilter(null)
  }

  const handleAgeBucketClick = (bucket: keyof AgeDistribution) => {
    if (snapshotLocked) return
    setAgeBucketFilter(ageBucketFilter === bucket ? null : bucket)
  }

  const toSingleLine = (value: string) => value.replace(/\s+/g, ' ').trim()

  const safeParseJson = (text: string): any | null => {
    const trimmed = text.trim()
    if (!trimmed) return null
    if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null
    try {
      return JSON.parse(trimmed)
    } catch {
      return null
    }
  }

  const ellipsize = (text: string, maxChars: number) => {
    const singleLine = toSingleLine(text)
    if (singleLine.length <= maxChars) return singleLine
    return singleLine.slice(0, maxChars) + '…'
  }

  const getValueByKey = (obj: any, key: string): string | null => {
    if (!obj || typeof obj !== 'object') return null
    const value = obj[key]
    if (value === undefined || value === null) return null
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return null
  }

  const pruneForTooltip = (value: any, depth: number): any => {
    if (value === null || value === undefined) return value
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
    if (depth <= 0) {
      return Array.isArray(value) ? '[…]' : '{…}'
    }

    if (Array.isArray(value)) {
      const maxItems = 20
      const sliced = value.slice(0, maxItems).map((v) => pruneForTooltip(v, depth - 1))
      if (value.length > maxItems) sliced.push('…')
      return sliced
    }

    if (typeof value === 'object') {
      const out: Record<string, any> = {}
      const keys = Object.keys(value).slice(0, 30)
      for (const k of keys) {
        const lk = k.toLowerCase()
        // Exclude system/internal keys from tooltip to reduce noise.
        if (
          lk === 'message_id' ||
          lk === 'messageid' ||
          lk === 'id' ||
          lk === 'correlationid' ||
          lk === 'generationid' ||
          lk === 'internal' ||
          lk === 'system' ||
          lk.startsWith('_') ||
          lk.startsWith('$')
        ) {
          continue
        }
        out[k] = pruneForTooltip(value[k], depth - 1)
      }
      if (Object.keys(value).length > keys.length) {
        out['…'] = '…'
      }
      return out
    }

    return String(value)
  }

  const buildPayloadSummaryAndTooltip = (message: MessageEnvelope, maxChars = 120) => {
    const rawBody = message.body || ''
    if (!rawBody) {
      return { summary: '—', tooltip: '' }
    }

    const json = safeParseJson(rawBody)
    const data = json && typeof json === 'object' ? (json.data ?? null) : null
    const top = json && typeof json === 'object' && !Array.isArray(json) ? json : null

    const getAny = (...candidates: Array<[any, string]>) => {
      for (const [obj, key] of candidates) {
        const v = getValueByKey(obj, key)
        if (v) return v
      }
      return null
    }

    // Determine event type (prefer app props/body, fallback to subject).
    const eventType =
      getAny(
        [data, 'event_type'],
        [data, 'eventType'],
        [top, 'event_type'],
        [top, 'eventType'],
        [message.applicationProperties, 'event_type'],
        [message.applicationProperties, 'eventType']
      ) || message.subject || null

    const correlationId =
      getAny(
        [message, 'correlationId'],
        [message.applicationProperties, 'correlationId'],
        [message.applicationProperties, 'correlation_id'],
        [data, 'correlationId'],
        [data, 'correlation_id'],
        [top, 'correlationId'],
        [top, 'correlation_id']
      ) || null

    const payloadTimestamp =
      getAny(
        [data, 'timestamp'],
        [data, 'time'],
        [top, 'timestamp'],
        [top, 'time']
      ) || null

    // FIX(payload-summary): prefer eventType/correlationId/timestamp and business keys; exclude messageId.
    // Summary stays compact; full JSON remains available in tooltip.
    const preferredKeys = [
      'entityId',
      'orderId',
      'paymentId',
      'accountId',
      'sku',
      'amount',
      'currency',
      'status',
      'reason',
      'failureReason',
      'customerId',
      'carrier',
      'quantity',
      'delta'
    ]

    const excludedKeys = new Set([
      'message_id',
      'messageid',
      'messageId',
      'id',
      'sequenceNumber',
      'sequencenumber',
      'sequence_number',
      'generationid',
      'event_type',
      'eventtype',
      'internal',
      'system'
    ])

    const collectFromObject = (obj: any) => {
      const pairs: Array<[string, string]> = []
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return pairs

      for (const key of preferredKeys) {
        const lk = key.toLowerCase()
        if (excludedKeys.has(lk)) continue
        const v = getValueByKey(obj, key)
        if (v) pairs.push([key, v])
      }

      return pairs
    }

    const pairs: Array<[string, string]> = []

    // Add high-signal fields first.
    if (eventType) pairs.push(['eventType', String(eventType)])
    if (correlationId) pairs.push(['correlationId', String(correlationId)])
    if (payloadTimestamp) pairs.push(['timestamp', String(payloadTimestamp)])

    // Prefer nested data payload if present, then top-level.
    for (const [k, v] of collectFromObject(data)) {
      if (!pairs.some(([ek]) => ek === k)) pairs.push([k, v])
    }
    for (const [k, v] of collectFromObject(top)) {
      if (!pairs.some(([ek]) => ek === k)) pairs.push([k, v])
    }

    // If none of the preferred keys exist, fallback to first 2–3 safe top-level keys.
    if (pairs.length === 0 && top) {
      const keys = Object.keys(top)
        .filter((k) => {
          const lk = k.toLowerCase()
          if (excludedKeys.has(lk)) return false
          if (lk.startsWith('_') || lk.startsWith('$')) return false
          return true
        })
        .slice(0, 3)

      for (const k of keys) {
        const v = getValueByKey(top, k)
        if (v) pairs.push([k, v])
      }
    }

    const selectedPairs = pairs.slice(0, 4)
    const baseSummary = selectedPairs.length > 0
      ? selectedPairs.map(([k, v]) => `${k}=${v}`).join(' · ')
      : (() => {
          const raw = toSingleLine(rawBody)
          // Ensure summary never collapses to a single raw token.
          if (eventType && raw === String(eventType)) return `body=${raw}`
          return raw
        })()

    const summary = ellipsize(baseSummary, maxChars)

    // Tooltip: highlight important fields + pretty JSON (depth-limited) or raw string.
    const importantLines: string[] = []
    if (eventType) importantLines.push(`★ eventType: ${eventType}`)
    const findPair = (key: string) => selectedPairs.find(([k]) => k === key)?.[1] || null
    const orderId = findPair('orderId')
    const reason = findPair('reason') || findPair('failureReason')
    const status = findPair('status')
    if (orderId) importantLines.push(`★ orderId: ${orderId}`)
    if (reason) importantLines.push(`★ reason: ${reason}`)
    if (status) importantLines.push(`★ status: ${status}`)

    let payloadBlock = ''
    if (json) {
      const pruned = pruneForTooltip(json, 2)
      payloadBlock = JSON.stringify(pruned, null, 2)
    } else {
      payloadBlock = rawBody
    }

    // Keep tooltip bounded.
    const maxTooltipChars = 4000
    const tooltipRaw = [
      importantLines.length > 0 ? ['IMPORTANT', ...importantLines].join('\n') : '',
      '---',
      'PAYLOAD',
      payloadBlock
    ].filter(Boolean).join('\n')

    const tooltip = tooltipRaw.length > maxTooltipChars
      ? tooltipRaw.slice(0, maxTooltipChars) + '\n…'
      : tooltipRaw

    return { summary, tooltip }
  }

  // FIX(refactor): keep JSX mostly declarative; move cell composition into a helper.
  const renderPayloadPreviewCell = (message: MessageEnvelope) => {
    const { summary, tooltip } = buildPayloadSummaryAndTooltip(message, 120)
    const dlqPrefix = isDLQ ? '⚠️ ' : ''
    return (
      <td
        className="body-col"
        onMouseEnter={(e) => {
          if (!tooltip) {
            setPayloadTooltip(null)
            return
          }
          scheduleShowTooltip(tooltip, e.currentTarget as HTMLElement)
        }}
        onMouseLeave={() => {
          scheduleHideTooltip()
        }}
      >
        <span className={`message-body-preview ${isDLQ ? 'dlq' : ''}`}>
          {dlqPrefix}{summary}
        </span>
      </td>
    )
  }

  const renderPayloadTooltipPortal = () => {
    if (!payloadTooltip) return null

    const { anchorRect, content } = payloadTooltip
    const margin = 12
    const maxWidth = 420
    const maxHeight = 520

    const leftCandidate = anchorRect.right + margin
    const left = Math.min(Math.max(leftCandidate, 12), window.innerWidth - maxWidth - 12)
    const top = Math.min(Math.max(anchorRect.top, 12), window.innerHeight - maxHeight - 12)

    return createPortal(
      <div
        className="payload-tooltip"
        role="tooltip"
        aria-label="Payload tooltip"
        style={{ position: 'fixed', left, top, maxWidth, maxHeight, zIndex: 2000 }}
      >
        <div className="payload-tooltip-title">Payload (pretty JSON)</div>
        <pre className="payload-tooltip-pre">{content}</pre>
      </div>,
      document.body
    )
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
        onAiInsights={onAiInsights}
        refreshing={false}
        loading={replayLoading}
        disabled={disabled || snapshotLocked}
        frozenSnapshot={frozenSnapshot}
        onToggleSnapshot={onToggleSnapshot}
        aiInsightsLoading={aiInsightsLoading}
        hasAiInsights={hasAiInsights}
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

      {/* Search and Filter Controls */}
      <div className="search-filter-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search messages (ID, body, subject, properties...)"
            value={searchTerm}
            onChange={(e) => {
              if (snapshotLocked) return
              setSearchTerm(e.target.value)
            }}
            className="search-input"
            disabled={snapshotLocked}
          />
          {searchTerm && (
            <button 
              onClick={() => {
                if (snapshotLocked) return
                setSearchTerm('')
              }}
              className="clear-search"
              title="Clear search"
              disabled={snapshotLocked}
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
            onChange={(e) => {
              if (snapshotLocked) return
              setCorrelationFilter(e.target.value)
            }}
            className="search-input"
            disabled={snapshotLocked}
          />
          {correlationFilter && (
            <button 
              onClick={() => {
                if (snapshotLocked) return
                setCorrelationFilter('')
              }}
              className="clear-search"
              title="Clear correlation filter"
              disabled={snapshotLocked}
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
            onChange={(e) => {
              if (snapshotLocked) return
              setEventTypeFilter(e.target.value)
            }}
            className="search-input"
            disabled={snapshotLocked}
          />
          {eventTypeFilter && (
            <button 
              onClick={() => {
                if (snapshotLocked) return
                setEventTypeFilter('')
              }}
              className="clear-search"
              title="Clear event type filter"
              disabled={snapshotLocked}
            >
              ✕
            </button>
          )}
        </div>
        <div className="filter-controls">
          <select
            value={filterDeliveryCount === null ? '' : filterDeliveryCount}
            onChange={(e) => {
              if (snapshotLocked) return
              setFilterDeliveryCount(e.target.value === '' ? null : Number(e.target.value))
            }}
            className="filter-select"
            disabled={snapshotLocked}
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
              <colgroup>
                {selectMode && <col style={{ width: '32px' }} />}
                {isDLQ && dlqClassifications && <col style={{ width: '110px' }} />}
                <col style={{ width: '60px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '90px' }} />
                {isDLQ && <col style={{ width: '160px' }} />}
                {isDLQ && <col style={{ width: '240px' }} />}
                <col style={{ width: '160px' }} />
                <col style={{ width: '260px' }} />
                {/* Message ID takes remaining width */}
                <col />
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
                <th className="body-col">Payload Summary</th>
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
                              {classification.riskSignals && classification.riskSignals.length > 0 && (
                                <div className="dlq-risk-signals">
                                  <RiskSignalGroup signals={classification.riskSignals} maxDisplay={2} />
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    </td>
                  )}
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
                  {renderPayloadPreviewCell(message)}
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
        </div>

        {/* INSPECTOR MODE Footer - informational only, no slicing */}
        <Pagination
          filteredCount={sortedMessages.length}
          loadedCount={messages.length}
          totalQueueCount={totalMessageCount}
          peekSize={peekSize}
          onPeekSizeChange={onPeekSizeChange}
          onLoadNextBatch={onLoadNextBatch}
          disabled={disabled || snapshotLocked}
        />
      </>
      )}

      {renderPayloadTooltipPortal()}
    </div>
  )
}
