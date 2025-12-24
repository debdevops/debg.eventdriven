/**
 * Entity List Component - Queues and Topics with Subscriptions
 * Compact 200px sidebar with collapsible sections
 */

import { useState, useEffect } from 'react'
import { useSessionV2 } from '../contexts/SessionContextV2'
import type { Entity, Topic, Subscription } from '../types'
import { apiClient } from '../api/client'
import { subscriptionEntityId } from '../utils/entityIdentity'
import EntityCard from './EntityCard'
import './EntityList.css'

interface SelectedTarget {
  type: 'queue' | 'subscription' | 'dlq'
  entity: Entity | null
  subscription?: Subscription
  topicName?: string
  isDLQ?: boolean
}

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
      onRefresh(true)
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

  const loadSubscriptions = async (topicName: string) => {
    setLoadingTopics(prev => new Set(prev).add(topicName))
    setError(null)
    
    try {
      const response = await apiClient.listSubscriptions(sessionId, topicName)
      setTopicSubscriptions(prev => ({
        ...prev,
        [topicName]: response.subscriptions.map((s: any) => ({
          ...s,
          topicName,
          entityId: subscriptionEntityId(topicName, s.name)
        }))
      }))
    } catch (err) {
      console.error(`Failed to load subscriptions for ${topicName}:`, err)
      setError(`Failed to load subscriptions for ${topicName}`)
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
                  isSelected={selectedTarget?.type === 'queue' && selectedTarget.entity?.name === queue.name && !selectedTarget.isDLQ}
                  isDLQSelected={selectedTarget?.type === 'dlq' && selectedTarget.entity?.name === queue.name}
                  onSelectQueue={onSelectEntity}
                  onSelectDLQ={onSelectDLQ}
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
                  selectedSubscriptionName={selectedTarget?.type === 'subscription' && selectedTarget.topicName === topic.name ? selectedTarget.subscription?.name : undefined}
                  selectedDlqSubscriptionName={selectedTarget?.type === 'dlq' && selectedTarget.topicName === topic.name ? selectedTarget.subscription?.name : undefined}
                  onToggle={() => toggleTopic(topic.name)}
                  onCreateTempSubscription={(e) => handleCreateTempSubscription(topic.name, e)}
                  onDeleteSubscription={(subName, e) => handleDeleteSubscription(topic.name, subName, e)}
                  onSelectSubscription={onSelectSubscription}
                  onSelectSubscriptionDLQ={onSelectSubscriptionDLQ}
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
  isSelected: boolean
  isDLQSelected: boolean
  onSelectQueue: (entity: Entity) => void
  onSelectDLQ: (entity: Entity) => void
}

function QueueItemExpandable({ entity, isSelected, isDLQSelected, onSelectQueue, onSelectDLQ }: QueueItemExpandableProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  // DLQ is a first-class entity node; do not derive its existence from count.
  const hasDLQ = true
  const { status } = useSessionV2()

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (status !== 'connected') return
    setIsExpanded(!isExpanded)
  }

  return (
    <div className="queue-card-container">
      <EntityCard
        type="queue"
        name={entity.name}
        messageCount={entity.messageCount}
        isSelected={isSelected}
        isDLQ={false}
        hasWarning={hasDLQ}
        onSelect={() => {
          if (status !== 'connected') return
          onSelectQueue(entity)
        }}
      />
      
      {hasDLQ && (
        <div className="dlq-expansion">
          <button
            className="dlq-expand-btn"
            onClick={handleExpandClick}
            aria-expanded={isExpanded}
          >
            {isExpanded ? '▼' : '▶'} DLQ ({entity.deadLetterMessageCount})
          </button>
          {isExpanded && (
            <EntityCard
              type="queue"
              name={`${entity.name} (DLQ)`}
              messageCount={entity.deadLetterMessageCount}
              isSelected={isDLQSelected}
              isDLQ={true}
              onSelect={() => {
                if (status !== 'connected') return
                onSelectDLQ(entity)
              }}
            />
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
  onSelectSubscription
: onSelectSubscription,
  onSelectSubscriptionDLQ
}: TopicItemProps) {
  const { status } = useSessionV2()
  const totalMessages = subscriptions.reduce((sum, sub) => sum + sub.messageCount, 0)
  
  return (
    <div className="topic-card-container">
      <EntityCard
        type="topic"
        name={topic.name}
        messageCount={totalMessages}
        isSelected={false}
        isDLQ={false}
        subscriptionCount={subscriptions.length}
        onSelect={() => {
          if (status !== 'connected') return
          onToggle()
        }}
        isExpanded={isExpanded}
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
                  key={sub.name}
                  subscription={sub}
                  topicName={topic.name}
                  isSelected={sub.name === selectedSubscriptionName || sub.name === selectedDlqSubscriptionName}
                  isDlqSelected={sub.name === selectedDlqSubscriptionName}
                  onSelect={(subscription, topicName) => {
                    if (status !== 'connected') return
                    onSelectSubscription(subscription, topicName)
                  }}
                  onSelectDLQ={(subscription, topicName) => {
                    if (status !== 'connected') return
                    onSelectSubscriptionDLQ(subscription, topicName)
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
  onSelect: (subscription: Subscription, topicName: string) => void
  onSelectDLQ: (subscription: Subscription, topicName: string) => void
  onDelete: (subscriptionName: string, e: React.MouseEvent) => void
}

function SubscriptionItem({ subscription, topicName, isSelected, isDlqSelected, onSelect, onSelectDLQ, onDelete }: SubscriptionItemProps) {
  const isTemp = subscription.name.startsWith('temp-sub-')
  // DLQ is a first-class entity node; do not derive its existence from count.
  const hasDLQ = true
  
  return (
    <div className="subscription-item-group">
      <div className="subscription-card-wrapper">
        <EntityCard
          type="subscription"
          name={subscription.name}
          messageCount={subscription.messageCount}
          isSelected={isSelected && !isDlqSelected}
          isDLQ={false}
          isTemp={isTemp}
          onSelect={() => onSelect(subscription, topicName)}
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

      {hasDLQ && (
        <button
          className={`subscription-dlq-child ${isDlqSelected ? 'selected' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onSelectDLQ(subscription, topicName)
          }}
          title={`View subscription DLQ (${subscription.deadLetterMessageCount})`}
        >
          <span className="subscription-dlq-icon">💀</span>
          <span className="subscription-dlq-label">DLQ ({subscription.deadLetterMessageCount})</span>
        </button>
      )}
    </div>
  )
}
