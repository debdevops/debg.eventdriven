/**
 * DLQ Replay Advisor - AI-assisted classification of Dead Letter Queue messages
 * 
 * SAFETY FIRST: This is purely advisory. No auto-actions, no replay execution.
 * Classification must be explainable and respect hard constraints.
 */

import type { MessageEnvelope } from '../types'

export type DlqClassification = 'SAFE_TO_REPLAY' | 'NEEDS_INVESTIGATION' | 'DO_NOT_REPLAY'

export type RiskSignalType = 
  | 'HIGH_DELIVERY_COUNT'
  | 'OLD_MESSAGE_AGE'
  | 'SCHEMA_MISMATCH'
  | 'MISSING_REQUIRED_FIELDS'
  | 'DOWNSTREAM_FAILURE'

export interface RiskSignal {
  type: RiskSignalType
  severity: 'low' | 'medium' | 'high'
  description: string
  explanation: string
}

export interface DlqMessageClassification {
  messageId: string
  classification: DlqClassification
  confidence: number // 0-100, <60 becomes NEEDS_INVESTIGATION
  explanation: string
  evidenceFields: string[]
  riskSignals: RiskSignal[]
}

export interface DlqAdvisorAnalysis {
  totalAnalyzed: number
  classifications: DlqMessageClassification[]
  summary: {
    safe: number
    investigate: number
    doNotReplay: number
  }
  riskSummary: {
    safe: RiskSummaryPerCategory
    investigate: RiskSummaryPerCategory
    doNotReplay: RiskSummaryPerCategory
  }
  timestamp: string
  minConfidenceThreshold: number // Usually 60
}

export interface RiskSummaryPerCategory {
  totalMessages: number
  highDeliveryCount: number
  oldMessageAge: number
  schemaMismatch: number
  missingFields: number
  downstreamFailure: number
  lastFailureAge?: string // e.g. "> 45 minutes ago"
}

/**
 * Transient error patterns that suggest safe replay
 */
const TRANSIENT_PATTERNS = [
  'timeout',
  'temporarily',
  'connection',
  'unavailable',
  'disconnected',
  'no space',
  'buffer',
  'not ready',
  'throttled',
  'rate limit',
  '503',
  '502',
  '504',
  'busy',
  'retry',
  'transient'
]

/**
 * Permanent error patterns that suggest DO_NOT_REPLAY
 */
const PERMANENT_PATTERNS = [
  'schema',
  'validation',
  'invalid',
  'malformed',
  'required field',
  'unauthorized',
  'forbidden',
  'not found',
  '404',
  '401',
  '403',
  'permission',
  'denied',
  'corrupt',
  'cannot deserialize',
  'parse error'
]

function isTransientError(reason: string): boolean {
  const lower = (reason || '').toLowerCase()
  return TRANSIENT_PATTERNS.some(pattern => lower.includes(pattern))
}

function isPermanentError(reason: string): boolean {
  const lower = (reason || '').toLowerCase()
  return PERMANENT_PATTERNS.some(pattern => lower.includes(pattern))
}

/**
 * Detect risk signals for a message
 * Non-automated advisory signals to help operators assess replay risk
 */
function detectRiskSignals(message: MessageEnvelope): RiskSignal[] {
  const signals: RiskSignal[] = []

  // SIGNAL 1: High delivery count
  if (message.deliveryCount && message.deliveryCount > 3) {
    signals.push({
      type: 'HIGH_DELIVERY_COUNT',
      severity: message.deliveryCount > 7 ? 'high' : 'medium',
      description: `Message has been attempted ${message.deliveryCount} times`,
      explanation: `This message has already failed ${message.deliveryCount} delivery attempts. Replaying without fixing the underlying issue may result in repeated failures.`
    })
  }

  // SIGNAL 2: Old message age
  const enqueuedTime = new Date(message.enqueuedTimeUtc).getTime()
  const now = Date.now()
  const ageMinutes = (now - enqueuedTime) / 60000

  if (ageMinutes > 1440) { // >24 hours
    const hours = Math.round(ageMinutes / 60)
    const days = Math.round(hours / 24)
    signals.push({
      type: 'OLD_MESSAGE_AGE',
      severity: days > 7 ? 'high' : 'medium',
      description: `Message is ${days}+ days old`,
      explanation: `This message entered the DLQ ${days} days ago. The original issue may have already been resolved or the business context may have changed. Verify that replaying is still appropriate.`
    })
  }

  // SIGNAL 3: Schema mismatch (detect from error description)
  const errorDescription = (message.deadLetterErrorDescription || '').toLowerCase()
  const deadLetterReason = (message.deadLetterReason || '').toLowerCase()
  const fullError = `${deadLetterReason} ${errorDescription}`

  if (fullError.includes('schema') || fullError.includes('deserialize') || fullError.includes('parse')) {
    signals.push({
      type: 'SCHEMA_MISMATCH',
      severity: 'high',
      description: 'Possible schema validation failure',
      explanation: 'The error suggests a schema or deserialization issue. The message format may not match current system expectations. Review the message structure before replaying.'
    })
  }

  // SIGNAL 4: Missing required fields
  if (fullError.includes('required field') || fullError.includes('missing field') || fullError.includes('missing')) {
    signals.push({
      type: 'MISSING_REQUIRED_FIELDS',
      severity: 'high',
      description: 'Message appears to be missing required fields',
      explanation: 'The error indicates missing required fields. Replaying will likely fail again unless the missing data is added or the system changes.'
    })
  }

  // SIGNAL 5: Downstream dependency failure
  if (fullError.includes('service unavailable') || fullError.includes('downstream') || 
      fullError.includes('gateway') || fullError.includes('remote service')) {
    signals.push({
      type: 'DOWNSTREAM_FAILURE',
      severity: 'medium',
      description: 'Downstream service may have failed',
      explanation: 'The error suggests a downstream service dependency issue. Before replaying, verify that all downstream services are healthy and ready to process messages.'
    })
  }

  return signals
}

