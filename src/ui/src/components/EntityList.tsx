/**
 * Entity List Component - Queues and Topics with Subscriptions
 * Compact 200px sidebar with collapsible sections
 */

import { useState, useEffect } from 'react'
import { useSessionV2 } from '../contexts/SessionContextV2'
import type { Entity, Topic, Subscription } from '../types'
import { apiClient } from '../api/client'
import { subscriptionEntityId } from '../utils/entityIdentity'
import { computeDlqHealth } from '../utils/dlqHealth'
import type { SelectedTarget } from '../entities/selection'
import EntityCard from './EntityCard'
import './EntityList.css'

interface EntityListProps {
  queues: Entity[]
  topics: Topic[]
  selectedTarget: SelectedTarget | null
  sessionId: string
  onSelectEntity: (entity: Entity) => void
  onSelectSubscription: (subscription: Subscription, topicName: string) => void
  onSelectSubscriptionDLQ: (subscription: Subscription, topicName: string) => void
  onSelectDLQ: (entity: Entity) => void
  onRefresh: (triggeredByUser?: boolean) => void
  refreshing: boolean
  refreshIndicatorVisible?: boolean
}

// localStorage keys for collapsed state
const STORAGE_KEY_QUEUES = 'entityList.collapsed.queues'
const STORAGE_KEY_TOPICS = 'entityList.collapsed.topics'

