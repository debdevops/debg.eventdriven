/**
 * Unified Inspector Panel - Bottom panel for AI insights
 * Azure Portal style resizable inspector
 */

import { useMemo } from 'react'
import { AiInsightsInspector } from '@/features/anomalies/components/AiInsightsInspector'
import './UnifiedInspector.css'

export type InspectorMode = 'closed' | 'ai-insights'

interface Analysis {
  source: string
  totalMessages: number
  clusters: any[]
  outliers: any[]
  processingTimeMs: number
}

interface AiInsightsData {
  activeQueueAnalysis?: Analysis | null
  dlqAnalysis?: Analysis | null
  summary: string
  analyzedAt: string
}

interface UnifiedInspectorProps {
  mode: InspectorMode
  aiInsights?: AiInsightsData | null
  sessionId?: string
  entityName?: string
  subscriptionName?: string
  isDLQ?: boolean
  onClose: () => void
  onMessageSelect?: (message: any) => void
  onAiRefresh?: () => void
  onApplyAiPattern?: (patternId: string, label: string, messageIds: string[]) => void
}

export function UnifiedInspector({
  mode,
  aiInsights,
  sessionId,
  entityName,
  subscriptionName,
  isDLQ,
  onClose,
  onMessageSelect,
  onAiRefresh,
  onApplyAiPattern
}: UnifiedInspectorProps) {
  const title = useMemo(() => {
    if (mode === 'ai-insights') return '🤖 AI Insights'
    return 'Inspector'
  }, [mode])

  if (mode === 'closed') {
    return null
  }

  return (
    <div className="unified-inspector" role="complementary" aria-label={title}>
      <div className="inspector-header">
        <div className="inspector-title">{title}</div>
        <button onClick={onClose} className="inspector-close-btn" title="Close inspector">
          ✕
        </button>
      </div>

      <div className="inspector-content">
        {mode === 'ai-insights' && aiInsights && (
          <AiInsightsInspector
            aiInsights={aiInsights}
            sessionId={sessionId || ''}
            entityName={entityName || ''}
            subscriptionName={subscriptionName}
            isDLQ={isDLQ}
            onMessageSelect={onMessageSelect}
            onRefresh={onAiRefresh}
            onApplyAiPattern={onApplyAiPattern}
          />
        )}

        {mode === 'ai-insights' && !aiInsights && (
          <div className="inspector-empty">
            Run AI Insights to see analysis.
          </div>
        )}
      </div>
    </div>
  )
}
