import { useState } from 'react'
import { connectToNamespace } from '../utils/api'

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
      <p style={{ color: '#888', marginBottom: '1.5rem' }}>
        Enter your Service Bus connection string. It will be stored in memory only
        and automatically expire after 10 minutes.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="connectionString" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Service Bus Connection String:
          </label>
          <input
            id="connectionString"
            type="password"
            value={connectionString}
            onChange={(e) => setConnectionString(e.target.value)}
            placeholder="Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=..."
            style={{ width: '100%', maxWidth: '500px' }}
            disabled={loading}
          />
        </div>

        {error && (
          <div className="error">
            <strong>Error:</strong> {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={{ backgroundColor: '#228be6' }}>
          {loading ? 'Connecting...' : 'Connect'}
        </button>
      </form>

      <div className="info" style={{ marginTop: '1.5rem' }}>
        <strong>Security Note:</strong> Your connection string is stored in memory only and never
        persisted to disk or logs. Sessions automatically expire after 10 minutes.
      </div>
    </div>
  )
}

export default ConnectForm
