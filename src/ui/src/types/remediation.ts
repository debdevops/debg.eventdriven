/**
 * AI Insights Remediation Types
 * Defines actions and feedback for anomaly remediation
 */

export type AnomalyType = 
  | 'HIGH_RETRY_COUNT'
  | 'DUPLICATE_FLAG'
  | 'SUSPICIOUS_AMOUNT'
  | 'MALFORMED_PAYLOAD'
  | 'TIMESTAMP_ANOMALY'
  | 'MISSING_FIELD'
  | 'INVALID_VALUE'
  | 'TYPE_MISMATCH'
  | 'unknown'

export type RemediationActionType =
  // HIGH_RETRY_COUNT actions
  | 'move_to_dlq'
  | 'view_retry_history'
  | 'adjust_retry_policy'
  // DUPLICATE_FLAG actions
  | 'keep_first_delete_rest'
  | 'compare_versions'
  | 'mark_non_duplicate'
  // SUSPICIOUS_AMOUNT actions
  | 'flag_for_review'
  | 'apply_validation_rule'
  | 'view_similar'
  // MALFORMED_PAYLOAD actions
  | 'fix_schema'
  | 'transform_resubmit'
  | 'view_raw'
  // TIMESTAMP_ANOMALY actions
  | 'adjust_timestamp'
  | 'reorder_messages'
  | 'ignore_future'
  // Bulk actions
  | 'batch_fix'
  | 'export_report'
  | 'create_rule'

export type FeedbackType = 'true_positive' | 'false_positive' | 'uncertain'

export interface RemediationAction {
  type: RemediationActionType
  label: string
  description: string
  icon?: string
  variant?: 'primary' | 'secondary' | 'danger' | 'warning'
  requiresConfirmation?: boolean
  estimatedImpact?: string
}

export interface AnomalyRemediationConfig {
  anomalyType: AnomalyType
  actions: RemediationAction[]
  suggestedAction?: RemediationActionType
  automationAvailable?: boolean
}

export interface RemediationRequest {
  sessionId: string
  queueName: string
  messageIds: string[]
  anomalyType: AnomalyType
  actionType: RemediationActionType
  parameters?: Record<string, unknown>
}

export interface RemediationResult {
  success: boolean
  affectedMessageIds: string[]
  errors?: string[]
  summary: string
}

export interface FeedbackRequest {
  sessionId: string
  messageId: string
  anomalyType: AnomalyType
  feedbackType: FeedbackType
  queueName?: string
  comment?: string
  timestamp: string
}

export interface FeedbackStats {
  totalFeedback: number
  truePositives: number
  falsePositives: number
  accuracy: number
  lastUpdated: string
}

export interface AISuggestion {
  id: string
  title: string
  description: string
  actionType: RemediationActionType
  confidence: number
  estimatedImpact: 'low' | 'medium' | 'high'
  affectedMessageCount: number
  parameters?: Record<string, unknown>
}

export interface BulkRemediationRequest {
  sessionId: string
  queueName: string
  anomalyIds: string[]
  anomalyType: AnomalyType | null
  actionType: RemediationActionType
  parameters?: Record<string, unknown>
}

/**
 * Remediation action configurations by anomaly type
 */
