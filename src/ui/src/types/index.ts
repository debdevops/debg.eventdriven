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
  // UI-only precomputed one-line preview (computed once at load time)
  previewText?: string
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
  operation: 'Connect' | 'Peek' | 'Receive' | 'AI Analysis'
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

/**
 * Toast API interface for displaying notifications
 */
export interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  warning: (message: string) => void
}

/**
 * AI Analysis types for message clustering and anomaly detection
 */
export interface MessageCluster {
  clusterId: string
  clusterName: string
  messageCount: number
  eventTypes: string[]
  patternDescription: string
  commonFields?: Record<string, unknown>
  correlationGroups?: string[][]
  sampleMessageIds?: string[]
  confidence: number
}

export interface MessageOutlier {
  messageId: string
  reason: string
  anomalyScore: number
  source: string
  eventType: string
  description: string
  sampleMessage?: unknown
}

export interface QueueAnalysis {
  source: string
  totalMessages: number
  clusters: MessageCluster[]
  outliers: MessageOutlier[]
  processingTimeMs: number
}

export interface AiInsightsResult {
  activeQueueAnalysis?: QueueAnalysis
  dlqAnalysis?: QueueAnalysis
  summary: string
  analyzedAt: string
}

/**
 * Generate messages result type
 */
export interface GenerateMessagesResult {
  totalGenerated: number
  anomalousCount: number
  dlqCandidates: number
  dlqDeadLettered: number
  dlqDeadLetteredQueue: number
  dlqDeadLetteredSubscriptions: number
  dlqTopicName?: string
  dlqSubscriptionName?: string
  errors: string[]
  success: boolean
}

/**
 * Peek compare result type
 */
export interface PeekCompareResult {
  queue: string
  mainQueue: { count: number; messages: MessageEnvelope[] }
  deadLetterQueue: { count: number; messages: MessageEnvelope[] }
}
