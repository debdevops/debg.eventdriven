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
  private onAuthError: (() => void) | null = null  // Callback to trigger reconnect
  private onSuccess: (() => void) | null = null    // NEW: Callback for successful API calls
  private inFlightControllers: Set<AbortController> = new Set()

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private currentConnectionString: string | null = null

  /**
   * Register callback for auth errors (401)
   * This will be called when 401 is detected to trigger reconnect flow
   */
  setAuthErrorHandler(handler: () => void) {
    this.onAuthError = handler
    console.log('[ApiClient] Auth error handler registered')
  }

  /**
   * Register callback for successful API calls
   * This will be called after each successful API response to mark session healthy
   */
  setSuccessHandler(handler: () => void) {
    this.onSuccess = handler
    console.log('[ApiClient] Success handler registered')
  }

  /**
   * Store connection session info
   * IMPORTANT: Store BOTH sessionId AND connectionString
   * The connectionString is needed to re-establish connection after 401/reconnect
   */
  setCredentials(sessionId: string, connectionString: string) {
    this.currentSessionId = sessionId
    this.currentConnectionString = connectionString
    console.log('[ApiClient] Credentials stored for session:', sessionId)
  }

  /**
   * Get current credentials (for reconnect flow)
   */
  getCredentials(): { sessionId: string; connectionString: string } | null {
    if (this.currentSessionId && this.currentConnectionString) {
      return {
        sessionId: this.currentSessionId,
        connectionString: this.currentConnectionString
      }
    }
    return null
  }

  /**
   * Clear stored session info (e.g., on logout or 401)
   */
  clearCredentials() {
    console.log('[ApiClient] Clearing credentials for session:', this.currentSessionId)
    this.currentSessionId = null
    this.currentConnectionString = null
    this.refreshPromise = null
  }

  /**
   * Reset client state completely (for reconnect after 401)
   * Clears all cached state and prepares for fresh connection
   */
  resetClient() {
    console.log('[ApiClient] Resetting client state')
    // Abort any in-flight requests first to prevent partial updates.
    this.abortAllRequests('client-reset')
    this.clearCredentials()
    this.lastHeartbeatTime = Date.now()
    this.consecutiveMissedHeartbeats = 0
  }

  /**
   * Abort all in-flight requests.
   * Used by the SessionController to enforce atomic reconnect semantics.
   */
  abortAllRequests(reason: string = 'abort-all') {
    if (this.inFlightControllers.size === 0) return
    console.warn(`[ApiClient] Aborting ${this.inFlightControllers.size} in-flight request(s): ${reason}`)
    for (const controller of this.inFlightControllers) {
      try {
        controller.abort(reason)
      } catch {
        // ignore
      }
    }
    this.inFlightControllers.clear()
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
   * requests hit 401 simultaneously. Other requests wait and then throw AuthError.
   * 
   * This forces all callers to handle re-authentication at the SessionContext level.
   */
  private async singleFlightRefresh(): Promise<void> {
    if (this.refreshPromise) {
      console.log('[ApiClient] Refresh already in progress, waiting...')
      await this.refreshPromise
      return
    }

    this.refreshPromise = (async () => {
      try {
        console.log('[ApiClient] 🔄 401 detected - credentials are invalid')
        
        // Trigger reconnect if handler is registered
        if (this.onAuthError) {
          console.log('[ApiClient] Triggering reconnect via registered handler')
          this.onAuthError()
        }
        
        // DON'T clear credentials here - let reconnect flow handle it
        // Reconnect needs access to the connection string
        console.log('[ApiClient] Waiting for reconnect to complete...')
        
        // Throw AuthError to propagate to SessionContext
        throw new AuthError('Session credentials are invalid. Re-authentication required.', 'auth', 'unauthorized')
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

        // Always attach an AbortController so the SessionController can cancel
        // all in-flight requests during reconnect.
        const controller = new AbortController()
        this.inFlightControllers.add(controller)

        // If caller provided a signal, mirror it into our controller.
        const externalSignal = options.signal
        if (externalSignal) {
          if (externalSignal.aborted) {
            controller.abort((externalSignal as any).reason || 'external-abort')
          } else {
            externalSignal.addEventListener(
              'abort',
              () => controller.abort((externalSignal as any).reason || 'external-abort'),
              { once: true }
            )
          }
        }

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        }).finally(() => {
          // Ensure we always release the controller.
          this.inFlightControllers.delete(controller)
        })

        // Handle 401 Unauthorized - trigger single-flight refresh (which throws AuthError)
        if (response.status === 401) {
          console.error(`[ApiClient] ⚠️  401 Unauthorized on ${endpoint}`)
          
          // Single-flight refresh will throw AuthError - don't retry
          try {
            await this.singleFlightRefresh()
          } catch (authErr) {
            // Propagate AuthError immediately - no retries
            throw authErr
          }
          
          // If we get here, refresh didn't throw (shouldn't happen), still throw 401 error
          const errorText = await response.text().catch(() => 'Unauthorized')
          throw new AuthError(errorText, endpoint, 'unauthorized')
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

        // Success! Call success handler to mark session healthy
        if (this.onSuccess) {
          this.onSuccess()
        }

        return response.json()
      } catch (error) {
        // Abort is an expected control-flow during reconnect; do not retry.
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error
        }

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

  /**
   * Generate test messages with controlled anomalies for AI analysis
   */
  async generateMessages(
    sessionId: string,
    count: number,
    queueName?: string,
    topicName?: string,
    targetType: 'Queue' | 'Topic' | 'Both' = 'Queue',
    includeDlqTestCases = true
  ): Promise<{
    totalGenerated: number
    anomalousCount: number
    dlqCandidates: number
    errors: string[]
    success: boolean
  }> {
    return this.request(`/api/messages/generate?sessionId=${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({
        count,
        queueName,
        topicName,
        targetType,
        includeDlqTestCases
      })
    })
  }

  /**
   * Analyze messages using AI Insights service
   */
  async analyzeMessages(
    sessionId: string,
    queueName: string,
    maxSampleSize = 100,
    includeDlq = true
  ): Promise<{
    activeQueueAnalysis?: {
      source: string
      totalMessages: number
      clusters: Array<{
        eventType: string
        size: number
        sampleMessage: any
        commonFields: string[]
      }>
      outliers: Array<{
        messageId: string
        eventType: string
        anomalyType: string
        description: string
        source: string
      }>
      processingTimeMs: number
    }
    dlqAnalysis?: {
      source: string
      totalMessages: number
      clusters: Array<{
        eventType: string
        size: number
        sampleMessage: any
        commonFields: string[]
      }>
      outliers: Array<{
        messageId: string
        eventType: string
        anomalyType: string
        description: string
        source: string
      }>
      processingTimeMs: number
    }
    summary: string
    analyzedAt: string
  }> {
    return this.request(`/api/messages/analyze?sessionId=${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({
        queueName,
        maxSampleSize,
        includeDlq
      })
    })
  }
}

export const apiClient = new ApiClient(API_BASE_URL)
