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
import MultiFab from './components/MultiFab'
import GenerateMessagesModal from './components/GenerateMessagesModal'
import { ToastContainer } from './components/Toast'
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp'
import { IdleWarningBanner } from './components/IdleWarningBanner'
import { AuthErrorBanner } from './components/AuthErrorBanner'
import { SessionExpiredModal } from './components/SessionExpiredModal'
import { ReauthModal } from './components/ReauthModal'
import { useToast } from './hooks/useToast'
import { SessionProviderV2, useSession } from './contexts/SessionContextV2'
import { apiClient } from './api/client'
import { apiLogger } from './utils/logger'
import type { Namespace, AuditEntry, ToastApi, AiInsightsResult, Entity } from './types'
import type { ToastType } from './components/Toast'
import './App.css'

/**
 * Props for AppContent component
 */
interface AppContentProps {
  namespaces: Namespace[]
  activeNamespaceId: string | null
  setActiveNamespaceId: (id: string) => void
  showConnectModal: boolean
  setShowConnectModal: (show: boolean) => void
  showShortcuts: boolean
  setShowShortcuts: (show: boolean) => void
  auditLog: AuditEntry[]
  currentEntityName: string | null
  setCurrentEntityName: (name: string | null) => void
  toast: ToastApi & { toasts: Array<{ id: string; message: string; type: ToastType }>; removeToast: (id: string) => void }
  addAuditEntry: (entry: AuditEntry) => void
  handleCloseNamespace: (sessionId: string) => void
  handleUpdateNamespace: (sessionId: string, updates: Partial<Namespace>) => void
  handleAddNamespace: (namespace: Namespace) => void
}

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
}: AppContentProps) {
  const {
    sessionState,
    status,
    canInteract,
    error,
    idleSeconds,
    reconnect,
    markIdle,
    setLastSelection
  } = useSession()

  type AppMode = 'idle' | 'connected' | 'expired'
  const appMode: AppMode = namespaces.length === 0
    ? 'idle'
    : sessionState === 'expired'
      ? 'expired'
      : 'connected'
  
  // Local state for dismissing warnings only
  const [dismissedIdleWarning, setDismissedIdleWarning] = useState(false)
  
  // AI Insights state
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showMessageDrawer, setShowMessageDrawer] = useState(false)
  const [aiInsights, setAiInsights] = useState<AiInsightsResult | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiCacheTime, setAiCacheTime] = useState<number>(0)

  const activeNamespace = namespaces.find((ns: Namespace) => ns.sessionId === activeNamespaceId)

  // Handle reconnect from modal or auth banner
  const handleReconnectFromModal = useCallback(async () => {
    if (!activeNamespace) {
      apiLogger.warn('No active namespace for reconnect')
      return
    }

    apiLogger.info('Reconnect triggered from modal/banner')
    
    try {
      await reconnect(async ({ sessionId, expiresAtUtc, entities, lastSelection }) => {
        // Update namespace with fresh session + entities.
        handleUpdateNamespace(activeNamespace.sessionId, {
          sessionId,
          expiresAtUtc,
          queues: entities.queues,
          topics: entities.topics.map((t: Entity) => ({ ...t, type: 'Topic' as const, subscriptions: [] }))
        })
        setActiveNamespaceId(sessionId)

        // Restore selection if it still exists.
        const entityNames = new Set<string>([
          ...entities.queues.map((q: Entity) => q.name),
          ...entities.topics.map((t: Entity) => t.name)
        ])
        if (lastSelection && entityNames.has(lastSelection)) {
          setCurrentEntityName(lastSelection)
        } else {
          setCurrentEntityName(null)
        }
      })
    } catch (err) {
      console.error('[App] Reconnect failed:', err)
      // SessionController will transition to expired/failed.
    }
  }, [activeNamespace, reconnect, handleUpdateNamespace, setActiveNamespaceId, setCurrentEntityName])

  // Auto-close idle warning when activity resumes
  useEffect(() => {
    if (sessionState !== 'idle-warning') {
      setDismissedIdleWarning(false)
    }
  }, [sessionState])

  // Track last selection for deterministic reconnect restore.
  useEffect(() => {
    setLastSelection(currentEntityName)
  }, [currentEntityName, setLastSelection])

  // If no namespace is connected, the app is in IDLE. No session timers should exist.
  useEffect(() => {
    if (namespaces.length === 0) {
      markIdle()
    }
  }, [namespaces.length, markIdle])

  // Handle switch namespace - close current and open connect modal
  const handleSwitchNamespace = useCallback(() => {
    if (activeNamespace) {
      handleCloseNamespace(activeNamespace.sessionId)
    }
    setShowConnectModal(true)
  }, [activeNamespace, handleCloseNamespace])

  const handleRunAiAnalysis = useCallback(async () => {
    if (!activeNamespace || !currentEntityName) {
      toast.warning('Please select a queue first')
      return
    }

    // Check cache (5 minute expiry)
    const now = Date.now()
    if (aiInsights && (now - aiCacheTime) < 5 * 60 * 1000) {
      toast.info('Using cached AI analysis (less than 5 minutes old)')
      return
    }

    setAiLoading(true)
    try {
      const result = await apiClient.analyzeMessages(
        activeNamespace.sessionId,
        currentEntityName,
        100, // Sample size
        true  // Include DLQ
      )

      setAiInsights(result)
      setAiCacheTime(now)
      
      const totalOutliers = 
        (result.activeQueueAnalysis?.outliers.length || 0) + 
        (result.dlqAnalysis?.outliers.length || 0)
      
      if (totalOutliers > 0) {
        toast.warning(`AI detected ${totalOutliers} anomalies`)
      } else {
        toast.success('AI analysis complete - no anomalies detected')
      }

      addAuditEntry({
        timestamp: new Date().toISOString(),
        sessionId: activeNamespace.sessionId,
        entityName: currentEntityName,
        operation: 'AI Analysis'
      })
    } catch (err) {
      apiLogger.error('AI analysis failed', err)
      toast.error(err instanceof Error ? err.message : 'AI analysis failed')
    } finally {
      setAiLoading(false)
    }
  }, [activeNamespace, currentEntityName, aiInsights, aiCacheTime, toast, addAuditEntry])

  /**
   * Local result type for UI-generated messages (matches GenerateMessagesModal)
   */
  interface LocalGenerateResult {
    totalGenerated: number
    anomalousCount: number
    dlqCandidates: number
    dlqDeadLettered: number
    dlqDeadLetteredQueue: number
    dlqDeadLetteredSubscriptions: number
    dlqTopicName?: string
    dlqSubscriptionName?: string
  }

  // Handle successful message generation
  const handleGenerateSuccess = useCallback((result: LocalGenerateResult) => {
    const subLabel = result.dlqTopicName && result.dlqSubscriptionName
      ? `${result.dlqTopicName}/${result.dlqSubscriptionName}`
      : 'subs'

    const dlqPart = result.dlqCandidates > 0
      ? `, DLQ dead-lettered ${result.dlqDeadLettered}/${result.dlqCandidates} (queue ${result.dlqDeadLetteredQueue}, ${subLabel} ${result.dlqDeadLetteredSubscriptions})`
      : ''

    toast.success(
      `Generated ${result.totalGenerated} messages (${result.anomalousCount} anomalies${dlqPart})`
    )

    if (result.dlqCandidates > 0 && result.dlqDeadLettered < result.dlqCandidates) {
      toast.warning('Some DLQ candidates were not dead-lettered (check queue activity and retry).')
    }
    
    // Trigger auto-refresh of entities to update message counts
    // The NamespaceView will handle this
    
  }, [toast])

  // Clear AI insights when entity changes
  useEffect(() => {
    setAiInsights(null)
    setAiCacheTime(0)
  }, [currentEntityName])

  return (
    <div className={`app ${appMode === 'expired' ? 'has-auth-error' : ''}`}>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      
      {/* Auth error banner - shown ONLY when sessionState === 'expired' */}
      {sessionState === 'expired' && error?.isAuthError && (
        <AuthErrorBanner
          isVisible={true}
          reason={error.reason}
          statusCode={error.statusCode}
          timestamp={error.timestamp}
          onReAddNamespace={() => {
            if (activeNamespace) {
              handleCloseNamespace(activeNamespace.sessionId)
            }
            setShowConnectModal(true)
          }}
        />
      )}
      
      {/* Main application - disabled during expired state */}
      <div className={`app-main ${appMode === 'expired' ? 'disabled' : ''}`}>
      {/* Idle warning banner - shown when user is idle but not expired yet */}
      {sessionState === 'idle-warning' && !dismissedIdleWarning && status === 'connected' && (
        <IdleWarningBanner
          secondsRemaining={Math.max(0, 150 - idleSeconds)}
          onDismiss={() => setDismissedIdleWarning(true)}
        />
      )}

      {/* Session Expired Modal - shown when idle timeout expires */}
      <SessionExpiredModal
        isOpen={appMode === 'expired' && error?.reason === 'idle'}
        onReconnect={handleReconnectFromModal}
        onSwitchNamespace={handleSwitchNamespace}
      />
      
      {/* 401 flow uses a single persistent banner; connect modal opens via CTA */}
      <ReauthModal
        isOpen={false}
        onEnterConnectionString={() => {}}
        onCloseNamespace={() => {}}
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
            onUpdateNamespace={(updates: Partial<Namespace>) =>
              handleUpdateNamespace(activeNamespace.sessionId, updates)
            }
            onAudit={addAuditEntry}
            onEntitySelect={setCurrentEntityName}
            toast={toast}
            onAiInsights={handleRunAiAnalysis}
            aiInsightsLoading={aiLoading}
            hasAiInsights={!!aiInsights}
            aiInsights={aiInsights}
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

      {/* Multi-Action FAB - always visible when namespace is active */}
      {activeNamespace && (
        <>
          <MultiFab
            onSendMessage={() => setShowMessageDrawer(true)}
            onGenerateMessages={() => setShowGenerateModal(true)}
            disabled={!canInteract}
          />
          
          {/* Message Drawer - opened by FAB */}
          <BottomMessageDock 
            sessionId={activeNamespace.sessionId}
            entities={[...activeNamespace.queues, ...activeNamespace.topics]}
            currentEntity={currentEntityName || undefined}
            isOpen={showMessageDrawer}
            onClose={() => setShowMessageDrawer(false)}
          />
          
          {/* Generate Messages Modal */}
          <GenerateMessagesModal
            isOpen={showGenerateModal}
            onClose={() => setShowGenerateModal(false)}
            sessionId={activeNamespace.sessionId}
            entities={[...activeNamespace.queues, ...activeNamespace.topics]}
            currentEntity={currentEntityName || undefined}
            onSuccess={handleGenerateSuccess}
          />
        </>
      )}

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
      </div> {/* Close app-main */}
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
