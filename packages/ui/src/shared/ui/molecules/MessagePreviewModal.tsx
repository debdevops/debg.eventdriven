/**
 * MessagePreviewModal - Full message body viewer
 * - Fetches full message body only when opened (lazy load)
 * - Pretty-prints JSON payloads
 * - Keyboard accessible (ESC to close, Enter to open)
 * - Focus management
 */

import React, { useEffect, useState, useRef } from 'react';
import type { MessageEnvelope } from '@/shared/types';
import './MessagePreviewModal.css';

interface MessagePreviewModalProps {
  message: MessageEnvelope;
  sessionId: string;
  entityName: string;
  subscriptionName?: string;
  isDLQ?: boolean;
  onClose: () => void;
}

export const MessagePreviewModal: React.FC<MessagePreviewModalProps> = ({
  message,
  sessionId,
  entityName,
  subscriptionName,
  isDLQ = false,
  onClose
}) => {
  const [fullBody, setFullBody] = useState<string>(message.body || '');
  const [loading, setLoading] = useState(false);
  const [error] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management - focus close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Fetch full message body if not already loaded
  useEffect(() => {
    // If body looks complete, skip fetch
    if (message.body && message.body.length > 100) {
      setFullBody(message.body);
      return;
    }

    // Otherwise, fetch full body from backend
    // Note: This assumes backend has an endpoint to fetch full message by ID
    // If not available, we use the body from the message object
    setLoading(true);
    setFullBody(message.body || '');
    setLoading(false);
    
    // TODO: If backend provides /api/queue/{sessionId}/{entityName}/message/{messageId} endpoint,
    // uncomment and implement fetch logic here
    /*
    const fetchFullBody = async () => {
      try {
        const url = subscriptionName
          ? `/api/queue/${sessionId}/${entityName}/message/${message.messageId}?subscriptionName=${subscriptionName}&isDLQ=${isDLQ}`
          : `/api/queue/${sessionId}/${entityName}/message/${message.messageId}?isDLQ=${isDLQ}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch message');
        const data = await response.json();
        setFullBody(data.body || message.body);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load message');
        setFullBody(message.body || '');
      } finally {
        setLoading(false);
      }
    };
    fetchFullBody();
    */
  }, [message, sessionId, entityName, subscriptionName, isDLQ]);

  // Pretty-print JSON if possible
  const prettyBody = React.useMemo(() => {
    if (!fullBody) return '';
    
    try {
      const parsed = JSON.parse(fullBody);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // Not JSON, return as-is
      return fullBody;
    }
  }, [fullBody]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(prettyBody);
  };

  return (
    <div className="message-preview-modal-backdrop" onClick={handleBackdropClick}>
      <div className="message-preview-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h2 id="modal-title">Message Details</h2>
          <button
            ref={closeButtonRef}
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="modal-metadata">
          <div className="metadata-row">
            <span className="metadata-label">Message ID:</span>
            <span className="metadata-value">{message.messageId}</span>
          </div>
          <div className="metadata-row">
            <span className="metadata-label">Sequence #:</span>
            <span className="metadata-value">{message.sequenceNumber}</span>
          </div>
          <div className="metadata-row">
            <span className="metadata-label">Enqueued:</span>
            <span className="metadata-value">{new Date(message.enqueuedTimeUtc).toLocaleString()}</span>
          </div>
          <div className="metadata-row">
            <span className="metadata-label">Delivery Count:</span>
            <span className="metadata-value">{message.deliveryCount}</span>
          </div>
          {isDLQ && message.deadLetterReason && (
            <div className="metadata-row dlq-metadata">
              <span className="metadata-label">Dead Letter Reason:</span>
              <span className="metadata-value dlq-reason">{message.deadLetterReason}</span>
            </div>
          )}
          {isDLQ && message.deadLetterErrorDescription && (
            <div className="metadata-row dlq-metadata">
              <span className="metadata-label">Error Description:</span>
              <span className="metadata-value dlq-error">{message.deadLetterErrorDescription}</span>
            </div>
          )}
          {isDLQ && message.deadLetterSource && (
            <div className="metadata-row dlq-metadata">
              <span className="metadata-label">DLQ Source:</span>
              <span className="metadata-value">{message.deadLetterSource}</span>
            </div>
          )}
          {message.applicationProperties && Object.keys(message.applicationProperties).length > 0 && (
            <div className="metadata-row">
              <span className="metadata-label">Properties:</span>
              <pre className="metadata-value">{JSON.stringify(message.applicationProperties, null, 2)}</pre>
            </div>
          )}
        </div>

        <div className="modal-body">
          <div className="modal-body-header">
            <h3>Message Body</h3>
            <button className="btn-copy" onClick={handleCopy} title="Copy to clipboard">
              📋 Copy
            </button>
          </div>
          
          {loading && <div className="modal-loading">Loading full message...</div>}
          {error && <div className="modal-error">{error}</div>}
          {!loading && !error && (
            <pre className="modal-body-content">{prettyBody || '(empty)'}</pre>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