export default function EntityList({
  queues,
  topics,
  selectedTarget,
  sessionId,
  onSelectEntity,
  onSelectSubscription,
  onSelectSubscriptionDLQ,
  onSelectDLQ,
  onRefresh,
  refreshing,
  refreshIndicatorVisible = false
}: EntityListProps) {
  const { status, scheduleInterval, clearTimer } = useSessionV2()
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set())
  const [expandedQueues, setExpandedQueues] = useState<Set<string>>(new Set())
  const [expandedSubscriptions, setExpandedSubscriptions] = useState<Set<string>>(new Set())
  const [topicSubscriptions, setTopicSubscriptions] = useState<Record<string, Subscription[]>>({})
  const [loadingTopics, setLoadingTopics] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  
  // Collapsible sections with localStorage persistence
  const [queuesCollapsed, setQueuesCollapsed] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_QUEUES)
    return saved === 'true'
  })
  
  const [topicsCollapsed, setTopicsCollapsed] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_TOPICS)
    return saved === 'true'
  })

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_QUEUES, String(queuesCollapsed))
  }, [queuesCollapsed])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TOPICS, String(topicsCollapsed))
  }, [topicsCollapsed])

  // Auto-refresh entity counts every 10 seconds (paused during reconnect)
  useEffect(() => {
    const timerKey = `entity-auto-refresh-${sessionId}`
    if (status !== 'connected') {
      clearTimer(timerKey)
      return
    }

    scheduleInterval(timerKey, 10000, () => {
      if (document.hidden || status !== 'connected') return
      onRefresh(false)
    })

    return () => clearTimer(timerKey)
  }, [onRefresh, scheduleInterval, clearTimer, status, sessionId])

  // When we regain connection, trigger an immediate refresh to clear any stale errors
  useEffect(() => {
    if (status === 'connected') {
      // Clear local error and force a visible refresh to update counts
      setError(null)
      onRefresh(false)
      // Reload subscriptions for expanded topics to ensure they are fresh
      expandedTopics.forEach((t) => {
        loadSubscriptions(t)
      })
    }
  }, [status])

  const toggleTopic = async (topicName: string) => {
    // Prevent toggling while disconnected to avoid errors
    if (status !== 'connected') {
      return
    }
    const isExpanded = expandedTopics.has(topicName)
    
    if (isExpanded) {
      // Collapse
      const newExpanded = new Set(expandedTopics)
      newExpanded.delete(topicName)
      setExpandedTopics(newExpanded)
    } else {
      // Expand and load subscriptions
      const newExpanded = new Set(expandedTopics)
      newExpanded.add(topicName)
      setExpandedTopics(newExpanded)
      
      if (!topicSubscriptions[topicName]) {
        await loadSubscriptions(topicName)
      }
    }
  }

  const toggleQueue = (queueName: string) => {
    setExpandedQueues((prev) => {
      const next = new Set(prev)
      if (next.has(queueName)) next.delete(queueName)
      else next.add(queueName)
      return next
    })
  }

  const toggleSubscription = (subscriptionEntityId: string) => {
    setExpandedSubscriptions((prev) => {
      const next = new Set(prev)
      if (next.has(subscriptionEntityId)) next.delete(subscriptionEntityId)
      else next.add(subscriptionEntityId)
      return next
    })
  }

  const loadSubscriptions = async (topicName: string): Promise<Subscription[]> => {
    setLoadingTopics(prev => new Set(prev).add(topicName))
    setError(null)
    
    try {
      const response = await apiClient.listSubscriptions(sessionId, topicName)
      const mapped: Subscription[] = response.subscriptions.map((raw: any) => {
        // Be robust to backend serializer casing (camelCase vs PascalCase).
        const name = String(raw?.name ?? raw?.Name ?? '')
        const messageCount = Number(raw?.messageCount ?? raw?.MessageCount ?? 0)
        const deadLetterMessageCount = Number(
          raw?.deadLetterMessageCount ?? raw?.DeadLetterMessageCount ?? 0
        )
        const maxDeliveryCount = raw?.maxDeliveryCount ?? raw?.MaxDeliveryCount
        const lockDuration = raw?.lockDuration ?? raw?.LockDuration
        const status = String(raw?.status ?? raw?.Status ?? '')

        return {
          ...raw,
          name,
          topicName,
          messageCount,
          deadLetterMessageCount,
          maxDeliveryCount,
          lockDuration,
          status,
          entityId: subscriptionEntityId(topicName, name)
        } as Subscription
      })
      setTopicSubscriptions(prev => ({
        ...prev,
        [topicName]: mapped
      }))
      return mapped
    } catch (err) {
      console.error(`Failed to load subscriptions for ${topicName}:`, err)
      setError(`Failed to load subscriptions for ${topicName}`)
      return []
    } finally {
      setLoadingTopics(prev => {
        const newSet = new Set(prev)
        newSet.delete(topicName)
        return newSet
      })
    }
  }

  const handleCreateTempSubscription = async (topicName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (status !== 'connected') {
      return
    }
    setError(null)
    
    try {
      await apiClient.createTempSubscription(sessionId, topicName)
      await loadSubscriptions(topicName)
    } catch (err) {
      console.error(`Failed to create temp subscription for ${topicName}:`, err)
      setError(`Failed to create temp subscription for ${topicName}`)
    }
  }

  const handleDeleteSubscription = async (topicName: string, subscriptionName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (status !== 'connected') {
      return
    }
    
    if (!confirm(`Delete subscription "${subscriptionName}"?`)) {
      return
    }
    
    setError(null)
    
    try {
      await apiClient.deleteSubscription(sessionId, topicName, subscriptionName)
      await loadSubscriptions(topicName)
    } catch (err) {
      console.error(`Failed to delete subscription ${subscriptionName}:`, err)
      setError(`Failed to delete subscription ${subscriptionName}`)
    }
  }

  return (
    <div className="entity-list compact">
      <div className="entity-list-header">
        <h3>Entities</h3>
        <div className="refresh-controls">
          <button
            className="refresh-btn"
            onClick={() => onRefresh(true)} // true = user clicked refresh button
            disabled={refreshing || status !== 'connected'}
            title={refreshing ? 'Refreshing entities...' : 'Refresh entity counts'}
          >
            {refreshing ? '⟳' : '🔄'}
          </button>
          {refreshIndicatorVisible && (
            <span 
              className="refresh-indicator"
              title="Updated"
            >
              ✓
            </span>
          )}
        </div>
      </div>
      
      {error && (
        <div className="entity-list-error">
          {error}
        </div>
      )}
      
      {queues.length > 0 && (
        <section className="entity-group">
          <h4 
            className={`entity-group-title collapsible ${queuesCollapsed ? 'collapsed' : ''}`}
            onClick={() => setQueuesCollapsed(!queuesCollapsed)}
            role="button"
            tabIndex={0}
          >
            <span className="collapse-arrow">{queuesCollapsed ? '▶' : '▼'}</span>
            <span>Queues</span>
            <span className="entity-count">{queues.length}</span>
          </h4>
          {!queuesCollapsed && (
            <div className={`entity-cards-grid ${status !== 'connected' ? 'disabled' : ''}`}>
              {queues.map(queue => (
                <QueueItemExpandable
                  key={queue.entityId}
                  entity={queue}
                  isExpanded={expandedQueues.has(queue.name)}
                  onToggle={() => toggleQueue(queue.name)}
                  isMessagesSelected={selectedTarget?.entityType === 'queue' && selectedTarget.viewType === 'messages' && selectedTarget.entity?.name === queue.name}
                  isDLQSelected={selectedTarget?.entityType === 'queue' && selectedTarget.viewType === 'dlq' && selectedTarget.entity?.name === queue.name}
                  onSelectMessages={() => onSelectEntity(queue)}
                  onSelectDLQ={() => onSelectDLQ(queue)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {topics.length > 0 && (
        <section className="entity-group">
          <h4 
            className={`entity-group-title collapsible ${topicsCollapsed ? 'collapsed' : ''}`}
            onClick={() => setTopicsCollapsed(!topicsCollapsed)}
            role="button"
            tabIndex={0}
          >
            <span className="collapse-arrow">{topicsCollapsed ? '▶' : '▼'}</span>
            <span>Topics</span>
            <span className="entity-count">{topics.length}</span>
          </h4>
          {!topicsCollapsed && (
            <div className={`entity-cards-grid ${status !== 'connected' ? 'disabled' : ''}`}>
              {topics.map(topic => (
                <TopicItem
                  key={topic.entityId}
                  topic={topic}
                  isExpanded={expandedTopics.has(topic.name)}
                  subscriptions={topicSubscriptions[topic.name] || []}
                  isLoading={loadingTopics.has(topic.name)}
                  sessionId={sessionId}
                  selectedSubscriptionName={selectedTarget?.entityType === 'subscription' && selectedTarget.viewType === 'messages' && selectedTarget.topicName === topic.name ? selectedTarget.subscription?.name : undefined}
                  selectedDlqSubscriptionName={selectedTarget?.entityType === 'subscription' && selectedTarget.viewType === 'dlq' && selectedTarget.topicName === topic.name ? selectedTarget.subscription?.name : undefined}
                  onToggle={() => toggleTopic(topic.name)}
                  onCreateTempSubscription={(e) => handleCreateTempSubscription(topic.name, e)}
                  onDeleteSubscription={(subName, e) => handleDeleteSubscription(topic.name, subName, e)}
                  onSelectSubscription={onSelectSubscription}
                  onSelectSubscriptionDLQ={onSelectSubscriptionDLQ}
                  onRefreshSubscriptions={loadSubscriptions}
                  expandedSubscriptions={expandedSubscriptions}
                  onToggleSubscription={toggleSubscription}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {queues.length === 0 && topics.length === 0 && (
        <div className="empty-entities">
          <p>No queues or topics found</p>
        </div>
      )}
    </div>
  )
}

interface QueueItemExpandableProps {
  entity: Entity
  isExpanded: boolean
  onToggle: () => void
  isMessagesSelected: boolean
  isDLQSelected: boolean
  onSelectMessages: () => void
  onSelectDLQ: () => void
}

function QueueItemExpandable({ entity, isExpanded, onToggle, isMessagesSelected, isDLQSelected, onSelectMessages, onSelectDLQ }: QueueItemExpandableProps) {
  // DLQ is a first-class entity node; do not derive its existence from count.
  const hasDLQ = true
  const { status } = useSessionV2()

  const dlqHealth = computeDlqHealth({
    dlqCount: entity.deadLetterMessageCount,
    activeCount: entity.messageCount,
    oldestDlqEnqueuedTimeUtc: null,
    sampledDlqMessages: null
  })

  return (
    <div className="queue-card-container">
      <EntityCard
        type="queue"
        name={entity.name}
        messageCount={entity.messageCount}
        isSelected={isMessagesSelected || isDLQSelected}
        isDLQ={false}
        hasWarning={false}
        onSelect={() => {
          if (status !== 'connected') return
          // FIX(selection): parent rows expand/collapse only; never trigger data fetch.
          onToggle()
        }}
        isExpanded={isExpanded}
      />

      {isExpanded && (
        <div className="subscription-children">
          <button
            className={`entity-child-row ${isMessagesSelected ? 'selected' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              if (status !== 'connected') return
              // FIX(selection): only child rows trigger fetch/selection.
              onSelectMessages()
            }}
            title="View queue messages"
          >
            <span className="entity-child-icon">📨</span>
            <span className="entity-child-label">Messages</span>
          </button>

          {hasDLQ && (
            <button
              className={`entity-child-row entity-dlq-row ${isDLQSelected ? 'selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                if (status !== 'connected') return
                // FIX(selection): only child rows trigger fetch/selection.
                onSelectDLQ()
              }}
              title={dlqHealth.whyTooltip}
            >
              <span className="entity-child-icon">💀</span>
              <span className="entity-child-label">DLQ</span>
              <span className="entity-child-badge">{entity.deadLetterMessageCount}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface TopicItemProps {
  topic: Topic
  isExpanded: boolean
  subscriptions: Subscription[]
  isLoading: boolean
  sessionId: string
  selectedSubscriptionName?: string
  selectedDlqSubscriptionName?: string
  onToggle: () => void
  onCreateTempSubscription: (e: React.MouseEvent) => void
  onDeleteSubscription: (subscriptionName: string, e: React.MouseEvent) => void
  onSelectSubscription: (subscription: Subscription, topicName: string) => void
  onSelectSubscriptionDLQ: (subscription: Subscription, topicName: string) => void
  onRefreshSubscriptions: (topicName: string) => Promise<Subscription[]>
  expandedSubscriptions: Set<string>
  onToggleSubscription: (subscriptionEntityId: string) => void
}

function TopicItem({
  topic,
  isExpanded,
  subscriptions,
  isLoading,
  selectedSubscriptionName,
  selectedDlqSubscriptionName,
  onToggle,
  onCreateTempSubscription,
  onDeleteSubscription,
  onSelectSubscription,
  onSelectSubscriptionDLQ,
  onRefreshSubscriptions,
  expandedSubscriptions,
  onToggleSubscription
}: TopicItemProps) {
  const { status } = useSessionV2()
  const totalMessages = subscriptions.reduce((sum, sub) => sum + sub.messageCount, 0)
  const showExpandChevron = isLoading || subscriptions.length > 0
  const isTopicSelected = Boolean(selectedSubscriptionName || selectedDlqSubscriptionName)
  
  return (
    <div className="topic-card-container">
      <EntityCard
        type="topic"
        name={topic.name}
        messageCount={totalMessages}
        isSelected={isTopicSelected}
        isDLQ={false}
        subscriptionCount={subscriptions.length}
        onSelect={() => {
          if (status !== 'connected') return
          onToggle()
        }}
        // FIX(sidebar): hide chevron when there are no children.
        isExpanded={showExpandChevron ? isExpanded : undefined}
      />
      
      {isExpanded && (
        <div className="subscriptions-container">
          <div className="subscriptions-header">
            <span className="subscriptions-label">
              {isLoading ? 'Loading...' : `${subscriptions.length} Subscriptions`}
            </span>
            <button
              className="create-temp-sub-btn-v2"
              onClick={(e) => {
                if (status !== 'connected') return
                onCreateTempSubscription(e)
              }}
              title="Create temporary subscription"
            >
              ➕ Temp Sub
            </button>
          </div>
          
          {!isLoading && subscriptions.length === 0 && (
            <div className="subscriptions-empty">
              <p>No subscriptions yet</p>
              <span className="subscriptions-empty-hint">Click ➕ above to create</span>
            </div>
          )}
          
          {!isLoading && subscriptions.length > 0 && (
            <div className="subscriptions-list">
              {subscriptions.map(sub => (
                <SubscriptionItem
                  key={sub.entityId}
                  subscription={sub}
                  topicName={topic.name}
                  isSelected={sub.name === selectedSubscriptionName || sub.name === selectedDlqSubscriptionName}
                  isDlqSelected={sub.name === selectedDlqSubscriptionName}
                  isExpanded={expandedSubscriptions.has(sub.entityId)}
                  onToggleExpand={() => onToggleSubscription(sub.entityId)}
                  onSelect={(subscription, topicName) => {
                    if (status !== 'connected') return
                    onSelectSubscription(subscription, topicName)
                  }}
                  onSelectDLQ={async (subscription, topicName) => {
                    if (status !== 'connected') return
                    // FIX(DLQ semantics): Refresh subscription runtime props so DLQ count is portal-aligned.
                    const fresh = await onRefreshSubscriptions(topicName)
                    const refreshed = fresh.find((s) => s.name === subscription.name) || subscription
                    onSelectSubscriptionDLQ(refreshed, topicName)
                  }}
                  onDelete={(subscriptionName, e) => {
                    if (status !== 'connected') return
                    onDeleteSubscription(subscriptionName, e)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface SubscriptionItemProps {
  subscription: Subscription
  topicName: string
  isSelected: boolean
  isDlqSelected: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onSelect: (subscription: Subscription, topicName: string) => void
  onSelectDLQ: (subscription: Subscription, topicName: string) => void
  onDelete: (subscriptionName: string, e: React.MouseEvent) => void
}

function SubscriptionItem({ subscription, topicName, isSelected, isDlqSelected, isExpanded, onToggleExpand, onSelect, onSelectDLQ, onDelete }: SubscriptionItemProps) {
  const isTemp = subscription.name.startsWith('temp-sub-')
  // DLQ is a first-class entity node; do not derive its existence from count.
  const hasDLQ = true

  const dlqHealth = computeDlqHealth({
    dlqCount: subscription.deadLetterMessageCount,
    activeCount: subscription.messageCount,
    oldestDlqEnqueuedTimeUtc: null,
    sampledDlqMessages: null
  })

  const dlqRowClass = dlqHealth.severity === 'CRITICAL'
    ? 'critical'
    : dlqHealth.severity === 'WARNING'
      ? 'warning'
      : ''
  
  return (
    <div className="subscription-item-group">
      <div className="subscription-card-wrapper">
        <EntityCard
          type="subscription"
          name={subscription.name}
          messageCount={subscription.messageCount}
          isSelected={isSelected}
          isDLQ={false}
          isTemp={isTemp}
          onSelect={() => {
            // FIX(selection): parent rows expand/collapse only; never trigger data fetch.
            onToggleExpand()
          }}
          isExpanded={isExpanded}
        />

        <button
          className="delete-sub-btn-v2"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(subscription.name, e)
          }}
          title="Delete subscription"
        >
          🗑️
        </button>
      </div>

      {hasDLQ && isExpanded && (
        <div className="subscription-children">
          <button
            className={`entity-child-row ${isSelected && !isDlqSelected ? 'selected' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              // FIX(selection): only child rows trigger fetch/selection.
              onSelect(subscription, topicName)
            }}
            title="View subscription messages"
          >
            <span className="entity-child-icon">📨</span>
            <span className="entity-child-label">Messages</span>
          </button>
          <button
            className={`entity-child-row entity-dlq-row ${dlqRowClass} ${isDlqSelected ? 'selected' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              // FIX(selection): only child rows trigger fetch/selection.
              onSelectDLQ(subscription, topicName)
            }}
            title={dlqHealth.whyTooltip}
          >
            <span className="entity-child-icon">💀</span>
            <span className="entity-child-label">DLQ</span>
            <span className="entity-child-badge">{subscription.deadLetterMessageCount}</span>
          </button>
        </div>
      )}
    </div>
  )
}
