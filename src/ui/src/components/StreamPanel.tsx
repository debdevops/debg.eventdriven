/**
 * Stream Panel - Main message viewing and interaction component
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
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
import type { Entity, Subscription, MessageEnvelope, StreamMode, AuditEntry } from '../types'
import './StreamPanel.css'

interface SelectedTarget {
  type: 'queue' | 'subscription' | 'dlq'
  entity: Entity | null
  subscription?: Subscription
  topicName?: string
  isDLQ?: boolean
}

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

  // DLQ mode must be derived ONLY from navigation selection state.
  const isDLQ = selectedTarget.type === 'dlq'

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
  const [frozenSnapshot, setFrozenSnapshot] = useState(false)
  const [showRules, setShowRules] = useState(false)
  
  // AI Pattern filter state
  const [aiPatternFilter, setAiPatternFilter] = useState<{
    patternId: string
    label: string
    messageIds: string[]
  } | null>(null)
  
  // DLQ Replay Advisor state
  const [dlqAdvisorAnalysis, setDlqAdvisorAnalysis] = useState<any>(null)
  
  // Unified Inspector state
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>('closed')
  const [selectedMessage, setSelectedMessage] = useState<MessageEnvelope | null>(null)

  // Resolve target identity.
  // For subscription DLQ, entityName must be the topic and subscriptionName must be present.
  const entityName = selectedTarget.type === 'queue'
    ? selectedTarget.entity!.name
    : selectedTarget.type === 'subscription'
    ? selectedTarget.topicName!
    : selectedTarget.subscription && selectedTarget.topicName
    ? selectedTarget.topicName
    : selectedTarget.entity!.name

  const subscriptionName = selectedTarget.type === 'subscription'
    ? selectedTarget.subscription!.name
    : selectedTarget.type === 'dlq' && selectedTarget.subscription
    ? selectedTarget.subscription.name
    : undefined

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const key = `stream-toast-${sessionId}`
      scheduleTimeout(key, 5000, () => setToast(null))
      return () => clearTimer(key)
    }
  }, [toast, scheduleTimeout, clearTimer, sessionId])

  // Reusable function to load messages once
  const loadMessagesOnce = useCallback(async (silent = false) => {
    if (status !== 'connected') {
      return
    }
    try {
      const entityType = selectedTarget.type === 'dlq' ? 'dlq' : 
                        selectedTarget.type === 'subscription' ? 'subscription' : 
                        selectedTarget.type === 'queue' ? 'queue' : 'topic'
      
      // Don't show loading spinner for silent background refreshes
      if (!silent) {
        setLoading(true)
      }
      
      // Fetch fresh from backend
      const response = await apiClient.peekMessages(sessionId, entityName, peekSize, subscriptionName, isDLQ)
      
      // Persist (optional) but render from the live response to keep DLQ vs active isolated.
      await messageStore.saveMessages(
        response.messages,
        sessionId,
        entityName,
        entityType,
        'peeked',
        subscriptionName
      )

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
  }, [sessionId, entityName, subscriptionName, isDLQ, selectedTarget.type, peekSize, status])

  // Track last refresh time
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Auto-load messages when entity changes
  useEffect(() => {
    setActiveMessages([])
    setDlqMessages([])
    setError(null)
    setSuccess(null)
    setStreaming(false)
    setToast(null)
    setIsRefreshing(false)
    
    // Immediate load (not silent for initial load)
    const initialLoad = async () => {
      try {
        await loadMessagesOnce(false)
      } catch (err) {
        console.error('Initial load failed:', err)
      }
    }
    
    initialLoad()
  }, [sessionId, entityName, subscriptionName, isDLQ, selectedTarget.type, loadMessagesOnce])

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
    const timerKey = `stream-auto-refresh-${sessionId}-${entityName}-${subscriptionName || 'none'}-${isDLQ ? 'dlq' : 'main'}`

    if (frozenSnapshot || status !== 'connected') {
      clearTimer(timerKey)
      return
    }

    let isRefreshInProgress = false

    scheduleInterval(timerKey, 10000, async () => {
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
    const entityType = selectedTarget.type === 'dlq' ? 'dlq' : 
              selectedTarget.type === 'subscription' ? 'subscription' : 
              selectedTarget.type === 'queue' ? 'queue' : 'topic'
    
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
  }, [sessionId, entityName, subscriptionName, selectedTarget.type])

  useSSE({
    url: streamURL,
    enabled: streaming && status === 'connected',
    onMessage: handleMessage
  })

  // Ensure streaming is stopped immediately when session isn't connected
  useEffect(() => {
    if (status !== 'connected' && streaming) {
      setStreaming(false)
    }
  }, [status, streaming])

  // Peek Now (POST) - now just calls loadMessagesOnce
  const handlePeekNow = async () => {
    if (controlsDisabled) return
    await loadMessagesOnce(false) // Not silent - show loading and errors
    onAudit({
      timestamp: new Date().toISOString(),
      sessionId,
      entityName,
      operation: 'Peek'
    })
  }

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

      const entityType = selectedTarget.type === 'dlq' ? 'dlq' : 
                        selectedTarget.type === 'subscription' ? 'subscription' : 
                        selectedTarget.type === 'queue' ? 'queue' : 'topic'
      
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
        await messageStore.saveMessages(
          response.messages,
          sessionId,
          entityName,
          entityType,
          'peeked',
          subscriptionName
        )

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
  }, [controlsDisabled, messages, sessionId, entityName, subscriptionName, isDLQ, selectedTarget.type, peekSize])

  // Start streaming
  /* const _handleStartStream = () => {
    setError(null)
    setSuccess(null)
    setToast(null)
    setStreaming(true)
  } */

  // Display name for header
  const displayName = selectedTarget.type === 'queue'
    ? selectedTarget.entity!.name
    : selectedTarget.type === 'subscription'
    ? selectedTarget.subscription!.name
    : selectedTarget.subscription?.name
    ? `${selectedTarget.subscription.name} (DLQ)`
    : `${selectedTarget.entity!.name} (DLQ)`

  const displayType = selectedTarget.type === 'queue'
    ? 'Queue'
    : selectedTarget.type === 'dlq'
    ? 'Dead Letter Queue'
    : 'Subscription'

  const displayContext = selectedTarget.type === 'subscription'
    ? ` (Topic: ${selectedTarget.topicName})`
    : selectedTarget.type === 'dlq' && selectedTarget.subscription && selectedTarget.topicName
    ? ` (Topic: ${selectedTarget.topicName})`
    : selectedTarget.type === 'dlq'
    ? ` (Queue: ${selectedTarget.entity!.name})`
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
            {messages.length}
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
                ? 'Auto-refresh paused'
                : 'Auto-refresh active - refreshes every 10 seconds'
            }
          >
            <span className="auto-icon">⚡</span>
            <span className="auto-text">{frozenSnapshot ? 'Paused' : 'Auto Mode'}</span>
            {!frozenSnapshot && isRefreshing && <span className="refreshing-dot"></span>}
          </div>
          
          {/* Manual refresh button */}
          <button
            onClick={handlePeekNow}
            className="btn-compact btn-primary"
            disabled={loading || isRefreshing}
            title="Manually refresh messages now (R)"
          >
            🔄 Refresh
          </button>
          
          {/* Pause/Resume toggle */}
          <button
            onClick={() => setFrozenSnapshot(!frozenSnapshot)}
            className={`btn-compact ${frozenSnapshot ? 'btn-success' : 'btn-outline'}`}
            title={frozenSnapshot ? 'Resume auto-refresh' : 'Pause auto-refresh'}
          >
            {frozenSnapshot ? '▶️' : '⏸️'}
          </button>
          
          {/* Rules button for subscriptions */}
          {selectedTarget.type === 'subscription' && (
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
      {isDLQ && (
        <div className="dlq-banner">
          <div className="dlq-banner-title">Dead-letter queue (DLQ)</div>
          <div className="dlq-banner-subtitle">
            {subscriptionName
              ? `Topic / Subscription DLQ: ${entityName} / ${subscriptionName}`
              : `Queue DLQ: ${entityName}`}
            <span className="dlq-banner-sep"> • </span>
            Messages failed delivery and require manual investigation
          </div>
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
      {(loading && messages.length === 0) || status === 'connecting' ? (
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
            messages={messages}
            totalMessageCount={
              selectedTarget.type === 'subscription'
                ? selectedTarget.subscription?.messageCount
                : selectedTarget.type === 'dlq' && selectedTarget.subscription
                ? selectedTarget.subscription?.deadLetterMessageCount
                : selectedTarget.entity?.messageCount
            }
            sessionId={sessionId}
            entityName={entityName}
            subscriptionName={subscriptionName}
            isDLQ={isDLQ}
            dlqCount={
              selectedTarget.type === 'subscription'
                ? (selectedTarget.subscription?.deadLetterMessageCount || 0)
                : selectedTarget.type === 'dlq' && selectedTarget.subscription
                ? (selectedTarget.subscription?.deadLetterMessageCount || 0)
                : (selectedTarget.entity?.deadLetterMessageCount || 0)
            }
            onRefresh={handlePeekNow}
            onLoadNextBatch={handleLoadNextBatch}
            disabled={controlsDisabled}
            frozenSnapshot={frozenSnapshot}
            onToggleSnapshot={() => setFrozenSnapshot(!frozenSnapshot)}
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
      {showRules && selectedTarget.type === 'subscription' && (
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
          messages={messages}
          dlqClassification={
            isDLQ && dlqClassificationsMap
              ? dlqClassificationsMap.get(selectedMessage.messageId) || null
              : null
          }
          onClose={() => setSelectedMessage(null)}
          onPrevious={() => {
            const currentIndex = messages.findIndex((m) =>
              (m.messageId && selectedMessage.messageId && m.messageId === selectedMessage.messageId) ||
              (m.sequenceNumber !== undefined && m.sequenceNumber === selectedMessage.sequenceNumber)
            )
            const safeIndex = currentIndex >= 0 ? currentIndex : 0
            if (safeIndex > 0) setSelectedMessage(messages[safeIndex - 1])
          }}
          onNext={() => {
            const currentIndex = messages.findIndex((m) =>
              (m.messageId && selectedMessage.messageId && m.messageId === selectedMessage.messageId) ||
              (m.sequenceNumber !== undefined && m.sequenceNumber === selectedMessage.sequenceNumber)
            )
            const safeIndex = currentIndex >= 0 ? currentIndex : 0
            if (safeIndex < messages.length - 1) setSelectedMessage(messages[safeIndex + 1])
          }}
        />
      )}
    </div>
  )
}
