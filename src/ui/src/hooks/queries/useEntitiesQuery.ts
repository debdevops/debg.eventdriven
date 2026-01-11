/**
 * TanStack Query Hooks for Namespace/Entity Operations
 * 
 * Features:
 * - Automatic request deduplication
 * - Intelligent caching (5 min for namespaces - they change infrequently)
 * - Automatic retries with exponential backoff
 * - Loading and error states
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { queryKeys } from '../../config/queryClient'
import type { 
  EntityListResponse, 
  Subscription 
} from '../../types'

/**
 * Query hook for listing entities (queues and topics) in a namespace
 * 
 * Caching Strategy:
 * - staleTime: 2 minutes (entities don't change often)
 * - Invalidate after mutations that affect entity counts
 * 
 * Usage:
 * ```tsx
 * const { data: entities, isLoading, error } = useEntitiesQuery(sessionId)
 * ```
 */
export function useEntitiesQuery(
  sessionId: string | null
): UseQueryResult<EntityListResponse, Error> {
  return useQuery({
    queryKey: queryKeys.entities(sessionId || ''),
    queryFn: () => {
      if (!sessionId) throw new Error('No session ID provided')
      return apiClient.listEntities(sessionId)
    },
    enabled: !!sessionId,
    staleTime: 2 * 60_000, // 2 minutes - entities change infrequently
    gcTime: 10 * 60_000, // 10 minutes - keep in cache longer
  })
}

/**
 * Query hook for listing subscriptions for a topic
 * 
 * Caching Strategy:
 * - staleTime: 1 minute (subscriptions more dynamic than entities)
 * - Only fetches when topicName is provided
 * 
 * Usage:
 * ```tsx
 * const { data: subs } = useSubscriptionsQuery(sessionId, 'orders-topic')
 * ```
 */
export function useSubscriptionsQuery(
  sessionId: string | null,
  topicName: string | null
): UseQueryResult<{ subscriptions: Subscription[] }, Error> {
  return useQuery({
    queryKey: queryKeys.subscriptions(sessionId || '', topicName || ''),
    queryFn: () => {
      if (!sessionId || !topicName) {
        throw new Error('Session ID and topic name required')
      }
      return apiClient.listSubscriptions(sessionId, topicName)
    },
    enabled: !!sessionId && !!topicName,
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes
  })
}

/**
 * Computed hook for getting all entities (queues + topics flattened)
 * 
 * Usage:
 * ```tsx
 * const { allEntities, isLoading } = useAllEntities(sessionId)
 * const queueNames = allEntities.filter(e => e.type === 'Queue').map(e => e.name)
 * ```
 */
export function useAllEntities(sessionId: string | null) {
  const query = useEntitiesQuery(sessionId)
  
  const allEntities = query.data 
    ? [...query.data.queues, ...query.data.topics]
    : []
  
  return {
    ...query,
    allEntities,
    queues: query.data?.queues || [],
    topics: query.data?.topics || [],
  }
}
