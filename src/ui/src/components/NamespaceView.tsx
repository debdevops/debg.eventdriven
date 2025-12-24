/**
 * Main Namespace View - Two-column layout
 */

import { useState, useCallback, useEffect } from 'react'
import EntityList from './EntityList'
import StreamPanel from '../views/StreamPanelView'
import { apiClient } from '../api/client'
import { useSessionV2 } from '../contexts/SessionContextV2'
import type { Namespace, Entity, Subscription, AuditEntry } from '../types'
import { selectionKey, type SelectedTarget } from '../entities/selection'
import { queueEntityId, topicEntityId } from '../utils/entityIdentity'
import './NamespaceView.css'

interface NamespaceViewProps {
  namespace: Namespace
  onUpdateNamespace: (updates: Partial<Namespace>) => void
  onAudit: (entry: AuditEntry) => void
  onEntitySelect?: (entityName: string) => void
  toast: any
  onAiInsights?: () => void
  aiInsightsLoading?: boolean
  hasAiInsights?: boolean
  aiInsights?: any
}

export function NamespaceView({
  namespace,
  onUpdateNamespace,
  onAudit,
  onEntitySelect,
  toast,
  onAiInsights,
  aiInsightsLoading,
  hasAiInsights,
  aiInsights
}: NamespaceViewProps) {
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(180) // Reduced from 200 for more grid space
  const [isResizing, setIsResizing] = useState(false)
  
  // Use new robust session context
  const { status, canInteract, scheduleTimeout } = useSessionV2()
  
  const [refreshIndicatorVisible, setRefreshIndicatorVisible] = useState(false)

  const handleSelectEntity = (entity: Entity) => {
    // Guard: Prevent navigation if session is not ready
    if (!canInteract) {
      console.log('[NamespaceView] Navigation blocked: session not ready (status=' + status + ')')
      return
    }
    
    setSelectedTarget({ entityType: 'queue', viewType: 'messages', entity })
    onEntitySelect?.(entity.name)
  }

  const handleSelectSubscription = (subscription: Subscription, topicName: string) => {
    // Guard: Prevent navigation if session is not ready
    if (!canInteract) {
      console.log('[NamespaceView] Navigation blocked: session not ready (status=' + status + ')')
      return
    }
    
    setSelectedTarget({ entityType: 'subscription', viewType: 'messages', subscription, topicName })
    onEntitySelect?.(`${topicName}/subscriptions/${subscription.name}`)
  }

  const handleSelectSubscriptionDLQ = (subscription: Subscription, topicName: string) => {
    // Guard: Prevent navigation if session is not ready
    if (!canInteract) {
      console.log('[NamespaceView] Navigation blocked: session not ready (status=' + status + ')')
      return
    }
    setSelectedTarget({ entityType: 'subscription', viewType: 'dlq', subscription, topicName })
    onEntitySelect?.(`${topicName}/subscriptions/${subscription.name}/$DeadLetterQueue`)
  }

  const handleSelectDLQ = (entity: Entity) => {
    // Guard: Prevent navigation if session is not ready
    if (!canInteract) {
      console.log('[NamespaceView] Navigation blocked: session not ready (status=' + status + ')')
      return
    }
    
    setSelectedTarget({ entityType: 'queue', viewType: 'dlq', entity })
    onEntitySelect?.(`${entity.name}/$DeadLetterQueue`)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const newWidth = e.clientX
    if (newWidth >= 160 && newWidth <= 400) { // Reduced min from 200 to 160
      setSidebarWidth(newWidth)
    }
  }, [isResizing])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  const handleRefreshEntities = useCallback(async (triggeredByUser = false) => {
    // Guard: Prevent refresh if session is not ready
    if (!canInteract) {
      console.log('[NamespaceView] Refresh blocked: session not ready (status=' + status + ')')
      return
    }
    
    setRefreshing(true)
    try {
      const entities = await apiClient.listEntities(namespace.sessionId)
      onUpdateNamespace({
        queues: entities.queues.map(q => ({ ...q, entityId: queueEntityId(q.name) })),
        topics: entities.topics.map(t => ({
          ...t,
          entityId: topicEntityId(t.name),
          type: 'Topic' as const,
          subscriptions: []
        }))
      })
      
      if (triggeredByUser) {
        // User clicked refresh button - show toast
        toast.success('Entities refreshed successfully')
      } else {
        // Background auto-refresh - show subtle indicator
        setRefreshIndicatorVisible(true)
        const key = `ns-refresh-indicator-${namespace.sessionId}`
        scheduleTimeout(key, 2000, () => setRefreshIndicatorVisible(false))
      }
    } catch (err) {
      console.error('Failed to refresh entities:', err)
      // Always show errors
      toast.error('Failed to refresh entities')
    } finally {
      setRefreshing(false)
    }
  }, [namespace.sessionId, onUpdateNamespace, toast, status, canInteract, scheduleTimeout])


  return (
    <>
      <div className={`namespace-view ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside 
        className={`left-pane ${sidebarCollapsed ? 'collapsed' : ''}`}
        style={{ width: sidebarCollapsed ? '40px' : `${sidebarWidth}px` }}
      >
        <button 
          className="sidebar-toggle" 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? '▶' : '◀'}
        </button>
        {!sidebarCollapsed && (
          <>
            <EntityList
              queues={namespace.queues}
              topics={namespace.topics}
              selectedTarget={selectedTarget}
              sessionId={namespace.sessionId}
              onSelectEntity={handleSelectEntity}
              onSelectSubscription={handleSelectSubscription}
              onSelectSubscriptionDLQ={handleSelectSubscriptionDLQ}
              onSelectDLQ={handleSelectDLQ}
              onRefresh={handleRefreshEntities}
              refreshing={refreshing}
              refreshIndicatorVisible={refreshIndicatorVisible}
            />
          </>
        )}
        {!sidebarCollapsed && (
          <div 
            className="resize-handle"
            onMouseDown={handleMouseDown}
          />
        )}
      </aside>

      <section className="right-pane">
        {selectedTarget ? (
          <StreamPanel
            // FIX(ux): keyed remount clears grid immediately on view switch.
            key={selectionKey(selectedTarget)}
            sessionId={namespace.sessionId}
            selectedTarget={selectedTarget}
            onAudit={onAudit}
            isSessionExpired={status === 'auth_required'}
            onAiInsights={onAiInsights}
            aiInsightsLoading={aiInsightsLoading}
            hasAiInsights={hasAiInsights}
            aiInsights={aiInsights}
          />
        ) : (
          <div className="empty-selection">
            <h3>No Entity Selected</h3>
            <p>Select a queue or subscription from the left panel to view messages</p>
          </div>
        )}
      </section>
      </div>
    </>
  )
}

