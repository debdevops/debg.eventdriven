/**
 * Main Namespace View - Two-column layout
 */

import { useState, useCallback, useEffect } from 'react'
import EntityList from './EntityList'
import StreamPanel from './StreamPanel'
import { apiClient } from '../api/client'
import { useSessionV2 } from '../contexts/SessionContextV2'
import type { Namespace, Entity, Subscription, AuditEntry } from '../types'
import './NamespaceView.css'

interface NamespaceViewProps {
  namespace: Namespace
  onUpdateNamespace: (updates: Partial<Namespace>) => void
  onAudit: (entry: AuditEntry) => void
  onEntitySelect?: (entityName: string) => void
  toast: any
}

interface SelectedTarget {
  type: 'queue' | 'subscription' | 'dlq'
  entity: Entity | null
  subscription?: Subscription
  topicName?: string
  isDLQ?: boolean
}

export function NamespaceView({
  namespace,
  onUpdateNamespace,
  onAudit,
  onEntitySelect,
  toast
}: NamespaceViewProps) {
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(200) // Compact sidebar default
  const [isResizing, setIsResizing] = useState(false)
  
  // Use new robust session context
  const { status } = useSessionV2()
  
  const [refreshIndicatorVisible, setRefreshIndicatorVisible] = useState(false)

  const handleSelectEntity = (entity: Entity) => {
    // Guard: Prevent navigation if session is not ready
    if (status === 'connecting' || status === 'auth_required') {
      console.log('[NamespaceView] Navigation blocked: session not ready (status=' + status + ')')
      toast?.warning('Please wait for reconnection to complete')
      return
    }
    
    setSelectedTarget({
      type: 'queue',
      entity,
      isDLQ: false
    })
    onEntitySelect?.(entity.name)
  }

  const handleSelectSubscription = (subscription: Subscription, topicName: string) => {
    // Guard: Prevent navigation if session is not ready
    if (status === 'connecting' || status === 'auth_required') {
      console.log('[NamespaceView] Navigation blocked: session not ready (status=' + status + ')')
      toast?.warning('Please wait for reconnection to complete')
      return
    }
    
    setSelectedTarget({
      type: 'subscription',
      entity: null,
      subscription,
      topicName,
      isDLQ: false
    })
    onEntitySelect?.(`${topicName}/subscriptions/${subscription.name}`)
  }

  const handleSelectDLQ = (entity: Entity) => {
    // Guard: Prevent navigation if session is not ready
    if (status === 'connecting' || status === 'auth_required') {
      console.log('[NamespaceView] Navigation blocked: session not ready (status=' + status + ')')
      toast?.warning('Please wait for reconnection to complete')
      return
    }
    
    setSelectedTarget({
      type: 'dlq',
      entity,
      isDLQ: true
    })
    onEntitySelect?.(`${entity.name}/$DeadLetterQueue`)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const newWidth = e.clientX
    if (newWidth >= 200 && newWidth <= 600) {
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
    if (status === 'connecting' || status === 'auth_required') {
      console.log('[NamespaceView] Refresh blocked: session not ready (status=' + status + ')')
      if (triggeredByUser) {
        toast.warning('Please wait for reconnection to complete')
      }
      return
    }
    
    setRefreshing(true)
    try {
      const entities = await apiClient.listEntities(namespace.sessionId)
      onUpdateNamespace({
        queues: entities.queues,
        topics: entities.topics.map(t => ({ ...t, type: 'Topic' as const, subscriptions: [] }))
      })
      
      if (triggeredByUser) {
        // User clicked refresh button - show toast
        toast.success('Entities refreshed successfully')
      } else {
        // Background auto-refresh - show subtle indicator
        setRefreshIndicatorVisible(true)
        setTimeout(() => setRefreshIndicatorVisible(false), 2000)
      }
    } catch (err) {
      console.error('Failed to refresh entities:', err)
      // Always show errors
      toast.error('Failed to refresh entities')
    } finally {
      setRefreshing(false)
    }
  }, [namespace.sessionId, onUpdateNamespace, toast, status])


  return (
    <>
      <div className={`namespace-view ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside 
        className={`left-pane ${sidebarCollapsed ? 'collapsed' : ''}`}
        style={{ width: sidebarCollapsed ? '64px' : `${sidebarWidth}px` }}
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
            sessionId={namespace.sessionId}
            selectedTarget={selectedTarget}
            onAudit={onAudit}
            isSessionExpired={status === 'expired'}
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

