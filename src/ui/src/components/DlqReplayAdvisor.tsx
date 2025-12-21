/**
 * DLQ Replay Advisor UI Component
 * Shows AI classification summary for DLQ messages
 * Advisory only - no auto-actions
 */

import './DlqReplayAdvisor.css'
import type { DlqAdvisorAnalysis, DlqClassification } from '../services/dlqReplayAdvisor'

interface DlqReplayAdvisorProps {
  analysis: DlqAdvisorAnalysis | null
  onFilterByCategory?: (category: DlqClassification) => void
  disabled?: boolean
}

export function DlqReplayAdvisor({
  analysis,
  onFilterByCategory,
  disabled = false
}: DlqReplayAdvisorProps) {
  if (!analysis || analysis.totalAnalyzed === 0) {
    return null
  }

  const getSafePercentage = () => {
    if (analysis.totalAnalyzed === 0) return 0
    return Math.round((analysis.summary.safe / analysis.totalAnalyzed) * 100)
  }

  const handleCategoryClick = (category: DlqClassification) => {
    if (!disabled && onFilterByCategory) {
      onFilterByCategory(category)
    }
  }

  return (
    <div className="dlq-replay-advisor">
      <div className="advisor-header">
        <h3 className="advisor-title">
          <span className="advisor-icon">🤖</span>
          AI Replay Advisor
        </h3>
        <span className="advisor-disclaimer">Advisory only - human decides</span>
      </div>

      <div className="advisor-content">
        {/* Summary Stats */}
        <div className="advisor-summary">
          <div className="summary-stat overall">
            <span className="stat-label">Analysis</span>
            <span className="stat-value">{analysis.totalAnalyzed} messages</span>
            <span className="stat-detail">min confidence {analysis.minConfidenceThreshold}%</span>
          </div>
        </div>

        {/* Category Buttons */}
        <div className="advisor-categories">
          {/* Safe to Replay */}
          <button
            className="category-btn safe-to-replay"
            onClick={() => handleCategoryClick('SAFE_TO_REPLAY')}
            disabled={disabled || analysis.summary.safe === 0}
            title={
              analysis.summary.safe === 0
                ? 'No messages in this category'
                : `Click to filter ${analysis.summary.safe} safe messages`
            }
          >
            <span className="category-icon">✅</span>
            <div className="category-info">
              <span className="category-label">Safe to Replay</span>
              <span className="category-count">{analysis.summary.safe}</span>
              {analysis.riskSummary?.safe && (
                <div className="category-risks">
                  {formatRiskIndicators(analysis.riskSummary.safe)}
                </div>
              )}
            </div>
            <span className="category-percentage">
              {getSafePercentage()}%
            </span>
          </button>

          {/* Needs Investigation */}
          <button
            className="category-btn needs-investigation"
            onClick={() => handleCategoryClick('NEEDS_INVESTIGATION')}
            disabled={disabled || analysis.summary.investigate === 0}
            title={
              analysis.summary.investigate === 0
                ? 'No messages in this category'
                : `Click to filter ${analysis.summary.investigate} messages needing review`
            }
          >
            <span className="category-icon">🔍</span>
            <div className="category-info">
              <span className="category-label">Needs Investigation</span>
              <span className="category-count">{analysis.summary.investigate}</span>
              {analysis.riskSummary?.investigate && (
                <div className="category-risks">
                  {formatRiskIndicators(analysis.riskSummary.investigate)}
                </div>
              )}
            </div>
            <span className="category-percentage">
              {analysis.totalAnalyzed > 0
                ? Math.round((analysis.summary.investigate / analysis.totalAnalyzed) * 100)
                : 0}%
            </span>
          </button>

          {/* Do Not Replay */}
          <button
            className="category-btn do-not-replay"
            onClick={() => handleCategoryClick('DO_NOT_REPLAY')}
            disabled={disabled || analysis.summary.doNotReplay === 0}
            title={
              analysis.summary.doNotReplay === 0
                ? 'No messages in this category'
                : `Click to filter ${analysis.summary.doNotReplay} messages that should not be replayed`
            }
          >
            <span className="category-icon">⛔</span>
            <div className="category-info">
              <span className="category-label">Do Not Replay</span>
              <span className="category-count">{analysis.summary.doNotReplay}</span>
              {analysis.riskSummary?.doNotReplay && (
                <div className="category-risks">
                  {formatRiskIndicators(analysis.riskSummary.doNotReplay)}
                </div>
              )}
            </div>
            <span className="category-percentage">
              {analysis.totalAnalyzed > 0
                ? Math.round((analysis.summary.doNotReplay / analysis.totalAnalyzed) * 100)
                : 0}%
            </span>
          </button>
        </div>

        {/* Disclaimer */}
        <div className="advisor-disclaimer-box">
          <span className="disclaimer-icon">⚠️</span>
          <span className="disclaimer-text">
            This is advisory guidance based on error patterns. Always review messages before replaying.
            Your decision is final.
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Format aggregated risk indicators for category button
 * Shows which risks are present in each category
 */
function formatRiskIndicators(riskSummary: {
  totalMessages: number
  highDeliveryCount: number
  oldMessageAge: number
  schemaMismatch: number
  missingFields: number
  downstreamFailure: number
}): string {
  const present = []

  if (riskSummary.highDeliveryCount > 0) present.push('🔄')
  if (riskSummary.oldMessageAge > 0) present.push('⏱️')
  if (riskSummary.schemaMismatch > 0) present.push('⚠️')
  if (riskSummary.missingFields > 0) present.push('❓')
  if (riskSummary.downstreamFailure > 0) present.push('🔗')

  return present.join(' ')
}
