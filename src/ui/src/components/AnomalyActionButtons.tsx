/**
 * Anomaly Action Buttons Component
 * Context-aware action buttons for each anomaly type
 */

import { useState } from 'react'
import { 
  getRemediationActions, 
  getSuggestedAction,
  isAutomationAvailable,
  type AnomalyType,
  type RemediationAction,
  type RemediationActionType
} from '../types/remediation'
import {
  useRemediationMutation,
  useFeedbackMutation
} from '../hooks/mutations/useRemediationMutations'
import './AnomalyActionButtons.css'

interface AnomalyActionButtonsProps {
  messageId: string
  anomalyType: AnomalyType
  sessionId: string
  queueName: string
  onActionComplete?: (actionType: RemediationActionType) => void
  compact?: boolean
}

export function AnomalyActionButtons({
  messageId,
  anomalyType,
  sessionId,
  queueName,
  onActionComplete,
  compact = false
}: AnomalyActionButtonsProps) {
  const [showActions, setShowActions] = useState(false)
  const [confirmAction, setConfirmAction] = useState<RemediationActionType | null>(null)
  
  const remediate = useRemediationMutation()
  const submitFeedback = useFeedbackMutation()
  
  const actions = getRemediationActions(anomalyType)
  const suggestedAction = getSuggestedAction(anomalyType)
  const canAutomate = isAutomationAvailable(anomalyType)

  const handleAction = async (action: RemediationAction) => {
    if (action.requiresConfirmation && confirmAction !== action.type) {
      setConfirmAction(action.type)
      return
    }

    try {
      await remediate.mutateAsync({
        sessionId,
        queueName,
        messageIds: [messageId],
        anomalyType,
        actionType: action.type
      })

      onActionComplete?.(action.type)
      setConfirmAction(null)
      setShowActions(false)
    } catch (error) {
      console.error('Remediation failed:', error)
      // Error will be shown via TanStack Query error state
    }
  }

  const handleFeedback = async (feedbackType: 'true_positive' | 'false_positive') => {
    try {
      await submitFeedback.mutateAsync({
        sessionId,
        messageId,
        anomalyType,
        feedbackType,
        queueName,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Feedback submission failed:', error)
    }
  }

  if (compact) {
    return (
      <div className="anomaly-actions-compact">
        <button
          className="action-menu-btn"
          onClick={() => setShowActions(!showActions)}
          title="Show remediation actions"
        >
          ⚡ Actions
        </button>
        
        {showActions && (
          <div className="action-dropdown">
            {actions.map(action => (
              <button
                key={action.type}
                className={`action-dropdown-item ${action.variant || 'secondary'}`}
                onClick={() => handleAction(action)}
                disabled={remediate.isPending}
                title={action.description}
              >
                <span className="action-icon">{action.icon}</span>
                <span className="action-label">{action.label}</span>
                {action.type === suggestedAction && (
                  <span className="suggested-badge">Suggested</span>
                )}
              </button>
            ))}
            
            <div className="action-dropdown-divider" />
            
            <button
              className="action-dropdown-item feedback"
              onClick={() => handleFeedback('true_positive')}
              title="Mark as correctly identified"
            >
              ✓ Correct Detection
            </button>
            
            <button
              className="action-dropdown-item feedback"
              onClick={() => handleFeedback('false_positive')}
              title="Mark as false positive"
            >
              ✗ False Positive
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="anomaly-action-buttons">
      <div className="action-header">
        <h4>Remediation Actions</h4>
        {canAutomate && (
          <span className="automation-badge" title="Automation available">
            🤖 Auto
          </span>
        )}
      </div>

      <div className="action-list">
        {actions.map(action => {
          const isSuggested = action.type === suggestedAction
          const isConfirming = confirmAction === action.type

          return (
            <div key={action.type} className="action-item">
              <button
                className={`action-btn ${action.variant || 'secondary'} ${isSuggested ? 'suggested' : ''} ${isConfirming ? 'confirming' : ''}`}
                onClick={() => handleAction(action)}
                disabled={remediate.isPending}
                title={action.description}
              >
                <span className="action-icon">{action.icon}</span>
                <span className="action-content">
                  <span className="action-label">
                    {action.label}
                    {isSuggested && <span className="badge-suggested">Recommended</span>}
                  </span>
                  <span className="action-desc">{action.description}</span>
                  {action.estimatedImpact && (
                    <span className="action-impact">💡 {action.estimatedImpact}</span>
                  )}
                </span>
              </button>

              {isConfirming && (
                <div className="confirmation-prompt">
                  <span>Are you sure?</span>
                  <button
                    className="confirm-yes"
                    onClick={() => handleAction(action)}
                    disabled={remediate.isPending}
                  >
                    {remediate.isPending ? 'Processing...' : 'Confirm'}
                  </button>
                  <button
                    className="confirm-no"
                    onClick={() => setConfirmAction(null)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="feedback-section">
        <div className="feedback-header">ML Feedback</div>
        <div className="feedback-buttons">
          <button
            className="feedback-btn positive"
            onClick={() => handleFeedback('true_positive')}
            disabled={submitFeedback.isPending}
            title="Help improve AI accuracy"
          >
            ✓ Correct
          </button>
          <button
            className="feedback-btn negative"
            onClick={() => handleFeedback('false_positive')}
            disabled={submitFeedback.isPending}
            title="Mark as false positive"
          >
            ✗ Wrong
          </button>
        </div>
        <div className="feedback-hint">
          Your feedback helps improve anomaly detection accuracy
        </div>
      </div>
    </div>
  )
}
