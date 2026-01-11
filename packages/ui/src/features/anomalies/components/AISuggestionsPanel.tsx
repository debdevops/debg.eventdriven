/**
 * AI Suggestions Panel Component
 * Displays AI-generated remediation suggestions with confidence scores
 */

import { useState } from 'react'
import { useGenerateSuggestionsMutation, useRemediationMutation } from "@/shared/hooks/mutations/useRemediationMutations"
import type { AISuggestion } from "@/shared/types/remediation"
import './AISuggestionsPanel.css'

interface AISuggestionsPanelProps {
  sessionId: string
  queueName: string
  onApplySuggestion?: (suggestion: AISuggestion) => void
}

export function AISuggestionsPanel({
  sessionId,
  queueName,
  onApplySuggestion
}: AISuggestionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  
  const generateSuggestions = useGenerateSuggestionsMutation()
  const remediate = useRemediationMutation()

  const handleGenerate = async () => {
    try {
      const result = await generateSuggestions.mutateAsync({ sessionId, queueName })
      setSuggestions(result)
      setIsExpanded(true)
    } catch (error) {
      console.error('Failed to generate suggestions:', error)
      // Error will be shown via TanStack Query error state
    }
  }

  const handleApply = async (suggestion: AISuggestion) => {
    if (!confirm(`Apply "${suggestion.title}"?\n\nThis will affect ${suggestion.affectedMessageCount} messages.`)) {
      return
    }

    try {
      // For demo purposes, we'll just show success
      // In real implementation, this would extract messageIds from the suggestion
      onApplySuggestion?.(suggestion)
      console.log(`Successfully applied: ${suggestion.title}`)
      
      // Remove applied suggestion
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
    } catch (error) {
      console.error('Failed to apply suggestion:', error)
      // Error will be shown via TanStack Query error state
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return '#10b981'
      case 'medium': return '#f59e0b'
      case 'low': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return '#10b981'
    if (confidence >= 0.70) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div className={`ai-suggestions-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="suggestions-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-left">
          <span className="ai-icon">🤖</span>
          <h3>AI Suggestions</h3>
          {suggestions.length > 0 && (
            <span className="suggestion-count">{suggestions.length}</span>
          )}
        </div>
        <div className="header-right">
          {!isExpanded && (
            <button
              className="generate-btn-compact"
              onClick={(e) => {
                e.stopPropagation()
                handleGenerate()
              }}
              disabled={generateSuggestions.isPending}
            >
              {generateSuggestions.isPending ? '🔄 Generating...' : '✨ Generate'}
            </button>
          )}
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="suggestions-content">
          {suggestions.length === 0 ? (
            <div className="suggestions-empty">
              <div className="empty-icon">💡</div>
              <p>No suggestions yet</p>
              <button
                className="generate-btn"
                onClick={handleGenerate}
                disabled={generateSuggestions.isPending}
              >
                {generateSuggestions.isPending ? (
                  <>
                    <span className="spinner"></span>
                    Analyzing...
                  </>
                ) : (
                  <>
                    ✨ Generate AI Suggestions
                  </>
                )}
              </button>
              <div className="empty-hint">
                AI will analyze anomaly patterns and suggest optimal remediation strategies
              </div>
            </div>
          ) : (
            <div className="suggestions-list">
              {suggestions.map(suggestion => (
                <div key={suggestion.id} className="suggestion-card">
                  <div className="suggestion-header">
                    <h4>{suggestion.title}</h4>
                    <div className="suggestion-metrics">
                      <span
                        className="confidence-badge"
                        style={{ borderColor: getConfidenceColor(suggestion.confidence) }}
                        title="AI Confidence Score"
                      >
                        {Math.round(suggestion.confidence * 100)}% confident
                      </span>
                      <span
                        className="impact-badge"
                        style={{ color: getImpactColor(suggestion.estimatedImpact) }}
                        title="Estimated Impact"
                      >
                        {suggestion.estimatedImpact} impact
                      </span>
                    </div>
                  </div>

                  <p className="suggestion-description">{suggestion.description}</p>

                  <div className="suggestion-footer">
                    <span className="affected-count">
                      📊 {suggestion.affectedMessageCount} messages
                    </span>
                    <button
                      className="apply-btn"
                      onClick={() => handleApply(suggestion)}
                      disabled={remediate.isPending}
                    >
                      {remediate.isPending ? 'Applying...' : 'Apply Suggestion'}
                    </button>
                  </div>
                </div>
              ))}

              <button
                className="regenerate-btn"
                onClick={handleGenerate}
                disabled={generateSuggestions.isPending}
              >
                🔄 Regenerate Suggestions
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
