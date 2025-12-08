/**
 * Message Detail Side Panel
 * Slide-out panel from right showing full message details
 */

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { MessageEnvelope } from '../types'
import './MessageDetailPanel.css'

interface MessageDetailPanelProps {
  message: MessageEnvelope
  messages: MessageEnvelope[]
  onClose: () => void
  onPrevious?: () => void
  onNext?: () => void
  onResubmit?: (message: MessageEnvelope) => void
  onDelete?: (message: MessageEnvelope) => void
  onMoveToDLQ?: (message: MessageEnvelope) => void
}

type TabType = 'body' | 'properties' | 'system'

export function MessageDetailPanel({
  message,
  messages,
  onClose,
  onPrevious,
  onNext,
  onResubmit,
  onDelete,
  onMoveToDLQ
}: MessageDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('body')
  const [formatBody, setFormatBody] = useState(true)

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft' && onPrevious) {
        onPrevious()
      } else if (e.key === 'ArrowRight' && onNext) {
        onNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onPrevious, onNext])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const formatJSON = (body: string) => {
    try {
      const parsed = JSON.parse(body)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return body
    }
  }

  const currentIndex = messages.findIndex(m => m.messageId === message.messageId)
  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex < messages.length - 1

  return createPortal(
    <div className="message-detail-modal-overlay">
      <div className="message-detail-modal-backdrop" onClick={onClose} />
      <div className="message-detail-modal">
        {/* Header */}
        <div className="message-detail-header">
          <div className="message-detail-title">
            <span className="message-id-label">Message ID</span>
            <span className="message-id-value">{message.messageId}</span>
            <button
              className="btn-copy-inline"
              onClick={() => copyToClipboard(message.messageId)}
              title="Copy Message ID"
            >
              📋
            </button>
          </div>
          <button
            className="btn-close-panel"
            onClick={onClose}
            aria-label="Close panel"
          >
            ×
          </button>
        </div>

        {/* Navigation */}
        <div className="message-detail-nav">
          <button
            className="btn-nav"
            onClick={onPrevious}
            disabled={!hasPrevious}
            title="Previous message"
          >
            ← Previous
          </button>
          <span className="message-position">
            {currentIndex + 1} of {messages.length}
          </span>
          <button
            className="btn-nav"
            onClick={onNext}
            disabled={!hasNext}
            title="Next message"
          >
            Next →
          </button>
        </div>

        {/* Tabs */}
        <div className="message-detail-tabs">
          <button
            className={`tab ${activeTab === 'body' ? 'active' : ''}`}
            onClick={() => setActiveTab('body')}
          >
            Body
          </button>
          <button
            className={`tab ${activeTab === 'properties' ? 'active' : ''}`}
            onClick={() => setActiveTab('properties')}
          >
            Properties
          </button>
          <button
            className={`tab ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            System
          </button>
        </div>

        {/* Tab Content */}
        <div className="message-detail-content">
          {activeTab === 'body' && (
            <div className="tab-body">
              <div className="tab-body-toolbar">
                <label className="format-toggle">
                  <input
                    type="checkbox"
                    checked={formatBody}
                    onChange={(e) => setFormatBody(e.target.checked)}
                  />
                  Format JSON
                </label>
                <button
                  className="btn-copy-small"
                  onClick={() => copyToClipboard(message.body)}
                >
                  📋 Copy
                </button>
              </div>
              <pre className="message-body-content">
                <code>{formatBody ? formatJSON(message.body) : message.body}</code>
              </pre>
            </div>
          )}

          {activeTab === 'properties' && (
            <div className="tab-properties">
              <table className="properties-table">
                <tbody>
                  {message.contentType && (
                    <tr>
                      <td className="prop-key">Content Type</td>
                      <td className="prop-value">
                        {message.contentType}
                        <button
                          className="btn-copy-mini"
                          onClick={() => copyToClipboard(message.contentType!)}
                        >
                          📋
                        </button>
                      </td>
                    </tr>
                  )}
                  {message.correlationId && (
                    <tr>
                      <td className="prop-key">Correlation ID</td>
                      <td className="prop-value">
                        {message.correlationId}
                        <button
                          className="btn-copy-mini"
                          onClick={() => copyToClipboard(message.correlationId!)}
                        >
                          📋
                        </button>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="prop-key">Message ID</td>
                    <td className="prop-value">
                      {message.messageId}
                      <button
                        className="btn-copy-mini"
                        onClick={() => copyToClipboard(message.messageId)}
                      >
                        📋
                      </button>
                    </td>
                  </tr>
                  {message.subject && (
                    <tr>
                      <td className="prop-key">Subject</td>
                      <td className="prop-value">{message.subject}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="tab-system">
              <table className="properties-table">
                <tbody>
                  <tr>
                    <td className="prop-key">Enqueued Time</td>
                    <td className="prop-value">
                      {new Date(message.enqueuedTimeUtc).toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td className="prop-key">Sequence Number</td>
                    <td className="prop-value">{message.sequenceNumber}</td>
                  </tr>
                  <tr>
                    <td className="prop-key">Size</td>
                    <td className="prop-value">
                      {(message.body.length / 1024).toFixed(2)} KB
                    </td>
                  </tr>
                  <tr>
                    <td className="prop-key">Delivery Count</td>
                    <td className="prop-value">{message.deliveryCount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="message-detail-footer">
          {onResubmit && (
            <button
              className="btn-action"
              onClick={() => onResubmit(message)}
            >
              🔄 Resubmit
            </button>
          )}
          {onMoveToDLQ && (
            <button
              className="btn-action"
              onClick={() => onMoveToDLQ(message)}
            >
              💀 Move to DLQ
            </button>
          )}
          {onDelete && (
            <button
              className="btn-action danger"
              onClick={() => onDelete(message)}
            >
              🗑️ Delete
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
