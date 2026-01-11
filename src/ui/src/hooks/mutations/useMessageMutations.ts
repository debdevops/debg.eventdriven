/**
 * TanStack Query Mutation Hooks for Message Operations
 * 
 * Features:
 * - Optimistic updates (instant UI feedback)
 * - Automatic cache invalidation
 * - Rollback on error
 * - Toast notifications
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { cacheInvalidation, queryKeys } from '../../config/queryClient'
import type { MessageEnvelope, ReceiveResponse } from '../../types'

/**
 * Mutation hook for receiving and completing messages
 * 
 * Flow:
 * 1. Optimistic update: Remove messages from UI immediately
 * 2. Send API request
 * 3. On success: Invalidate cache to refetch updated counts
 * 4. On error: Rollback optimistic update
 * 
 * Usage:
 * ```tsx
 * const completeMutation = useCompleteMessagesMutation()
 * 
 * const handleComplete = async () => {
 *   try {
 *     await completeMutation.mutateAsync({
 *       sessionId,
 *       entityName: 'orders-queue',
 *       tokens: selectedMessages.map(m => m.token!),
 *       subscriptionName,
 *       isDLQ
 *     })
 *     toast.success('Messages completed')
 *   } catch (error) {
 *     toast.error('Failed to complete messages')
 *   }
 * }
 * ```
 */
export function useCompleteMessagesMutation(): UseMutationResult<
  ReceiveResponse,
  Error,
  {
    sessionId: string
    entityName: string
    tokens: string[]
    subscriptionName?: string
    isDLQ?: boolean
  }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, entityName, tokens, subscriptionName, isDLQ }) => {
      return apiClient.receiveMessages(
        sessionId,
        entityName,
        tokens,
        subscriptionName,
        isDLQ
      )
    },

    // Optimistic update: Remove messages from cache immediately
    onMutate: async ({ sessionId, entityName, tokens, subscriptionName, isDLQ }) => {
      const queryKey = queryKeys.messages(sessionId, entityName, {
        subscriptionName,
        isDLQ,
      })

      // Cancel outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey })

      // Snapshot previous value for rollback
      const previousMessages = queryClient.getQueryData(queryKey)

      // Optimistically remove completed messages
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.messages) return old
        return {
          ...old,
          messages: old.messages.filter((m: MessageEnvelope) => !tokens.includes(m.token || '')),
          peekedCount: old.peekedCount - tokens.length,
        }
      })

      return { previousMessages, queryKey }
    },

    // On error: Rollback optimistic update
    onError: (_err, _variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(context.queryKey, context.previousMessages)
      }
    },

    // On success: Invalidate cache to refetch updated data
    onSuccess: (_data, { sessionId, entityName }) => {
      // Invalidate messages to get updated counts
      cacheInvalidation.invalidateMessages(sessionId, entityName)
      
      // Invalidate entities to update message counts in sidebar
      cacheInvalidation.invalidateEntities(sessionId)
    },
  })
}

/**
 * Mutation hook for deleting a message from DLQ
 * 
 * Usage:
 * ```tsx
 * const deleteMutation = useDeleteMessageMutation()
 * 
 * const handleDelete = async (messageId: string) => {
 *   if (!confirm('Delete this message?')) return
 *   
 *   await deleteMutation.mutateAsync({
 *     sessionId,
 *     entityName,
 *     messageId
 *   })
 * }
 * ```
 */
export function useDeleteMessageMutation(): UseMutationResult<
  void,
  Error,
  {
    sessionId: string
    entityName: string
    messageId: string
    subscriptionName?: string
    isDLQ?: boolean
  }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId: _sessionId, entityName: _entityName, messageId: _messageId }) => {
      // Assuming API has a delete endpoint (adjust if needed)
      // This might be part of the receive flow with a delete flag
      throw new Error('Delete endpoint not yet implemented in API client')
      // return apiClient.deleteMessage(sessionId, entityName, messageId)
    },

    // Optimistic update: Remove message immediately
    onMutate: async ({ sessionId, entityName, messageId, subscriptionName, isDLQ }) => {
      const queryKey = queryKeys.messages(sessionId, entityName, {
        subscriptionName,
        isDLQ,
      })

      await queryClient.cancelQueries({ queryKey })
      const previousMessages = queryClient.getQueryData(queryKey)

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.messages) return old
        return {
          ...old,
          messages: old.messages.filter((m: MessageEnvelope) => m.messageId !== messageId),
          peekedCount: Math.max(0, old.peekedCount - 1),
        }
      })

      return { previousMessages, queryKey }
    },

    onError: (_err, _variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(context.queryKey, context.previousMessages)
      }
    },

    onSuccess: (_data, { sessionId, entityName }) => {
      cacheInvalidation.invalidateMessages(sessionId, entityName)
      cacheInvalidation.invalidateEntities(sessionId)
    },
  })
}

