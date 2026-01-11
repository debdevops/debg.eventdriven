/**
 * CompareModal - Side-by-side comparison of main queue vs DLQ messages
 * Shows message metadata to help identify if messages are duplicates or distinct
 */

import React, { useEffect, useState } from 'react';
import { apiClient } from "@/shared/api/client";
import './CompareModal.css';

interface CompareModalProps {
  sessionId: string;
  queueName: string;
  subscriptionName?: string;
  onClose: () => void;
}

interface MessageMetadata {
  messageId: string;
  sequenceNumber: number;
  enqueuedTimeUtc: string;
  deliveryCount: number;
  subject?: string;
  correlationId?: string;
  deadLetterReason?: string;
  deadLetterErrorDescription?: string;
}

interface CompareResult {
  queue: string;
  mainQueue: { count: number; messages: MessageMetadata[] };
  deadLetterQueue: { count: number; messages: MessageMetadata[] };
}

export const CompareModal: React.FC<CompareModalProps> = ({
  sessionId,
  queueName,
  subscriptionName,
  onClose
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CompareResult | null>(null);

  useEffect(() => {
    const fetchCompare = async () => {
      try {
        setLoading(true);
        const result = await apiClient.peekCompare(sessionId, queueName, subscriptionName);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to compare');
      } finally {
        setLoading(false);
      }
    };
    fetchCompare();
  }, [sessionId, queueName, subscriptionName]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Find matching messages (same MessageId in both queues)
  const findMatches = () => {
    if (!data) return { mainOnly: [], dlqOnly: [], matches: [] };
    
    const mainIds = new Set(data.mainQueue.messages.map(m => m.messageId));
    const dlqIds = new Set(data.deadLetterQueue.messages.map(m => m.messageId));
    
    const matches = data.mainQueue.messages.filter(m => dlqIds.has(m.messageId));
    const mainOnly = data.mainQueue.messages.filter(m => !dlqIds.has(m.messageId));
    const dlqOnly = data.deadLetterQueue.messages.filter(m => !mainIds.has(m.messageId));
    
    return { mainOnly, dlqOnly, matches };
  };

  const { mainOnly, dlqOnly, matches } = data ? findMatches() : { mainOnly: [], dlqOnly: [], matches: [] };

  return (
    <div className="compare-modal-backdrop" onClick={handleBackdropClick}>
      <div className="compare-modal" role="dialog" aria-modal="true">
        <div className="compare-header">
          <h2>🔍 Queue vs DLQ Comparison</h2>
          <span className="compare-entity">{data?.queue || queueName}</span>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        {loading && (
          <div className="compare-loading">
            <div className="spinner"></div>
            <p>Comparing queue and DLQ...</p>
          </div>
        )}

        {error && (
          <div className="compare-error">
            <p>❌ {error}</p>
          </div>
        )}

        {data && !loading && (
          <div className="compare-content">
            <div className="compare-summary">
              <div className="summary-item">
                <span className="summary-label">Main Queue</span>
                <span className="summary-value main-count">{data.mainQueue.count} messages</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Dead Letter Queue</span>
                <span className="summary-value dlq-count">{data.deadLetterQueue.count} messages</span>
              </div>
              {matches.length > 0 && (
                <div className="summary-item warning">
                  <span className="summary-label">⚠️ Matching IDs</span>
                  <span className="summary-value">{matches.length} (same MessageId in both)</span>
                </div>
              )}
            </div>

            <div className="compare-columns">
              <div className="compare-column">
                <h3>📥 Main Queue ({mainOnly.length} unique)</h3>
                {mainOnly.length === 0 ? (
                  <p className="empty-state">No unique messages in main queue</p>
                ) : (
                  <div className="message-list">
                    {mainOnly.map(msg => (
                      <div key={msg.sequenceNumber} className="message-card">
                        <div className="msg-id">{msg.messageId}</div>
                        <div className="msg-meta">
                          <span>Seq: {msg.sequenceNumber}</span>
                          <span>Delivery: {msg.deliveryCount}</span>
                        </div>
                        <div className="msg-time">{new Date(msg.enqueuedTimeUtc).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="compare-column dlq-column">
                <h3>💀 DLQ ({dlqOnly.length} unique)</h3>
                {dlqOnly.length === 0 ? (
                  <p className="empty-state">No unique messages in DLQ</p>
                ) : (
                  <div className="message-list">
                    {dlqOnly.map(msg => (
                      <div key={msg.sequenceNumber} className="message-card dlq-card">
                        <div className="msg-id">{msg.messageId}</div>
                        <div className="msg-meta">
                          <span>Seq: {msg.sequenceNumber}</span>
                          <span>Delivery: {msg.deliveryCount}</span>
                        </div>
                        {msg.deadLetterReason && (
                          <div className="dlq-reason">
                            <strong>Reason:</strong> {msg.deadLetterReason}
                          </div>
                        )}
                        <div className="msg-time">{new Date(msg.enqueuedTimeUtc).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {matches.length > 0 && (
              <div className="compare-matches">
                <h3>⚠️ Messages with Same ID in Both Queues</h3>
                <p className="matches-note">
                  These messages have the same MessageId. This is unusual - typically a message is in one or the other.
                </p>
                <div className="message-list">
                  {matches.map(msg => (
                    <div key={msg.sequenceNumber} className="message-card warning-card">
                      <div className="msg-id">{msg.messageId}</div>
                      <div className="msg-meta">
                        <span>Seq: {msg.sequenceNumber}</span>
                        <span>Delivery: {msg.deliveryCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="compare-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
