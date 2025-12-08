import { useState, useEffect } from 'react';
import './RulesPanel.css';
import { API_BASE_URL } from '../config/api';

interface RulesPanelProps {
  sessionId: string;
  topicName: string;
  subscriptionName: string;
  onClose: () => void;
}

interface Rule {
  name: string;
  filter: {
    type: string;
    sqlExpression?: string;
    parameters?: Record<string, any>;
    correlationId?: string;
    messageId?: string;
    to?: string;
    replyTo?: string;
    subject?: string;
    sessionId?: string;
    replyToSessionId?: string;
    contentType?: string;
    properties?: Record<string, any>;
  };
  action?: {
    type: string;
    sqlExpression?: string;
    parameters?: Record<string, any>;
  } | null;
}

export default function RulesPanel({ sessionId, topicName, subscriptionName, onClose }: RulesPanelProps) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [ruleName, setRuleName] = useState('');
  const [filterType, setFilterType] = useState<'Sql' | 'Correlation' | 'True'>('Sql');
  const [sqlExpression, setSqlExpression] = useState('');
  const [correlationId, setCorrelationId] = useState('');
  const [messageId, setMessageId] = useState('');
  const [subject, setSubject] = useState('');
  const [customProperties, setCustomProperties] = useState<Array<{ key: string; value: string }>>([]);

  useEffect(() => {
    loadRules();
  }, [sessionId, topicName, subscriptionName]);

  const loadRules = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/subscription/${sessionId}/${topicName}/${subscriptionName}/rules`
      );

      if (!response.ok) {
        throw new Error(`Failed to load rules: ${response.statusText}`);
      }

      const data = await response.json();
      setRules(data.rules || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    if (!ruleName.trim()) {
      setError('Rule name is required');
      return;
    }

    if (filterType === 'Sql' && !sqlExpression.trim()) {
      setError('SQL expression is required for SQL filter');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const requestBody: any = {
        ruleName: ruleName.trim(),
        filterType
      };

      if (filterType === 'Sql') {
        requestBody.sqlExpression = sqlExpression.trim();
      } else if (filterType === 'Correlation') {
        if (correlationId.trim()) requestBody.correlationId = correlationId.trim();
        if (messageId.trim()) requestBody.messageId = messageId.trim();
        if (subject.trim()) requestBody.subject = subject.trim();
        
        const props = customProperties
          .filter(p => p.key.trim() && p.value.trim())
          .reduce((acc, p) => {
            acc[p.key] = p.value;
            return acc;
          }, {} as Record<string, string>);
        
        if (Object.keys(props).length > 0) {
          requestBody.properties = props;
        }
      }

      const response = await fetch(
        `${API_BASE_URL}/api/subscription/${sessionId}/${topicName}/${subscriptionName}/rules`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to create rule');
      }

      // Reset form
      setRuleName('');
      setSqlExpression('');
      setCorrelationId('');
      setMessageId('');
      setSubject('');
      setCustomProperties([]);
      setShowCreateForm(false);

      // Reload rules
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRule = async (name: string) => {
    if (!confirm(`Are you sure you want to delete rule "${name}"?`)) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/subscription/${sessionId}/${topicName}/${subscriptionName}/rules/${encodeURIComponent(name)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to delete rule');
      }

      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  const addCustomProperty = () => {
    setCustomProperties([...customProperties, { key: '', value: '' }]);
  };

  const updateCustomProperty = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customProperties];
    updated[index][field] = value;
    setCustomProperties(updated);
  };

  const removeCustomProperty = (index: number) => {
    setCustomProperties(customProperties.filter((_, i) => i !== index));
  };

  const renderFilter = (rule: Rule) => {
    const { filter } = rule;

    if (filter.type === 'SqlFilter') {
      return (
        <div className="filter-content">
          <div className="filter-label">SQL Filter:</div>
          <div className="filter-sql">{filter.sqlExpression}</div>
          {filter.parameters && Object.keys(filter.parameters).length > 0 && (
            <div className="filter-params">
              <strong>Parameters:</strong>
              {Object.entries(filter.parameters).map(([key, value]) => (
                <div key={key} className="param-item">
                  {key} = {JSON.stringify(value)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (filter.type === 'CorrelationFilter') {
      const fields = [];
      if (filter.correlationId) fields.push(['Correlation ID', filter.correlationId]);
      if (filter.messageId) fields.push(['Message ID', filter.messageId]);
      if (filter.subject) fields.push(['Subject', filter.subject]);
      if (filter.to) fields.push(['To', filter.to]);
      if (filter.replyTo) fields.push(['Reply To', filter.replyTo]);
      if (filter.sessionId) fields.push(['Session ID', filter.sessionId]);
      if (filter.contentType) fields.push(['Content Type', filter.contentType]);

      return (
        <div className="filter-content">
          <div className="filter-label">Correlation Filter:</div>
          {fields.length > 0 ? (
            <div className="filter-fields">
              {fields.map(([label, value]) => (
                <div key={label} className="filter-field">
                  <strong>{label}:</strong> {value}
                </div>
              ))}
            </div>
          ) : (
            <div className="filter-empty">No correlation fields set</div>
          )}
          {filter.properties && Object.keys(filter.properties).length > 0 && (
            <div className="filter-properties">
              <strong>Custom Properties:</strong>
              {Object.entries(filter.properties).map(([key, value]) => (
                <div key={key} className="property-item">
                  {key} = {JSON.stringify(value)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="filter-content">
        <div className="filter-label">True Filter (matches all messages)</div>
      </div>
    );
  };

  return (
    <div className="rules-panel-overlay" onClick={onClose}>
      <div className="rules-panel" onClick={(e) => e.stopPropagation()}>
        <div className="rules-panel-header">
          <h2>Subscription Rules</h2>
          <div className="rules-panel-subtitle">
            {topicName} / {subscriptionName}
          </div>
          <button className="rules-panel-close" onClick={onClose}>×</button>
        </div>

        <div className="rules-panel-content">
          {error && (
            <div className="rules-error">
              {error}
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}

          <div className="rules-panel-actions">
            <button
              className="btn-create-rule"
              onClick={() => setShowCreateForm(!showCreateForm)}
              disabled={loading}
            >
              {showCreateForm ? '− Cancel' : '+ Create Rule'}
            </button>
            <button className="btn-refresh" onClick={loadRules} disabled={loading}>
              🔄 Refresh
            </button>
          </div>

          {showCreateForm && (
            <div className="create-rule-form">
              <h3>Create New Rule</h3>

              <div className="form-group">
                <label>Rule Name:</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g., HighPriorityOrders"
                  disabled={creating}
                />
              </div>

              <div className="form-group">
                <label>Filter Type:</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  disabled={creating}
                >
                  <option value="Sql">SQL Filter</option>
                  <option value="Correlation">Correlation Filter</option>
                  <option value="True">True Filter (matches all)</option>
                </select>
              </div>

              {filterType === 'Sql' && (
                <div className="form-group">
                  <label>SQL Expression:</label>
                  <textarea
                    value={sqlExpression}
                    onChange={(e) => setSqlExpression(e.target.value)}
                    placeholder="e.g., Priority = 'High' OR Amount > 1000"
                    rows={3}
                    disabled={creating}
                  />
                  <div className="form-hint">
                    Example: <code>user.Priority = 'High' AND user.Amount &gt; 1000</code>
                  </div>
                </div>
              )}

              {filterType === 'Correlation' && (
                <>
                  <div className="form-group">
                    <label>Correlation ID:</label>
                    <input
                      type="text"
                      value={correlationId}
                      onChange={(e) => setCorrelationId(e.target.value)}
                      placeholder="Optional correlation ID"
                      disabled={creating}
                    />
                  </div>

                  <div className="form-group">
                    <label>Message ID:</label>
                    <input
                      type="text"
                      value={messageId}
                      onChange={(e) => setMessageId(e.target.value)}
                      placeholder="Optional message ID"
                      disabled={creating}
                    />
                  </div>

                  <div className="form-group">
                    <label>Subject:</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Optional subject"
                      disabled={creating}
                    />
                  </div>

                  <div className="form-group">
                    <label>Custom Properties:</label>
                    <button
                      className="btn-add-property"
                      onClick={addCustomProperty}
                      disabled={creating}
                      type="button"
                    >
                      + Add Property
                    </button>
                    {customProperties.map((prop, index) => (
                      <div key={index} className="property-row">
                        <input
                          type="text"
                          value={prop.key}
                          onChange={(e) => updateCustomProperty(index, 'key', e.target.value)}
                          placeholder="Key"
                          disabled={creating}
                        />
                        <input
                          type="text"
                          value={prop.value}
                          onChange={(e) => updateCustomProperty(index, 'value', e.target.value)}
                          placeholder="Value"
                          disabled={creating}
                        />
                        <button
                          onClick={() => removeCustomProperty(index)}
                          disabled={creating}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="form-actions">
                <button
                  className="btn-submit"
                  onClick={handleCreateRule}
                  disabled={creating || !ruleName.trim()}
                >
                  {creating ? 'Creating...' : 'Create Rule'}
                </button>
                <button
                  className="btn-cancel"
                  onClick={() => setShowCreateForm(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="rules-list">
            {loading ? (
              <div className="rules-loading">Loading rules...</div>
            ) : rules.length === 0 ? (
              <div className="rules-empty">
                No rules found. Create one to filter messages for this subscription.
              </div>
            ) : (
              rules.map((rule) => (
                <div key={rule.name} className="rule-item">
                  <div className="rule-header">
                    <div className="rule-name">{rule.name}</div>
                    <div className="rule-type-badge">{rule.filter.type}</div>
                    {rule.name !== '$Default' && (
                      <button
                        className="btn-delete-rule"
                        onClick={() => handleDeleteRule(rule.name)}
                        title="Delete rule"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                  {renderFilter(rule)}
                  {rule.action && (
                    <div className="rule-action">
                      <strong>Action:</strong> {rule.action.sqlExpression}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
