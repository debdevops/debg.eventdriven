/**
 * TanStack Query Hooks for Message Operations
 * 
 * Features:
 * - Request deduplication (multiple components can call same query)
 * - Intelligent caching with shorter staleTime (messages change frequently)
 * - Automatic background refetching
 * - AbortController integration for cleanup
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { queryKeys } from '../../config/queryClient'
import type { PeekResponse } from '../../types'

export interface MessagesQueryOptions {
  sessionId: string | null
  entityName: string | null
  subscriptionName?: string
  isDLQ?: boolean
  maxMessages?: number
  fromSequenceNumber?: number
}

/**
 * Query hook for peeking messages (non-destructive read)
 * 
 * Caching Strategy:
 * - staleTime: 10 seconds (messages change frequently)
 * - Automatic refetch on window focus
 * - Request deduplication (if 3 components request same queue, only 1 API call)
 * 
 * Usage:
 * ```tsx
 * const { data, isLoading, error, refetch } = useMessagesQuery({
 *   sessionId,
 *   entityName: 'orders-queue',
 *   isDLQ: false,
 *   maxMessages: 100
 * })
 * ```
 */
export function useMessagesQuery(
  options: MessagesQueryOptions
): UseQueryResult<PeekResponse, Error> {
  const {
    sessionId,
    entityName,
    subscriptionName,
    isDLQ = false,
    maxMessages = 100,
    fromSequenceNumber,
  } = options

  return useQuery({
    queryKey: queryKeys.messages(
      sessionId || '',
      entityName || '',
      { subscriptionName, isDLQ, maxMessages, fromSequenceNumber }
    ),
    queryFn: async ({ signal }) => {
      if (!sessionId || !entityName) {
        throw new Error('Session ID and entity name required')
      }
      
      return apiClient.peekMessages(
        sessionId,
        entityName,
        maxMessages,
        subscriptionName,
        isDLQ,
        signal,
        fromSequenceNumber
      )
    },
    enabled: !!sessionId && !!entityName,
    staleTime: 10_000, // 10 seconds - messages change frequently
    gcTime: 2 * 60_000, // 2 minutes - shorter retention for message data
    refetchOnWindowFocus: true, // Get latest messages when user returns
  })
}

/**
 * Query hook for both active queue and DLQ messages
 * Returns both queries for side-by-side comparison
 * 
 * Usage:
 * ```tsx
 * const { activeQuery, dlqQuery, totalMessages } = useQueueMessagesQuery({
 *   sessionId,
 *   entityName: 'orders-queue'
 * })
 * ```
 */
export function useQueueMessagesQuery(options: {
  sessionId: string | null
  entityName: string | null
  subscriptionName?: string
  maxMessages?: number
}) {
  const activeQuery = useMessagesQuery({
    ...options,
    isDLQ: false,
  })

  const dlqQuery = useMessagesQuery({
    ...options,
    isDLQ: true,
  })

  const totalMessages = 
    (activeQuery.data?.messages.length || 0) +
    (dlqQuery.data?.messages.length || 0)

  const isLoading = activeQuery.isLoading || dlqQuery.isLoading
  const hasError = !!activeQuery.error || !!dlqQuery.error

  return {
    activeQuery,
    dlqQuery,
    totalMessages,
    isLoading,
    hasError,
    // Convenience method to refetch both
    refetchAll: () => {
      activeQuery.refetch()
      dlqQuery.refetch()
    },
  }
}

/**
 * Query hook for a single message peek (by sequence number)
 * Useful for detail views
 * 
 * Usage:
 * ```tsx
 * const { data: message } = useMessageBySequenceQuery({
 *   sessionId,
 *   entityName: 'orders-queue',
 *   sequenceNumber: 12345
 * })
 * ```
 */
export function useMessageBySequenceQuery(options: {
  sessionId: string | null
  entityName: string | null
  sequenceNumber: number | null
  subscriptionName?: string
  isDLQ?: boolean
}) {
  const {
    sessionId,
    entityName,
    sequenceNumber,
    subscriptionName,
    isDLQ = false,
  } = options

  return useQuery({
    queryKey: queryKeys.messages(
      sessionId || '',
      entityName || '',
      { subscriptionName, isDLQ, maxMessages: 1, fromSequenceNumber: sequenceNumber || undefined }
    ),
    queryFn: async ({ signal }) => {
      if (!sessionId || !entityName || sequenceNumber === null) {
        throw new Error('Session ID, entity name, and sequence number required')
      }

      const response = await apiClient.peekMessages(
        sessionId,
        entityName,
        1, // Only fetch 1 message
        subscriptionName,
        isDLQ,
        signal,
        sequenceNumber
      )

      return response.messages[0] || null
    },
    enabled: !!sessionId && !!entityName && sequenceNumber !== null,
    staleTime: 30_000, // 30 seconds - single message less likely to change
    gcTime: 5 * 60_000, // 5 minutes
  })
}
