import axios from 'axios'
import { generateCorrelationId } from './correlation'

// Base URL for API calls
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add correlation ID to all requests for distributed tracing
apiClient.interceptors.request.use((config) => {
  const correlationId = generateCorrelationId()
  config.headers['X-Correlation-ID'] = correlationId
  return config
})

// API response types
export interface ConnectResponse {
  sessionId: string
  expiresAtUtc: string
}

export interface Entity {
  name: string
  messageCount: number
  deadLetterMessageCount: number
  maxDeliveryCount?: number
  lockDuration?: string
  type: string
}

export interface EntitiesResponse {
  queues: Entity[]
  topics: Entity[]
}

export interface Message {
  token?: string
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
}

export interface PeekResponse {
  messages: Message[]
}

export interface ReceiveResponse {
  completed: string[]
  failed: string[]
}

// API functions

/**
 * Connect to a Service Bus namespace using a connection string.
 * Returns a session ID and expiry time.
 */
export async function connectToNamespace(connectionString: string): Promise<ConnectResponse> {
  try {
    const response = await apiClient.post<ConnectResponse>('/api/namespace/connect', {
      connectionString,
    })
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.error || error.message)
    }
    throw error
  }
}

/**
 * List all queues and topics in the Service Bus namespace.
 */
export async function listEntities(sessionId: string): Promise<EntitiesResponse> {
  try {
    const response = await apiClient.get<EntitiesResponse>(
      `/api/namespace/${sessionId}/entities`
    )
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Session expired or invalid. Please reconnect.')
      }
      throw new Error(error.response?.data?.error || error.message)
    }
    throw error
  }
}

/**
 * Peek messages from a queue (non-destructive read).
 */
export async function peekMessages(
  sessionId: string,
  entityName: string,
  maxMessages: number = 10
): Promise<PeekResponse> {
  try {
    const response = await apiClient.post<PeekResponse>(
      `/api/queue/${sessionId}/${entityName}/peek`,
      { maxMessages }
    )
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Session expired or invalid. Please reconnect.')
      }
      throw new Error(error.response?.data?.error || error.message)
    }
    throw error
  }
}

/**
 * Receive and complete messages from a queue.
 * Tokens are ephemeral identifiers mapped server-side to lock tokens.
 */
export async function receiveMessages(
  sessionId: string,
  entityName: string,
  tokens: string[]
): Promise<ReceiveResponse> {
  try {
    const response = await apiClient.post<ReceiveResponse>(
      `/api/queue/${sessionId}/${entityName}/receive`,
      { tokens }
    )
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Session expired or invalid. Please reconnect.')
      }
      throw new Error(error.response?.data?.error || error.message)
    }
    throw error
  }
}

// PRODUCTION ENHANCEMENTS:
// 1. Add retry logic with exponential backoff for transient failures
// 2. Implement request caching for entity lists
// 3. Add request/response logging for debugging
// 4. Implement circuit breaker pattern for API resilience
// 5. Add authentication token handling if using AAD/MSAL
// 6. Implement request queue for offline support
// 7. Add telemetry for frontend performance monitoring
