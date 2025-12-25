/**
 * Hook for anomaly detection and message analysis
 */

import { useState, useCallback, useMemo } from 'react'
import type { MessageEnvelope } from '../types'
import type {
  SuspicionAnalysis,
  AnomalyAnalysis,
  TagAnalysis,
  RiskAssessment,
  QueueMetrics,
  AiQueueInsights
} from '../types/anomaly'
import {
  analyzeMessageSuspicion,
  analyzeAndTagMessage,
  analyzeQueueMetrics,
  calculateRiskAssessment,
  generateQueueInsights
} from '../services/anomalyService'

interface AnomalyDetectionState {
  suspicionAnalyses: Map<string, SuspicionAnalysis>
  tagAnalyses: Map<string, TagAnalysis>
  riskAssessments: Map<string, RiskAssessment>
  queueAnomalies: Map<string, AnomalyAnalysis>
  queueInsights: Map<string, AiQueueInsights>
  isAnalyzing: boolean
  lastAnalyzedAt: string | null
}

interface UseAnomalyDetectionReturn {
  // State
  suspicionAnalyses: Map<string, SuspicionAnalysis>
  tagAnalyses: Map<string, TagAnalysis>
  riskAssessments: Map<string, RiskAssessment>
  queueAnomalies: Map<string, AnomalyAnalysis>
  queueInsights: Map<string, AiQueueInsights>
  isAnalyzing: boolean
  
  // Analysis functions
  analyzeMessage: (message: MessageEnvelope) => RiskAssessment
  analyzeMessages: (messages: MessageEnvelope[]) => Map<string, RiskAssessment>
  analyzeQueue: (entityId: string, entityName: string, metrics: QueueMetrics) => AnomalyAnalysis
  generateInsights: (entityId: string, entityName: string, messages: MessageEnvelope[]) => AiQueueInsights
  
  // Utility functions
  getSuspicion: (messageId: string) => SuspicionAnalysis | undefined
  getTags: (messageId: string) => TagAnalysis | undefined
  getRisk: (messageId: string) => RiskAssessment | undefined
  getQueueAnomaly: (entityId: string) => AnomalyAnalysis | undefined
  getQueueInsights: (entityId: string) => AiQueueInsights | undefined
  
  // Filtering
  getHighRiskMessages: () => string[]
  getSuspiciousMessages: () => string[]
  getMessagesByTag: (tag: string) => string[]
  
  // Stats
  stats: {
    totalAnalyzed: number
    suspiciousCount: number
    highRiskCount: number
    criticalCount: number
    healthyQueues: number
    unhealthyQueues: number
  }
  
  // Actions
  clearAnalyses: () => void
}

