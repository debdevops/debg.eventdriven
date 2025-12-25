/**
 * Anomaly Detection and Message Quality Types
 * 
 * Comprehensive type definitions for intelligent message analysis,
 * anomaly detection, risk scoring, and AI-powered insights.
 */

import type { MessageEnvelope } from './index'

// ============================================================================
// SUSPICION DETECTION TYPES
// ============================================================================

/**
 * Flags indicating why a message is considered suspicious
 */
export interface SuspicionFlags {
  /** Message size significantly larger/smaller than normal */
  unusualSize: boolean
  /** Message frequency abnormal (burst or gap) */
  unusualFrequency: boolean
  /** Processing delay exceeds threshold */
  unusualDelay: boolean
  /** Retry count exceeds normal patterns */
  highRetryCount: boolean
  /** Invalid or unexpected encoding */
  invalidEncoding: boolean
  /** Required fields missing or malformed */
  missingFields: boolean
  /** Field values outside expected ranges */
  anomalousValues: boolean
  /** Duplicate message detected */
  duplicate: boolean
  /** Schema validation failed */
  schemaViolation: boolean
  /** Timestamp anomaly (future date, too old) */
  timestampAnomaly: boolean
}

/**
 * Confidence level for suspicion classification
 */
export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'very_high'

/**
 * Individual suspicion indicator with score
 */
export interface SuspicionIndicator {
  flag: keyof SuspicionFlags
  score: number // 0-1
  confidence: ConfidenceLevel
  reason: string
  evidence: string
  suggestedAction?: string
}

/**
 * Complete suspicion analysis for a message
 */
export interface SuspicionAnalysis {
  messageId: string
  isSuspicious: boolean
  totalScore: number // 0-1, aggregated
  confidence: ConfidenceLevel
  indicators: SuspicionIndicator[]
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical'
  analyzedAt: string
}

// ============================================================================
// ANOMALY DETECTION TYPES
// ============================================================================

/**
 * Metrics tracked for anomaly detection
 */
export interface QueueMetrics {
  timestamp: number
  queueDepth: number
  errorRate: number // 0-1
  messageAge: number // minutes
  dlqGrowthRate: number // messages per minute
  throughput: number // messages per minute
  processingLatency: number // milliseconds
  retryRate: number // 0-1
  deadLetterRatio: number // 0-1
}

/**
 * Statistical baseline for a metric
 */
export interface MetricBaseline {
  metric: keyof QueueMetrics
  mean: number
  stdDev: number
  min: number
  max: number
  p50: number
  p90: number
  p99: number
  sampleCount: number
  lastUpdated: string
  /** Time-of-day adjustments (hour -> multiplier) */
  hourlyFactors: Record<number, number>
}

/**
 * Anomaly detection result for a single metric
 */
export interface MetricAnomaly {
  metric: keyof QueueMetrics
  currentValue: number
  baselineValue: number
  zScore: number
  percentileRank: number
  deviation: number // percentage
  isAnomaly: boolean
  severity: 'normal' | 'warning' | 'critical'
  trend: 'improving' | 'stable' | 'degrading'
  predictedDuration?: number // minutes until normal
}

/**
 * Complete anomaly analysis for a queue/subscription
 */
export interface AnomalyAnalysis {
  entityId: string
  entityName: string
  entityType: 'queue' | 'subscription'
  timestamp: string
  metrics: MetricAnomaly[]
  overallHealth: 'healthy' | 'warning' | 'critical' | 'unknown'
  anomalyCount: number
  primaryConcern?: string
  predictedImpact?: string
  recommendedActions: string[]
}

// ============================================================================
// TAGGING SYSTEM TYPES
// ============================================================================

/**
 * Available tags for messages
 */
export type MessageTag =
  | 'SUSPICIOUS'
  | 'ANOMALOUS'
  | 'BAD'
  | 'QUARANTINE'
  | 'DUPLICATE'
  | 'SLOW'
  | 'TIMEOUT'
  | 'RETRY_EXHAUSTED'
  | 'SCHEMA_INVALID'
  | 'ENCODING_ERROR'
  | 'POISON'
  | 'TRANSIENT_FAILURE'
  | 'PERMANENT_FAILURE'
  | 'SAFE_TO_REPLAY'
  | 'DO_NOT_REPLAY'
  | 'NEEDS_INVESTIGATION'
  | 'SLA_BREACH'
  | 'HIGH_PRIORITY'
  | 'LOW_PRIORITY'

