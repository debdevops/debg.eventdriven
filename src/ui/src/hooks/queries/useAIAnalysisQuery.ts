/**
 * TanStack Query Hooks for AI Insights Analysis
 * 
 * Features:
 * - Long staleTime (AI analysis is expensive, cache aggressively)
 * - Manual refetch control (user-triggered analysis)
 * - Automatic cache invalidation after message mutations
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { queryKeys } from '../../config/queryClient'
import type { AiInsightsResult } from '../../types'

export interface AIAnalysisQueryOptions {
  sessionId: string | null
  queueName: string | null
  maxSampleSize?: number
  includeDlq?: boolean
  enabled?: boolean // Manual control over when to analyze
}

/**
 * Query hook for AI message analysis (clustering + anomaly detection)
 * 
 * Caching Strategy:
 * - staleTime: 5 minutes (AI analysis is expensive, cache aggressively)
 * - Manual refetch only (don't auto-refetch on window focus)
 * - Invalidate after message mutations
 * 
 * Usage:
 * ```tsx
 * const { 
 *   data: analysis, 
 *   isLoading, 
 *   error, 
 *   refetch: runAnalysis 
 * } = useAIAnalysisQuery({
 *   sessionId,
 *   queueName: 'orders-queue',
 *   maxSampleSize: 100,
 *   includeDlq: true,
 *   enabled: false // Don't auto-run, wait for user click
 * })
 * 
 * // User clicks "Analyze" button
 * <button onClick={() => runAnalysis()}>Analyze Messages</button>
 * ```
 */
export function useAIAnalysisQuery(
  options: AIAnalysisQueryOptions
): UseQueryResult<AiInsightsResult, Error> {
  const {
    sessionId,
    queueName,
    maxSampleSize = 100,
    includeDlq = true,
    enabled = false, // Default: don't auto-run
  } = options

  return useQuery({
    queryKey: queryKeys.aiAnalysis(
      sessionId || '',
      queueName || '',
      { maxSampleSize, includeDlq }
    ),
    queryFn: async () => {
      if (!sessionId || !queueName) {
        throw new Error('Session ID and queue name required')
      }

      return apiClient.analyzeMessages(
        sessionId,
        queueName,
        maxSampleSize,
        includeDlq
      )
    },
    enabled: !!sessionId && !!queueName && enabled,
    staleTime: 5 * 60_000, // 5 minutes - AI analysis is expensive
    gcTime: 10 * 60_000, // 10 minutes - keep results longer
    refetchOnWindowFocus: false, // Don't auto-refetch (expensive operation)
    refetchOnMount: false, // Don't auto-run on component mount
    retry: 1, // Only retry once (AI analysis can be slow)
  })
}

/**
 * Query hook for checking if AI analysis is available/ready
 * Lighter weight check before running full analysis
 * 
 * Usage:
 * ```tsx
 * const { data: isReady } = useAIAnalysisReadyQuery(sessionId, queueName)
 * 
 * if (!isReady) {
 *   return <div>AI analysis not available for this queue</div>
 * }
 * ```
 */
export function useAIAnalysisReadyQuery(
  sessionId: string | null,
  queueName: string | null
) {
  return useQuery({
    queryKey: ['ai-analysis-ready', sessionId, queueName],
    queryFn: async () => {
      // This could be a lightweight endpoint to check if analysis is possible
      // For now, just return true if we have session and queue
      return !!sessionId && !!queueName
    },
    enabled: !!sessionId && !!queueName,
    staleTime: Infinity, // Result doesn't change during session
  })
}

/**
 * Hook for accessing cached AI analysis without triggering new fetch
 * Useful for displaying results in multiple components
 * 
 * Usage:
 * ```tsx
 * // Component A runs the analysis
 * const { refetch } = useAIAnalysisQuery({ sessionId, queueName, enabled: false })
 * 
 * // Component B accesses the cached result
 * const analysis = useCachedAIAnalysis(sessionId, queueName)
 * if (analysis) {
 *   return <ClusterView clusters={analysis.activeQueueAnalysis?.clusters} />
 * }
 * ```
 */
export function useCachedAIAnalysis(
  sessionId: string | null,
  queueName: string | null,
  options?: { maxSampleSize?: number; includeDlq?: boolean }
): AiInsightsResult | undefined {
  const queryKey = queryKeys.aiAnalysis(
    sessionId || '',
    queueName || '',
    options
  )
  
  // Get cached data without triggering fetch
  const { data } = useQuery({
    queryKey,
    enabled: false, // Never fetch
    staleTime: Infinity,
  })
  
  return data as AiInsightsResult | undefined
}
