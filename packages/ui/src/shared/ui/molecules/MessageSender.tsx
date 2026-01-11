/**
 * Horizontal Message Sender Component
 * Replaces the chatbot with a collapsible horizontal layout
 */

import React, { useState } from 'react';
import './MessageSender.css';
import { API_BASE_URL } from "@/shared/config/api";
import { useSessionV2 } from "@/shared/contexts/SessionContextV2";

interface MessageSenderProps {
  sessionId: string | null;
  entities?: Array<{ name: string; type: string }>;
  currentEntity?: string; // Auto-select this entity when provided
  onMessageSent?: () => void; // Callback when message is successfully sent
}

interface MessageTemplate {
  id: string;
  name: string;
  payload: string;
  properties: Record<string, string>;
  createdAt: string;
}

interface CustomProperty {
  key: string;
  value: string;
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

export const MessageSender: React.FC<MessageSenderProps> = ({ sessionId, entities = [], currentEntity, onMessageSent }) => {
  const { scheduleTimeout, clearTimer } = useSessionV2();

  const [selectedEntity, setSelectedEntity] = useState('');
  const [message, setMessage] = useState('');
  const [showSamples, setShowSamples] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // Auto-select current entity when provided
  React.useEffect(() => {
    if (currentEntity && entities.some(e => e.name === currentEntity)) {
      setSelectedEntity(currentEntity);
    }
  }, [currentEntity, entities]);
  
  // Template management
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  
  // Custom properties
  const [customProperties, setCustomProperties] = useState<CustomProperty[]>([{ key: '', value: '' }]);
  const [showProperties, setShowProperties] = useState(false);
  
  // Batch & scheduled sending
  const [batchCount, setBatchCount] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [scheduledDelay, setScheduledDelay] = useState(0);
  const [isScheduled, setIsScheduled] = useState(false);
  
  // Import/upload state
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const scheduleStatusClear = (delayMs: number) => {
    scheduleTimeout('message-sender:status-clear', delayMs, () => setStatusMessage(null));
  };

  React.useEffect(() => {
    return () => {
      clearTimer('message-sender:status-clear');
      clearTimer('message-sender:import-close');
    };
  }, [clearTimer]);

  // Load templates from localStorage on mount
  React.useEffect(() => {
    const savedTemplates = localStorage.getItem('messageTemplates');
    if (savedTemplates) {
      try {
        setTemplates(JSON.parse(savedTemplates));
      } catch (e) {
        console.error('Failed to load templates:', e);
      }
    }
  }, []);

  const sendMessage = async () => {
    if (!sessionId || !selectedEntity || !message.trim()) {
      setStatusMessage({ text: 'Please select a queue/topic and enter a message', type: 'error' });
      scheduleStatusClear(3000);
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const selectedEntityObj = entities.find(e => e.name === selectedEntity);
      const isTopicSelected = selectedEntityObj?.type === 'Topic';

      // Build application properties
      const appProperties: Record<string, string> = {
        timestamp: new Date().toISOString(),
        source: 'message-sender',
        correlationId: `msg-${Date.now()}`
      };
      
      // Add custom properties
      customProperties.forEach(prop => {
        if (prop.key.trim() && prop.value.trim()) {
          appProperties[prop.key] = prop.value;
        }
      });

      // Batch sending
      const messagesToSend = batchCount > 1 ? batchCount : 1;
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < messagesToSend; i++) {
        try {
          // Scheduled send
          if (isScheduled && scheduledDelay > 0) {
            const response = await fetch(
              `${API_BASE_URL}/api/namespace/${sessionId}/${selectedEntity}/send-scheduled`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: message,
                  delaySeconds: scheduledDelay,
                  applicationProperties: { ...appProperties, batchIndex: i + 1 }
                })
              }
            );
            if (response.ok) successCount++;
            else failCount++;
          } else {
            // Regular send
            const response = await fetch(
              `${API_BASE_URL}/api/namespace/${sessionId}/send`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  entityName: selectedEntity,
                  message: message,
                  applicationProperties: { ...appProperties, batchIndex: i + 1 }
                })
              }
            );
            if (response.ok) successCount++;
            else failCount++;
          }
        } catch (error) {
          failCount++;
        }
      }

      if (successCount > 0) {
        const schedMsg = isScheduled ? ` (scheduled in ${scheduledDelay}s)` : '';
        const batchMsg = messagesToSend > 1 ? ` ${successCount}/${messagesToSend} messages` : '';
        if (isTopicSelected) {
          setStatusMessage({ 
            text: `✓${batchMsg} sent to topic${schedMsg}! View from subscriptions.`, 
            type: 'success' 
          });
        } else {
          setStatusMessage({ 
            text: `✓${batchMsg} sent${schedMsg}! Select queue to view.`, 
            type: 'success' 
          });
        }
        setMessage('');
        
        // Call callback to close drawer
        if (onMessageSent) {
          onMessageSent();
        }

        scheduleStatusClear(2000);
      } else {
        setStatusMessage({ text: `✗ Failed to send messages (${failCount} failed)`, type: 'error' });
        scheduleStatusClear(5000);
      }
    } catch (error) {
      setStatusMessage({ text: `✗ Error: ${error instanceof Error ? error.message : 'Failed to send'}`, type: 'error' });
      scheduleStatusClear(5000);
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

  // Template management functions
  const saveTemplate = () => {
    if (!templateName.trim() || !message.trim()) {
      setStatusMessage({ text: 'Template name and message are required', type: 'error' });
      scheduleStatusClear(3000);
      return;
    }

    const newTemplate: MessageTemplate = {
      id: `template-${Date.now()}`,
      name: templateName,
      payload: message,
      properties: customProperties.reduce((acc, prop) => {
        if (prop.key.trim() && prop.value.trim()) {
          acc[prop.key] = prop.value;
        }
        return acc;
      }, {} as Record<string, string>),
      createdAt: new Date().toISOString()
    };

    const updatedTemplates = [...templates, newTemplate];
    setTemplates(updatedTemplates);
    localStorage.setItem('messageTemplates', JSON.stringify(updatedTemplates));
    
    setTemplateName('');
    setShowSaveTemplate(false);
    setStatusMessage({ text: '✓ Template saved!', type: 'success' });
    scheduleStatusClear(2000);
  };

  const loadTemplate = (template: MessageTemplate) => {
    setMessage(template.payload);
    const props = Object.entries(template.properties).map(([key, value]) => ({ key, value }));
    setCustomProperties(props.length > 0 ? props : [{ key: '', value: '' }]);
    setShowTemplates(false);
    setStatusMessage({ text: `✓ Loaded template: ${template.name}`, type: 'success' });
    scheduleStatusClear(2000);
  };

  const deleteTemplate = (templateId: string) => {
    const updatedTemplates = templates.filter(t => t.id !== templateId);
    setTemplates(updatedTemplates);
    localStorage.setItem('messageTemplates', JSON.stringify(updatedTemplates));
    setStatusMessage({ text: '✓ Template deleted', type: 'success' });
    scheduleStatusClear(2000);
  };

  // Custom properties management
  const addProperty = () => {
    setCustomProperties([...customProperties, { key: '', value: '' }]);
  };

  const removeProperty = (index: number) => {
    setCustomProperties(customProperties.filter((_, i) => i !== index));
  };

  const updateProperty = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customProperties];
    updated[index][field] = value;
    setCustomProperties(updated);
  };

  // Import/upload handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const jsonFile = files.find(f => f.name.endsWith('.json'));
    
    if (jsonFile) {
      await processImportFile(jsonFile);
    } else {
      setStatusMessage({ text: '✗ Please drop a JSON file', type: 'error' });
      scheduleStatusClear(3000);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processImportFile(file);
    }
    // Reset input
    e.target.value = '';
  };

  const processImportFile = async (file: File) => {
    if (!selectedEntity || !sessionId) {
      setStatusMessage({ text: '✗ Please select a queue/topic first', type: 'error' });
      scheduleStatusClear(3000);
      return;
    }

    setImporting(true);
    setStatusMessage(null);

    try {
      const content = await file.text();
      const messages = JSON.parse(content);

      // Validate format
      if (!Array.isArray(messages)) {
        throw new Error('JSON file must contain an array of messages');
      }

      if (messages.length === 0) {
        throw new Error('No messages found in file');
      }

      if (messages.length > 1000) {
        throw new Error('Cannot import more than 1000 messages at once');
      }

      // Validate message structure
      const validMessages = messages.map((msg, index) => {
        if (typeof msg === 'string') {
          return { body: msg };
        }
        if (typeof msg === 'object' && msg !== null) {
          return {
            body: msg.body || JSON.stringify(msg),
            messageId: msg.messageId,
            correlationId: msg.correlationId,
            subject: msg.subject,
            contentType: msg.contentType,
            sessionId: msg.sessionId,
            replyTo: msg.replyTo,
            to: msg.to,
            timeToLive: msg.timeToLive,
            scheduledEnqueueTime: msg.scheduledEnqueueTime,
            applicationProperties: msg.applicationProperties
          };
        }
        throw new Error(`Invalid message format at index ${index}`);
      });

      // Send import request
      const response = await fetch(
        `${API_BASE_URL}/api/namespace/${sessionId}/${selectedEntity}/import`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: validMessages })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Import failed');
      }

      const result = await response.json();
      
      setStatusMessage({
        text: `✓ Imported ${result.successCount}/${result.totalMessages} messages` +
              (result.failCount > 0 ? ` (${result.failCount} failed)` : ''),
        type: result.failCount > 0 ? 'error' : 'success'
      });

      scheduleTimeout('message-sender:import-close', 3000, () => {
        setStatusMessage(null);
        setShowImport(false);
      });

    } catch (error) {
      setStatusMessage({
        text: `✗ Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      });
      scheduleStatusClear(5000);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="message-sender">
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

            <div className="control-group button-group">
              <button
                className="btn-samples"
                onClick={() => setShowSamples(!showSamples)}
                disabled={isLoading}
                title="Insert sample payload"
              >
                📋 Samples
              </button>
              <button
                className="btn-templates"
                onClick={() => setShowTemplates(!showTemplates)}
                disabled={isLoading}
                title="Load saved templates"
              >
                📁 Templates ({templates.length})
              </button>
              <button
                className="btn-save-template"
                onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                disabled={isLoading || !message.trim()}
                title="Save current message as template"
              >
                💾 Save Template
              </button>
              <button
                className="btn-advanced"
                onClick={() => setShowAdvanced(!showAdvanced)}
                disabled={isLoading}
                title="Advanced options"
              >
                ⚙️ Advanced
              </button>
              <button
                className="btn-import"
                onClick={() => setShowImport(!showImport)}
                disabled={isLoading || !selectedEntity}
                title="Import messages from JSON file"
              >
                📥 Import
              </button>
              <button
                className="btn-send"
                onClick={sendMessage}
                disabled={isLoading || !selectedEntity || !message.trim()}
              >
                {isLoading ? '⏳ Sending...' : isScheduled ? '⏰ Schedule' : '📤 Send'}
              </button>
            </div>
          </div>

          {/* Sample Payloads Panel */}
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

          {/* Templates Panel */}
          {showTemplates && (
            <div className="templates-panel">
              <div className="templates-header">
                <h4>Saved Templates</h4>
                <button className="templates-close" onClick={() => setShowTemplates(false)}>×</button>
              </div>
              {templates.length === 0 ? (
                <div className="templates-empty">No templates saved yet. Create one using "Save Template" button.</div>
              ) : (
                <div className="templates-list">
                  {templates.map((template) => (
                    <div key={template.id} className="template-item">
                      <div className="template-info">
                        <strong>{template.name}</strong>
                        <span className="template-date">{new Date(template.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="template-actions">
                        <button className="btn-load" onClick={() => loadTemplate(template)}>Load</button>
                        <button className="btn-delete" onClick={() => deleteTemplate(template.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Save Template Panel */}
          {showSaveTemplate && (
            <div className="save-template-panel">
              <div className="save-template-header">
                <h4>Save as Template</h4>
                <button className="save-template-close" onClick={() => setShowSaveTemplate(false)}>×</button>
              </div>
              <div className="save-template-form">
                <input
                  type="text"
                  placeholder="Template name (e.g., Order Created Event)"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && saveTemplate()}
                />
                <button className="btn-save" onClick={saveTemplate}>💾 Save</button>
              </div>
            </div>
          )}

          {/* Advanced Options Panel */}
          {showAdvanced && (
            <div className="advanced-panel">
              <div className="advanced-header">
                <h4>Advanced Options</h4>
                <button className="advanced-close" onClick={() => setShowAdvanced(false)}>×</button>
              </div>
              
              <div className="advanced-section">
                <h5>Batch Sending</h5>
                <div className="batch-control">
                  <label>Number of messages:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={batchCount}
                    onChange={(e) => setBatchCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                  />
                  <span className="batch-hint">(1-100 messages)</span>
                </div>
              </div>

              <div className="advanced-section">
                <h5>Scheduled Delivery</h5>
                <div className="scheduled-control">
                  <label>
                    <input
                      type="checkbox"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                    />
                    Schedule message delivery
                  </label>
                  {isScheduled && (
                    <div className="delay-input">
                      <label>Delay (seconds):</label>
                      <input
                        type="number"
                        min="1"
                        max="3600"
                        value={scheduledDelay}
                        onChange={(e) => setScheduledDelay(Math.max(1, parseInt(e.target.value) || 0))}
                      />
                      <span className="delay-hint">({scheduledDelay}s = {Math.floor(scheduledDelay / 60)}m {scheduledDelay % 60}s)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="advanced-section">
                <h5>Custom Application Properties</h5>
                <button className="btn-toggle-properties" onClick={() => setShowProperties(!showProperties)}>
                  {showProperties ? '▼ Hide Properties' : '▶ Show Properties'}
                </button>
              </div>
            </div>
          )}

          {/* Custom Properties Editor */}
          {showProperties && (
            <div className="properties-editor">
              <div className="properties-header">
                <h4>Application Properties</h4>
                <button className="btn-add-property" onClick={addProperty}>+ Add Property</button>
              </div>
              <div className="properties-list">
                {customProperties.map((prop, index) => (
                  <div key={index} className="property-row">
                    <input
                      type="text"
                      placeholder="Property key"
                      value={prop.key}
                      onChange={(e) => updateProperty(index, 'key', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Property value"
                      value={prop.value}
                      onChange={(e) => updateProperty(index, 'value', e.target.value)}
                    />
                    <button className="btn-remove-property" onClick={() => removeProperty(index)}>×</button>
                  </div>
                ))}
              </div>
              <div className="properties-note">
                Note: Default properties (timestamp, source, correlationId) are always included.
              </div>
            </div>
          )}

          {/* Import Panel */}
          {showImport && (
            <div
              className={`import-panel ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="import-header">
                <h4>📥 Import Messages from JSON</h4>
                <button className="import-close" onClick={() => setShowImport(false)}>×</button>
              </div>
              <div className="import-content">
                <div className="import-dropzone">
                  <div className="import-icon">📁</div>
                  <p className="import-text">Drag and drop a JSON file here</p>
                  <p className="import-subtext">or</p>
                  <label className="import-button">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileSelect}
                      disabled={importing}
                      style={{ display: 'none' }}
                    />
                    {importing ? '⏳ Importing...' : 'Browse Files'}
                  </label>
                </div>
                <div className="import-info">
                  <strong>File Format:</strong>
                  <pre>{`[
  {
    "body": "message content",
    "messageId": "optional-id",
    "correlationId": "optional-correlation",
    "subject": "optional-subject",
    "applicationProperties": {
      "key": "value"
    }
  }
]`}</pre>
                  <ul>
                    <li>Maximum 1000 messages per file</li>
                    <li>Each message must have a "body" field</li>
                    <li>All other fields are optional</li>
                  </ul>
                </div>
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
    </div>
  );
};
