/**
 * AI Insights Store - Zustand State Management
 * 
 * Manages:
 * - Message clusters and patterns
 * - Outliers and anomalies
 * - Analysis results from backend AI
 * - Confidence threshold filtering
 * - Selected anomaly for detail view
 * 
 * Integrates with: Backend AI Analysis API
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { AiInsightsResult, MessageCluster, MessageOutlier } from '../types'

/**
 * Anomaly filter configuration
 */
export interface AnomalyFilter {
  minConfidence: number // 0-100
  showHighOnly: boolean
  severityFilter: ('low' | 'medium' | 'high' | 'critical')[]
  searchTerm: string
}

/**
 * Analysis status
 */
export enum AnalysisStatus {
  IDLE = 'idle',
  ANALYZING = 'analyzing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

/**
 * AI Insights store state interface
 */
export interface AIInsightsState {
  // State - Analysis Results
  activeQueueAnalysis: {
    clusters: MessageCluster[]
    outliers: MessageOutlier[]
    summary: string
    analyzedAt: string | null
    processingTimeMs: number
  } | null
  
  dlqAnalysis: {
    clusters: MessageCluster[]
    outliers: MessageOutlier[]
    summary: string
    analyzedAt: string | null
    processingTimeMs: number
  } | null
  
  // State - Filters
  anomalyFilter: AnomalyFilter
  
  // State - Selection
  selectedCluster: MessageCluster | null
  selectedOutlier: MessageOutlier | null
  
  // State - UI
  analysisStatus: AnalysisStatus
  error: string | null
  isExpanded: boolean
  
  // Actions - Analysis Results
  setAIInsights: (insights: AiInsightsResult) => void
  clearActiveAnalysis: () => void
  clearDLQAnalysis: () => void
  clearAllAnalysis: () => void
  
  // Actions - Clusters
  setClusters: (clusters: MessageCluster[], isDLQ?: boolean) => void
  selectCluster: (cluster: MessageCluster | null) => void
  
  // Actions - Outliers/Anomalies
  setOutliers: (outliers: MessageOutlier[], isDLQ?: boolean) => void
  selectOutlier: (outlier: MessageOutlier | null) => void
  
  // Actions - Filters
  setAnomalyFilter: (filter: Partial<AnomalyFilter>) => void
  setMinConfidence: (confidence: number) => void
  toggleHighConfidenceOnly: () => void
  setSeverityFilter: (severities: ('low' | 'medium' | 'high' | 'critical')[]) => void
  setSearchTerm: (term: string) => void
  clearFilters: () => void
  
  // Actions - Status
  setAnalysisStatus: (status: AnalysisStatus) => void
  setError: (error: string | null) => void
  setExpanded: (expanded: boolean) => void
  toggleExpanded: () => void
  
  // Selectors
  getFilteredClusters: (isDLQ?: boolean) => MessageCluster[]
  getFilteredOutliers: (isDLQ?: boolean) => MessageOutlier[]
  getHighConfidenceClusters: (isDLQ?: boolean) => MessageCluster[]
  getHighConfidenceOutliers: (isDLQ?: boolean) => MessageOutlier[]
  hasActiveAnalysis: () => boolean
  getTotalAnomalyCount: () => number
}

/**
 * Create AI Insights store with middleware
 */
export const useAIInsightsStore = create<AIInsightsState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      activeQueueAnalysis: null,
      dlqAnalysis: null,
      
      anomalyFilter: {
        minConfidence: 0,
        showHighOnly: false,
        severityFilter: ['low', 'medium', 'high', 'critical'],
        searchTerm: ''
      },
      
      selectedCluster: null,
      selectedOutlier: null,
      
      analysisStatus: AnalysisStatus.IDLE,
      error: null,
      isExpanded: false,