/**
 * Tag metadata with risk and actions
 */
export interface TagDefinition {
  tag: MessageTag
  displayName: string
  description: string
  icon: string
  color: string
  riskWeight: number // 0-1, contribution to risk score
  suggestedAction: string
  autoRemoveAfter?: number // minutes
}

/**
 * Applied tag on a message
 */
export interface AppliedTag {
  tag: MessageTag
  appliedAt: string
  appliedBy: 'system' | 'user' | 'ai'
  confidence: number // 0-1
  reason: string
  expiresAt?: string
}

/**
 * Complete tag analysis for a message
 */
export interface TagAnalysis {
  messageId: string
  tags: AppliedTag[]
  riskScore: number // 0-100
  riskCategory: 'low' | 'medium' | 'high' | 'critical'
  primaryTag?: MessageTag
  suggestedActions: string[]
  tagHistory: AppliedTag[]
}

// ============================================================================
// RISK SCORING TYPES
// ============================================================================

/**
 * Risk score breakdown
 */
export interface RiskScoreBreakdown {
  suspicionComponent: number // 0-30
  anomalyComponent: number // 0-30
  tagComponent: number // 0-20
  retryComponent: number // 0-20
  total: number // 0-100
}

/**
 * Complete risk assessment for a message
 */
export interface RiskAssessment {
  messageId: string
  score: number // 0-100
  category: 'low' | 'medium' | 'high' | 'critical'
  breakdown: RiskScoreBreakdown
  factors: string[]
  mitigations: string[]
  canReplay: boolean
  replayRisk: 'safe' | 'caution' | 'dangerous'
  assessedAt: string
}

// ============================================================================
// AI INSIGHTS TYPES
// ============================================================================

/**
 * Message cluster identified by AI
 */
export interface MessageClusterInsight {
  clusterId: string
  name: string
  description: string
  messageCount: number
  messageIds: string[]
  commonPatterns: string[]
  averageRiskScore: number
  dominantTags: MessageTag[]
  suggestedAction: string
}

/**
 * Root cause analysis result
 */
export interface RootCauseAnalysis {
  primaryCause: string
  confidence: number // 0-1
  probability: number // 0-1
  supportingEvidence: string[]
  relatedCauses: Array<{
    cause: string
    probability: number
  }>
  suggestedFixes: string[]
  estimatedRecoveryTime?: number // minutes
  historicalMatches?: number
}

/**
 * Queue behavior prediction
 */
export interface QueuePrediction {
  entityId: string
  predictedDepth: number
  predictedErrorRate: number
  predictedDlqGrowth: number
  timeHorizon: number // minutes
  confidence: number // 0-1
  trend: 'improving' | 'stable' | 'degrading' | 'critical'
  breachRisk: {
    slaBreachProbability: number
    estimatedBreachTime?: number // minutes
    affectedSlas: string[]
  }
}

/**
 * Smart replay strategy recommendation
 */
export interface SmartReplayStrategy {
  totalMessages: number
  safeToReplay: number
  needsReview: number
  doNotReplay: number
  recommendedBatchSize: number
  recommendedDelay: number // seconds between batches
  estimatedDuration: number // minutes
  monitoringIntensity: 'normal' | 'intensive' | 'critical'
  stopConditions: string[]
  riskAssessment: {
    level: 'low' | 'medium' | 'high'
    factors: string[]
  }
  preChecks: Array<{
    check: string
    status: 'pass' | 'fail' | 'warning'
    details: string
  }>
}

/**
 * Cross-queue flow impact analysis
 */
export interface FlowImpactAnalysis {
  sourceEntity: string
  affectedEntities: Array<{
    entityId: string
    entityName: string
    impactType: 'direct' | 'indirect'
    severity: 'low' | 'medium' | 'high'
    estimatedDelay: number // minutes
    messageBacklog: number
  }>
  cascadeRisk: 'none' | 'low' | 'medium' | 'high'
  recommendations: string[]
}

/**
 * Incident prediction
 */
