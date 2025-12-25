/**
 * Anomaly Detection Service
 * 
 * Provides anomaly detection and message analysis capabilities.
 * Aligned with types defined in types/anomaly.ts
 */

import type { MessageEnvelope } from '../types'
import type {
  QueueMetrics,
  MetricAnomaly,
  AnomalyAnalysis,
  SuspicionAnalysis,
  SuspicionFlags,
  SuspicionIndicator,
  ConfidenceLevel,
  MessageTag,
  AppliedTag,
  TagAnalysis,
  RiskScoreBreakdown,
  RiskAssessment,
  MessageClusterInsight,
  RootCauseAnalysis,
  QueuePrediction,
  SmartReplayStrategy,
  IncidentPrediction,
  AiQueueInsights,
  FlowImpactAnalysis
} from '../types/anomaly'

// ============================================================================
// SUSPICION ANALYSIS
// ============================================================================

/**
 * Analyze a message for suspicious characteristics
 */
export function analyzeMessageSuspicion(
  message: MessageEnvelope,
  config?: Partial<SuspicionConfig>
): SuspicionAnalysis {
  const fullConfig = { ...DEFAULT_SUSPICION_CONFIG, ...config }
  const indicators: SuspicionIndicator[] = []
  const flags = createEmptySuspicionFlags()
  
  // Check delivery count
  if (message.deliveryCount >= fullConfig.highRetryThreshold) {
    flags.highRetryCount = true
    indicators.push({
      flag: 'highRetryCount',
      score: Math.min(1, message.deliveryCount / 10),
      confidence: 'high',
      reason: `High delivery count: ${message.deliveryCount}`,
      evidence: `Message has been delivered ${message.deliveryCount} times`,
      suggestedAction: 'Investigate why message is being rejected'
    })
  }
  
  // Check message size
  const bodySize = message.body?.length ?? 0
  if (bodySize > fullConfig.largeSizeThreshold) {
    flags.unusualSize = true
    indicators.push({
      flag: 'unusualSize',
      score: Math.min(1, bodySize / (fullConfig.largeSizeThreshold * 2)),
      confidence: 'medium',
      reason: 'Unusually large message',
      evidence: `Message size: ${(bodySize / 1024).toFixed(1)}KB`,
      suggestedAction: 'Consider compression or claim-check pattern'
    })
  }
  
  // Check if message is valid JSON when expected
  if (message.contentType?.includes('json') && message.body) {
    try {
      JSON.parse(message.body)
    } catch {
      flags.schemaViolation = true
      indicators.push({
        flag: 'schemaViolation',
        score: 0.8,
        confidence: 'high',
        reason: 'Invalid JSON body',
        evidence: 'Message body cannot be parsed as JSON',
        suggestedAction: 'Fix JSON formatting at source'
      })
    }
  }
  
  // Check message age
  const enqueuedTime = new Date(message.enqueuedTimeUtc).getTime()
  const age = Date.now() - enqueuedTime
  if (age > fullConfig.staleMessageThreshold) {
    flags.timestampAnomaly = true
    indicators.push({
      flag: 'timestampAnomaly',
      score: Math.min(1, age / (fullConfig.staleMessageThreshold * 2)),
      confidence: 'high',
      reason: 'Stale message detected',
      evidence: `Message age: ${(age / (60 * 60 * 1000)).toFixed(1)} hours`,
      suggestedAction: 'Investigate processing delays'
    })
  }
  
  // Calculate totals
  const totalScore = indicators.length > 0 
    ? indicators.reduce((sum, i) => sum + i.score, 0) / indicators.length
    : 0
  
  const severity = totalScore >= 0.8 ? 'critical' :
                   totalScore >= 0.6 ? 'high' :
                   totalScore >= 0.4 ? 'medium' :
                   totalScore >= 0.2 ? 'low' : 'none'
  
  const confidence: ConfidenceLevel = indicators.some(i => i.confidence === 'very_high') ? 'very_high' :
                                      indicators.some(i => i.confidence === 'high') ? 'high' :
                                      indicators.some(i => i.confidence === 'medium') ? 'medium' : 'low'
  
  return {
    messageId: message.messageId,
    isSuspicious: totalScore >= fullConfig.suspicionThreshold,
    totalScore,
    confidence,
    indicators,
    severity,
    analyzedAt: new Date().toISOString()
  }
}

