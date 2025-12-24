/**
 * Stable entity identity helpers
 *
 * Contract:
 * - entityId MUST be a string and NEVER undefined
 * - Formats:
 *   queue:<queueName>
 *   queue:<queueName>:dlq
 *   topic:<topicName>
 *   topic:<topicName>:sub:<subscriptionName>
 *   topic:<topicName>:sub:<subscriptionName>:dlq
 */

export type EntityId = string

export function queueEntityId(queueName: string): EntityId {
  return `queue:${queueName}`
}

export function queueDlqEntityId(queueName: string): EntityId {
  return `queue:${queueName}:dlq`
}

export function topicEntityId(topicName: string): EntityId {
  return `topic:${topicName}`
}

export function subscriptionEntityId(topicName: string, subscriptionName: string): EntityId {
  return `topic:${topicName}:sub:${subscriptionName}`
}

export function subscriptionDlqEntityId(topicName: string, subscriptionName: string): EntityId {
  return `topic:${topicName}:sub:${subscriptionName}:dlq`
}

export function isValidEntityId(value: unknown): value is EntityId {
  return typeof value === 'string' && value.length > 0
}

export function entityIdFromMessageStoreParams(
  entityType: 'queue' | 'topic' | 'subscription' | 'dlq',
  entityName: string,
  subscriptionName?: string
): EntityId {
  if (entityType === 'queue') return queueEntityId(entityName)
  if (entityType === 'topic') return topicEntityId(entityName)
  if (entityType === 'subscription') {
    // For subscriptions, entityName is the topic name.
    return subscriptionEntityId(entityName, subscriptionName || '')
  }

  // DLQ: either queue DLQ (no subscriptionName) or subscription DLQ.
  if (subscriptionName) return subscriptionDlqEntityId(entityName, subscriptionName)
  return queueDlqEntityId(entityName)
}
