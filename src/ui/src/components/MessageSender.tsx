/**
 * Horizontal Message Sender Component
 * Replaces the chatbot with a collapsible horizontal layout
 */

import React, { useState } from 'react';
import './MessageSender.css';
import { API_BASE_URL } from '../config/api';

interface MessageSenderProps {
  sessionId: string | null;
  entities?: Array<{ name: string; type: string }>;
}

const SAMPLE_PAYLOADS = [
  {
    name: 'Simple Text',
    payload: 'Hello from Service Bus!'
  },
  {
    name: 'Order Created',
    payload: JSON.stringify({
      eventType: 'OrderCreated',
      orderId: 'ORD-12345',
      customerId: 'CUST-67890',
      orderDate: new Date().toISOString(),
      items: [
        { sku: 'PROD-001', name: 'Product A', quantity: 2, price: 29.99 },
        { sku: 'PROD-002', name: 'Product B', quantity: 1, price: 49.99 }
      ],
      totalAmount: 109.97,
      currency: 'USD',
      shippingAddress: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA'
      },
      paymentMethod: 'CreditCard',
      status: 'Pending'
    }, null, 2)
  },
  {
    name: 'Payment Processed',
    payload: JSON.stringify({
      eventType: 'PaymentProcessed',
      paymentId: 'PAY-98765',
      orderId: 'ORD-12345',
      transactionId: 'TXN-54321',
      timestamp: new Date().toISOString(),
      amount: 109.97,
      currency: 'USD',
      paymentMethod: {
        type: 'CreditCard',
        last4Digits: '4242',
        cardBrand: 'Visa',
        expiryMonth: 12,
        expiryYear: 2025
      },
      status: 'Success',
      processorResponse: {
        code: '00',
        message: 'Approved',
        authCode: 'AUTH123456'
      },
      billingAddress: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA'
      }
    }, null, 2)
  },
  {
    name: 'Financial Transaction',
    payload: JSON.stringify({
      eventType: 'FinancialTransaction',
      transactionId: 'FTX-2024-00123',
      accountId: 'ACC-789012',
      timestamp: new Date().toISOString(),
      transactionType: 'CREDIT',
      amount: 1500.00,
      currency: 'USD',
      description: 'Wire Transfer Received',
      sourceAccount: {
        accountNumber: '****5678',
        bankCode: 'CHASE',
        accountType: 'CHECKING'
      },
      destinationAccount: {
        accountNumber: '****1234',
        bankCode: 'BOFA',
        accountType: 'SAVINGS'
      },
      metadata: {
        reference: 'REF-INV-2024-456',
        category: 'INCOME',
        tags: ['invoice', 'payment'],
        reconciled: false
      },
      balanceAfter: 15234.56,
      fees: {
        wireTransferFee: 25.00,
        currency: 'USD'
      }
    }, null, 2)
  },
  {
    name: 'User Registration',
    payload: JSON.stringify({
      eventType: 'UserRegistered',
      userId: 'USR-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      timestamp: new Date().toISOString(),
      userDetails: {
        email: 'newuser@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '+1-555-0123',
        dateOfBirth: '1990-05-15'
      },
      registrationSource: 'WebPortal',
      ipAddress: '203.0.113.45',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      accountType: 'Premium',
      verificationStatus: 'EmailSent',
      preferences: {
        newsletter: true,
        notifications: true,
        language: 'en-US',
        timezone: 'America/New_York'
      }
    }, null, 2)
  },
  {
    name: 'Inventory Update',
    payload: JSON.stringify({
      eventType: 'InventoryUpdated',
      warehouseId: 'WH-001',
      timestamp: new Date().toISOString(),
      updates: [
        {
          sku: 'PROD-001',
          previousQuantity: 150,
          newQuantity: 148,
          changeReason: 'SALE',
          orderId: 'ORD-12345'
        },
        {
          sku: 'PROD-002',
          previousQuantity: 75,
          newQuantity: 100,
          changeReason: 'RESTOCK',
          purchaseOrderId: 'PO-9876'
        }
      ],
      performedBy: 'system-auto',
      auditTrail: {
        action: 'BATCH_UPDATE',
        timestamp: new Date().toISOString(),
        correlationId: 'CORR-' + Date.now()
      }
    }, null, 2)
  }
];