interface SuspicionConfig {
  highRetryThreshold: number
  largeSizeThreshold: number
  staleMessageThreshold: number
  suspicionThreshold: number
}

const DEFAULT_SUSPICION_CONFIG: SuspicionConfig = {
  highRetryThreshold: 5,
  largeSizeThreshold: 50 * 1024, // 50KB
  staleMessageThreshold: 24 * 60 * 60 * 1000, // 24 hours
  suspicionThreshold: 0.4
}

function createEmptySuspicionFlags(): SuspicionFlags {
  return {
    unusualSize: false,
    unusualFrequency: false,
    unusualDelay: false,
    highRetryCount: false,
    invalidEncoding: false,
    missingFields: false,
    anomalousValues: false,
    duplicate: false,
    schemaViolation: false,
    timestampAnomaly: false
  }
}

// ============================================================================
// MESSAGE TAGGING
// ============================================================================

/**
 * Analyze and tag a message
 */
export function analyzeAndTagMessage(
  message: MessageEnvelope,
  suspicionAnalysis?: SuspicionAnalysis
): TagAnalysis {
  const tags: AppliedTag[] = []
  const now = new Date().toISOString()
  
  // Add tags based on delivery count
  if (message.deliveryCount >= 10) {
    tags.push(createTag('POISON', 'Excessive delivery count', 0.95))
  } else if (message.deliveryCount >= 5) {
    tags.push(createTag('RETRY_EXHAUSTED', `${message.deliveryCount} retries`, 0.9))
  }
  
  // Add suspicious tag if analysis indicates
  if (suspicionAnalysis?.isSuspicious) {
    tags.push(createTag('SUSPICIOUS', suspicionAnalysis.indicators[0]?.reason ?? 'Suspicious patterns detected', suspicionAnalysis.totalScore))
  }
  
  // Check for priority
  const priority = message.applicationProperties?.priority ?? message.applicationProperties?.Priority
  if (priority === 'high' || priority === 'urgent' || priority === 1) {
    tags.push(createTag('HIGH_PRIORITY', 'High priority message', 1.0))
  }
  
  // Calculate risk score
  const riskScore = calculateRiskScore(tags, message)
  const riskCategory = riskScore >= 75 ? 'critical' :
                       riskScore >= 50 ? 'high' :
                       riskScore >= 25 ? 'medium' : 'low'
  
  return {
    messageId: message.messageId,
    tags,
    riskScore,
    riskCategory,
    primaryTag: tags[0]?.tag,
    suggestedActions: generateSuggestedActions(tags),
    tagHistory: tags
  }
  
  function createTag(tag: MessageTag, reason: string, confidence: number): AppliedTag {
    return {
      tag,
      appliedAt: now,
      appliedBy: 'system',
      confidence,
      reason
    }
  }
}

function calculateRiskScore(tags: AppliedTag[], message: MessageEnvelope): number {
  let score = 0
  
  // Add score based on tags
  const tagScores: Partial<Record<MessageTag, number>> = {
    POISON: 80,
    QUARANTINE: 70,
    DO_NOT_REPLAY: 65,
    PERMANENT_FAILURE: 60,
    RETRY_EXHAUSTED: 50,
    BAD: 45,
    SCHEMA_INVALID: 40,
    SUSPICIOUS: 35,
    TIMEOUT: 30,
    ANOMALOUS: 25,
    SLA_BREACH: 25,
    SLOW: 15,
    DUPLICATE: 10,
    NEEDS_INVESTIGATION: 20
  }
  
  for (const tag of tags) {
    score = Math.max(score, (tagScores[tag.tag] ?? 0) * tag.confidence)
  }
  
  // Add score based on delivery count
  score += Math.min(20, message.deliveryCount * 2)
  
  return Math.min(100, Math.round(score))
}

function generateSuggestedActions(tags: AppliedTag[]): string[] {
  const actions: string[] = []
  
  if (tags.some(t => t.tag === 'POISON')) {
    actions.push('Do not replay - investigate root cause first')
  }
  if (tags.some(t => t.tag === 'RETRY_EXHAUSTED')) {
    actions.push('Review processing logic and retry policy')
  }
  if (tags.some(t => t.tag === 'SUSPICIOUS')) {
    actions.push('Manual review recommended before replay')
  }
  if (tags.some(t => t.tag === 'SCHEMA_INVALID')) {
    actions.push('Fix message schema before replay')
  }
  
  return actions
}

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

