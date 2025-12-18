/**
 * Stream Panel - Main message viewing and interaction component
 */

import { useState, useCallback, useEffect } from 'react'
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
  const { status, registerTimer } = useSessionV2()
  const [messages, setMessages] = useState<MessageEnvelope[]>([])
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [frozenSnapshot, setFrozenSnapshot] = useState(false)
  const [showRules, setShowRules] = useState(false)
  
  // Unified Inspector state
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>('closed')
  const [selectedMessage, setSelectedMessage] = useState<MessageEnvelope | null>(null)

  // Get entity name and subscription name based on target type
  const entityName = selectedTarget.type === 'queue' || selectedTarget.type === 'dlq'
    ? selectedTarget.entity!.name 
    : selectedTarget.topicName!
  
  const subscriptionName = selectedTarget.type === 'subscription' 
    ? selectedTarget.subscription!.name 
    : undefined
  
  const isDLQ = selectedTarget.isDLQ || false

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Reusable function to load messages once
  const loadMessagesOnce = useCallback(async (silent = false) => {
    try {
      const entityType = selectedTarget.type === 'dlq' ? 'dlq' : 
                        selectedTarget.type === 'subscription' ? 'subscription' : 
                        selectedTarget.type === 'queue' ? 'queue' : 'topic'
      
      // Don't show loading spinner for silent background refreshes
      if (!silent) {
        setLoading(true)
      }
      
      // Fetch fresh from backend
      const response = await apiClient.peekMessages(sessionId, entityName, 20, subscriptionName, isDLQ)
      
      // Save to local store with correct entity type
      await messageStore.saveMessages(
        response.messages,
        sessionId,
        entityName,
        entityType,
        'peeked',
        subscriptionName
      )
      
      // Reload all stored messages for this entity (filtered by type)
      const updatedMessages = await messageStore.getMessages(sessionId, entityName, entityType)
      
      // Only update state if messages actually changed (prevents UI flicker)
      setMessages(prevMessages => {
        const prevIds = prevMessages.map(m => m.sequenceNumber).sort().join(',')
        const newIds = updatedMessages.map(m => m.sequenceNumber).sort().join(',')
        return prevIds === newIds ? prevMessages : updatedMessages
      })
      
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
  }, [sessionId, entityName, subscriptionName, isDLQ, selectedTarget.type])

  // Track last refresh time
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Auto-load messages when entity changes
  useEffect(() => {
    setMessages([])
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

  // Single unified auto-refresh loop with Page Visibility API
  // Pauses during session expiry or reconnect
  useEffect(() => {
    if (frozenSnapshot || status !== 'connected') {
      console.log('[StreamPanel] Auto-refresh paused:', 
        frozenSnapshot ? 'Snapshot frozen' : `Session status: ${status}`)
      return // Don't refresh when paused or not connected
    }

    let intervalId: ReturnType<typeof setInterval> | null = null
    let isRefreshInProgress = false
    
    const performRefresh = async () => {
      if (isRefreshInProgress || document.hidden || status !== 'connected') return
      
      try {
        isRefreshInProgress = true
        setIsRefreshing(true)
        await loadMessagesOnce(true) // Silent refresh
      } catch (err) {
        console.error('[StreamPanel] Auto-refresh failed:', err)
      } finally {
        setIsRefreshing(false)
        isRefreshInProgress = false
      }
    }
    
    const startAutoRefresh = () => {
      if (intervalId) return // Prevent duplicate intervals
      console.log('[StreamPanel] Starting auto-refresh (10s interval)')
      intervalId = setInterval(performRefresh, 10000) // 10 seconds
      registerTimer?.('stream-auto-refresh', intervalId) // Register with SessionContext
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pause refresh when tab is hidden
        if (intervalId) {
          console.log('[StreamPanel] Pausing auto-refresh (tab hidden)')
          clearInterval(intervalId)
          intervalId = null
        }
      } else {
        // Resume refresh when tab becomes visible
        if (!intervalId && status === 'connected') {
          console.log('[StreamPanel] Resuming auto-refresh (tab visible)')
          startAutoRefresh()
          performRefresh() // Immediate refresh on tab activation
        }
      }
    }

    startAutoRefresh()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalId) {
        console.log('[StreamPanel] Cleaning up auto-refresh interval')
        clearInterval(intervalId)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [frozenSnapshot, status, loadMessagesOnce, registerTimer])

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
    enabled: streaming,
    onMessage: handleMessage
  })

  // Peek Now (POST) - now just calls loadMessagesOnce
  const handlePeekNow = async () => {
    await loadMessagesOnce(false) // Not silent - show loading and errors
    onAudit({
      timestamp: new Date().toISOString(),
      sessionId,
      entityName,
      operation: 'Peek'
    })
  }

  // Start streaming
  /* const _handleStartStream = () => {
    setError(null)
    setSuccess(null)
    setToast(null)
    setStreaming(true)
  } */

  // Display name for header
  const displayName = selectedTarget.type === 'queue' || selectedTarget.type === 'dlq'
    ? selectedTarget.entity!.name
    : selectedTarget.subscription!.name
  
  const displayType = selectedTarget.type === 'queue' ? 'Queue' : selectedTarget.type === 'dlq' ? 'Dead Letter Queue' : 'Subscription'
  const displayContext = selectedTarget.type === 'subscription' 
    ? ` (Topic: ${selectedTarget.topicName})`
    : selectedTarget.type === 'dlq'
    ? ` (Queue: ${selectedTarget.entity!.name})`
    : ''

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
        </div>

        <div className="action-buttons-compact">
          {/* Auto Mode badge */}
          {!frozenSnapshot && (
            <div className="auto-mode-badge" title="Auto-refresh active - refreshes every 10 seconds">
              <span className="auto-icon">⚡</span>
              <span className="auto-text">Auto Mode</span>
              {isRefreshing && <span className="refreshing-dot"></span>}
            </div>
          )}
          
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
          💀 <strong>Dead Letter Queue:</strong> These messages failed delivery or exceeded max delivery attempts. Use Replay to reprocess.
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

      {/* Show skeleton loader during initial load or reconnect */}
      {(loading && messages.length === 0) || status === 'connecting' ? (
        <MessageTableSkeleton />
      ) : (
        <MessageTable
          messages={messages}
          sessionId={sessionId}
          entityName={entityName}
          subscriptionName={subscriptionName}
          isDLQ={isDLQ}
          dlqCount={selectedTarget.entity?.deadLetterMessageCount || 0}
          onRefresh={handlePeekNow}
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
        />
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
      />

      {/* Message Detail (Right-side modal, restored) */}
      {selectedMessage && (
        <MessageDetailPanel
          message={selectedMessage}
          messages={messages}
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
