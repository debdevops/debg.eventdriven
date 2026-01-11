/**
 * TanStack Query Hooks for AI Remediation Actions
 * 
 * Features:
 * - Execute remediation actions on anomalies
 * - Submit ML feedback (true/false positives)
 * - Batch remediation operations
 * - Track remediation history
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { cacheInvalidation } from '../../config/queryClient'
import { apiClient } from '../../api/client'
import type {
  RemediationRequest,
  RemediationResult,
  FeedbackRequest,
  BulkRemediationRequest,
  AISuggestion,
  RemediationActionType
} from '../../types/remediation'

/**
 * Mutation hook for executing remediation action on single anomaly
 * 
 * Usage:
 * ```tsx
 * const remediate = useRemediationMutation()
 * 
 * await remediate.mutateAsync({
 *   sessionId,
 *   messageIds: ['msg-123'],
 *   anomalyType: 'HIGH_RETRY_COUNT',
 *   actionType: 'move_to_dlq'
 * })
 * ```
 */
export function useRemediationMutation(): UseMutationResult<
  RemediationResult,
  Error,
  RemediationRequest
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: RemediationRequest) => {
      const response = await apiClient.executeRemediation(
        request.sessionId,
        request.queueName,
        request.messageIds,
        request.anomalyType,
        request.actionType,
        request.parameters
      )
      
      return {
        success: response.success,
        affectedMessageIds: response.affectedMessageIds,
        summary: response.summary
      }
    },

    onSuccess: (_data: RemediationResult, variables: RemediationRequest) => {
      // Invalidate messages cache (counts may have changed)
      cacheInvalidation.invalidateMessages(variables.sessionId, '')
      
      // Invalidate AI analysis (anomalies resolved)
      queryClient.invalidateQueries({
        queryKey: ['ai-analysis', variables.sessionId]
      })
      
      // Invalidate entities (DLQ counts may have changed)
      cacheInvalidation.invalidateEntities(variables.sessionId)
    },
  })
}

/**
 * Mutation hook for bulk remediation
 * 
 * Usage:
 * ```tsx
 * const bulkRemediate = useBulkRemediationMutation()
 * 
 * await bulkRemediate.mutateAsync({
 *   sessionId,
 *   anomalyIds: ['msg-1', 'msg-2', 'msg-3'],
 *   actionType: 'move_to_dlq'
 * })
 * ```
 */
export function useBulkRemediationMutation(): UseMutationResult<
  RemediationResult,
  Error,
  BulkRemediationRequest
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: BulkRemediationRequest) => {
      const response = await apiClient.executeBulkRemediation(
        request.sessionId,
        request.queueName,
        request.anomalyIds,
        request.anomalyType,
        request.actionType,
        request.parameters
      )
      
      return {
        success: response.success,
        affectedMessageIds: response.affectedMessageIds,
        summary: response.summary
      }
    },

    onSuccess: (_data: RemediationResult, variables: BulkRemediationRequest) => {
      // Invalidate caches
      cacheInvalidation.invalidateMessages(variables.sessionId, '')
      queryClient.invalidateQueries({
        queryKey: ['ai-analysis', variables.sessionId]
      })
      cacheInvalidation.invalidateEntities(variables.sessionId)
    },
  })
}

/**
 * Mutation hook for submitting ML feedback
 * 
 * Usage:
 * ```tsx
 * const submitFeedback = useFeedbackMutation()
 * 
 * await submitFeedback.mutateAsync({
 *   sessionId,
 *   messageId: 'msg-123',
 *   anomalyType: 'DUPLICATE_FLAG',
 *   feedbackType: 'false_positive',
 *   comment: 'These are actually different orders'
 * })
 * ```
 */