/**
 * Analyze queue metrics for anomalies
 */
export function analyzeQueueMetrics(
  entityId: string,
  entityName: string,
  metrics: QueueMetrics
): AnomalyAnalysis {
  const metricResults: MetricAnomaly[] = []
  
  // Simple threshold-based anomaly detection
  // In production, this would use statistical baselines
  
  // Queue depth analysis
  if (metrics.queueDepth > 1000) {
    metricResults.push({
      metric: 'queueDepth',
      currentValue: metrics.queueDepth,
      baselineValue: 100,
      zScore: (metrics.queueDepth - 100) / 50,
      percentileRank: 99,
      deviation: ((metrics.queueDepth - 100) / 100) * 100,
      isAnomaly: true,
      severity: metrics.queueDepth > 5000 ? 'critical' : 'warning',
      trend: 'degrading'
    })
  }
  
  // Error rate analysis
  if (metrics.errorRate > 0.1) {
    metricResults.push({
      metric: 'errorRate',
      currentValue: metrics.errorRate,
      baselineValue: 0.02,
      zScore: (metrics.errorRate - 0.02) / 0.05,
      percentileRank: 95,
      deviation: ((metrics.errorRate - 0.02) / 0.02) * 100,
      isAnomaly: true,
      severity: metrics.errorRate > 0.3 ? 'critical' : 'warning',
      trend: 'degrading'
    })
  }
  
  // DLQ growth analysis
  if (metrics.dlqGrowthRate > 5) {
    metricResults.push({
      metric: 'dlqGrowthRate',
      currentValue: metrics.dlqGrowthRate,
      baselineValue: 0,
      zScore: metrics.dlqGrowthRate / 2,
      percentileRank: 98,
      deviation: 100,
      isAnomaly: true,
      severity: metrics.dlqGrowthRate > 20 ? 'critical' : 'warning',
      trend: 'degrading'
    })
  }
  
  const anomalyCount = metricResults.filter(m => m.isAnomaly).length
  const criticalCount = metricResults.filter(m => m.severity === 'critical').length
  const warningCount = metricResults.filter(m => m.severity === 'warning').length
  
  const overallHealth = criticalCount > 0 ? 'critical' :
                        warningCount > 0 ? 'warning' :
                        anomalyCount > 0 ? 'warning' : 'healthy'
  
  return {
    entityId,
    entityName,
    entityType: 'queue',
    timestamp: new Date().toISOString(),
    metrics: metricResults,
    overallHealth,
    anomalyCount,
    primaryConcern: metricResults[0] 
      ? `${String(metricResults[0].metric)} anomaly detected`
      : undefined,
    recommendedActions: generateRecommendedActions(metricResults)
  }
}

function generateRecommendedActions(metrics: MetricAnomaly[]): string[] {
  const actions: string[] = []
  
  for (const metric of metrics) {
    if (metric.metric === 'queueDepth' && metric.isAnomaly) {
      actions.push('Scale up consumers to reduce backlog')
    }
    if (metric.metric === 'errorRate' && metric.isAnomaly) {
      actions.push('Investigate error patterns in consumer logs')
    }
    if (metric.metric === 'dlqGrowthRate' && metric.isAnomaly) {
      actions.push('Review dead letter queue for common failure patterns')
    }
  }
  
  return actions
}

// ============================================================================
// AI INSIGHTS
// ============================================================================

/**
 * Generate comprehensive AI insights for a queue
 */
