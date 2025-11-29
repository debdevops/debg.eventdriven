/**
 * Main Namespace View - Two-column layout
 */

import { useState, useCallback, useEffect } from 'react'
import { NamespaceSummary } from './NamespaceSummary'
import EntityList from './EntityList'
import StreamPanel from './StreamPanel'
import { apiClient } from '../api/client'
import { useSessionExpiry } from '../hooks/useSessionExpiry'
import type { Namespace, Entity, Subscription, AuditEntry } from '../types'
import './NamespaceView.css'

interface NamespaceViewProps {
  namespace: Namespace
  onUpdateNamespace: (updates: Partial<Namespace>) => void
  onAudit: (entry: AuditEntry) => void
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
  onAudit
}: NamespaceViewProps) {
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [isResizing, setIsResizing] = useState(false)
  
  const { formatTimeRemaining } = useSessionExpiry(namespace.expiresAtUtc)

  const handleSelectEntity = (entity: Entity) => {
    setSelectedTarget({
      type: 'queue',
      entity,
      isDLQ: false
    })
  }

  const handleSelectSubscription = (subscription: Subscription, topicName: string) => {
    setSelectedTarget({
      type: 'subscription',
      entity: null,
      subscription,
      topicName,
      isDLQ: false
    })
  }

  const handleSelectDLQ = (entity: Entity) => {
    setSelectedTarget({
      type: 'dlq',
      entity,
      isDLQ: true
    })
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

  const handleRefreshEntities = useCallback(async () => {
    setRefreshing(true)
    try {
      const entities = await apiClient.listEntities(namespace.sessionId)
      onUpdateNamespace({
        queues: entities.queues,
        topics: entities.topics.map(t => ({ ...t, type: 'Topic' as const, subscriptions: [] }))
      })
    } catch (err) {
      console.error('Failed to refresh entities:', err)
    } finally {
      setRefreshing(false)
    }
  }, [namespace.sessionId, onUpdateNamespace])

  return (
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
          {sidebarCollapsed ? '❯' : '❮'}
        </button>
        {!sidebarCollapsed && (
          <div style={{ 
            padding: '8px 12px', 
            background: '#fff3cd', 
            borderBottom: '1px solid #ffc107',
            fontSize: '12px',
            color: '#856404'
          }}>
            ⏱️ Session: {formatTimeRemaining()}
          </div>
        )}
        {!sidebarCollapsed && (
          <>
            <NamespaceSummary namespace={namespace} />
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
          />
        ) : (
          <div className="empty-selection">
            <h3>No Entity Selected</h3>
            <p>Select a queue or subscription from the left panel to view messages</p>
          </div>
        )}
      </section>
    </div>
  )
}

