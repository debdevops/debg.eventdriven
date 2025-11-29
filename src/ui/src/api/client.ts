/**
 * API Client for Service Bus Inspector Backend
 * Security: Never logs or exposes connection strings or lock tokens
 */

import { API_BASE_URL, API_ENDPOINTS } from '../config/api'
import type {
  ConnectResponse,
  EntityListResponse,
  PeekResponse,
  ReceiveResponse
} from '../types'

class ApiClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error')
      throw new Error(`API Error: ${response.status} ${error}`)
    }

    return response.json()
  }

  /**
   * Connect to a namespace using Service Bus connection string
   */
  async connect(connectionString: string): Promise<ConnectResponse> {
    return this.request<ConnectResponse>(API_ENDPOINTS.connect, {
      method: 'POST',
      body: JSON.stringify({ connectionString })
    })
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
