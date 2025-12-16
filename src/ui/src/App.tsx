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
import BottomMessageDock from './components/BottomMessageDock'
import { ToastContainer } from './components/Toast'
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp'
import { IdleWarningBanner } from './components/IdleWarningBanner'
import { AuthErrorBanner } from './components/AuthErrorBanner'
import { SessionExpiredModal } from './components/SessionExpiredModal'
import { ReauthModal } from './components/ReauthModal'
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
  const { status, error, showIdleCritical, idleSeconds, reconnect, clearError, markConnected } = useSessionV2()
  
  // Local state for dismissing warnings only
  const [dismissedIdleWarning, setDismissedIdleWarning] = useState(false)

  const activeNamespace = namespaces.find((ns: Namespace) => ns.sessionId === activeNamespaceId)

  // Handle reconnect from modal or auth banner
  const handleReconnectFromModal = useCallback(async () => {
    if (!activeNamespace) {
      console.warn('[App] No active namespace for reconnect')
      return
    }

    console.log('[App] Reconnect triggered from modal/banner')
    
    try {
      await reconnect(activeNamespace.sessionId, async () => {
        const { apiClient } = await import('./api/client')
        
        // CRITICAL FIX: Re-establish connection with fresh credentials
        // This ensures ApiClient has valid sessionId/token for all subsequent requests
        const credentials = apiClient.getCredentials()
        if (!credentials?.connectionString) {
          throw new Error('No connection string available for reconnect')
        }
        
        console.log('[App] Re-establishing connection with backend')
        const connectResponse = await apiClient.connect(credentials.connectionString)
        
        // Update apiClient with fresh session credentials
        apiClient.setCredentials(connectResponse.sessionId, credentials.connectionString)
        console.log('[App] ✓ Fresh session established:', connectResponse.sessionId)
        
        // Update namespace with new sessionId and also set activeNamespaceId
        handleUpdateNamespace(activeNamespace.sessionId, {
          sessionId: connectResponse.sessionId,
          expiresAtUtc: connectResponse.expiresAtUtc
        })
        setActiveNamespaceId(connectResponse.sessionId)
        
        // Now reload entities with the NEW sessionId
        console.log('[App] Loading entities with fresh session')
        const entities = await apiClient.listEntities(connectResponse.sessionId)
        
        // Update namespace with fresh entities against the NEW sessionId
        handleUpdateNamespace(connectResponse.sessionId, {
          queues: entities.queues,
          topics: entities.topics.map(t => ({ ...t, type: 'Topic' as const, subscriptions: [] }))
        })
        
        console.log('[App] ✓ Metadata reloaded successfully')
      })
      
      // On success, all modals auto-close via session status change
      console.log('[App] Reconnect successful')
      toast.success('Reconnected successfully')
      
    } catch (err) {
      console.error('[App] Reconnect failed:', err)
      toast.error('Reconnect failed. Please try again.')
      // Error already handled in SessionContext - will show auth banner or modal
    }
  }, [activeNamespace, reconnect, handleUpdateNamespace, setActiveNamespaceId, toast])

  // Wire up API client auth error handler to trigger reconnect automatically
  useEffect(() => {
    const setupAuthHandler = async () => {
      const { apiClient } = await import('./api/client')
      apiClient.setAuthErrorHandler(() => {
        console.log('[App] Auth error detected by API client, triggering reconnect')
        if (activeNamespace) {
          setTimeout(() => handleReconnectFromModal(), 100)
        }
      })
    }
    setupAuthHandler()
  }, [activeNamespace, handleReconnectFromModal])

  // Mark connected when we have an active namespace and status is disconnected
  useEffect(() => {
    if (activeNamespace && status === 'disconnected') {
      console.log('[App] Active namespace exists, marking connected')
      markConnected()
    }
  }, [activeNamespace, status, markConnected])

  // Auto-close idle warning when activity resumes
  useEffect(() => {
    if (!showIdleCritical) {
      setDismissedIdleWarning(false)
    }
  }, [showIdleCritical])

  // Handle switch namespace - close current and open connect modal
  const handleSwitchNamespace = useCallback(() => {
    if (activeNamespace) {
      handleCloseNamespace(activeNamespace.sessionId)
    }
    setShowConnectModal(true)
  }, [activeNamespace, handleCloseNamespace])

  return (
    <div className="app">
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      
      {/* Auth error banner - shown when auth fails (status='auth_required') */}
      {status === 'auth_required' && error && error.isAuthError && (
        <AuthErrorBanner
          isVisible={true}
          message={error.message}
          reason={error.reason}
          statusCode={error.statusCode}
          timestamp={error.timestamp}
          onDismiss={() => {
            clearError()
            // Clear error but keep status as auth_required to show fresh auth modal
          }}
          onRetryReconnect={handleReconnectFromModal}
          isReconnecting={false}
        />
      )}
      
      {/* Idle warning banner - shown when user is idle but not expired yet */}
      {showIdleCritical && !dismissedIdleWarning && status === 'connected' && (
        <IdleWarningBanner
          secondsRemaining={Math.max(0, 180 - idleSeconds)}
          onDismiss={() => setDismissedIdleWarning(true)}
        />
      )}

      {/* Session Expired Modal - shown when idle timeout expires */}
      <SessionExpiredModal
        isOpen={showIdleCritical && status !== 'auth_required'}
        onReconnect={handleReconnectFromModal}
        onSwitchNamespace={handleSwitchNamespace}
      />
      
      <ReauthModal
        isOpen={status === 'auth_required' && !!activeNamespace && !showConnectModal}
        onEnterConnectionString={() => {
          if (activeNamespace) {
            handleCloseNamespace(activeNamespace.sessionId);
            setShowConnectModal(true);
          }
        }}
        onCloseNamespace={() => {
          if (activeNamespace) {
            handleCloseNamespace(activeNamespace.sessionId);
            clearError();
          }
        }}
      />
      
      <TopBar
        namespacesCount={namespaces.length}
        currentNamespace={activeNamespace?.friendlyName}
        expiresAtUtc={activeNamespace?.expiresAtUtc}
        onAddNamespace={() => setShowConnectModal(true)}
        onSwitchNamespace={handleSwitchNamespace}
        onReconnect={handleReconnectFromModal}
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

      <BottomMessageDock 
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
  const [reconnecting, setReconnecting] = useState(false)
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