export const REMEDIATION_CONFIGS: Record<AnomalyType, AnomalyRemediationConfig> = {
  HIGH_RETRY_COUNT: {
    anomalyType: 'HIGH_RETRY_COUNT',
    suggestedAction: 'move_to_dlq',
    automationAvailable: true,
    actions: [
      {
        type: 'move_to_dlq',
        label: 'Move to DLQ',
        description: 'Permanently move message to Dead Letter Queue',
        icon: '🗑️',
        variant: 'danger',
        requiresConfirmation: true,
        estimatedImpact: 'Stops retry attempts, preserves message for analysis'
      },
      {
        type: 'view_retry_history',
        label: 'View Retry History',
        description: 'Show timeline of all retry attempts',
        icon: '📊',
        variant: 'secondary'
      },
      {
        type: 'adjust_retry_policy',
        label: 'Adjust Retry Policy',
        description: 'Configure retry behavior for similar messages',
        icon: '⚙️',
        variant: 'primary'
      }
    ]
  },
  DUPLICATE_FLAG: {
    anomalyType: 'DUPLICATE_FLAG',
    suggestedAction: 'keep_first_delete_rest',
    automationAvailable: true,
    actions: [
      {
        type: 'keep_first_delete_rest',
        label: 'Keep First, Delete Rest',
        description: 'Automatically dedup by keeping earliest message',
        icon: '🔄',
        variant: 'primary',
        requiresConfirmation: true,
        estimatedImpact: 'Removes duplicate messages, keeps original'
      },
      {
        type: 'compare_versions',
        label: 'Compare Versions',
        description: 'Show diff between duplicate messages',
        icon: '🔍',
        variant: 'secondary'
      },
      {
        type: 'mark_non_duplicate',
        label: 'Mark as Non-Duplicate',
        description: 'Flag this as false positive to improve AI',
        icon: '✓',
        variant: 'secondary'
      }
    ]
  },
  SUSPICIOUS_AMOUNT: {
    anomalyType: 'SUSPICIOUS_AMOUNT',
    suggestedAction: 'flag_for_review',
    automationAvailable: false,
    actions: [
      {
        type: 'flag_for_review',
        label: 'Flag for Review',
        description: 'Add to manual review queue for investigation',
        icon: '🚩',
        variant: 'warning',
        estimatedImpact: 'Requires manual approval before processing'
      },
      {
        type: 'apply_validation_rule',
        label: 'Create Validation Rule',
        description: 'Define rule to catch similar anomalies',
        icon: '📋',
        variant: 'primary'
      },
      {
        type: 'view_similar',
        label: 'View Similar',
        description: 'Find other messages with suspicious amounts',
        icon: '🔎',
        variant: 'secondary'
      }
    ]
  },
  MALFORMED_PAYLOAD: {
    anomalyType: 'MALFORMED_PAYLOAD',
    suggestedAction: 'fix_schema',
    automationAvailable: true,
    actions: [
      {
        type: 'fix_schema',
        label: 'Auto-Fix Schema',
        description: 'Attempt automatic correction of common issues',
        icon: '🔧',
        variant: 'primary',
        estimatedImpact: 'Fixes common schema violations automatically'
      },
      {
        type: 'transform_resubmit',
        label: 'Transform & Resubmit',
        description: 'Apply custom transformer and resend',
        icon: '🔄',
        variant: 'primary',
        requiresConfirmation: true
      },
      {
        type: 'view_raw',
        label: 'View Raw Data',
        description: 'Inspect malformed payload in detail',
        icon: '📄',
        variant: 'secondary'
      }
    ]
  },
  TIMESTAMP_ANOMALY: {
    anomalyType: 'TIMESTAMP_ANOMALY',
    suggestedAction: 'adjust_timestamp',
    automationAvailable: true,
    actions: [
      {
        type: 'adjust_timestamp',
        label: 'Adjust Timestamp',
        description: 'Correct time drift or timezone issues',
        icon: '🕐',
        variant: 'primary',
        estimatedImpact: 'Updates timestamp to correct value'
      },
      {
        type: 'reorder_messages',
        label: 'Reorder Messages',
        description: 'Fix message sequence based on corrected time',
        icon: '↕️',
        variant: 'warning',
        requiresConfirmation: true
      },
      {
        type: 'ignore_future',
        label: 'Whitelist Pattern',
        description: 'Stop flagging this timestamp pattern',
        icon: '✓',
        variant: 'secondary'
      }
    ]
  },
  MISSING_FIELD: {
    anomalyType: 'MISSING_FIELD',
    automationAvailable: false,
    actions: [
      {
        type: 'fix_schema',
        label: 'Add Default Value',
        description: 'Fill missing field with default',
        icon: '➕',
        variant: 'primary'
      },
      {
        type: 'move_to_dlq',
        label: 'Move to DLQ',
        description: 'Invalid message, cannot process',
        icon: '🗑️',
        variant: 'danger',
        requiresConfirmation: true
      }
    ]
  },
  INVALID_VALUE: {
    anomalyType: 'INVALID_VALUE',
    automationAvailable: false,
    actions: [
      {
        type: 'fix_schema',
        label: 'Coerce to Valid Type',
        description: 'Attempt type conversion',
        icon: '🔄',
        variant: 'primary'
      },
      {
        type: 'flag_for_review',
        label: 'Flag for Review',
        description: 'Requires manual validation',
        icon: '🚩',
        variant: 'warning'
      }
    ]
  },
  TYPE_MISMATCH: {
    anomalyType: 'TYPE_MISMATCH',
    automationAvailable: true,
    actions: [
      {
        type: 'fix_schema',
        label: 'Convert Type',
        description: 'Auto-convert to expected type',
        icon: '🔄',
        variant: 'primary',
        estimatedImpact: 'Converts value to correct type if possible'
      },
      {
        type: 'move_to_dlq',
        label: 'Move to DLQ',
        description: 'Cannot safely convert',
        icon: '🗑️',
        variant: 'danger',
        requiresConfirmation: true
      }
    ]
  },
  unknown: {
    anomalyType: 'unknown',
    automationAvailable: false,
    actions: [
      {
        type: 'flag_for_review',
        label: 'Flag for Review',
        description: 'Manual investigation required',
        icon: '🚩',
        variant: 'warning'
      }
    ]
  }
}

/**
 * Get remediation actions for a specific anomaly type
 */
export function getRemediationActions(anomalyType: AnomalyType): RemediationAction[] {
  const config = REMEDIATION_CONFIGS[anomalyType] || REMEDIATION_CONFIGS.unknown
  return config.actions
}

/**
 * Get suggested action for an anomaly type
 */
export function getSuggestedAction(anomalyType: AnomalyType): RemediationActionType | undefined {
  const config = REMEDIATION_CONFIGS[anomalyType]
  return config?.suggestedAction
}

/**
 * Check if automation is available for an anomaly type
 */
export function isAutomationAvailable(anomalyType: AnomalyType): boolean {
  const config = REMEDIATION_CONFIGS[anomalyType]
  return config?.automationAvailable || false
}
