/**
 * Connect Modal for adding new namespace
 */

import { useState } from 'react'
import { apiClient } from '../api/client'
import type { Namespace } from '../types'
import './ConnectModal.css'

interface ConnectModalProps {
  onConnect: (namespace: Namespace) => void
  onClose: () => void
}

export function ConnectModal({ onConnect, onClose }: ConnectModalProps) {
  const [connectionString, setConnectionString] = useState('')
  const [friendlyName, setFriendlyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!connectionString.trim()) {
      setError('Connection string is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.connect(connectionString.trim())
      const entities = await apiClient.listEntities(response.sessionId)

      const namespace: Namespace = {
        ...response,
        friendlyName: friendlyName.trim() || undefined,
        queues: entities.queues,
        topics: entities.topics.map(t => ({ ...t, type: 'Topic' as const, subscriptions: [] }))
      }

      onConnect(namespace)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Namespace</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="connectionString">
              Service Bus Connection String <span className="required">*</span>
            </label>
            <input
              id="connectionString"
              type="text"
              className="connection-string-input"
              value={connectionString}
              onChange={(e) => setConnectionString(e.target.value)}
              placeholder="Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=..."
              disabled={loading}
              autoFocus
            />
            <small className="form-help">
              Your Service Bus connection string. It will be stored in memory only (never persisted).
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="friendlyName">Friendly Name (optional)</label>
            <input
              id="friendlyName"
              type="text"
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="e.g., Production, Development"
              disabled={loading}
            />
            <small className="form-help">
              A display name for this namespace (optional)
            </small>
          </div>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
              {error.toLowerCase().includes('expired') && (
                <div style={{ marginTop: '8px' }}>
                  <small>Session has expired. Click "Connect" below to restart.</small>
                </div>
              )}
            </div>
          )}

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-outline" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Connecting...' : (error && error.toLowerCase().includes('expired') ? '🔄 Restart Session' : 'Connect')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