export function generateQueueInsights(
  entityId: string,
  entityName: string,
  messages: MessageEnvelope[],
  anomalyAnalysis: AnomalyAnalysis,
  tagAnalyses: Map<string, TagAnalysis>
): AiQueueInsights {
  // Generate clusters
  const clusters = clusterMessages(messages, tagAnalyses)
  
  // Analyze root cause
  const rootCause = analyzeRootCause(messages, tagAnalyses)
  
  // Generate queue prediction
  const queuePrediction = predictQueueHealth(entityId, anomalyAnalysis)
  
  // Generate incident predictions
  const incidentPredictions = predictIncidents(anomalyAnalysis)
  
  // Generate replay strategy
  const replayStrategy = generateReplayStrategy(messages, tagAnalyses)
  
  // Flow impact
  const flowImpact = analyzeFlowImpact(entityName, anomalyAnalysis)
  
  // Calculate health score
  const healthScore = calculateHealthScore(anomalyAnalysis, clusters)
  
  // Generate summary
  const summary = generateSummary(messages.length, clusters.length, anomalyAnalysis, queuePrediction)
  
  return {
    entityId,
    entityName,
    analyzedAt: new Date().toISOString(),
    clusters,
    rootCause,
    queuePrediction,
    incidentPredictions,
    replayStrategy,
    flowImpact,
    filterSuggestions: generateFilterSuggestions(clusters, tagAnalyses),
    runbookSuggestions: generateRunbookSuggestions(anomalyAnalysis),
    summary,
    healthScore,
    actionPriority: generateActionPriority(anomalyAnalysis, rootCause, replayStrategy)
  }
}

function clusterMessages(
  messages: MessageEnvelope[],
  tagAnalyses: Map<string, TagAnalysis>
): MessageClusterInsight[] {
  const clusters: MessageClusterInsight[] = []
  
  // Group by primary tag
  const tagGroups = new Map<string, MessageEnvelope[]>()
  for (const msg of messages) {
    const analysis = tagAnalyses.get(msg.messageId)
    const primaryTag = analysis?.primaryTag ?? 'NONE'
    const group = tagGroups.get(primaryTag) ?? []
    group.push(msg)
    tagGroups.set(primaryTag, group)
  }
  
  let clusterId = 1
  for (const [tag, msgs] of tagGroups) {
    if (msgs.length >= 2) {
      const avgRisk = msgs.reduce((sum, m) => {
        const analysis = tagAnalyses.get(m.messageId)
        return sum + (analysis?.riskScore ?? 0)
      }, 0) / msgs.length
      
      clusters.push({
        clusterId: `cluster_${clusterId++}`,
        name: `${tag} Messages`,
        description: `${msgs.length} messages with ${tag} pattern`,
        messageCount: msgs.length,
        messageIds: msgs.map(m => m.messageId),
        commonPatterns: [tag],
        averageRiskScore: avgRisk,
        dominantTags: [tag as MessageTag],
        suggestedAction: getClusterAction(tag)
      })
    }
  }
  
  return clusters
}

function getClusterAction(tag: string): string {
  const actions: Record<string, string> = {
    POISON: 'Do not replay - requires root cause investigation',
    RETRY_EXHAUSTED: 'Review consumer logic before replay',
    SUSPICIOUS: 'Manual review required',
    SCHEMA_INVALID: 'Fix schema issues before replay'
  }
  return actions[tag] ?? 'Review messages before replay'
}

function analyzeRootCause(
  messages: MessageEnvelope[],
  tagAnalyses: Map<string, TagAnalysis>
): RootCauseAnalysis | undefined {
  const errorMessages = messages.filter(m => {
    const analysis = tagAnalyses.get(m.messageId)
    return analysis && analysis.riskScore >= 50
  })
  
  if (errorMessages.length < 2) return undefined
  
  // Find common patterns
  const errorTypes = new Map<string, number>()
  for (const msg of errorMessages) {
    try {
      const body = JSON.parse(msg.body || '{}')
      const errorType = body.error?.type ?? body.errorCode ?? 'unknown'
      errorTypes.set(errorType, (errorTypes.get(errorType) ?? 0) + 1)
    } catch {
      errorTypes.set('parse_error', (errorTypes.get('parse_error') ?? 0) + 1)
    }
  }
  
  // Find most common error
  let primaryCause = 'Unknown failure pattern'
  let maxCount = 0
  for (const [type, count] of errorTypes) {
    if (count > maxCount) {
      maxCount = count
      primaryCause = type
    }
  }
  
  const probability = maxCount / messages.length
  
  return {
    primaryCause,
    confidence: Math.min(0.9, 0.5 + probability * 0.4),
    probability,
    supportingEvidence: [
      `${maxCount} messages with same error pattern`,
      `Affects ${((maxCount / messages.length) * 100).toFixed(0)}% of messages`
    ],
    relatedCauses: [],
    suggestedFixes: [
      'Review error handling in consumer',
      'Check for transient vs permanent failures'
    ],
    estimatedRecoveryTime: 30
  }
}