export function useAnomalyDetection(): UseAnomalyDetectionReturn {
  const [state, setState] = useState<AnomalyDetectionState>({
    suspicionAnalyses: new Map(),
    tagAnalyses: new Map(),
    riskAssessments: new Map(),
    queueAnomalies: new Map(),
    queueInsights: new Map(),
    isAnalyzing: false,
    lastAnalyzedAt: null
  })
  
  /**
   * Analyze a single message
   */
  const analyzeMessage = useCallback((message: MessageEnvelope): RiskAssessment => {
    const suspicion = analyzeMessageSuspicion(message)
    const tags = analyzeAndTagMessage(message, suspicion)
    const risk = calculateRiskAssessment(message, suspicion, tags)
    
    setState(prev => ({
      ...prev,
      suspicionAnalyses: new Map(prev.suspicionAnalyses).set(message.messageId, suspicion),
      tagAnalyses: new Map(prev.tagAnalyses).set(message.messageId, tags),
      riskAssessments: new Map(prev.riskAssessments).set(message.messageId, risk),
      lastAnalyzedAt: new Date().toISOString()
    }))
    
    return risk
  }, [])
  
  /**
   * Analyze multiple messages
   */
  const analyzeMessages = useCallback((messages: MessageEnvelope[]): Map<string, RiskAssessment> => {
    setState(prev => ({ ...prev, isAnalyzing: true }))
    
    const newSuspicion = new Map<string, SuspicionAnalysis>()
    const newTags = new Map<string, TagAnalysis>()
    const newRisks = new Map<string, RiskAssessment>()
    
    for (const message of messages) {
      const suspicion = analyzeMessageSuspicion(message)
      const tags = analyzeAndTagMessage(message, suspicion)
      const risk = calculateRiskAssessment(message, suspicion, tags)
      
      newSuspicion.set(message.messageId, suspicion)
      newTags.set(message.messageId, tags)
      newRisks.set(message.messageId, risk)
    }
    
    setState(prev => ({
      ...prev,
      suspicionAnalyses: new Map([...prev.suspicionAnalyses, ...newSuspicion]),
      tagAnalyses: new Map([...prev.tagAnalyses, ...newTags]),
      riskAssessments: new Map([...prev.riskAssessments, ...newRisks]),
      isAnalyzing: false,
      lastAnalyzedAt: new Date().toISOString()
    }))
    
    return newRisks
  }, [])
  
  /**
   * Analyze queue metrics
   */
  const analyzeQueue = useCallback((
    entityId: string,
    entityName: string,
    metrics: QueueMetrics
  ): AnomalyAnalysis => {
    const analysis = analyzeQueueMetrics(entityId, entityName, metrics)
    
    setState(prev => ({
      ...prev,
      queueAnomalies: new Map(prev.queueAnomalies).set(entityId, analysis)
    }))
    
    return analysis
  }, [])
  
  /**
   * Generate comprehensive insights for a queue
   */
  const generateInsights = useCallback((
    entityId: string,
    entityName: string,
    messages: MessageEnvelope[]
  ): AiQueueInsights => {
    // Ensure messages are analyzed
    analyzeMessages(messages)
    
    // Get or create anomaly analysis
    let anomalyAnalysis = state.queueAnomalies.get(entityId)
    if (!anomalyAnalysis) {
      // Create default metrics for analysis
      const metrics: QueueMetrics = {
        timestamp: Date.now(),
        queueDepth: messages.length,
        throughput: 0,
        processingLatency: 0,
        errorRate: messages.filter(m => m.deliveryCount > 1).length / Math.max(1, messages.length),
        dlqGrowthRate: 0,
        messageAge: 0,
        retryRate: 0,
        deadLetterRatio: 0
      }
      anomalyAnalysis = analyzeQueueMetrics(entityId, entityName, metrics)
    }
    
    const insights = generateQueueInsights(
      entityId,
      entityName,
      messages,
      anomalyAnalysis,
      state.tagAnalyses
    )
    
    setState(prev => ({
      ...prev,
      queueInsights: new Map(prev.queueInsights).set(entityId, insights)
    }))
    
    return insights
  }, [analyzeMessages, state.queueAnomalies, state.tagAnalyses])
  
  // Utility getters
  const getSuspicion = useCallback((messageId: string) => 
    state.suspicionAnalyses.get(messageId), [state.suspicionAnalyses])
  
  const getTags = useCallback((messageId: string) => 
    state.tagAnalyses.get(messageId), [state.tagAnalyses])
  
  const getRisk = useCallback((messageId: string) => 
    state.riskAssessments.get(messageId), [state.riskAssessments])
  
  const getQueueAnomaly = useCallback((entityId: string) => 
    state.queueAnomalies.get(entityId), [state.queueAnomalies])
  
  const getQueueInsights = useCallback((entityId: string) => 
    state.queueInsights.get(entityId), [state.queueInsights])
  
  // Filtering functions
  const getHighRiskMessages = useCallback(() => {
    const highRisk: string[] = []
    for (const [id, risk] of state.riskAssessments) {
      if (risk.category === 'high' || risk.category === 'critical') {
        highRisk.push(id)
      }
    }
    return highRisk
  }, [state.riskAssessments])
  
  const getSuspiciousMessages = useCallback(() => {
    const suspicious: string[] = []
    for (const [id, analysis] of state.suspicionAnalyses) {
      if (analysis.isSuspicious) {
        suspicious.push(id)
      }
    }
    return suspicious
  }, [state.suspicionAnalyses])
  
  const getMessagesByTag = useCallback((tag: string) => {
    const matches: string[] = []
    for (const [id, analysis] of state.tagAnalyses) {
      if (analysis.tags.some(t => t.tag === tag)) {
        matches.push(id)
      }
    }
    return matches
  }, [state.tagAnalyses])
  
  // Calculate stats
  const stats = useMemo(() => {
    let suspiciousCount = 0
    let highRiskCount = 0
    let criticalCount = 0
    
    for (const analysis of state.suspicionAnalyses.values()) {
      if (analysis.isSuspicious) suspiciousCount++
    }
    
    for (const risk of state.riskAssessments.values()) {
      if (risk.category === 'high') highRiskCount++
      if (risk.category === 'critical') criticalCount++
    }
    
    let healthyQueues = 0
    let unhealthyQueues = 0
    
    for (const anomaly of state.queueAnomalies.values()) {
      if (anomaly.overallHealth === 'healthy') healthyQueues++
      else unhealthyQueues++
    }
    
    return {
      totalAnalyzed: state.riskAssessments.size,
      suspiciousCount,
      highRiskCount,
      criticalCount,
      healthyQueues,
      unhealthyQueues
    }
  }, [state.suspicionAnalyses, state.riskAssessments, state.queueAnomalies])
  
  // Clear all analyses
  const clearAnalyses = useCallback(() => {
    setState({
      suspicionAnalyses: new Map(),
      tagAnalyses: new Map(),
      riskAssessments: new Map(),
      queueAnomalies: new Map(),
      queueInsights: new Map(),
      isAnalyzing: false,
      lastAnalyzedAt: null
    })
  }, [])
  
  return {
    suspicionAnalyses: state.suspicionAnalyses,
    tagAnalyses: state.tagAnalyses,
    riskAssessments: state.riskAssessments,
    queueAnomalies: state.queueAnomalies,
    queueInsights: state.queueInsights,
    isAnalyzing: state.isAnalyzing,
    analyzeMessage,
    analyzeMessages,
    analyzeQueue,
    generateInsights,
    getSuspicion,
    getTags,
    getRisk,
    getQueueAnomaly,
    getQueueInsights,
    getHighRiskMessages,
    getSuspiciousMessages,
    getMessagesByTag,
    stats,
    clearAnalyses
  }
}
