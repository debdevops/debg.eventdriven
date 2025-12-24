/**
 * Stream Panel - Main message viewing and interaction component
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSSE } from '../hooks/useSSE'
import { useSessionV2 } from '../contexts/SessionContextV2'
import { apiClient } from '../api/client'
import { messageStore } from '../services/messageStore'
import MessageTable from './MessageTable'
import { MetricsPanel } from './MetricsPanel'
import RulesPanel from './RulesPanel'
import { MessageTableSkeleton } from './MessageTableSkeleton'
import { UnifiedInspector, InspectorMode } from './UnifiedInspector'
import { MessageDetailPanel } from './MessageDetailPanel'
import { AiPatternFilterChip } from './AiPatternFilterChip'
import { DlqReplayAdvisor } from './DlqReplayAdvisor'
import { analyzeDlqMessages, getMessageIdsByClassification, type DlqClassification } from '../services/dlqReplayAdvisor'
import type { MessageEnvelope, StreamMode, AuditEntry } from '../types'
import type { SelectedTarget } from '../entities/selection'
import { computeDlqHealth, formatAgeMinutes } from '../utils/dlqHealth'
import './StreamPanel.css'

interface StreamPanelProps {
  sessionId: string
  selectedTarget: SelectedTarget
  onAudit: (entry: AuditEntry) => void
  isSessionExpired?: boolean
  onAiInsights?: () => void
  aiInsightsLoading?: boolean
  hasAiInsights?: boolean
  aiInsights?: any
}

export default function StreamPanel({ 
  sessionId, 
  selectedTarget,
  onAudit, 
  isSessionExpired = false,
  onAiInsights,
  aiInsightsLoading,
  hasAiInsights,
  aiInsights
}: StreamPanelProps) {
  const mode: StreamMode = 'peek' // Read-only mode
  const { status, canInteract, scheduleTimeout, scheduleInterval, clearTimer } = useSessionV2()
  const controlsDisabled = !canInteract || isSessionExpired

  // Snapshot (Frozen View)
  const [snapshotEnabled, setSnapshotEnabled] = useState(false)
  const [snapshotCapturedAtUtc, setSnapshotCapturedAtUtc] = useState<string | null>(null)
  const [snapshotReason, setSnapshotReason] = useState<'user' | 'dlq' | null>(null)
  const frozenMessagesRef = useRef<MessageEnvelope[] | null>(null)
  const snapshotEnabledRef = useRef(false)
  const loadRequestIdRef = useRef(0)
  const autoDlqFreezeDoneRef = useRef(false)

  const snapshotControlsDisabled = controlsDisabled || snapshotEnabled

  // FIX(selection): DLQ mode derived ONLY from explicit viewType (no implicit auto-derivation).
  const isDLQ = selectedTarget.viewType === 'dlq'

  const [activeMessages, setActiveMessages] = useState<MessageEnvelope[]>([])
  const [dlqMessages, setDlqMessages] = useState<MessageEnvelope[]>([])
  const messages = isDLQ ? dlqMessages : activeMessages
  const setMessages = isDLQ ? setDlqMessages : setActiveMessages
  const [streaming, setStreaming] = useState(false)
  const [peekSize, setPeekSize] = useState(50)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const frozenSnapshot = snapshotEnabled
  const renderedMessages = snapshotEnabled
    ? (frozenMessagesRef.current || [])
    : messages
  const [showRules, setShowRules] = useState(false)
  
  // AI Pattern filter state
  const [aiPatternFilter, setAiPatternFilter] = useState<{
    patternId: string
    label: string
    messageIds: string[]
  } | null>(null)
  
  // DLQ Replay Advisor state
  const [dlqAdvisorAnalysis, setDlqAdvisorAnalysis] = useState<any>(null)

  // DLQ health sampling (used for tiered severity when NOT viewing DLQ)
  const [sampledDlqMessages, setSampledDlqMessages] = useState<MessageEnvelope[] | null>(null)
  const [oldestDlqEnqueuedTimeUtc, setOldestDlqEnqueuedTimeUtc] = useState<string | null>(null)
  
  // Unified Inspector state
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>('closed')
  const [selectedMessage, setSelectedMessage] = useState<MessageEnvelope | null>(null)

  // Resolve target identity.
  // For subscriptions (messages or DLQ), entityName must be the topic and subscriptionName must be present.
  const entityName = selectedTarget.entityType === 'queue'
    ? selectedTarget.entity!.name
    : selectedTarget.topicName!

  const subscriptionName = selectedTarget.entityType === 'subscription'
    ? selectedTarget.subscription!.name
    : undefined

  const activeCountTotal = selectedTarget.entityType === 'subscription'
    ? (selectedTarget.subscription?.messageCount || 0)
    : (selectedTarget.entity?.messageCount || 0)

  const dlqCountTotal = selectedTarget.entityType === 'subscription'
    ? (selectedTarget.subscription?.deadLetterMessageCount || 0)
    : (selectedTarget.entity?.deadLetterMessageCount || 0)

  const totalCountForView = isDLQ ? dlqCountTotal : activeCountTotal

  const selectedEntityTypeLabel = selectedTarget.entityType === 'subscription'
    ? 'Subscription'
    : 'Queue'

  const oldestDlqFromLoadedMessages = useMemo(() => {
    if (!isDLQ || messages.length === 0) return null
    const oldest = messages.reduce((min, m) => {
      const t = new Date(m.enqueuedTimeUtc).getTime()
      const minT = new Date(min.enqueuedTimeUtc).getTime()
      return t < minT ? m : min
    }, messages[0])
    return oldest.enqueuedTimeUtc
  }, [isDLQ, messages])

  // Sample DLQ details (oldest age + reasons) when viewing active messages.
  // This keeps severity portal-aligned without changing backend contracts.
  useEffect(() => {
    if (status !== 'connected') {
      setSampledDlqMessages(null)
      setOldestDlqEnqueuedTimeUtc(null)
      return
    }

    if (isDLQ || dlqCountTotal <= 0) {
      setSampledDlqMessages(null)
      setOldestDlqEnqueuedTimeUtc(null)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        // Peek a small sample from DLQ. Peek returns oldest-first, so [0] is the oldest.
        const resp = await apiClient.peekMessages(sessionId, entityName, 10, subscriptionName, true)
        if (cancelled) return
        setSampledDlqMessages(resp.messages)
        setOldestDlqEnqueuedTimeUtc(resp.messages.length > 0 ? resp.messages[0].enqueuedTimeUtc : null)
      } catch (e) {
        // Non-fatal: if sampling fails, severity falls back to ratio-only.
        if (cancelled) return
        setSampledDlqMessages(null)
        setOldestDlqEnqueuedTimeUtc(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [status, isDLQ, dlqCountTotal, sessionId, entityName, subscriptionName])

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const key = `stream-toast-${sessionId}`
      scheduleTimeout(key, 5000, () => setToast(null))
      return () => clearTimer(key)
    }
  }, [toast, scheduleTimeout, clearTimer, sessionId])

  const enterSnapshot = useCallback((reason: 'user' | 'dlq') => {
    if (frozenMessagesRef.current == null) {
      // Freeze current view's messages; do NOT clear live messages.
      frozenMessagesRef.current = [...messages]
    }
    setSnapshotEnabled(true)
    snapshotEnabledRef.current = true
    setSnapshotReason(reason)
    if (!snapshotCapturedAtUtc) setSnapshotCapturedAtUtc(new Date().toISOString())
    // Snapshot must never show loading or refreshing indicators.
    setLoading(false)
    setIsRefreshing(false)
    setStreaming(false)
  }, [messages, snapshotCapturedAtUtc])

  const exitSnapshot = useCallback(() => {
    frozenMessagesRef.current = null
    setSnapshotEnabled(false)
    snapshotEnabledRef.current = false
    setSnapshotCapturedAtUtc(null)
    setSnapshotReason(null)
  }, [])

  // Keep ref in sync even if snapshotEnabled changes via other paths
  useEffect(() => {
    snapshotEnabledRef.current = snapshotEnabled
    if (snapshotEnabled) {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [snapshotEnabled])

  // Reusable function to load messages once
  const loadMessagesOnce = useCallback(async (silent = false) => {
    if (status !== 'connected') {
      return
    }

    // FIX(snapshot): Snapshot must NEVER fetch.
    if (snapshotEnabledRef.current) {
      return
    }

    const requestId = ++loadRequestIdRef.current
    try {
      const entityType = isDLQ ? 'dlq' : selectedTarget.entityType
      
      // Don't show loading spinner for silent background refreshes
      if (!silent) {
        setLoading(true)
      }
      
      // Fetch fresh from backend
      const response = await apiClient.peekMessages(sessionId, entityName, peekSize, subscriptionName, isDLQ)

      // If Snapshot was enabled mid-flight (or a newer request started), ignore this result.
      if (snapshotEnabledRef.current || requestId !== loadRequestIdRef.current) {
        return
      }
      
      // Persist (optional) but render from the live response to keep DLQ vs active isolated.
      try {
        await messageStore.saveMessages(
          response.messages,
          sessionId,
          entityName,
          entityType,
          'peeked',
          subscriptionName
        )
      } catch (err) {
        // Regression protection: local persistence must never break the UI.
        console.warn('[StreamPanel] IndexedDB persist failed (non-fatal)', err)
      }

      // Never merge active+DLQ. Replace only the current view's message set.
      setMessages(response.messages)
      
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load messages'
      console.error('Load messages failed:', err)
      
      // Handle 401 Unauthorized - session expired
      if (errorMsg.includes('401') || errorMsg.toLowerCase().includes('unauthorized')) {
        // Session expiry is now handled by SessionExpiryModal - don't set error here
        console.log('[StreamPanel] Session expired detected - modal will handle this')
      } else if (!silent) {
        // Only show error for non-silent requests
        setError(errorMsg)
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [status, sessionId, entityName, peekSize, subscriptionName, isDLQ, selectedTarget.entityType])


  // Track last refresh time
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Snapshot must never show skeleton/loading states.
  const effectiveLoading = snapshotEnabled ? false : loading
  const effectiveRefreshing = snapshotEnabled ? false : isRefreshing

  // Auto-load messages when entity changes
  useEffect(() => {
    setActiveMessages([])
    setDlqMessages([])
    setError(null)
    setSuccess(null)
    setStreaming(false)
    setToast(null)
    setIsRefreshing(false)

    // FIX(state): clear persisted bucket for this entity+view to avoid stale carry-over.
    void messageStore.clearView(sessionId, isDLQ ? 'dlq' : selectedTarget.entityType, entityName, subscriptionName)
    
    // Immediate load (not silent for initial load)
    const initialLoad = async () => {
      try {
        await loadMessagesOnce(false)
      } catch (err) {
        console.error('Initial load failed:', err)
      }
    }
    
    initialLoad()
  }, [sessionId, entityName, subscriptionName, isDLQ, selectedTarget.entityType, selectedTarget.viewType, loadMessagesOnce])

  // DLQ Replay Advisor Analysis - runs when messages are loaded and we're viewing DLQ
  useEffect(() => {
    if (!isDLQ || messages.length === 0) {
      setDlqAdvisorAnalysis(null)
      return
    }

    // Run analysis on DLQ messages (client-side, instant)
    try {
      const analysis = analyzeDlqMessages(messages, 5, 60) // min 5 messages, 60% confidence threshold
      setDlqAdvisorAnalysis(analysis)
    } catch (err) {
      console.error('[StreamPanel] DLQ analysis failed:', err)
      // Silently fail - don't disrupt UI
    }
  }, [messages, isDLQ])

  // Create a Map of messageId -> classification for efficient lookup in grid
  const dlqClassificationsMap = useMemo(() => {
    if (!dlqAdvisorAnalysis) return null
    const map = new Map()
    dlqAdvisorAnalysis.classifications.forEach((c: any) => {
      map.set(c.messageId, c)
    })
    return map
  }, [dlqAdvisorAnalysis])

  // Single unified auto-refresh loop with Page Visibility API
  // Pauses during session expiry or reconnect
  useEffect(() => {
    // Guard all fetch effects while Snapshot is active.
    if (snapshotEnabled) return
    const timerKey = `stream-auto-refresh-${sessionId}-${entityName}-${subscriptionName || 'none'}-${isDLQ ? 'dlq' : 'main'}`

    if (frozenSnapshot || status !== 'connected') {
      clearTimer(timerKey)
      return
    }

    let isRefreshInProgress = false

    scheduleInterval(timerKey, 10000, async () => {
      if (snapshotEnabledRef.current) return
      if (isRefreshInProgress || document.hidden || status !== 'connected') return
      try {
        isRefreshInProgress = true
        setIsRefreshing(true)
        await loadMessagesOnce(true)
      } catch (err) {
        console.error('[StreamPanel] Auto-refresh failed:', err)
      } finally {
        setIsRefreshing(false)
        isRefreshInProgress = false
      }
    })

    return () => clearTimer(timerKey)
  }, [frozenSnapshot, status, loadMessagesOnce, scheduleInterval, clearTimer, sessionId, entityName, subscriptionName, isDLQ])

  // SSE Stream
  const streamURL = apiClient.getStreamURL(sessionId, entityName, mode, subscriptionName, isDLQ)
  
  const handleMessage = useCallback((message: MessageEnvelope) => {
    // Save to local store
    const entityType = isDLQ ? 'dlq' : selectedTarget.entityType
    
    messageStore.saveMessage(
      message,
      sessionId,
      entityName,
      entityType,
      'peeked',
      subscriptionName
    ).catch(err => console.error('Failed to save message:', err))
    
    setMessages(prev => {
      // Avoid duplicates
      const exists = prev.find(m => m.sequenceNumber === message.sequenceNumber)
      if (exists) return prev
      return [message, ...prev] // Newest first
    })
  }, [sessionId, entityName, subscriptionName, isDLQ, selectedTarget.entityType])

  useSSE({
    url: streamURL,
    enabled: streaming && status === 'connected' && !snapshotEnabled,
    onMessage: handleMessage
  })

  // Ensure streaming is stopped immediately when session isn't connected
  useEffect(() => {
    if (status !== 'connected' && streaming) {
      setStreaming(false)
    }
  }, [status, streaming])

  useEffect(() => {
    if (snapshotEnabled && streaming) {
      setStreaming(false)
    }
  }, [snapshotEnabled, streaming])

  // Peek Now (POST) - now just calls loadMessagesOnce
  const handlePeekNow = async () => {
    if (snapshotControlsDisabled) return
    await loadMessagesOnce(false) // Not silent - show loading and errors
    onAudit({
      timestamp: new Date().toISOString(),
      sessionId,
      entityName,
      operation: 'Peek'
    })
  }

  const handleToggleSnapshot = () => {
    if (snapshotEnabled) {
      exitSnapshot()
      return
    }
    enterSnapshot('user')
  }

  // Auto-freeze for DLQ views after first successful load.
  useEffect(() => {
    if (!isDLQ) {
      autoDlqFreezeDoneRef.current = false
      return
    }
    if (snapshotEnabled) return
    if (autoDlqFreezeDoneRef.current) return
    if (messages.length === 0) return

    autoDlqFreezeDoneRef.current = true
    enterSnapshot('dlq')
  }, [isDLQ, snapshotEnabled, messages.length, enterSnapshot])

  // Apply AI Pattern Filter
  const handleApplyAiPattern = (patternId: string, label: string, messageIds: string[]) => {
    setAiPatternFilter({ patternId, label, messageIds })
    setToast({
      message: `✅ Filtered to ${messageIds.length} messages in pattern "${label}"`,
      type: 'success'
    })
    onAudit({
      timestamp: new Date().toISOString(),
      sessionId,
      entityName,
      operation: 'Peek' // Audit as a Peek operation
    })
  }

  // Clear AI Pattern Filter
  const handleClearAiPattern = () => {
    if (aiPatternFilter) {
      const clearedPattern = aiPatternFilter.label
      setAiPatternFilter(null)
      setToast({
        message: `✅ Cleared filter for pattern "${clearedPattern}"`,
        type: 'success'
      })
      onAudit({
        timestamp: new Date().toISOString(),
        sessionId,
        entityName,
        operation: 'Peek' // Audit as a Peek operation
      })
    }
  }

  // Filter by DLQ Classification Category
  const handleFilterByDlqCategory = (category: DlqClassification) => {
    if (!dlqAdvisorAnalysis) return

    const messageIds = getMessageIdsByClassification(dlqAdvisorAnalysis, category)
    if (messageIds.length === 0) return

    const categoryLabel = category === 'SAFE_TO_REPLAY'
      ? 'Safe to Replay'
      : category === 'NEEDS_INVESTIGATION'
      ? 'Needs Investigation'
      : 'Do Not Replay'

    setAiPatternFilter({
      patternId: `dlq-${category}`,
      label: `DLQ: ${categoryLabel}`,
      messageIds
    })

    setToast({
      message: `✅ Filtered to ${messageIds.length} DLQ messages (${categoryLabel})`,
      type: 'success'
    })

    onAudit({
      timestamp: new Date().toISOString(),
      sessionId,
      entityName,
      operation: 'Peek'
    })
  }

  // Load Next Batch - uses last message sequence number to peek from that point
  const handleLoadNextBatch = useCallback(async () => {
    if (controlsDisabled) return
    if (snapshotEnabledRef.current) return
    if (messages.length === 0) {
      console.log('[StreamPanel] No messages loaded, cannot load next batch')
      return
    }

    try {
      setLoading(true)
      
      // Get last message sequence number (messages are sorted newest first, so last = oldest loaded)
      // Find the message with the highest sequence number to use as fromSequenceNumber
      const lastSeqNum = Math.max(...messages.map(m => m.sequenceNumber))
      
      if (!lastSeqNum) {
        setError('No sequence number found in loaded messages')
        return
      }

      const entityType = isDLQ ? 'dlq' : selectedTarget.entityType
      
      // Peek from next sequence number (lastSeqNum + 1)
      const response = await apiClient.peekMessages(
        sessionId,
        entityName,
        peekSize,
        subscriptionName,
        isDLQ
      )

      if (response.messages && response.messages.length > 0) {
        // Save messages to local store
        try {
          await messageStore.saveMessages(
            response.messages,
            sessionId,
            entityName,
            entityType,
            'peeked',
            subscriptionName
          )
        } catch (err) {
          console.warn('[StreamPanel] IndexedDB persist failed (non-fatal)', err)
        }

        // Append new messages to current list
        setMessages(prev => {
          // Combine and deduplicate
          const allMessages = [...prev, ...response.messages]
          const unique = Array.from(new Map(allMessages.map(m => [m.sequenceNumber, m])).values())
          // Sort by sequence number (newest first)
          return unique.sort((a, b) => b.sequenceNumber - a.sequenceNumber)
        })

        setToast({
          message: `✅ Loaded ${response.messages.length} more messages`,
          type: 'success'
        })

        onAudit({
          timestamp: new Date().toISOString(),
          sessionId,
          entityName,
          operation: 'Peek'
        })
      } else {
        setToast({
          message: 'ℹ️ No more messages to load',
          type: 'success'
        })
      }

      setError(null)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load next batch'
      console.error('Load next batch failed:', err)
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [controlsDisabled, messages, sessionId, entityName, subscriptionName, isDLQ, selectedTarget.entityType, peekSize])

  // Start streaming
  /* const _handleStartStream = () => {
    setError(null)
    setSuccess(null)
    setToast(null)
    setStreaming(true)
  } */

  // Display name for header
  const displayName = selectedTarget.entityType === 'queue'
    ? selectedTarget.entity!.name
    : selectedTarget.subscription!.name

  const displayType = selectedTarget.entityType === 'subscription'
    ? 'Subscription'
    : 'Queue'

  const displayContext = selectedTarget.entityType === 'subscription'
    ? ` (Topic: ${selectedTarget.topicName})`
    : ''

  // Format last updated time
  const formatLastUpdated = (): string => {
    if (!lastUpdated) return 'Not yet loaded'
    const secondsAgo = Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
    if (secondsAgo < 10) return 'Just now'
    if (secondsAgo < 60) return `${secondsAgo}s ago`
    const minutesAgo = Math.floor(secondsAgo / 60)
    if (minutesAgo < 60) return `${minutesAgo}m ago`
    const hoursAgo = Math.floor(minutesAgo / 60)
    return `${hoursAgo}h ago`
  }

  // FIX(refactor): keep JSX declarative by precomputing DLQ banner fields.
  const dlqBannerModel = useMemo(() => {
    if (!isDLQ) return null

    const dlqOldestTime = oldestDlqFromLoadedMessages
    const dlqHealth = computeDlqHealth({
      dlqCount: dlqCountTotal,
      activeCount: activeCountTotal,
      oldestDlqEnqueuedTimeUtc: dlqOldestTime,
      sampledDlqMessages: messages
    })

    const oldestAgeText = dlqHealth.oldestDlqAgeMinutes === null
      ? '—'
      : formatAgeMinutes(dlqHealth.oldestDlqAgeMinutes)

    const severityBadgeClass = dlqHealth.severity === 'CRITICAL'
      ? 'critical'
      : dlqHealth.severity === 'WARNING'
        ? 'warning'
        : 'healthy'

    return {
      dlqHealth,
      oldestAgeText,
      severityBadgeClass
    }
  }, [isDLQ, oldestDlqFromLoadedMessages, dlqCountTotal, activeCountTotal, messages])

  return (
    <div className="stream-panel">
      {/* Session expired is now handled by SessionExpiryModal in NamespaceView */}
      
      {/* Full-width error banner for non-session-expired errors */}
      {error && !error.includes('Session expired') && (
        <div className="stream-panel-error">
          {error}
          <button onClick={() => setError(null)} className="error-dismiss">×</button>
        </div>
      )}

      <div className="action-toolbar">
        <div className="header-left">
          <h3>
            {isDLQ && <span className="dlq-badge" title="Dead Letter Queue">💀</span>}
            {displayName}
          </h3>
          <span className="entity-type-badge" title={displayType}>{displayType}</span>
          {displayContext && <span className="entity-context" title={displayContext.substring(2, displayContext.length - 1)}>{displayContext}</span>}
          <span className="message-count-badge" title="Total messages in grid">
            {renderedMessages.length}
          </span>
          <span className="read-mode-badge" title="Read-only peek mode - messages are not removed from queue">
            📖 Peek Mode
          </span>
          <span className="last-updated-badge" title={lastUpdated ? `Last updated at ${lastUpdated.toLocaleTimeString()}` : 'Not yet loaded'}>
            {formatLastUpdated()}
          </span>
        </div>

        <div className="action-buttons-compact">
          {/* Auto Mode badge (always rendered to avoid layout shift) */}
          <div
            className={`auto-mode-badge ${frozenSnapshot ? 'paused' : ''}`}
            title={
              frozenSnapshot
                ? 'Snapshot (Frozen View) active — live updates paused'
                : 'Auto-refresh active — refreshes every 10 seconds'
            }
          >
            <span className="auto-icon">⚡</span>
            <span className="auto-text">{frozenSnapshot ? 'Snapshot' : 'Auto Mode'}</span>
            {!frozenSnapshot && effectiveRefreshing && <span className="refreshing-dot"></span>}
          </div>
          
          {/* Manual refresh button */}
          <button
            onClick={handlePeekNow}
            className="btn-compact btn-primary"
            disabled={effectiveLoading || effectiveRefreshing || snapshotEnabled}
            title="Manually refresh messages now (R)"
          >
            🔄 Refresh
          </button>
          
          {/* Snapshot controls */}
          {!snapshotEnabled ? (
            <button
              onClick={() => {
                void handleToggleSnapshot()
              }}
              className="btn-compact btn-outline"
              title="Freezes the message list for safe investigation. Does not lock or stop messages in Service Bus."
              disabled={controlsDisabled}
            >
              Snapshot (Frozen View)
            </button>
          ) : (
            <button
              onClick={handleToggleSnapshot}
              className="btn-compact btn-success"
              title="Exit Snapshot and resume live updates"
              disabled={controlsDisabled}
            >
              Exit Snapshot
            </button>
          )}
          
          {/* Rules button for subscriptions */}
          {selectedTarget.entityType === 'subscription' && (
            <button
              onClick={() => setShowRules(true)}
              className="btn-compact btn-outline"
              title="Manage subscription rules"
            >
              ⚙️ Rules
            </button>
          )}
        </div>
      </div>

      {/* Read-only badge removed intentionally; auto-refresh/pause logic remains intact */}

      {/* DLQ explanation banner - simplified one-liner */}
      {isDLQ && dlqBannerModel && (
        <div className="dlq-banner">
          <>
            <div className="dlq-banner-title">
              Dead-letter queue (DLQ)
              {snapshotEnabled && (
                <span className="dlq-frozen-badge" title="Frozen View">Frozen</span>
              )}
              <span
                className={`dlq-severity-badge ${dlqBannerModel.severityBadgeClass}`}
                title={dlqBannerModel.dlqHealth.whyTooltip}
              >
                {dlqBannerModel.dlqHealth.label}
              </span>
              <span className="dlq-why" title={dlqBannerModel.dlqHealth.whyTooltip}>Why is this happening?</span>
            </div>
            <div className="dlq-banner-subtitle">
              {selectedEntityTypeLabel}: {subscriptionName
                ? `${entityName} / ${subscriptionName}`
                : entityName}
              <span className="dlq-banner-sep"> • </span>
              DLQ count: <strong>{dlqCountTotal}</strong>
              <span className="dlq-banner-sep"> • </span>
              Oldest DLQ age: <strong>{dlqBannerModel.oldestAgeText}</strong>
            </div>
            <div className="dlq-banner-footnote">
              These messages failed delivery and require investigation.
            </div>
          </>
        </div>
      )}

      {/* Snapshot banner: persistent while Snapshot is active */}
      {snapshotEnabled && (
        <div className="snapshot-banner" role="status" aria-live="polite">
          <div className="snapshot-banner-title">Snapshot (Frozen View)</div>
          <div className="snapshot-banner-body">
            You are viewing a frozen snapshot of messages captured at{' '}
            <strong>
              {snapshotCapturedAtUtc
                ? new Date(snapshotCapturedAtUtc).toLocaleString()
                : '…'}
            </strong>
            . Live updates are paused.
          </div>
          {snapshotReason === 'dlq' && (
            <div className="snapshot-banner-footnote">
              DLQ views open in Snapshot mode by default for investigation safety.
            </div>
          )}
        </div>
      )}

      {/* Only show error alerts for non-session-expired errors */}
      {error && !isSessionExpired && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}

      {/* Metrics Panel */}
      {!isDLQ && (
        <MetricsPanel
          sessionId={sessionId}
          entityName={entityName}
          subscriptionName={subscriptionName}
        />
      )}

      {/* DLQ Replay Advisor - only for DLQ view */}
      {isDLQ && dlqAdvisorAnalysis && (
        <DlqReplayAdvisor
          analysis={dlqAdvisorAnalysis}
          onFilterByCategory={handleFilterByDlqCategory}
          disabled={false}
        />
      )}

      {/* Show skeleton loader during initial load or reconnect */}
      {(effectiveLoading && renderedMessages.length === 0) || status === 'connecting' ? (
        <MessageTableSkeleton />
      ) : (
        <>
          {/* AI Pattern Filter Chip - appears when filter is active */}
          {aiPatternFilter && (
            <AiPatternFilterChip
              patternLabel={aiPatternFilter.label}
              messageCount={aiPatternFilter.messageIds.length}
              onClear={handleClearAiPattern}
            />
          )}

          <MessageTable
            messages={renderedMessages}
            // FIX(pagination): totalMessageCount is view-specific (messages vs DLQ).
            totalMessageCount={totalCountForView}
            activeCount={activeCountTotal}
            sessionId={sessionId}
            entityName={entityName}
            subscriptionName={subscriptionName}
            isDLQ={isDLQ}
            dlqCount={dlqCountTotal}
            oldestDlqEnqueuedTimeUtc={isDLQ ? oldestDlqFromLoadedMessages : oldestDlqEnqueuedTimeUtc}
            sampledDlqMessages={isDLQ ? renderedMessages : sampledDlqMessages}
            onRefresh={snapshotEnabled ? undefined : handlePeekNow}
            onLoadNextBatch={snapshotEnabled ? undefined : handleLoadNextBatch}
            disabled={controlsDisabled}
            frozenSnapshot={frozenSnapshot}
            onToggleSnapshot={snapshotEnabled ? exitSnapshot : undefined}
            onAiInsights={() => {
              setInspectorMode('ai-insights')
              if (onAiInsights) onAiInsights()
            }}
            aiInsightsLoading={aiInsightsLoading}
            hasAiInsights={hasAiInsights}
            onMessageSelect={(message) => {
              setSelectedMessage(message)
            }}
            aiPatternFilter={aiPatternFilter}
            dlqClassifications={isDLQ ? dlqClassificationsMap : null}
            peekSize={peekSize}
            onPeekSizeChange={setPeekSize}
          />
        </>
      )}
      
      {/* Rules Panel */}
      {showRules && selectedTarget.entityType === 'subscription' && (
        <RulesPanel
          sessionId={sessionId}
          topicName={selectedTarget.topicName!}
          subscriptionName={selectedTarget.subscription!.name}
          onClose={() => setShowRules(false)}
        />
      )}

      {/* Unified Inspector Panel */}
      <UnifiedInspector
        mode={inspectorMode}
        aiInsights={aiInsights}
        sessionId={sessionId}
        entityName={entityName}
        subscriptionName={subscriptionName}
        isDLQ={isDLQ}
        onClose={() => {
          setInspectorMode('closed')
        }}
        onMessageSelect={(message) => setSelectedMessage(message)}
        onAiRefresh={onAiInsights}
        onApplyAiPattern={handleApplyAiPattern}
      />

      {/* Message Detail (Right-side modal, restored) */}
      {selectedMessage && (
        <MessageDetailPanel
          message={selectedMessage}
          messages={renderedMessages}
          dlqClassification={
            isDLQ && dlqClassificationsMap
              ? dlqClassificationsMap.get(selectedMessage.messageId) || null
              : null
          }
          onClose={() => setSelectedMessage(null)}
          onPrevious={() => {
            const currentIndex = renderedMessages.findIndex((m) =>
              (m.messageId && selectedMessage.messageId && m.messageId === selectedMessage.messageId) ||
              (m.sequenceNumber !== undefined && m.sequenceNumber === selectedMessage.sequenceNumber)
            )
            const safeIndex = currentIndex >= 0 ? currentIndex : 0
            if (safeIndex > 0) setSelectedMessage(renderedMessages[safeIndex - 1])
          }}
          onNext={() => {
            const currentIndex = renderedMessages.findIndex((m) =>
              (m.messageId && selectedMessage.messageId && m.messageId === selectedMessage.messageId) ||
              (m.sequenceNumber !== undefined && m.sequenceNumber === selectedMessage.sequenceNumber)
            )
            const safeIndex = currentIndex >= 0 ? currentIndex : 0
            if (safeIndex < renderedMessages.length - 1) setSelectedMessage(renderedMessages[safeIndex + 1])
          }}
        />
      )}
    </div>
  )
}
