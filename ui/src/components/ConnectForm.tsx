import React, { useState } from 'react'
import { useSession } from '../context/SessionContext'

export function ConnectForm() {
  const { connect } = useSession()
  const [secretName, setSecretName] = useState('')
  const [raw, setRaw] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await connect({ secretName: secretName || undefined, raw: raw || undefined })
  }

  return (
    <div className="card">
      <h3>Connect</h3>
      <form onSubmit={onSubmit}>
        <label>Key Vault Secret Name</label>
        <input className="input" value={secretName} onChange={e => setSecretName(e.target.value)} placeholder="ServiceBusConnectionString" />
        <div style={{ height: 8 }} />
        <label>Or Raw Connection String (local only)</label>
        <input className="input" value={raw} onChange={e => setRaw(e.target.value)} placeholder="Endpoint=sb://..." />
        <div style={{ height: 8 }} />
        <button className="button primary" type="submit">Connect</button>
      </form>
    </div>
  )
}