/**
 * Classify a single DLQ message
 * Returns classification, confidence, and evidence
 */
function classifyMessage(
  message: MessageEnvelope,
  minConfidenceThreshold: number = 60
): DlqMessageClassification {
  const evidenceFields: string[] = []
  let classification: DlqClassification = 'NEEDS_INVESTIGATION'
  let confidence = 50 // Default neutral

  const deadLetterReason = message.deadLetterReason || ''
  const errorDescription = message.deadLetterErrorDescription || ''

  // RULE 1: Analyze dead letter reason
  if (deadLetterReason) {
    evidenceFields.push('deadLetterReason')

    if (isTransientError(deadLetterReason)) {
      classification = 'SAFE_TO_REPLAY'
      confidence = 80
    } else if (isPermanentError(deadLetterReason)) {
      classification = 'DO_NOT_REPLAY'
      confidence = 85
    } else {
      // Unknown but documented
      classification = 'NEEDS_INVESTIGATION'
      confidence = 65
    }
  }

  // RULE 2: High delivery count suggests permanent issue
  if (message.deliveryCount && message.deliveryCount > 5) {
    evidenceFields.push('deliveryCount')
    if (classification === 'SAFE_TO_REPLAY') {
      confidence -= 10 // Reduce confidence if multiple retries failed
    } else if (classification !== 'DO_NOT_REPLAY') {
      classification = 'NEEDS_INVESTIGATION'
      confidence = Math.max(confidence, 70)
    }
  }

  // RULE 3: Very recent DLQ entry might be transient
  const enqueuedTime = new Date(message.enqueuedTimeUtc).getTime()
  const now = Date.now()
  const ageMinutes = (now - enqueuedTime) / 60000

  if (ageMinutes < 5 && classification === 'NEEDS_INVESTIGATION') {
    // Recent, so might be transient
    confidence = Math.min(confidence + 10, 75)
    evidenceFields.push('recentEnqueueTime')
  } else if (ageMinutes > 1440) {
    // Old message (>24h) - less likely to be transient
    if (classification === 'SAFE_TO_REPLAY') {
      confidence -= 15
    }
    evidenceFields.push('oldEnqueueTime')
  }

  // RULE 4: Error description provides additional signals
  if (errorDescription) {
    evidenceFields.push('deadLetterErrorDescription')
    const fullReason = `${deadLetterReason} ${errorDescription}`

    if (isTransientError(fullReason) && classification !== 'DO_NOT_REPLAY') {
      confidence = Math.min(confidence + 10, 85)
      if (classification === 'NEEDS_INVESTIGATION') {
        classification = 'SAFE_TO_REPLAY'
      }
    } else if (isPermanentError(fullReason) && classification !== 'SAFE_TO_REPLAY') {
      confidence = Math.min(confidence + 10, 90)
      classification = 'DO_NOT_REPLAY'
    }
  }

  // RULE 5: Apply confidence threshold
  if (confidence < minConfidenceThreshold) {
    classification = 'NEEDS_INVESTIGATION'
    confidence = Math.max(confidence, minConfidenceThreshold - 10)
  }

  // Generate explanation
  const explanation = generateExplanation(
    classification,
    confidence,
    deadLetterReason,
    message.deliveryCount,
    ageMinutes
  )

  // Detect risk signals
  const riskSignals = detectRiskSignals(message)

  return {
    messageId: message.messageId,
    classification,
    confidence: Math.round(confidence),
    explanation,
    evidenceFields,
    riskSignals
  }
}

