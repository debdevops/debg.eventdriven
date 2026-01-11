/**
 * Message Modal - View full message JSON with multiple format options
 * Supports: Raw, Pretty JSON, Base64, XML, UTF-8
 */

import { useState } from 'react'
import { parseMessageBody } from "@/shared/lib/utils/formatters"
import type { MessageEnvelope } from '../types'
import './MessageModal.css'

interface MessageModalProps {
  message: MessageEnvelope
  onClose: () => void
}

type FormatType = 'raw' | 'pretty' | 'base64' | 'xml' | 'utf8'

export function MessageModal({ message, onClose }: MessageModalProps) {
  const [activeFormat, setActiveFormat] = useState<FormatType>('pretty')
  const { isJson } = parseMessageBody(message.body)

  const formatBody = (type: FormatType): string => {
    const body = message.body

    switch (type) {
      case 'raw':
        return body

      case 'pretty':
        try {
          const parsed = JSON.parse(body)
          return JSON.stringify(parsed, null, 2)
        } catch {
          return body
        }

      case 'base64':
        try {
          // Try to decode if it's base64, otherwise encode
          const decoded = atob(body)
          return `Decoded:\n${decoded}\n\n---\n\nOriginal Base64:\n${body}`
        } catch {
          // Not base64, so encode it
          const encoded = btoa(body)
          return `Base64 Encoded:\n${encoded}\n\n---\n\nOriginal:\n${body}`
        }

      case 'xml':
        try {
          // Try to parse as XML and pretty-print
          const parser = new DOMParser()
          const xmlDoc = parser.parseFromString(body, 'text/xml')
          const serializer = new XMLSerializer()
          return serializer.serializeToString(xmlDoc)
        } catch {
          return `Not valid XML:\n\n${body}`
        }

      case 'utf8':
        return body

      default:
        return body
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(formatBody(activeFormat))
  }

  const handleDownload = () => {
    const blob = new Blob([formatBody(activeFormat)], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `message-${message.messageId}-${activeFormat}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

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
                <span className="detail-value correlationId-highlight">{message.correlationId}</span>
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
            {/* DLQ-specific fields */}
            {message.deadLetterReason && (
              <div className="detail-row dlq-info">
                <span className="detail-label">Dead Letter Reason:</span>
                <span className="detail-value dlq-reason">{message.deadLetterReason}</span>
              </div>
            )}
            {message.deadLetterErrorDescription && (
              <div className="detail-row dlq-info">
                <span className="detail-label">Error Description:</span>
                <span className="detail-value dlq-error">{message.deadLetterErrorDescription}</span>
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
            <div className="message-section-header">
              <h3>Message Body {isJson && <span className="badge-info">JSON</span>}</h3>
              <div className="format-tabs">
                <button
                  className={`format-tab ${activeFormat === 'pretty' ? 'active' : ''}`}
                  onClick={() => setActiveFormat('pretty')}
                >
                  Pretty JSON
                </button>
                <button
                  className={`format-tab ${activeFormat === 'raw' ? 'active' : ''}`}
                  onClick={() => setActiveFormat('raw')}
                >
                  Raw
                </button>
                <button
                  className={`format-tab ${activeFormat === 'base64' ? 'active' : ''}`}
                  onClick={() => setActiveFormat('base64')}
                >
                  Base64
                </button>
                <button
                  className={`format-tab ${activeFormat === 'xml' ? 'active' : ''}`}
                  onClick={() => setActiveFormat('xml')}
                >
                  XML
                </button>
                <button
                  className={`format-tab ${activeFormat === 'utf8' ? 'active' : ''}`}
                  onClick={() => setActiveFormat('utf8')}
                >
                  UTF-8
                </button>
              </div>
              <div className="format-actions">
                <button onClick={handleCopy} className="btn-sm btn-outline" title="Copy to clipboard">
                  📋 Copy
                </button>
                <button onClick={handleDownload} className="btn-sm btn-outline" title="Download as file">
                  ⬇️ Download
                </button>
              </div>
            </div>
            <pre className="code-block">
              {formatBody(activeFormat)}
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
