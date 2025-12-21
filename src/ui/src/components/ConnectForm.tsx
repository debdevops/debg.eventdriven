import { useState } from 'react'
import { connectToNamespace } from '../utils/api'
import './ConnectForm.css'

interface ConnectFormProps {
  onConnect: (session: { sessionId: string; expiresAtUtc: string }) => void
}

function ConnectForm({ onConnect }: ConnectFormProps) {
  const [connectionString, setConnectionString] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!connectionString.trim()) {
      setError('Please enter a Service Bus connection string')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const session = await connectToNamespace(connectionString)
      onConnect(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>Connect to Service Bus</h2>
      <p className="connect-form-description">
        Enter your Service Bus connection string. It will be stored in memory only
        and automatically expire after 10 minutes.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="connect-form-field">
          <label htmlFor="connectionString" className="connect-form-label">
            Service Bus Connection String:
          </label>
          <input
            id="connectionString"
            type="password"
            value={connectionString}
            onChange={(e) => setConnectionString(e.target.value)}
            placeholder="Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=..."
            className="connect-form-input"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="error">
            <strong>Error:</strong> {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="connect-form-submit">
          {loading ? 'Connecting...' : 'Connect'}
        </button>
      </form>

      <div className="info connect-form-info">
        <strong>Security Note:</strong> Your connection string is stored in memory only and never
        persisted to disk or logs. Sessions automatically expire after 10 minutes.
      </div>
    </div>
  )
}

export default ConnectForm
