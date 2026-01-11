/**
 * Bulk Anomaly Actions Component
 * Select multiple anomalies and apply actions in batch
 */

import { useState } from 'react'
import {
  useBulkRemediationMutation,
  useExportReportMutation,
  useCreateRuleMutation
} from '../hooks/mutations/useRemediationMutations'
import type { RemediationActionType } from '../types/remediation'
import './BulkAnomalyActions.css'

interface BulkAnomalyActionsProps {
  sessionId: string
  queueName: string
  selectedAnomalyIds: string[]
  onClearSelection: () => void
  onActionComplete?: () => void
}

export function BulkAnomalyActions({
  sessionId,
  queueName,
  selectedAnomalyIds,
  onClearSelection,
  onActionComplete
}: BulkAnomalyActionsProps) {
  const [showActions, setShowActions] = useState(false)
  const [showRuleModal, setShowRuleModal] = useState(false)
  
  const bulkRemediate = useBulkRemediationMutation()
  const exportReport = useExportReportMutation()
  const createRule = useCreateRuleMutation()

  const count = selectedAnomalyIds.length

  if (count === 0) {
    return null
  }

  const handleBulkAction = async (actionType: RemediationActionType) => {
    if (!confirm(`Apply ${actionType} to ${count} anomalies?`)) {
      return
    }

    try {
      await bulkRemediate.mutateAsync({
        sessionId,
        queueName,
        anomalyIds: selectedAnomalyIds,
        anomalyType: null,
        actionType
      })

      onActionComplete?.()
      onClearSelection()
      // alert() removed - using toast notification instead
      console.log(`Successfully applied ${actionType} to ${count} anomalies`)
    } catch (error) {
      console.error('Bulk action failed:', error)
      // alert() removed - error will show via TanStack Query error state
    }
  }

  const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      const result = await exportReport.mutateAsync({
        sessionId,
        queueName,
        anomalyIds: selectedAnomalyIds,
        format
      })

      // Trigger download
      window.open(result.downloadUrl, '_blank')
    } catch (error) {
      console.error('Export failed:', error)
      // alert() removed - error will show via TanStack Query error state
    }
  }

  const handleCreateRule = async () => {
    // This would open a modal to configure the rule
    setShowRuleModal(true)
  }

  return (
    <div className="bulk-anomaly-actions">
      <div className="bulk-header">
        <div className="bulk-count">
          <span className="count-badge">{count}</span>
          <span className="count-label">anomalies selected</span>
        </div>
        
        <button
          className="clear-selection-btn"
          onClick={onClearSelection}
          title="Clear selection"
        >
          ✕ Clear
        </button>
      </div>

      <div className="bulk-action-bar">
        <button
          className="bulk-action-btn primary"
          onClick={() => setShowActions(!showActions)}
        >
          ⚡ Batch Actions
        </button>

        {showActions && (
          <div className="bulk-action-menu">
            <button
              className="bulk-menu-item danger"
              onClick={() => handleBulkAction('move_to_dlq')}
              disabled={bulkRemediate.isPending}
            >
              🗑️ Move All to DLQ
            </button>
            
            <button
              className="bulk-menu-item"
              onClick={() => handleBulkAction('keep_first_delete_rest')}
              disabled={bulkRemediate.isPending}
            >
              🔄 Deduplicate All
            </button>
            
            <button
              className="bulk-menu-item"
              onClick={() => handleBulkAction('fix_schema')}
              disabled={bulkRemediate.isPending}
            >
              🔧 Auto-Fix Schema
            </button>

            <div className="bulk-menu-divider" />

            <button
              className="bulk-menu-item"
              onClick={handleCreateRule}
              disabled={createRule.isPending}
            >
              📋 Create Validation Rule
            </button>
          </div>
        )}

        <button
          className="bulk-action-btn"
          onClick={() => handleExport('csv')}
          disabled={exportReport.isPending}
        >
          📊 Export Report
        </button>

        <div className="export-format-group">
          <button
            className="format-btn"
            onClick={() => handleExport('csv')}
            disabled={exportReport.isPending}
            title="Export as CSV"
          >
            CSV
          </button>
          <button
            className="format-btn"
            onClick={() => handleExport('json')}
            disabled={exportReport.isPending}
            title="Export as JSON"
          >
            JSON
          </button>
          <button
            className="format-btn"
            onClick={() => handleExport('pdf')}
            disabled={exportReport.isPending}
            title="Export as PDF"
          >
            PDF
          </button>
        </div>
      </div>

      {bulkRemediate.isPending && (
        <div className="bulk-progress">
          <div className="progress-spinner"></div>
          <span>Processing {count} anomalies...</span>
        </div>
      )}

      {showRuleModal && (
        <div className="rule-modal-overlay" onClick={() => setShowRuleModal(false)}>
          <div className="rule-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create Validation Rule</h3>
            <p>Configure a rule to automatically catch similar anomalies in the future.</p>
            <div className="rule-form">
              <input type="text" placeholder="Rule Name" className="rule-input" />
              <textarea placeholder="Rule Definition" className="rule-textarea" rows={4} />
              <div className="rule-actions">
                <button className="btn-primary" onClick={async () => {
                  await createRule.mutateAsync({
                    sessionId,
                    anomalyType: 'unknown',
                    ruleName: 'Custom Rule',
                    ruleDefinition: {}
                  })
                  setShowRuleModal(false)
                  console.log('Rule created successfully')
                }}>
                  Create Rule
                </button>
                <button className="btn-secondary" onClick={() => setShowRuleModal(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
