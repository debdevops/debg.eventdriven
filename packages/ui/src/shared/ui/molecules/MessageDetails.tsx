import React from 'react';
import { MessageEnvelope } from '@/shared/types';
import './MessageDetails.css';

interface MessageDetailsProps {
  message: MessageEnvelope | null;
}

export const MessageDetails: React.FC<MessageDetailsProps> = ({ message }) => {
  if (!message) {
    return (
      <div className="message-details-empty">
        <p>Select a message to view its details</p>
      </div>
    );
  }

  const renderObject = (obj: object) => {
    return <pre>{JSON.stringify(obj, null, 2)}</pre>;
  };

  return (
    <div className="message-details-container">
      <div className="properties-section">
        <h4>Properties</h4>
        <div className="properties-grid">
          <div className="prop-item">
            <span className="prop-label">Message ID</span>
            <span className="prop-value">{message.messageId}</span>
          </div>
          <div className="prop-item">
            <span className="prop-label">Sequence #</span>
            <span className="prop-value">{message.sequenceNumber}</span>
          </div>
          <div className="prop-item">
            <span className="prop-label">Enqueued Time</span>
            <span className="prop-value">{new Date(message.enqueuedTimeUtc).toLocaleString()}</span>
          </div>
          <div className="prop-item">
            <span className="prop-label">Delivery Count</span>
            <span className="prop-value">{message.deliveryCount}</span>
          </div>
          {message.contentType && (
            <div className="prop-item">
              <span className="prop-label">Content Type</span>
              <span className="prop-value">{message.contentType}</span>
            </div>
          )}
          {message.correlationId && (
            <div className="prop-item">
              <span className="prop-label">Correlation ID</span>
              <span className="prop-value">{message.correlationId}</span>
            </div>
          )}
          {message.subject && (
            <div className="prop-item">
              <span className="prop-label">Subject</span>
              <span className="prop-value">{message.subject}</span>
            </div>
          )}
        </div>
      </div>

      {message.applicationProperties && Object.keys(message.applicationProperties).length > 0 && (
        <div className="properties-section">
          <h4>Application Properties</h4>
          {renderObject(message.applicationProperties)}
        </div>
      )}

      <div className="body-section">
        <h4>Body</h4>
        <pre className="message-body">{message.body}</pre>
      </div>
    </div>
  );
};