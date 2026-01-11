/**
 * TanStack Query Mutation Hooks for Namespace Operations
 * 
 * Features:
 * - Connection establishment
 * - Subscription management
 * - Automatic cache updates
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { cacheInvalidation, queryKeys } from '../../config/queryClient'
import type { ConnectResponse } from '../../types'

/**
 * Mutation hook for connecting to a Service Bus namespace
 * 
 * Usage:
 * ```tsx
 * const connectMutation = useConnectMutation()
 * 
 * const handleConnect = async (connectionString: string) => {
 *   try {
 *     const response = await connectMutation.mutateAsync({ connectionString })
 *     setSessionId(response.sessionId)
 *     toast.success('Connected successfully')
 *   } catch (error) {
 *     toast.error('Connection failed')
 *   }
 * }
 * ```
 */
export function useConnectMutation(): UseMutationResult<
  ConnectResponse,
  Error,
  { connectionString: string }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ connectionString }) => {
      return apiClient.connect(connectionString)
    },

    onSuccess: (data) => {
      // Pre-fetch entities after successful connection
      queryClient.prefetchQuery({
        queryKey: queryKeys.entities(data.sessionId),
        queryFn: () => apiClient.listEntities(data.sessionId),
      })
    },

    onError: () => {
      // Clear any stale cache on connection failure
      cacheInvalidation.clearAll()
    },
  })
}

/**
 * Mutation hook for disconnecting from namespace
 * 
 * Usage:
 * ```tsx
 * const disconnectMutation = useDisconnectMutation()
 * 
 * const handleDisconnect = async () => {
 *   await disconnectMutation.mutateAsync({ sessionId })
 *   setSessionId(null)
 * }
 * ```
 */
export function useDisconnectMutation(): UseMutationResult<
  void,
  Error,
  { sessionId: string }
> {
  return useMutation({
    mutationFn: async ({ sessionId: _sessionId }) => {
      // Clear credentials from API client
      apiClient.clearCredentials()
      // Note: Backend may not have explicit disconnect endpoint
      // Session expires naturally
    },

    onSuccess: () => {
      // Clear all cached data on disconnect
      cacheInvalidation.clearAll()
    },
  })
}

/**
 * Mutation hook for creating a temporary subscription
 * 
 * Usage:
 * ```tsx
 * const createSubMutation = useCreateSubscriptionMutation()
 * 
 * const handleCreateTemp = async () => {
 *   await createSubMutation.mutateAsync({
 *     sessionId,
 *     topicName: 'orders-topic'
 *   })
 *   toast.success('Temporary subscription created')
 * }
 * ```
 */
export function useCreateSubscriptionMutation(): UseMutationResult<
  any,
  Error,
  {
    sessionId: string
    topicName: string
  }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, topicName }) => {
      return apiClient.createTempSubscription(sessionId, topicName)
    },

    onSuccess: (_data, { sessionId, topicName }) => {
      // Invalidate subscriptions list to show new subscription
      queryClient.invalidateQueries({
        queryKey: queryKeys.subscriptions(sessionId, topicName),
      })
    },
  })
}

/**
 * Mutation hook for deleting a subscription
 * 
 * Usage:
 * ```tsx
 * const deleteSubMutation = useDeleteSubscriptionMutation()
 * 
 * const handleDelete = async () => {
 *   await deleteSubMutation.mutateAsync({
 *     sessionId,
 *     topicName: 'orders-topic',
 *     subscriptionName: 'temp-sub-123'
 *   })
 * }
 * ```
 */
export function useDeleteSubscriptionMutation(): UseMutationResult<
  any,
  Error,
  {
    sessionId: string
    topicName: string
    subscriptionName: string
  }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, topicName, subscriptionName }) => {
      return apiClient.deleteSubscription(sessionId, topicName, subscriptionName)
    },

    // Optimistic update: Remove subscription from list
    onMutate: async ({ sessionId, topicName, subscriptionName }) => {
      const queryKey = queryKeys.subscriptions(sessionId, topicName)

      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData(queryKey)

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.subscriptions) return old
        return {
          ...old,
          subscriptions: old.subscriptions.filter(
            (sub: any) => sub.name !== subscriptionName
          ),
        }
      })

      return { previousData, queryKey }
    },

    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData)
      }
    },

    onSuccess: (_data, { sessionId, topicName }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.subscriptions(sessionId, topicName),
      })
    },
  })
}
