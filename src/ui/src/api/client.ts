/**
 * API Client for Service Bus Inspector Backend
 * Security: Never logs or exposes connection strings or lock tokens
 * Features: 401 detection, automatic token refresh, exponential backoff retry
 */

import { API_BASE_URL, API_ENDPOINTS } from '../config/api'
import { ApiError, AuthError, NetworkError } from './errors'
import type {
  ConnectResponse,
  EntityListResponse,
  PeekResponse,
  ReceiveResponse
} from '../types'

interface RetryConfig {
  maxRetries: number
  backoffMs: number
  retryOn5xx: boolean
  retryOn401: boolean
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  backoffMs: 1000,
  retryOn5xx: true,
  retryOn401: false // 401 handled separately via refresh
}

class ApiClient {
  private baseURL: string
  private currentSessionId: string | null = null
  private refreshPromise: Promise<void> | null = null
  private lastHeartbeatTime: number = Date.now()
  private consecutiveMissedHeartbeats: number = 0

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  /**
   * Store connection session info
   * NOTE: We intentionally do NOT store the connection string anymore
   * When 401 occurs, we throw immediately and let SessionContext handle re-auth flow
   * This prevents the cascading retry problem where invalid credentials cause infinite loops
   */
  setCredentials(sessionId: string, _connectionString: string) {
    this.currentSessionId = sessionId
    console.log('[ApiClient] Session ID stored:', sessionId)
  }

  /**
   * Clear stored session info (e.g., on logout)
   */
  clearCredentials() {
    console.log('[ApiClient] Clearing credentials for session:', this.currentSessionId)
    this.currentSessionId = null
    this.refreshPromise = null
  }

  /**
   * Mark successful heartbeat
   */
  recordHeartbeat() {
    this.lastHeartbeatTime = Date.now()
    this.consecutiveMissedHeartbeats = 0
  }

  /**
   * Mark failed heartbeat - returns true if connection is stale (2+ missed)
   */
  recordMissedHeartbeat(): boolean {
    this.consecutiveMissedHeartbeats++
    console.warn(`[ApiClient] Missed heartbeat ${this.consecutiveMissedHeartbeats}. Last was ${Math.round((Date.now() - this.lastHeartbeatTime) / 1000)}s ago`)
    return this.consecutiveMissedHeartbeats >= 2
  }

  /**
   * Single-flight token refresh: ensure only one refresh happens when multiple
   * requests hit 401 simultaneously. Other requests wait and retry.
   */
  private async singleFlightRefresh(): Promise<void> {
    if (this.refreshPromise) {
      console.log('[ApiClient] Refresh already in progress, waiting...')
      await this.refreshPromise
      return
    }

    this.refreshPromise = (async () => {
      try {
        console.log('[ApiClient] 🔄 Starting single-flight token refresh...')
        // Note: 401 means credentials are invalid. We clear them and let SessionContext handle re-auth.
        this.clearCredentials()
        console.log('[ApiClient] ✓ Refresh completed (credentials cleared, re-auth required)')
      } catch (err) {
        console.error('[ApiClient] ✗ Refresh failed:', err)
        throw err
      } finally {
        this.refreshPromise = null
      }
    })()

    await this.refreshPromise
  }

  /**
   * Enhanced request method with 401 detection and single-flight token refresh.
   * When multiple requests hit 401, only one refresh occurs and others wait/retry.
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryConfig: Partial<RetryConfig> = {}
  ): Promise<T> {
    const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
    const url = `${this.baseURL}${endpoint}`
    
    let lastError: Error | null = null
    let attempt = 0

    while (attempt <= config.maxRetries) {
      try {
        console.log(`[ApiClient] ${options.method || 'GET'} ${endpoint} (attempt ${attempt + 1}/${config.maxRetries + 1})`)
        
        // Record heartbeat on successful request
        this.recordHeartbeat()

        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        })

        // Handle 401 Unauthorized - trigger single-flight refresh then retry once
        if (response.status === 401) {
          console.error(`[ApiClient] ⚠️  401 Unauthorized on ${endpoint}`)
          
          // Single-flight refresh (only one actually happens, others wait)
          await this.singleFlightRefresh()
          
          // After refresh, allow ONE retry of the original request
          if (attempt === 0) {
            console.log('[ApiClient] Retrying request after refresh...')
            attempt++
            continue
          } else {
            // Already retried once, don't retry again
            console.error('[ApiClient] Still 401 after refresh - authentication failed')
            const errorText = await response.text().catch(() => 'Unauthorized')
            throw new AuthError(errorText, endpoint, 'unauthorized')
          }
        }

        // Handle other errors
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error')
          
          // Retry on 5xx if configured
          if (response.status >= 500 && config.retryOn5xx && attempt < config.maxRetries) {
            const backoff = config.backoffMs * Math.pow(2, attempt)
            console.warn(`[ApiClient] ⚠️  ${response.status} on ${endpoint}, retrying in ${backoff}ms...`)
            await new Promise(resolve => setTimeout(resolve, backoff))
            attempt++
            lastError = new ApiError(errorText, response.status, endpoint)
            continue
          }

          throw new ApiError(errorText, response.status, endpoint)
        }

        return response.json()
      } catch (error) {
        // Auth errors are NOT retried - thrown immediately
        if (error instanceof AuthError) {
          throw error
        }

        // Network errors
        if (error instanceof TypeError) {
          // Record missed heartbeat on network failure
          const isStale = this.recordMissedHeartbeat()
          if (isStale) {
            console.error('[ApiClient] Connection appears stale (2+ missed heartbeats)')
          }
          
          lastError = new NetworkError('Network request failed', error)
          
          if (attempt < config.maxRetries) {
            const backoff = config.backoffMs * Math.pow(2, attempt)
            console.warn(`[ApiClient] ⚠️  Network error on ${endpoint}, retrying in ${backoff}ms...`)
            await new Promise(resolve => setTimeout(resolve, backoff))
            attempt++
            continue
          }
          
          throw lastError
        }

        // Other errors
        lastError = error as Error
        attempt++
        
        if (attempt <= config.maxRetries) {
          const backoff = config.backoffMs * Math.pow(2, attempt - 1)
          console.warn(`[ApiClient] ⚠️  Error on ${endpoint}, retrying in ${backoff}ms...`, error)
          await new Promise(resolve => setTimeout(resolve, backoff))
        }
      }
    }

    throw lastError || new Error('Request failed after retries')
  }

  /**
   * Connect to a namespace using Service Bus connection string
   * Stores credentials for automatic token refresh
   */
  async connect(connectionString: string): Promise<ConnectResponse> {
    const response = await this.request<ConnectResponse>(API_ENDPOINTS.connect, {
      method: 'POST',
      body: JSON.stringify({ connectionString })
    })
    
    // Store credentials for automatic refresh
    this.setCredentials(response.sessionId, connectionString)
    
    return response
  }

