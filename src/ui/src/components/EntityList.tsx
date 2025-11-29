/**
 * Entity List Component - Queues and Topics with Subscriptions
 */

import { useState, useEffect } from 'react'
import type { Entity, Topic, Subscription } from '../types'
import { apiClient } from '../api/client'
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
  onSelectDLQ: (entity: Entity) => void
  onRefresh: () => void
  refreshing: boolean
}

export default function EntityList({
  queues,
  topics,
  selectedTarget,
  sessionId,
  onSelectEntity,
  onSelectSubscription,
  onSelectDLQ,
  onRefresh,
  refreshing
}: EntityListProps) {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set())
  const [topicSubscriptions, setTopicSubscriptions] = useState<Record<string, Subscription[]>>({})
  const [loadingTopics, setLoadingTopics] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Auto-refresh entity counts every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      onRefresh()
    }, 10000) // 10 seconds
    
    return () => clearInterval(interval)
  }, [onRefresh])

  const toggleTopic = async (topicName: string) => {
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
        [topicName]: response.subscriptions
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
    <div className="entity-list">
      <div className="entity-list-header">
        <h3>Entities</h3>
        <button
          className="refresh-btn"
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh entity counts"
        >
          🔄 {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      
      {error && (
        <div className="entity-list-error">
          {error}
        </div>
      )}
      
      {queues.length > 0 && (
        <section className="entity-group">
          <h4 className="entity-group-title">
            🗂️ Queues ({queues.length})
          </h4>
          <ul className="entity-items">
            {queues.map(queue => (
              <QueueItemExpandable
                key={queue.name}
                entity={queue}
                isSelected={selectedTarget?.type === 'queue' && selectedTarget.entity?.name === queue.name && !selectedTarget.isDLQ}
                isDLQSelected={selectedTarget?.type === 'dlq' && selectedTarget.entity?.name === queue.name}
                onSelectQueue={onSelectEntity}
                onSelectDLQ={onSelectDLQ}
              />
            ))}
          </ul>
        </section>
      )}

      {topics.length > 0 && (
        <section className="entity-group">
          <h4 className="entity-group-title">
            📡 Topics ({topics.length})
          </h4>
          <ul className="entity-items">
            {topics.map(topic => (
              <TopicItem
                key={topic.name}
                topic={topic}
                isExpanded={expandedTopics.has(topic.name)}
                subscriptions={topicSubscriptions[topic.name] || []}
                isLoading={loadingTopics.has(topic.name)}
                sessionId={sessionId}
                selectedSubscriptionName={selectedTarget?.type === 'subscription' && selectedTarget.topicName === topic.name ? selectedTarget.subscription?.name : undefined}
                onToggle={() => toggleTopic(topic.name)}
                onCreateTempSubscription={(e) => handleCreateTempSubscription(topic.name, e)}
                onDeleteSubscription={(subName, e) => handleDeleteSubscription(topic.name, subName, e)}
                onSelectSubscription={onSelectSubscription}
              />
            ))}
          </ul>
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
  const [isExpanded, setIsExpanded] = useState(false)
  const hasDLQ = entity.deadLetterMessageCount > 0

  const handleQueueClick = () => {
    onSelectQueue(entity)
  }

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  return (
    <li className="entity-item queue-item-expandable">
      <div
        className={`queue-header ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}
        onClick={handleQueueClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleQueueClick()
          }
        }}
      >
        <div className="entity-info">
          {hasDLQ && (
            <span 
              className="expand-icon" 
              onClick={handleExpandClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleExpandClick(e as any)
                }
              }}
            >
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          <span className="entity-icon">📥</span>
          <span className="entity-name">{entity.name}</span>
          {hasDLQ && (
            <span className="dlq-indicator" title="Has dead letter messages">
              ⚠️ DLQ
            </span>
          )}
        </div>
      </div>
      
      {isExpanded && hasDLQ && (
        <ul className="dlq-list">
          <li
            className={`dlq-item ${isDLQSelected ? 'selected' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onSelectDLQ(entity)
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelectDLQ(entity)
              }
            }}
          >
            <div className="entity-info">
              <span className="entity-icon dlq-icon">💀</span>
              <span className="entity-name">Dead Letter Queue</span>
            </div>
          </li>
        </ul>
      )}
    </li>
  )
}

interface TopicItemProps {
  topic: Topic
  isExpanded: boolean
  subscriptions: Subscription[]
  isLoading: boolean
  sessionId: string
  selectedSubscriptionName?: string
  onToggle: () => void
  onCreateTempSubscription: (e: React.MouseEvent) => void
  onDeleteSubscription: (subscriptionName: string, e: React.MouseEvent) => void
  onSelectSubscription: (subscription: Subscription, topicName: string) => void
}

function TopicItem({
  topic,
  isExpanded,
  subscriptions,
  isLoading,
  selectedSubscriptionName,
  onToggle,
  onCreateTempSubscription,
  onDeleteSubscription,
  onSelectSubscription
}: TopicItemProps) {
  return (
    <li className="entity-item topic-item">
      <div
        className={`topic-header ${isExpanded ? 'expanded' : ''}`}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
      >
        <div className="entity-info">
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
          <span className="entity-icon">📢</span>
          <span className="entity-name">{topic.name}</span>
        </div>
        <div className="entity-stats">
          <span className="subscription-count" title="Subscriptions">
            🔔 {subscriptions.length}
          </span>
          <button
            className="create-temp-sub-btn"
            onClick={onCreateTempSubscription}
            title="Create temporary subscription for debugging"
          >
            ➕
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <ul className="subscription-list">
          {isLoading && (
            <li className="subscription-loading">Loading subscriptions...</li>
          )}
          {!isLoading && subscriptions.length === 0 && (
            <li className="subscription-empty">
              No subscriptions. Click ➕ to create a temp subscription.
            </li>
          )}
          {!isLoading && subscriptions.map(sub => (
            <SubscriptionItem
              key={sub.name}
              subscription={sub}
              topicName={topic.name}
              isSelected={sub.name === selectedSubscriptionName}
              onSelect={onSelectSubscription}
              onDelete={onDeleteSubscription}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

interface SubscriptionItemProps {
  subscription: Subscription
  topicName: string
  isSelected: boolean
  onSelect: (subscription: Subscription, topicName: string) => void
  onDelete: (subscriptionName: string, e: React.MouseEvent) => void
}

function SubscriptionItem({ subscription, topicName, isSelected, onSelect, onDelete }: SubscriptionItemProps) {
  const isTemp = subscription.name.startsWith('temp-sub-')
  
  return (
    <li
      className={`subscription-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(subscription, topicName)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(subscription, topicName)
        }
      }}
    >
      <div className="entity-info">
        <span className="entity-icon">🔔</span>
        <span className="entity-name">{subscription.name}</span>
        {isTemp && <span className="temp-badge" title="Auto-deletes in 15 minutes">⏱️</span>}
        {subscription.deadLetterMessageCount > 0 && (
          <span className="dlq-indicator" title="Has dead letter messages">
            ⚠️ DLQ
          </span>
        )}
      </div>
      <div className="entity-stats">
        <button
          className="delete-sub-btn"
          onClick={(e) => onDelete(subscription.name, e)}
          title="Delete subscription"
        >
          🗑️
        </button>
      </div>
    </li>
  )
}