function generateExplanation(
  classification: DlqClassification,
  confidence: number,
  reason: string,
  deliveryCount: number | undefined,
  ageMinutes: number
): string {
  const confPercent = Math.round(confidence)

  if (classification === 'SAFE_TO_REPLAY') {
    return `Likely transient error. ${confPercent}% confidence. ${reason || 'Unknown reason'}. Delivery attempts: ${deliveryCount || 0}.`
  }

  if (classification === 'DO_NOT_REPLAY') {
    return `Likely permanent error. ${confPercent}% confidence. ${reason || 'Unknown reason'}. Check data/schema before replay.`
  }

  // NEEDS_INVESTIGATION
  const ageLabel = ageMinutes < 5 ? 'recently' : ageMinutes < 60 ? 'within the last hour' : 'over an hour ago'
  return `Insufficient confidence (${confPercent}%). Recommend manual review. Message DLQ'd ${ageLabel}. Reason: ${reason || 'Not specified'}`
}

/**
 * Analyze a batch of DLQ messages
 * Returns classifications for all messages + summary
 * 
 * Safety constraint: If fewer than 5 messages, return empty (AI stays silent)
 */
export function analyzeDlqMessages(
  messages: MessageEnvelope[],
  minSampleSize: number = 5,
  minConfidenceThreshold: number = 60
): DlqAdvisorAnalysis {
  // Safety constraint: Don't advise on too-small samples
  if (messages.length < minSampleSize) {
    return {
      totalAnalyzed: 0,
      classifications: [],
      summary: { safe: 0, investigate: 0, doNotReplay: 0 },
      riskSummary: {
        safe: { totalMessages: 0, highDeliveryCount: 0, oldMessageAge: 0, schemaMismatch: 0, missingFields: 0, downstreamFailure: 0 },
        investigate: { totalMessages: 0, highDeliveryCount: 0, oldMessageAge: 0, schemaMismatch: 0, missingFields: 0, downstreamFailure: 0 },
        doNotReplay: { totalMessages: 0, highDeliveryCount: 0, oldMessageAge: 0, schemaMismatch: 0, missingFields: 0, downstreamFailure: 0 }
      },
      timestamp: new Date().toISOString(),
      minConfidenceThreshold
    }
  }

  const classifications = messages.map(msg =>
    classifyMessage(msg, minConfidenceThreshold)
  )

  const summary = {
    safe: classifications.filter(c => c.classification === 'SAFE_TO_REPLAY').length,
    investigate: classifications.filter(c => c.classification === 'NEEDS_INVESTIGATION').length,
    doNotReplay: classifications.filter(c => c.classification === 'DO_NOT_REPLAY').length
  }

  // Aggregate risk signals per classification category
  const riskSummary = aggregateRiskSignals(classifications)

  return {
    totalAnalyzed: messages.length,
    classifications,
    summary,
    riskSummary,
    timestamp: new Date().toISOString(),
    minConfidenceThreshold
  }
}

/**
 * Aggregate risk signals per classification category
 * Shows what types of risks are common in each classification group
 */
function aggregateRiskSignals(
  classifications: DlqMessageClassification[]
): {
  safe: RiskSummaryPerCategory
  investigate: RiskSummaryPerCategory
  doNotReplay: RiskSummaryPerCategory
} {
  const initCategory = (): RiskSummaryPerCategory => ({
    totalMessages: 0,
    highDeliveryCount: 0,
    oldMessageAge: 0,
    schemaMismatch: 0,
    missingFields: 0,
    downstreamFailure: 0
  })

  const riskSummary = {
    safe: initCategory(),
    investigate: initCategory(),
    doNotReplay: initCategory()
  }

  // Map classification to summary key
  const classificationToKey = (classification: DlqClassification) => {
    switch (classification) {
      case 'SAFE_TO_REPLAY': return 'safe'
      case 'NEEDS_INVESTIGATION': return 'investigate'
      case 'DO_NOT_REPLAY': return 'doNotReplay'
    }
  }

  for (const classification of classifications) {
    const key = classificationToKey(classification.classification) as keyof typeof riskSummary
    const category = riskSummary[key]
    category.totalMessages++

    for (const signal of classification.riskSignals) {
      switch (signal.type) {
        case 'HIGH_DELIVERY_COUNT':
          category.highDeliveryCount++
          break
        case 'OLD_MESSAGE_AGE':
          category.oldMessageAge++
          break
        case 'SCHEMA_MISMATCH':
          category.schemaMismatch++
          break
        case 'MISSING_REQUIRED_FIELDS':
          category.missingFields++
          break
        case 'DOWNSTREAM_FAILURE':
          category.downstreamFailure++
          break
      }
    }
  }

  return riskSummary
}

/**
 * Get message IDs for a specific classification category
 * Used for filtering grid by category
 */
export function getMessageIdsByClassification(
  analysis: DlqAdvisorAnalysis,
  classification: DlqClassification
): string[] {
  return analysis.classifications
    .filter(c => c.classification === classification)
    .map(c => c.messageId)
}
