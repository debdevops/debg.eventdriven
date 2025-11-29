/**
 * Main Application Component
 * Manages multi-namespace tabs and global state
 */

import { useState } from 'react'
import { TopBar } from './components/TopBar'
import { NamespaceTabs } from './components/NamespaceTabs'
import { NamespaceView } from './components/NamespaceView'
import { ConnectModal } from './components/ConnectModal'
import { AuditPanel } from './components/AuditPanel'
import { MessageSender } from './components/MessageSender'
import type { Namespace, AuditEntry } from './types'
import './App.css'

function App() {
  const [namespaces, setNamespaces] = useState<Namespace[]>([])
  const [activeNamespaceId, setActiveNamespaceId] = useState<string | null>(null)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])

  const activeNamespace = namespaces.find(ns => ns.sessionId === activeNamespaceId)

  const handleAddNamespace = (namespace: Namespace) => {
    setNamespaces(prev => [...prev, namespace])
    setActiveNamespaceId(namespace.sessionId)
    
    // Add audit entry
    addAuditEntry({
      timestamp: new Date().toISOString(),
      sessionId: namespace.sessionId,
      entityName: '-',
      operation: 'Connect'
    })
  }

  const handleCloseNamespace = (sessionId: string) => {
    setNamespaces(prev => prev.filter(ns => ns.sessionId !== sessionId))
    if (activeNamespaceId === sessionId) {
      setActiveNamespaceId(namespaces[0]?.sessionId || null)
    }
  }

  const handleUpdateNamespace = (sessionId: string, updates: Partial<Namespace>) => {
    setNamespaces(prev =>
      prev.map(ns => (ns.sessionId === sessionId ? { ...ns, ...updates } : ns))
    )
  }

  const addAuditEntry = (entry: AuditEntry) => {
    setAuditLog(prev => [entry, ...prev].slice(0, 50)) // Keep last 50 entries
  }

  return (
    <div className="app">
      <TopBar
        namespacesCount={namespaces.length}
        onAddNamespace={() => setShowConnectModal(true)}
      />

      {namespaces.length > 0 && (
        <NamespaceTabs
          namespaces={namespaces}
          activeNamespaceId={activeNamespaceId}
          onSelectNamespace={setActiveNamespaceId}
          onCloseNamespace={handleCloseNamespace}
        />
      )}

      <main className="main-content">
        {activeNamespace ? (
          <NamespaceView
            namespace={activeNamespace}
            onUpdateNamespace={(updates) =>
              handleUpdateNamespace(activeNamespace.sessionId, updates)
            }
            onAudit={addAuditEntry}
          />
        ) : (
          <div className="empty-state">
            <h2>No Namespace Connected</h2>
            <p>Click "Add Namespace" to connect to a Service Bus namespace using Key Vault</p>
            <button onClick={() => setShowConnectModal(true)} className="btn-primary">
              Add Namespace
            </button>
          </div>
        )}
      </main>

      <AuditPanel entries={auditLog} />

      <MessageSender 
        sessionId={activeNamespace?.sessionId || null}
        entities={activeNamespace ? [...activeNamespace.queues, ...activeNamespace.topics] : []}
      />

      {showConnectModal && (
        <ConnectModal
          onConnect={handleAddNamespace}
          onClose={() => setShowConnectModal(false)}
        />
      )}
    </div>
  )
}

export default App