function predictQueueHealth(
  entityId: string,
  anomalyAnalysis: AnomalyAnalysis
): QueuePrediction {
  const criticalMetrics = anomalyAnalysis.metrics.filter(m => m.severity === 'critical')
  const trend = criticalMetrics.length > 0 ? 'critical' :
                anomalyAnalysis.anomalyCount > 0 ? 'degrading' : 'stable'
  
  const depthMetric = anomalyAnalysis.metrics.find(m => m.metric === 'queueDepth')
  const errorMetric = anomalyAnalysis.metrics.find(m => m.metric === 'errorRate')
  
  return {
    entityId,
    predictedDepth: Math.round((depthMetric?.currentValue ?? 0) * 1.1),
    predictedErrorRate: (errorMetric?.currentValue ?? 0) * 1.05,
    predictedDlqGrowth: anomalyAnalysis.metrics.find(m => m.metric === 'dlqGrowthRate')?.currentValue ?? 0,
    timeHorizon: 60,
    confidence: 0.7,
    trend,
    breachRisk: {
      slaBreachProbability: criticalMetrics.length > 0 ? 0.6 : 0.2,
      estimatedBreachTime: criticalMetrics.length > 0 ? 30 : undefined,
      affectedSlas: criticalMetrics.map(m => `${String(m.metric)} SLA`)
    }
  }
}

function predictIncidents(anomalyAnalysis: AnomalyAnalysis): IncidentPrediction[] {
  const predictions: IncidentPrediction[] = []
  
  for (const metric of anomalyAnalysis.metrics) {
    if (metric.severity === 'critical') {
      predictions.push({
        predictedIncident: `${String(metric.metric)} breach`,
        probability: 0.7,
        estimatedTime: 30,
        affectedEntities: [anomalyAnalysis.entityName],
        earlyWarnings: [`${String(metric.metric)} deviating ${metric.deviation.toFixed(0)}% from baseline`],
        preventiveActions: ['Scale resources', 'Investigate root cause'],
        confidence: 0.75
      })
    }
  }
  
  return predictions
}

function generateReplayStrategy(
  messages: MessageEnvelope[],
  tagAnalyses: Map<string, TagAnalysis>
): SmartReplayStrategy {
  let safeCount = 0
  let reviewCount = 0
  let doNotReplayCount = 0
  
  for (const msg of messages) {
    const analysis = tagAnalyses.get(msg.messageId)
    if (!analysis) {
      safeCount++
    } else if (analysis.riskScore >= 60) {
      doNotReplayCount++
    } else if (analysis.riskScore >= 30) {
      reviewCount++
    } else {
      safeCount++
    }
  }
  
  return {
    totalMessages: messages.length,
    safeToReplay: safeCount,
    needsReview: reviewCount,
    doNotReplay: doNotReplayCount,
    recommendedBatchSize: Math.min(50, Math.max(10, safeCount / 5)),
    recommendedDelay: 2,
    estimatedDuration: Math.ceil(safeCount / 50) * 2,
    monitoringIntensity: doNotReplayCount > messages.length * 0.3 ? 'critical' : 'normal',
    stopConditions: ['Error rate > 10%', 'Queue depth increases 50%'],
    riskAssessment: {
      level: doNotReplayCount > messages.length * 0.3 ? 'high' :
             reviewCount > messages.length * 0.2 ? 'medium' : 'low',
      factors: doNotReplayCount > 0 ? [`${doNotReplayCount} messages cannot be replayed`] : []
    },
    preChecks: [
      { check: 'Consumer running', status: 'pass', details: 'Active' },
      { check: 'Queue healthy', status: safeCount > 0 ? 'pass' : 'warning', details: 'Ready' }
    ]
  }
}

