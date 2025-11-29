/**
 * Stream Panel - Main message viewing and interaction component
 */

import { useState, useCallback, useEffect } from 'react'
import { useSSE } from '../hooks/useSSE'
import { apiClient } from '../api/client'
import { messageStore } from '../services/messageStore'
import MessageTable from './MessageTable'
import { CompareModal } from './CompareModal'
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
}

export default function StreamPanel({ sessionId, selectedTarget, onAudit }: StreamPanelProps) {
  const mode: StreamMode = 'peek' // Read-only mode
  const [messages, setMessages] = useState<MessageEnvelope[]>([])
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showCompare, setShowCompare] = useState(false)

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

  // Auto-load messages when entity changes
  useEffect(() => {
    setMessages([])
    setError(null)
    setSuccess(null)
    setStreaming(false)
    setToast(null)
    
    // Auto-load messages after clearing
    const loadMessages = async () => {
      try {
        const entityType = selectedTarget.type === 'dlq' ? 'dlq' : 
                          selectedTarget.type === 'subscription' ? 'subscription' : 
                          selectedTarget.type === 'queue' ? 'queue' : 'topic'
        
        // Load from IndexedDB first (filtered by entity type)
        const storedMessages = await messageStore.getMessages(sessionId, entityName, entityType)
        if (storedMessages.length > 0) {
          setMessages(storedMessages)
        }
        
        // Then fetch fresh from backend
        setLoading(true)
        const response = await apiClient.peekMessages(sessionId, entityName, 10, subscriptionName, isDLQ)
        
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
        setMessages(updatedMessages)
      } catch (err) {
        console.error('Auto-load failed:', err)
      } finally {
        setLoading(false)
      }
    }
    
    loadMessages()
  }, [sessionId, entityName, subscriptionName, isDLQ, selectedTarget.type])

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

  // Peek Now (POST)
  const handlePeekNow = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    setToast(null)

    try {
      // Determine entity type for proper filtering
      const entityType = selectedTarget.type === 'dlq' ? 'dlq' : 
                        selectedTarget.type === 'subscription' ? 'subscription' : 
                        selectedTarget.type === 'queue' ? 'queue' : 'topic'
      
      // First load any stored messages (filtered by entity type)
      const storedMessages = await messageStore.getMessages(sessionId, entityName, entityType)
      if (storedMessages.length > 0) {
        setMessages(storedMessages)
      }
      
      // Then peek new messages from backend
      const response = await apiClient.peekMessages(sessionId, entityName, 10, subscriptionName, isDLQ)
      
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
      setMessages(updatedMessages)
      
      const successMsg = `Peeked ${response.peekedCount} message(s) - Total stored: ${updatedMessages.length}`
      setSuccess(successMsg)
      setToast({ message: successMsg, type: 'success' })
      
      onAudit({
        timestamp: new Date().toISOString(),
        sessionId,
        entityName,
        operation: 'Peek'
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Peek failed'
      setError(errorMsg)
      setToast({ message: errorMsg, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Start streaming
  const handleStartStream = () => {
    setError(null)
    setSuccess(null)
    setToast(null)
    setStreaming(true)
  }

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
      <div className="stream-controls-compact">
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
          <button
            onClick={handlePeekNow}
            disabled={true}
            className="btn-compact btn-primary"
            title="Disabled — auto-load enabled"
          >
            📖 Peek
          </button>
          
          <button
            onClick={handleStartStream}
            disabled={true}
            className="btn-compact btn-primary"
            title="Disabled — auto-load enabled"
          >
            ▶️ Stream
          </button>
          
          <button
            onClick={() => setShowCompare(true)}
            disabled={true}
            className="btn-compact btn-outline"
            title="Disabled — auto-load enabled"
          >
            🔍 Compare
          </button>
        </div>
      </div>

      {error && (
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

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading messages...</p>
          </div>
        </div>
      )}

      <MessageTable
        messages={messages}
      />
      
      {/* Compare Modal */}
      {showCompare && (
        <CompareModal
          sessionId={sessionId}
          queueName={entityName}
          subscriptionName={subscriptionName}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  )
}
