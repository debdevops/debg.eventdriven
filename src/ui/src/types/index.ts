/**
 * Type definitions for Service Bus Inspector UI
 * Security Note: Connection strings and lock tokens are never exposed to the UI
 */

export interface Namespace {
  sessionId: string
  friendlyName?: string
  expiresAtUtc: string
  queues: Entity[]
  topics: Topic[]
}

export interface Entity {
  entityId: string
  name: string
  type: 'Queue' | 'Topic' | 'Subscription'
  messageCount: number
  deadLetterMessageCount: number
  maxDeliveryCount?: number
  lockDuration?: string
}

export interface Topic {
  entityId: string
  name: string
  type: 'Topic'
  messageCount: number
  deadLetterMessageCount: number
  subscriptions?: Subscription[]
}

export interface Subscription {
  entityId: string
  name: string
  topicName: string
  messageCount: number
  deadLetterMessageCount: number
  maxDeliveryCount?: number
  lockDuration?: string
  status: string
}

export interface MessageEnvelope {
  token?: string // Ephemeral token for receive mode (opaque value)
  messageId: string
  sequenceNumber: number
  enqueuedTimeUtc: string
  deliveryCount: number
  body: string
  applicationProperties: Record<string, any>
  contentType?: string
  correlationId?: string
  subject?: string
  lockedUntilUtc?: string
  // DLQ-specific fields (only present for dead-lettered messages)
  deadLetterReason?: string
  deadLetterErrorDescription?: string
  deadLetterSource?: string
}

export interface AuditEntry {
  timestamp: string
  sessionId: string
  entityName: string
  operation: 'Connect' | 'Peek' | 'Receive'
  messageId?: string
  sequenceNumber?: number
}

export interface ConnectResponse {
  sessionId: string
  expiresAtUtc: string
}

export interface EntityListResponse {
  queues: Entity[]
  topics: Entity[]
}

export interface PeekResponse {
  messages: MessageEnvelope[]
  peekedCount: number
}

export interface ReceiveResponse {
  completed: string[]
  failed: string[]
}

export type StreamMode = 'peek' | 'receive'
export type SSEEventType = 'message' | 'heartbeat' | 'error'
