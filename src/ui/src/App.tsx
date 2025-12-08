/**
 * Main Application Component
 * Manages multi-namespace tabs and global state
 */

import { useState, useEffect, useCallback } from 'react'
import { TopBar } from './components/TopBar'
import { NamespaceTabs } from './components/NamespaceTabs'
import { NamespaceView } from './components/NamespaceView'
import { ConnectModal } from './components/ConnectModal'
import { AuditPanel } from './components/AuditPanel'
import { MessageSender } from './components/MessageSender'
import { ToastContainer } from './components/Toast'
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp'
import { IdleWarningBanner } from './components/IdleWarningBanner'
import { AuthErrorBanner } from './components/AuthErrorBanner'
import { SessionExpiredModal } from './components/SessionExpiredModal'
import { useToast } from './hooks/useToast'
import { SessionProviderV2, useSessionV2 } from './contexts/SessionContextV2'
import type { Namespace, AuditEntry } from './types'
import './App.css'

/**
 * AppContent - Inner component that uses SessionContext
 * This must be inside SessionProvider to access useSession hook
 */
function AppContent({
  namespaces,
  activeNamespaceId,
  setActiveNamespaceId,
  showConnectModal,
  setShowConnectModal,
  showShortcuts,
  setShowShortcuts,
  auditLog,
  currentEntityName,
  setCurrentEntityName,
  toast,
  addAuditEntry,
  handleCloseNamespace,
  handleUpdateNamespace,
  handleAddNamespace
}: any) {
  const { status, error, showIdleCritical, idleSeconds, reconnect, clearError } = useSessionV2()
  const [dismissedWarning, setDismissedWarning] = useState(false)
  const [showExpiredModal, setShowExpiredModal] = useState(false)
  const [showAuthError, setShowAuthError] = useState(false)

  const activeNamespace = namespaces.find((ns: Namespace) => ns.sessionId === activeNamespaceId)
  const secondsRemaining = Math.max(0, 180 - idleSeconds) // 3 minutes = 180 seconds

  // Auto-show/hide auth error banner based on session status
  useEffect(() => {
    if (error && error.isAuthError) {
      setShowAuthError(true)
    } else {
      setShowAuthError(false)
    }
  }, [error])

  // Reset dismissed flag when warning state changes
  useEffect(() => {
    if (!showIdleCritical) {
      setDismissedWarning(false)
    } else {
      // When critical idle triggered, show expired modal after 2 seconds
      const timer = setTimeout(() => {
        setShowExpiredModal(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [showIdleCritical])

  // Handle reconnect from modal or auth banner
  const handleReconnectFromModal = useCallback(async () => {
    if (activeNamespace) {
      // If it's an auth error, require fresh authentication
      const isAuthError = error?.isAuthError ?? false
      
      if (isAuthError) {
        // For auth errors, force user to enter credentials again
        console.log('[App] Auth error detected - prompting for fresh credentials')
        setShowAuthError(false)
        setShowExpiredModal(false)
        setShowConnectModal(true)  // Open connect modal for fresh auth
        // Close the old namespace since credentials are invalid
        handleCloseNamespace(activeNamespace.sessionId)
        return
      }
      
      // For network errors, try to reconnect with existing credentials
      try {
        await reconnect(activeNamespace.sessionId, async () => {
          // Reload entities
          const { apiClient } = await import('./api/client')
          const entities = await apiClient.listEntities(activeNamespace.sessionId)
          // Update will happen via handleUpdateNamespace
          handleUpdateNamespace(activeNamespace.sessionId, {
            queues: entities.queues,
            topics: entities.topics.map(t => ({ ...t, type: 'Topic' as const, subscriptions: [] }))
          })
        })
        setShowExpiredModal(false)
        setShowAuthError(false)
      } catch (err) {
        console.error('Reconnect failed:', err)
        // Error will be shown in auth banner
      }
    }
  }, [activeNamespace, error, reconnect, handleUpdateNamespace, handleCloseNamespace])

  return (
    <div className="app">
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      
      {/* Auth error banner - shown when 401 or auth failures occur */}
      {error && error.isAuthError && showAuthError && (
        <AuthErrorBanner
          isVisible={showAuthError}
          message={error.message}
          reason={error.reason}
          statusCode={error.statusCode}
          timestamp={error.timestamp}
          onDismiss={() => {
            setShowAuthError(false)
            clearError()
          }}
          onRetryReconnect={handleReconnectFromModal}
          isReconnecting={status === 'connecting'}
        />
      )}
      
      {/* Modal shown when credentials are invalid - requires fresh auth */}
      {status === 'auth_required' && activeNamespace && !showConnectModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center' }}>
            <h2>🔐 Re-Authentication Required</h2>
            <p>Your session credentials are no longer valid. Please provide a fresh connection string.</p>
            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn-primary" onClick={() => {
                setShowConnectModal(true)
              }}>
                Enter Connection String
              </button>
              <button className="btn-secondary" onClick={() => handleCloseNamespace(activeNamespace.sessionId)}>
                Close Namespace
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showIdleCritical && !dismissedWarning && (
        <IdleWarningBanner
          secondsRemaining={secondsRemaining}
          onDismiss={() => setDismissedWarning(true)}
        />
      )}

      <SessionExpiredModal
        isOpen={showExpiredModal}
        onReconnect={handleReconnectFromModal}
        onSwitchNamespace={() => {
          setShowExpiredModal(false)
          setShowConnectModal(true)
        }}
      />
      
      <TopBar
        namespacesCount={namespaces.length}
        currentNamespace={activeNamespace?.friendlyName}
        onAddNamespace={() => setShowConnectModal(true)}
        onSwitchNamespace={() => setShowConnectModal(true)}
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
            onUpdateNamespace={(updates: any) =>
              handleUpdateNamespace(activeNamespace.sessionId, updates)
            }
            onAudit={addAuditEntry}
            onEntitySelect={setCurrentEntityName}
            toast={toast}
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
        currentEntity={currentEntityName || undefined}
      />

      {showConnectModal && (
        <ConnectModal
          onConnect={handleAddNamespace}
          onClose={() => setShowConnectModal(false)}
        />
      )}

      <KeyboardShortcutsHelp
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  )
}

function App() {
  const [namespaces, setNamespaces] = useState<Namespace[]>([])
  const [activeNamespaceId, setActiveNamespaceId] = useState<string | null>(null)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [currentEntityName, setCurrentEntityName] = useState<string | null>(null)
  const toast = useToast()

  // Global keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        setShowShortcuts(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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
    
    toast.success(`Connected to ${namespace.friendlyName || 'namespace'}`)
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
    <SessionProviderV2 toast={toast}>
      <AppContent
        namespaces={namespaces}
        activeNamespaceId={activeNamespaceId}
        setActiveNamespaceId={setActiveNamespaceId}
        showConnectModal={showConnectModal}
        setShowConnectModal={setShowConnectModal}
        showShortcuts={showShortcuts}
        setShowShortcuts={setShowShortcuts}
        auditLog={auditLog}
        currentEntityName={currentEntityName}
        setCurrentEntityName={setCurrentEntityName}
        toast={toast}
        addAuditEntry={addAuditEntry}
        handleCloseNamespace={handleCloseNamespace}
        handleUpdateNamespace={handleUpdateNamespace}
        handleAddNamespace={handleAddNamespace}
      />
    </SessionProviderV2>
  )
}

export default App