export interface IncidentPrediction {
  predictedIncident: string
  probability: number // 0-1
  estimatedTime: number // minutes until incident
  affectedEntities: string[]
  earlyWarnings: string[]
  preventiveActions: string[]
  confidence: number // 0-1
}

/**
 * Complete AI insights for a queue/subscription
 */
export interface AiQueueInsights {
  entityId: string
  entityName: string
  analyzedAt: string
  
  // Cluster analysis
  clusters: MessageClusterInsight[]
  
  // Root cause
  rootCause?: RootCauseAnalysis
  
  // Predictions
  queuePrediction: QueuePrediction
  incidentPredictions: IncidentPrediction[]
  
  // Replay intelligence
  replayStrategy?: SmartReplayStrategy
  
  // Flow analysis
  flowImpact?: FlowImpactAnalysis
  
  // Smart suggestions
  filterSuggestions: string[]
  runbookSuggestions: Array<{
    title: string
    steps: string[]
    applicability: number // 0-1
  }>
  
  // Summary
  summary: string
  healthScore: number // 0-100
  actionPriority: Array<{
    action: string
    priority: 'immediate' | 'soon' | 'later'
    impact: 'high' | 'medium' | 'low'
  }>
}

// ============================================================================
// BASELINE & HISTORY TYPES
// ============================================================================

/**
 * Historical baseline data point
 */
export interface BaselineDataPoint {
  timestamp: number
  metrics: Partial<QueueMetrics>
}

/**
 * Baseline configuration
 */
export interface BaselineConfig {
  /** Days of history to consider */
  historyDays: number
  /** Minimum samples required */
  minSamples: number
  /** Z-score threshold for anomaly */
  anomalyThreshold: number
  /** Spike multiplier (current vs baseline) */
  spikeThreshold: number
  /** Update interval in minutes */
  updateIntervalMinutes: number
  /** Enable time-of-day adjustments */
  enableTimeOfDayAdjustment: boolean
}

/**
 * Stored baseline for an entity
 */
export interface EntityBaseline {
  entityId: string
  entityName: string
  entityType: 'queue' | 'subscription'
  baselines: Record<keyof QueueMetrics, MetricBaseline>
  dataPoints: BaselineDataPoint[]
  config: BaselineConfig
  lastUpdated: string
  version: number
}

// ============================================================================
// ANALYSIS ENGINE TYPES
// ============================================================================

/**
 * Analysis request for a message
 */
export interface MessageAnalysisRequest {
  message: MessageEnvelope
  entityId: string
  entityName: string
  includeAiInsights: boolean
  baselineData?: EntityBaseline
}

/**
 * Complete analysis result for a message
 */
export interface MessageAnalysisResult {
  messageId: string
  suspicion: SuspicionAnalysis
  tags: TagAnalysis
  risk: RiskAssessment
  relatedAnomalies?: MetricAnomaly[]
  aiInsights?: {
    cluster?: MessageClusterInsight
    rootCause?: RootCauseAnalysis
    replayAdvice?: string
  }
  analyzedAt: string
}

/**
 * Batch analysis summary
 */
export interface BatchAnalysisSummary {
  totalAnalyzed: number
  suspiciousCount: number
  anomalousCount: number
  criticalRiskCount: number
  tagDistribution: Record<MessageTag, number>
  averageRiskScore: number
  topConcerns: string[]
  recommendedActions: string[]
  processingTimeMs: number
}

// ============================================================================
// EVENT & NOTIFICATION TYPES
// ============================================================================

/**
 * Anomaly event for alerting
 */
export interface AnomalyEvent {
  eventId: string
  entityId: string
  entityName: string
  type: 'spike' | 'degradation' | 'threshold_breach' | 'prediction'
  severity: 'info' | 'warning' | 'critical'
  metric?: keyof QueueMetrics
  description: string
  detectedAt: string
  resolvedAt?: string
  acknowledged: boolean
  actions: string[]
}

/**
 * Real-time alert configuration
 */
export interface AlertConfig {
  entityId: string
  enabled: boolean
  thresholds: Partial<Record<keyof QueueMetrics, {
    warning: number
    critical: number
  }>>
  notifyOnSpike: boolean
  notifyOnPrediction: boolean
  cooldownMinutes: number
}