/**
 * Mutation hook for resubmitting a DLQ message to main queue
 * 
 * Usage:
 * ```tsx
 * const resubmitMutation = useResubmitMessageMutation()
 * 
 * const handleResubmit = async (message: MessageEnvelope) => {
 *   await resubmitMutation.mutateAsync({
 *     sessionId,
 *     entityName,
 *     message
 *   })
 *   toast.success('Message resubmitted to main queue')
 * }
 * ```
 */
export function useResubmitMessageMutation(): UseMutationResult<
  void,
  Error,
  {
    sessionId: string
    entityName: string
    message: MessageEnvelope
    subscriptionName?: string
  }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId: _sessionId, entityName: _entityName, message: _message }) => {
      // This would be an API endpoint to resubmit DLQ message
      // Might involve completing from DLQ and sending to main queue
      throw new Error('Resubmit endpoint not yet implemented in API client')
      // return apiClient.resubmitMessage(sessionId, entityName, message)
    },

    // Optimistic update: Remove from DLQ, add to main queue
    onMutate: async ({ sessionId, entityName, message, subscriptionName }) => {
      const dlqQueryKey = queryKeys.messages(sessionId, entityName, {
        subscriptionName,
        isDLQ: true,
      })
      const mainQueryKey = queryKeys.messages(sessionId, entityName, {
        subscriptionName,
        isDLQ: false,
      })

      await queryClient.cancelQueries({ queryKey: dlqQueryKey })
      await queryClient.cancelQueries({ queryKey: mainQueryKey })

      const previousDLQ = queryClient.getQueryData(dlqQueryKey)
      const previousMain = queryClient.getQueryData(mainQueryKey)

      // Remove from DLQ
      queryClient.setQueryData(dlqQueryKey, (old: any) => {
        if (!old?.messages) return old
        return {
          ...old,
          messages: old.messages.filter((m: MessageEnvelope) => m.messageId !== message.messageId),
          peekedCount: Math.max(0, old.peekedCount - 1),
        }
      })

      // Add to main queue (at the end)
      queryClient.setQueryData(mainQueryKey, (old: any) => {
        if (!old?.messages) return old
        return {
          ...old,
          messages: [...old.messages, { ...message, token: undefined }],
          peekedCount: old.peekedCount + 1,
        }
      })

      return { previousDLQ, previousMain, dlqQueryKey, mainQueryKey }
    },

    onError: (_err, _variables, context) => {
      if (context?.previousDLQ) {
        queryClient.setQueryData(context.dlqQueryKey, context.previousDLQ)
      }
      if (context?.previousMain) {
        queryClient.setQueryData(context.mainQueryKey, context.previousMain)
      }
    },

    onSuccess: (_data, { sessionId, entityName }) => {
      // Invalidate both DLQ and main queue
      cacheInvalidation.invalidateMessages(sessionId, entityName)
      cacheInvalidation.invalidateEntities(sessionId)
    },
  })
}

/**
 * Mutation hook for abandoning messages (return to queue)
 * 
 * Usage:
 * ```tsx
 * const abandonMutation = useAbandonMessagesMutation()
 * 
 * const handleAbandon = async () => {
 *   await abandonMutation.mutateAsync({
 *     sessionId,
 *     entityName,
 *     tokens: selectedMessages.map(m => m.token!)
 *   })
 * }
 * ```
 */
export function useAbandonMessagesMutation(): UseMutationResult<
  void,
  Error,
  {
    sessionId: string
    entityName: string
    tokens: string[]
    subscriptionName?: string
  }
> {
  return useMutation({
    mutationFn: async ({ sessionId: _sessionId, entityName: _entityName, tokens: _tokens }) => {
      // API endpoint to abandon messages
      throw new Error('Abandon endpoint not yet implemented in API client')
      // return apiClient.abandonMessages(sessionId, entityName, tokens)
    },

    onSuccess: (_data, { sessionId, entityName }) => {
      // Invalidate to refetch (abandoned messages reappear in queue)
      cacheInvalidation.invalidateMessages(sessionId, entityName)
    },
  })
}