      // Analysis result actions
      setAIInsights: (insights) => {
        set((state) => {
          if (insights.activeQueueAnalysis) {
            state.activeQueueAnalysis = {
              clusters: insights.activeQueueAnalysis.clusters,
              outliers: insights.activeQueueAnalysis.outliers,
              summary: insights.summary,
              analyzedAt: insights.analyzedAt,
              processingTimeMs: insights.activeQueueAnalysis.processingTimeMs
            }
          }
          
          if (insights.dlqAnalysis) {
            state.dlqAnalysis = {
              clusters: insights.dlqAnalysis.clusters,
              outliers: insights.dlqAnalysis.outliers,
              summary: insights.summary,
              analyzedAt: insights.analyzedAt,
              processingTimeMs: insights.dlqAnalysis.processingTimeMs
            }
          }
          
          state.analysisStatus = AnalysisStatus.COMPLETED
          state.error = null
        }, false, 'ai/setAIInsights')
      },

      clearActiveAnalysis: () => {
        set((state) => {
          state.activeQueueAnalysis = null
          state.selectedCluster = null
          state.selectedOutlier = null
        }, false, 'ai/clearActiveAnalysis')
      },

      clearDLQAnalysis: () => {
        set((state) => {
          state.dlqAnalysis = null
        }, false, 'ai/clearDLQAnalysis')
      },

      clearAllAnalysis: () => {
        set((state) => {
          state.activeQueueAnalysis = null
          state.dlqAnalysis = null
          state.selectedCluster = null
          state.selectedOutlier = null
          state.analysisStatus = AnalysisStatus.IDLE
          state.error = null
        }, false, 'ai/clearAllAnalysis')
      },

      // Cluster actions
      setClusters: (clusters, isDLQ = false) => {
        set((state) => {
          const target = isDLQ ? state.dlqAnalysis : state.activeQueueAnalysis
          if (target) {
            target.clusters = clusters
          }
        }, false, 'ai/setClusters')
      },

      selectCluster: (cluster) => {
        set((state) => {
          state.selectedCluster = cluster
          // Clear outlier selection when selecting cluster
          if (cluster) {
            state.selectedOutlier = null
          }
        }, false, 'ai/selectCluster')
      },

      // Outlier actions
      setOutliers: (outliers, isDLQ = false) => {
        set((state) => {
          const target = isDLQ ? state.dlqAnalysis : state.activeQueueAnalysis
          if (target) {
            target.outliers = outliers
          }
        }, false, 'ai/setOutliers')
      },

      selectOutlier: (outlier) => {
        set((state) => {
          state.selectedOutlier = outlier
          // Clear cluster selection when selecting outlier
          if (outlier) {
            state.selectedCluster = null
          }
        }, false, 'ai/selectOutlier')
      },

      // Filter actions
      setAnomalyFilter: (filter) => {
        set((state) => {
          Object.assign(state.anomalyFilter, filter)
        }, false, 'ai/setAnomalyFilter')
      },

      setMinConfidence: (confidence) => {
        set((state) => {
          state.anomalyFilter.minConfidence = Math.max(0, Math.min(100, confidence))
        }, false, 'ai/setMinConfidence')
      },

      toggleHighConfidenceOnly: () => {
        set((state) => {
          state.anomalyFilter.showHighOnly = !state.anomalyFilter.showHighOnly
          if (state.anomalyFilter.showHighOnly) {
            state.anomalyFilter.minConfidence = 80
          } else {
            state.anomalyFilter.minConfidence = 0
          }
        }, false, 'ai/toggleHighConfidenceOnly')
      },

      setSeverityFilter: (severities) => {
        set((state) => {
          state.anomalyFilter.severityFilter = severities
        }, false, 'ai/setSeverityFilter')
      },

      setSearchTerm: (term) => {
        set((state) => {
          state.anomalyFilter.searchTerm = term
        }, false, 'ai/setSearchTerm')
      },

      clearFilters: () => {
        set((state) => {
          state.anomalyFilter = {
            minConfidence: 0,
            showHighOnly: false,
            severityFilter: ['low', 'medium', 'high', 'critical'],
            searchTerm: ''
          }
        }, false, 'ai/clearFilters')
      },

      // Status actions
      setAnalysisStatus: (status) => {
        set((state) => {
          state.analysisStatus = status
        }, false, 'ai/setAnalysisStatus')
      },

      setError: (error) => {
        set((state) => {
          state.error = error
          if (error) {
            state.analysisStatus = AnalysisStatus.ERROR
          }
        }, false, 'ai/setError')
      },

