/**
 * Unified Inspector Panel - Bottom panel for AI insights
 * Azure Portal style resizable inspector
 */

import { useState, useRef, useEffect } from 'react'
import { AiInsightsInspector } from './AiInsightsInspector'
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
  const [height, setHeight] = useState(400)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mode === 'closed') return

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      
      const newHeight = window.innerHeight - e.clientY
      
      // Clamp between 200px and 80% of viewport
      const minHeight = 200
      const maxHeight = window.innerHeight * 0.8
      setHeight(Math.min(Math.max(newHeight, minHeight), maxHeight))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, mode])

  if (mode === 'closed') {
    return null
  }

  return (
    <div 
      ref={containerRef}
      className="unified-inspector"
      style={{ height: `${height}px` }}
    >
      <div 
        className="inspector-resize-handle"
        onMouseDown={() => setIsResizing(true)}
      >
        <div className="resize-indicator" />
      </div>

      <div className="inspector-header">
        <div className="inspector-title">🤖 AI Insights</div>
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
