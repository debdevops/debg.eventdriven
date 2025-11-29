/**
 * Message Modal - View full message JSON
 */

import { parseMessageBody } from '../utils/formatters'
import type { MessageEnvelope } from '../types'
import './MessageModal.css'

interface MessageModalProps {
  message: MessageEnvelope
  onClose: () => void
}

export function MessageModal({ message, onClose }: MessageModalProps) {
  const { formatted, isJson } = parseMessageBody(message.body)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Message Details</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="message-details">
            <div className="detail-row">
              <span className="detail-label">Message ID:</span>
              <span className="detail-value">{message.messageId}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Sequence Number:</span>
              <span className="detail-value">{message.sequenceNumber}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Enqueued:</span>
              <span className="detail-value">{new Date(message.enqueuedTimeUtc).toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Delivery Count:</span>
              <span className="detail-value">{message.deliveryCount}</span>
            </div>
            {message.contentType && (
              <div className="detail-row">
                <span className="detail-label">Content Type:</span>
                <span className="detail-value">{message.contentType}</span>
              </div>
            )}
            {message.correlationId && (
              <div className="detail-row">
                <span className="detail-label">Correlation ID:</span>
                <span className="detail-value">{message.correlationId}</span>
              </div>
            )}
            {message.subject && (
              <div className="detail-row">
                <span className="detail-label">Subject:</span>
                <span className="detail-value">{message.subject}</span>
              </div>
            )}
            {message.lockedUntilUtc && (
              <div className="detail-row">
                <span className="detail-label">Locked Until:</span>
                <span className="detail-value">{new Date(message.lockedUntilUtc).toLocaleString()}</span>
              </div>
            )}
          </div>

          {Object.keys(message.applicationProperties || {}).length > 0 && (
            <div className="message-section">
              <h3>Application Properties</h3>
              <pre className="code-block">
                {JSON.stringify(message.applicationProperties, null, 2)}
              </pre>
            </div>
          )}

          <div className="message-section">
            <h3>Message Body {isJson && <span className="badge-info">JSON</span>}</h3>
            <pre className="code-block">
              {formatted}
            </pre>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