export function useFeedbackMutation(): UseMutationResult<
  { success: boolean },
  Error,
  FeedbackRequest
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: FeedbackRequest) => {
      const response = await apiClient.submitFeedback(
        request.sessionId,
        request.messageId,
        request.anomalyType,
        request.feedbackType,
        request.queueName,
        request.comment
      )
      
      return { success: response.success }
    },

    onSuccess: (_data: { success: boolean }, variables: FeedbackRequest) => {
      // Invalidate AI analysis to reflect feedback
      queryClient.invalidateQueries({
        queryKey: ['ai-analysis', variables.sessionId]
      })
      
      // Invalidate feedback stats
      queryClient.invalidateQueries({
        queryKey: ['feedback-stats', variables.sessionId]
      })
    },
  })
}

/**
 * Hook for generating AI suggestions
 * 
 * Usage:
 * ```tsx
 * const generateSuggestions = useGenerateSuggestionsMutation()
 * 
 * const suggestions = await generateSuggestions.mutateAsync({
 *   sessionId,
 *   queueName: 'orders-queue'
 * })
 * ```
 */
export function useGenerateSuggestionsMutation(): UseMutationResult<
  AISuggestion[],
  Error,
  { sessionId: string; queueName: string }
> {
  return useMutation({
    mutationFn: async ({ sessionId, queueName }: { sessionId: string; queueName: string }) => {
      const response = await apiClient.generateSuggestions(sessionId, queueName)
      
      // Map API response to AISuggestion format
      return response.suggestions.map(s => ({
        id: s.id,
        title: s.title,
        description: s.description,
        actionType: s.actionType as RemediationActionType,
        confidence: s.confidence,
        estimatedImpact: s.priority === 'high' ? 'high' as const : s.priority === 'medium' ? 'medium' as const : 'low' as const,
        affectedMessageCount: s.affectedMessages.length,
        parameters: {}
      }))
    },
  })
}

/**
 * Hook for creating validation rules from anomaly patterns
 * 
 * Usage:
 * ```tsx
 * const createRule = useCreateRuleMutation()
 * 
 * await createRule.mutateAsync({
 *   sessionId,
 *   anomalyType: 'SUSPICIOUS_AMOUNT',
 *   ruleName: 'Max Order Amount',
 *   ruleDefinition: { field: 'amount', operator: '>', threshold: 10000 }
 * })
 * ```
 */
export function useCreateRuleMutation(): UseMutationResult<
  { success: boolean; ruleId: string },
  Error,
  {
    sessionId: string
    anomalyType: string
    ruleName: string
    ruleDefinition: Record<string, unknown>
  }
> {
  return useMutation({
    mutationFn: async (request: {
      sessionId: string
      anomalyType: string
      ruleName: string
      ruleDefinition: Record<string, unknown>
    }) => {
      const response = await apiClient.createRule(
        request.sessionId,
        '', // queueName - may need to add to request type
        request.anomalyType,
        request.ruleName,
        request.ruleDefinition
      )
      
      return {
        success: response.success,
        ruleId: response.ruleId
      }
    },
  })
}

/**
 * Hook for exporting anomaly report
 * 
 * Usage:
 * ```tsx
 * const exportReport = useExportReportMutation()
 * 
 * await exportReport.mutateAsync({
 *   sessionId,
 *   anomalyIds: selectedAnomalies,
 *   format: 'pdf'
 * })
 * ```
 */
export function useExportReportMutation(): UseMutationResult<
  { downloadUrl: string },
  Error,
  {
    sessionId: string
    queueName: string
    anomalyIds: string[]
    format: 'csv' | 'json' | 'pdf'
  }
> {
  return useMutation({
    mutationFn: async (request: { sessionId: string; queueName: string; anomalyIds: string[]; format: 'csv' | 'json' | 'pdf' }) => {
      const response = await apiClient.exportReport(
        request.sessionId,
        request.queueName,
        request.anomalyIds,
        request.format.toUpperCase() as 'CSV' | 'JSON' | 'PDF'
      )
      
      return {
        downloadUrl: response.downloadUrl
      }
    },
  })
}
