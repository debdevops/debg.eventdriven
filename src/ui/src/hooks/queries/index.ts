/**
 * TanStack Query Hooks - Central Export
 * 
 * Import all query and mutation hooks from this file:
 * ```tsx
 * import { 
 *   useMessagesQuery, 
 *   useCompleteMessagesMutation,
 *   useEntitiesQuery 
 * } from '@/hooks/queries'
 * ```
 */

// Query hooks
export {
  useEntitiesQuery,
  useSubscriptionsQuery,
  useAllEntities,
} from './useEntitiesQuery'

export {
  useMessagesQuery,
  useQueueMessagesQuery,
  useMessageBySequenceQuery,
  type MessagesQueryOptions,
} from './useMessagesQuery'

export {
  useAIAnalysisQuery,
  useAIAnalysisReadyQuery,
  useCachedAIAnalysis,
  type AIAnalysisQueryOptions,
} from './useAIAnalysisQuery'

// Mutation hooks
export {
  useCompleteMessagesMutation,
  useDeleteMessageMutation,
  useResubmitMessageMutation,
  useAbandonMessagesMutation,
} from '../mutations/useMessageMutations'

export {
  useConnectMutation,
  useDisconnectMutation,
  useCreateSubscriptionMutation,
  useDeleteSubscriptionMutation,
} from '../mutations/useNamespaceMutations'

// Re-export query client and utilities
export { queryClient, queryKeys, cacheInvalidation } from '../../config/queryClient'