function analyzeFlowImpact(entityName: string, anomalyAnalysis: AnomalyAnalysis): FlowImpactAnalysis {
  return {
    sourceEntity: entityName,
    affectedEntities: anomalyAnalysis.metrics
      .filter(m => m.isAnomaly)
      .map(m => ({
        entityId: `${entityName}_${String(m.metric)}`,
        entityName: String(m.metric),
        impactType: 'direct' as const,
        severity: m.severity === 'critical' ? 'high' as const : 'medium' as const,
        estimatedDelay: m.predictedDuration ?? 30,
        messageBacklog: Math.round(m.currentValue)
      })),
    cascadeRisk: anomalyAnalysis.overallHealth === 'critical' ? 'high' : 'low',
    recommendations: anomalyAnalysis.recommendedActions
  }
}

function calculateHealthScore(analysis: AnomalyAnalysis, clusters: MessageClusterInsight[]): number {
  let score = 100
  
  score -= analysis.anomalyCount * 15
  score -= analysis.metrics.filter(m => m.severity === 'critical').length * 20
  score -= clusters.filter(c => c.averageRiskScore > 50).length * 10
  
  return Math.max(0, score)
}

function generateSummary(
  messageCount: number,
  clusterCount: number,
  analysis: AnomalyAnalysis,
  prediction: QueuePrediction
): string {
  const parts = [`Analyzed ${messageCount} messages`]
  if (clusterCount > 0) parts.push(`${clusterCount} pattern clusters`)
  if (analysis.anomalyCount > 0) parts.push(`${analysis.anomalyCount} anomalies`)
  parts.push(`trend: ${prediction.trend}`)
  return parts.join(', ')
}

function generateFilterSuggestions(
  clusters: MessageClusterInsight[],
  _tagAnalyses: Map<string, TagAnalysis>
): string[] {
  const suggestions: string[] = []
  if (clusters.length > 0) {
    suggestions.push(`Filter by: ${clusters[0].name}`)
  }
  return suggestions
}

function generateRunbookSuggestions(
  analysis: AnomalyAnalysis
): Array<{ title: string; steps: string[]; applicability: number }> {
  const suggestions: Array<{ title: string; steps: string[]; applicability: number }> = []
  
  if (analysis.overallHealth === 'critical') {
    suggestions.push({
      title: 'Emergency Recovery',
      steps: ['Scale consumers', 'Enable circuit breaker', 'Monitor'],
      applicability: 0.9
    })
  }
  
  return suggestions
}

function generateActionPriority(
  analysis: AnomalyAnalysis,
  rootCause: RootCauseAnalysis | undefined,
  replayStrategy: SmartReplayStrategy
): AiQueueInsights['actionPriority'] {
  const actions: AiQueueInsights['actionPriority'] = []
  
  if (analysis.overallHealth === 'critical') {
    actions.push({ action: 'Address critical anomalies', priority: 'immediate', impact: 'high' })
  }
  if (rootCause) {
    actions.push({ action: `Fix: ${rootCause.primaryCause}`, priority: 'soon', impact: 'high' })
  }
  if (replayStrategy.safeToReplay > 0) {
    actions.push({ action: `Replay ${replayStrategy.safeToReplay} safe messages`, priority: 'later', impact: 'medium' })
  }
  
  return actions
}

// ============================================================================
// RISK ASSESSMENT
// ============================================================================

/**
 * Calculate comprehensive risk assessment for a message
 */
export function calculateRiskAssessment(
  message: MessageEnvelope,
  suspicion: SuspicionAnalysis,
  tags: TagAnalysis
): RiskAssessment {
  const breakdown: RiskScoreBreakdown = {
    suspicionComponent: Math.round(suspicion.totalScore * 30),
    anomalyComponent: 0, // Would come from anomaly analysis
    tagComponent: Math.round((tags.riskScore / 100) * 20),
    retryComponent: Math.min(20, message.deliveryCount * 2),
    total: tags.riskScore
  }
  
  const category = breakdown.total >= 75 ? 'critical' :
                   breakdown.total >= 50 ? 'high' :
                   breakdown.total >= 25 ? 'medium' : 'low'
  
  return {
    messageId: message.messageId,
    score: breakdown.total,
    category,
    breakdown,
    factors: suspicion.indicators.map(i => i.reason),
    mitigations: tags.suggestedActions,
    canReplay: category !== 'critical' && !tags.tags.some(t => t.tag === 'DO_NOT_REPLAY'),
    replayRisk: category === 'critical' ? 'dangerous' :
                category === 'high' ? 'caution' : 'safe',
    assessedAt: new Date().toISOString()
  }
}