      setExpanded: (expanded) => {
        set((state) => {
          state.isExpanded = expanded
        }, false, 'ai/setExpanded')
      },

      toggleExpanded: () => {
        set((state) => {
          state.isExpanded = !state.isExpanded
        }, false, 'ai/toggleExpanded')
      },

      // Selectors
      getFilteredClusters: (isDLQ = false) => {
        const { activeQueueAnalysis, dlqAnalysis, anomalyFilter } = get()
        const analysis = isDLQ ? dlqAnalysis : activeQueueAnalysis
        
        if (!analysis) return []
        
        return analysis.clusters.filter(cluster => {
          // Confidence filter
          if (cluster.confidence < anomalyFilter.minConfidence) return false
          
          // Search term filter
          if (anomalyFilter.searchTerm) {
            const term = anomalyFilter.searchTerm.toLowerCase()
            const searchable = [
              cluster.clusterName,
              cluster.patternDescription,
              ...cluster.eventTypes
            ].join(' ').toLowerCase()
            
            if (!searchable.includes(term)) return false
          }
          
          return true
        })
      },

      getFilteredOutliers: (isDLQ = false) => {
        const { activeQueueAnalysis, dlqAnalysis, anomalyFilter } = get()
        const analysis = isDLQ ? dlqAnalysis : activeQueueAnalysis
        
        if (!analysis) return []
        
        return analysis.outliers.filter(outlier => {
          // Confidence filter (using anomalyScore as confidence)
          if (outlier.anomalyScore < anomalyFilter.minConfidence) return false
          
          // Search term filter
          if (anomalyFilter.searchTerm) {
            const term = anomalyFilter.searchTerm.toLowerCase()
            const searchable = [
              outlier.reason,
              outlier.description,
              outlier.eventType,
              outlier.source
            ].join(' ').toLowerCase()
            
            if (!searchable.includes(term)) return false
          }
          
          return true
        })
      },

      getHighConfidenceClusters: (isDLQ = false) => {
        const { activeQueueAnalysis, dlqAnalysis } = get()
        const analysis = isDLQ ? dlqAnalysis : activeQueueAnalysis
        
        if (!analysis) return []
        
        return analysis.clusters.filter(cluster => cluster.confidence >= 80)
      },

      getHighConfidenceOutliers: (isDLQ = false) => {
        const { activeQueueAnalysis, dlqAnalysis } = get()
        const analysis = isDLQ ? dlqAnalysis : activeQueueAnalysis
        
        if (!analysis) return []
        
        return analysis.outliers.filter(outlier => outlier.anomalyScore >= 80)
      },

      hasActiveAnalysis: () => {
        const { activeQueueAnalysis, dlqAnalysis } = get()
        return activeQueueAnalysis !== null || dlqAnalysis !== null
      },

      getTotalAnomalyCount: () => {
        const { activeQueueAnalysis, dlqAnalysis } = get()
        let count = 0
        
        if (activeQueueAnalysis) {
          count += activeQueueAnalysis.outliers.length
        }
        
        if (dlqAnalysis) {
          count += dlqAnalysis.outliers.length
        }
        
        return count
      }
    })),
    { name: 'AIInsightsStore' }
  )
)

/**
 * Convenience hooks for common selections
 */
export const useActiveQueueAnalysis = () => useAIInsightsStore(state => state.activeQueueAnalysis)
export const useDLQAnalysis = () => useAIInsightsStore(state => state.dlqAnalysis)
export const useAnomalyFilter = () => useAIInsightsStore(state => state.anomalyFilter)
export const useSelectedCluster = () => useAIInsightsStore(state => state.selectedCluster)
export const useSelectedOutlier = () => useAIInsightsStore(state => state.selectedOutlier)
export const useAIInsightsActions = () => useAIInsightsStore(state => ({
  setAIInsights: state.setAIInsights,
  selectCluster: state.selectCluster,
  selectOutlier: state.selectOutlier,
  setMinConfidence: state.setMinConfidence,
  toggleHighConfidenceOnly: state.toggleHighConfidenceOnly,
  clearAllAnalysis: state.clearAllAnalysis
}))
