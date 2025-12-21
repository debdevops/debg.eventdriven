/**
 * Message Detail Panel
 * Modal by default; can render embedded (no portal/backdrop) for the bottom inspector.
 */

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MessageEnvelope } from '../types'
import type { DlqMessageClassification } from '../services/dlqReplayAdvisor'
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
  dlqClassification?: DlqMessageClassification | null
  embedded?: boolean
}

type TabType = 'body' | 'properties' | 'system' | 'risks'

export function MessageDetailPanel({
  message,
  messages,
  onClose,
  onPrevious,
  onNext,
  onResubmit,
  onDelete,
  onMoveToDLQ,
  dlqClassification = null,
  embedded = false
}: MessageDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('body')
  const [formatBody, setFormatBody] = useState(true)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const { safeIndex, hasPrevious, hasNext } = useMemo(() => {
    const currentIndex = messages.findIndex((m) =>
      (m.messageId && message.messageId && m.messageId === message.messageId) ||
      (m.sequenceNumber !== undefined && m.sequenceNumber === message.sequenceNumber)
    )
    const resolvedIndex = currentIndex >= 0 ? currentIndex : 0
    return {
      safeIndex: resolvedIndex,
      hasPrevious: resolvedIndex > 0,
      hasNext: resolvedIndex < messages.length - 1
    }
  }, [messages, message])

  const bodyText = message.body ?? ''

  const panel = (
    <div className={embedded ? 'message-detail-embedded' : 'message-detail-modal-overlay'}>
      {!embedded && <div className="message-detail-modal-backdrop" onClick={onClose} />}
      <div className={`message-detail-modal${embedded ? ' embedded' : ''}`}>
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
          {!embedded && (
            <button className="btn-close-panel" onClick={onClose} aria-label="Close panel">
              ×
            </button>
          )}
        </div>

        <div className="message-detail-nav">
          <button
            className="btn-nav"
            onClick={onPrevious}
            disabled={!onPrevious || !hasPrevious}
            title="Previous message"
          >
            ← Previous
          </button>
          <span className="message-position">
            {safeIndex + 1} of {messages.length}
          </span>
          <button
            className="btn-nav"
            onClick={onNext}
            disabled={!onNext || !hasNext}
            title="Next message"
          >
            Next →
          </button>
        </div>

        <div className="message-detail-tabs">
          <button className={`tab ${activeTab === 'body' ? 'active' : ''}`} onClick={() => setActiveTab('body')}>
            Body
          </button>
          <button
            className={`tab ${activeTab === 'properties' ? 'active' : ''}`}
            onClick={() => setActiveTab('properties')}
          >
            Properties
          </button>
          <button className={`tab ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')}>
            System
          </button>
          {dlqClassification && dlqClassification.riskSignals && dlqClassification.riskSignals.length > 0 && (
            <button
              className={`tab ${activeTab === 'risks' ? 'active' : ''}`}
              onClick={() => setActiveTab('risks')}
              title="Risk signals for this message"
            >
              ⚠️ Risks ({dlqClassification.riskSignals.length})
            </button>
          )}
        </div>

        <div className="message-detail-content">
          {activeTab === 'body' && (
            <div className="tab-body">
              <div className="tab-body-toolbar">
                <label className="format-toggle">
                  <input type="checkbox" checked={formatBody} onChange={(e) => setFormatBody(e.target.checked)} />
                  Format JSON
                </label>
                <button className="btn-copy-small" onClick={() => copyToClipboard(bodyText)}>
                  📋 Copy
                </button>
              </div>
              <pre className="message-body-content">
                <code>{formatBody ? formatJSON(bodyText) : bodyText}</code>
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
                        <button className="btn-copy-mini" onClick={() => copyToClipboard(message.contentType!)}>
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
                        <button className="btn-copy-mini" onClick={() => copyToClipboard(message.correlationId!)}>
                          📋
                        </button>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="prop-key">Message ID</td>
                    <td className="prop-value">
                      {message.messageId}
                      <button className="btn-copy-mini" onClick={() => copyToClipboard(message.messageId)}>
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
                    <td className="prop-value">{new Date(message.enqueuedTimeUtc).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="prop-key">Sequence Number</td>
                    <td className="prop-value">{message.sequenceNumber}</td>
                  </tr>
                  <tr>
                    <td className="prop-key">Size</td>
                    <td className="prop-value">{((bodyText.length || 0) / 1024).toFixed(2)} KB</td>
                  </tr>
                  <tr>
                    <td className="prop-key">Delivery Count</td>
                    <td className="prop-value">{message.deliveryCount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'risks' && dlqClassification && dlqClassification.riskSignals && (
            <div className="tab-risks">
              <div className="risks-header">
                <h3>Risk Signals</h3>
                <p className="risks-description">
                  These non-automated signals help you assess message replay risk. Review each signal carefully before replaying.
                </p>
              </div>
              <div className="risks-list">
                {dlqClassification.riskSignals.length === 0 ? (
                  <div className="no-risks">No risk signals detected</div>
                ) : (
                  dlqClassification.riskSignals.map((signal, idx) => (
                    <div key={idx} className={`risk-signal-item risk-${signal.severity}`}>
                      <div className="risk-header">
                        <span className="risk-type">{signal.description}</span>
                        <span className={`risk-severity ${signal.severity}`}>{signal.severity.toUpperCase()}</span>
                      </div>
                      <div className="risk-explanation">{signal.explanation}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="message-detail-footer">
          {onResubmit && (
            <button className="btn-action" onClick={() => onResubmit(message)}>
              🔄 Resubmit
            </button>
          )}
          {onDelete && (
            <button className="btn-action danger" onClick={() => onDelete(message)}>
              🗑 Delete
            </button>
          )}
          {onMoveToDLQ && (
            <button className="btn-action warning" onClick={() => onMoveToDLQ(message)}>
              📤 Move to DLQ
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (embedded) return panel
  return createPortal(panel, document.body)
}

function formatJSON(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // ignore
  }
}