export const MessageSender: React.FC<MessageSenderProps> = ({ sessionId, entities = [] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState('');
  const [message, setMessage] = useState('');
  const [showSamples, setShowSamples] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const sendMessage = async () => {
    if (!sessionId || !selectedEntity || !message.trim()) {
      setStatusMessage({ text: 'Please select a queue/topic and enter a message', type: 'error' });
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      // Check if selected entity is a topic
      const selectedEntityObj = entities.find(e => e.name === selectedEntity);
      const isTopicSelected = selectedEntityObj?.type === 'Topic';

      const response = await fetch(
        `${API_BASE_URL}/api/namespace/${sessionId}/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entityName: selectedEntity,
            message: message,
            applicationProperties: {
              timestamp: new Date().toISOString(),
              source: 'message-sender',
              correlationId: `msg-${Date.now()}`
            },
          }),
        }
      );

      if (response.ok) {
        if (isTopicSelected) {
          setStatusMessage({ 
            text: '✓ Message sent to topic! Note: View messages from topic subscriptions, not the topic itself.', 
            type: 'success' 
          });
        } else {
          setStatusMessage({ text: '✓ Message sent successfully! Select the queue in left panel to view.', type: 'success' });
        }
        setMessage('');
        
        // Auto-collapse after successful send
        setTimeout(() => {
          setStatusMessage(null);
          setIsExpanded(false);
        }, 2000);
      } else {
        await response.text(); // Consume response
        setStatusMessage({ text: `✗ Error: ${response.status}`, type: 'error' });
        setTimeout(() => setStatusMessage(null), 5000);
      }
    } catch (error) {
      setStatusMessage({ text: `✗ Error: ${error instanceof Error ? error.message : 'Failed to send'}`, type: 'error' });
      setTimeout(() => setStatusMessage(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSampleClick = (sample: typeof SAMPLE_PAYLOADS[0]) => {
    setMessage(sample.payload);
    setShowSamples(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      sendMessage();
    }
  };

  return (
    <div className={`message-sender ${isExpanded ? 'expanded' : ''}`}>
      <div className="message-sender-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="message-sender-title">
          <span className="message-sender-icon">📤</span>
          <span>Send Message to Service Bus</span>
        </div>
        <button className="message-sender-toggle" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
          {isExpanded ? '▼' : '▲'}
        </button>
      </div>

      {isExpanded && (
        <div className="message-sender-content">
          <div className="message-sender-controls">
            <div className="control-group">
              <label htmlFor="entity-select">Queue/Topic:</label>
              <select
                id="entity-select"
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                disabled={!sessionId || entities.length === 0}
                className={selectedEntity ? 'selected' : ''}
              >
                <option value="">Select queue or topic...</option>
                {entities.map((entity) => (
                  <option key={entity.name} value={entity.name}>
                    {entity.name} ({entity.type})
                  </option>
                ))}
              </select>
              {selectedEntity && (
                <span className="selected-indicator">✓ {selectedEntity}</span>
              )}
            </div>

            <div className="control-group">
              <button
                className="btn-samples"
                onClick={() => setShowSamples(!showSamples)}
                disabled={isLoading}
              >
                📋 Sample Payloads
              </button>
              <button
                className="btn-send"
                onClick={sendMessage}
                disabled={isLoading || !selectedEntity || !message.trim()}
              >
                {isLoading ? 'Sending...' : '📤 Send Message'}
              </button>
            </div>
          </div>

          {showSamples && (
            <div className="samples-panel">
              <div className="samples-header">
                <h4>Sample Payloads</h4>
                <button className="samples-close" onClick={() => setShowSamples(false)}>×</button>
              </div>
              <div className="samples-grid">
                {SAMPLE_PAYLOADS.map((sample, index) => (
                  <button
                    key={index}
                    className="sample-button"
                    onClick={() => handleSampleClick(sample)}
                  >
                    {sample.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="message-input-area">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Enter message payload (JSON or plain text)&#10;&#10;Press Ctrl+Enter to send"
              disabled={isLoading}
              rows={10}
            />
          </div>

          {statusMessage && (
            <div className={`status-message ${statusMessage.type}`}>
              {statusMessage.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
