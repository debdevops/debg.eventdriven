/**
 * TanStack Query Client Configuration
 * Provides intelligent caching, request deduplication, and automatic retries
 * 
 * SUCCESS METRICS:
 * - Reduce API calls from 3-5 to 1-2 per action
 * - Instant cache hits for repeated requests
 * - Automatic retry with exponential backoff
 * - Request deduplication (multiple components requesting same data)
 */

import { QueryClient } from '@tanstack/react-query'

/**
 * Global QueryClient instance
 * 
 * Configuration:
 * - staleTime: How long data is considered fresh (no refetch needed)
 * - gcTime: How long unused data stays in cache before garbage collection
 * - refetchOnWindowFocus: Refetch stale queries when user returns to tab
 * - retry: Number of automatic retry attempts on failure
 * - retryDelay: Exponential backoff delay calculation
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data freshness: 30 seconds (balance between UX and API load)
      staleTime: 30_000,
      
      // Cache retention: 5 minutes (keep data for quick navigation)
      gcTime: 5 * 60_000,
      
      // Refetch stale data when user returns to tab (good UX)
      refetchOnWindowFocus: true,
      
      // Retry failed requests 3 times (handles transient errors)
      retry: 3,
      
      // Exponential backoff: 1s, 2s, 4s (max 30s)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
      
      // Don't refetch on mount if data is fresh (reduce API calls)
      refetchOnMount: false,
      
      // Keep previous data while fetching new data (better UX)
      placeholderData: (previousData: unknown) => previousData,
    },
    mutations: {
      // Retry mutations once (be conservative with destructive operations)
      retry: 1,
      
      // Use same retry delay as queries
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
    }
  }
})

/**
 * Query Key Factory
 * Standardized query keys prevent cache misses and enable targeted invalidation
 * 
 * Pattern: [domain, entity, ...params]
 * Example: ['messages', 'myQueue', { isDLQ: false, search: 'error' }]
 */
export const queryKeys = {
  // Namespace queries
  namespaces: ['namespaces'] as const,
  namespace: (sessionId: string) => ['namespaces', sessionId] as const,
  entities: (sessionId: string) => ['entities', sessionId] as const,
  subscriptions: (sessionId: string, topicName: string) => 
    ['subscriptions', sessionId, topicName] as const,
  
  // Message queries
  messages: (
    sessionId: string,
    entityName: string,
    options?: {
      subscriptionName?: string
      isDLQ?: boolean
      maxMessages?: number
      fromSequenceNumber?: number
    }
  ) => ['messages', sessionId, entityName, options] as const,
  
  // AI Analysis queries
  aiAnalysis: (sessionId: string, queueName: string, options?: {
    maxSampleSize?: number
    includeDlq?: boolean
  }) => ['ai-analysis', sessionId, queueName, options] as const,
  
  // Health check
  health: ['health'] as const,
}

/**
 * Cache invalidation helpers
 * Use these to invalidate cache after mutations
 */
export const cacheInvalidation = {
  /**
   * Invalidate all messages for a specific entity
   */
  invalidateMessages: (sessionId: string, entityName: string) => {
    return queryClient.invalidateQueries({
      queryKey: ['messages', sessionId, entityName],
    })
  },
  
  /**
   * Invalidate entity list (after message count changes)
   */
  invalidateEntities: (sessionId: string) => {
    return queryClient.invalidateQueries({
      queryKey: ['entities', sessionId],
    })
  },
  
  /**
   * Invalidate AI analysis (after message changes)
   */
  invalidateAIAnalysis: (sessionId: string, queueName: string) => {
    return queryClient.invalidateQueries({
      queryKey: ['ai-analysis', sessionId, queueName],
    })
  },
  
  /**
   * Clear all caches (on disconnect)
   */
  clearAll: () => {
    queryClient.clear()
  }
}