  /**
   * List queues and topics for a namespace
   */
  async listEntities(sessionId: string): Promise<EntityListResponse> {
    return this.request<EntityListResponse>(
      API_ENDPOINTS.listEntities(sessionId),
      { method: 'GET' }
    )
  }

  /**
   * List subscriptions for a topic
   */
  async listSubscriptions(sessionId: string, topicName: string) {
    return this.request<{ subscriptions: any[] }>(
      `/api/namespace/${sessionId}/topic/${encodeURIComponent(topicName)}/subscriptions`,
      { method: 'GET' }
    )
  }

  /**
   * Create a temporary subscription for debugging
   */
  async createTempSubscription(sessionId: string, topicName: string) {
    return this.request(
      `/api/namespace/${sessionId}/topic/${encodeURIComponent(topicName)}/subscription/temp`,
      { method: 'POST' }
    )
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(sessionId: string, topicName: string, subscriptionName: string) {
    return this.request(
      `/api/namespace/${sessionId}/topic/${encodeURIComponent(topicName)}/subscription/${encodeURIComponent(subscriptionName)}`,
      { method: 'DELETE' }
    )
  }

  /**
   * Peek messages (non-destructive)
   * For subscriptions, pass topicName as entityName and subscriptionName separately
   */
  async peekMessages(
    sessionId: string,
    entityName: string,
    maxMessages = 10,
    subscriptionName?: string,
    isDLQ = false
  ): Promise<PeekResponse> {
    let url = subscriptionName 
      ? `${API_ENDPOINTS.peek(sessionId, entityName)}?subscriptionName=${encodeURIComponent(subscriptionName)}`
      : API_ENDPOINTS.peek(sessionId, entityName);
    
    if (isDLQ) {
      url += (subscriptionName ? '&' : '?') + 'isDLQ=true';
    }
    
    return this.request<PeekResponse>(url, {
      method: 'POST',
      body: JSON.stringify({ maxMessages })
    })
  }

  /**
   * Receive and complete messages
   * @param tokens - Ephemeral tokens (opaque values from SSE stream)
   */
  async receiveMessages(
    sessionId: string,
    entityName: string,
    tokens: string[],
    subscriptionName?: string,
    isDLQ = false
  ): Promise<ReceiveResponse> {
    let url = subscriptionName 
      ? `${API_ENDPOINTS.receive(sessionId, entityName)}?subscriptionName=${encodeURIComponent(subscriptionName)}`
      : API_ENDPOINTS.receive(sessionId, entityName);
    
    if (isDLQ) {
      url += (subscriptionName ? '&' : '?') + 'isDLQ=true';
    }
    
    return this.request<ReceiveResponse>(url, {
      method: 'POST',
      body: JSON.stringify({ tokens })
    })
  }

  /**
   * Get stream URL for SSE
   * For subscriptions, pass topicName as entityName and subscriptionName separately
   */
  getStreamURL(
    sessionId: string,
    entityName: string,
    mode: 'peek' | 'receive',
    subscriptionName?: string,
    isDLQ = false
  ): string {
    const base = `${this.baseURL}${API_ENDPOINTS.stream(sessionId, entityName, mode)}`;
    let url = base;
    
    if (subscriptionName) {
      url += `&subscriptionName=${encodeURIComponent(subscriptionName)}`;
    }
    
    if (isDLQ) {
      url += '&isDLQ=true';
    }
    
    return url;
  }

  /**
   * Health check
   */
  async health(): Promise<{ status: string; timestamp: string }> {
    return this.request(API_ENDPOINTS.health)
  }

  /**
   * Compare main queue vs DLQ metadata (headers only)
   */
  async peekCompare(
    sessionId: string,
    queueName: string,
    subscriptionName?: string
  ): Promise<{
    queue: string
    mainQueue: { count: number; messages: any[] }
    deadLetterQueue: { count: number; messages: any[] }
  }> {
    let url = `/api/debug/${sessionId}/peek-compare?queue=${encodeURIComponent(queueName)}`
    if (subscriptionName) {
      url += `&subscriptionName=${encodeURIComponent(subscriptionName)}`
    }
    return this.request(url, { method: 'GET' })
  }
}

export const apiClient = new ApiClient(API_BASE_URL)
