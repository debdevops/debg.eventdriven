/**
 * Insights Dashboard Component
 * 
 * Displays comprehensive AI-generated insights for a queue
 */

import { useState } from 'react'
import type { AiQueueInsights, MessageClusterInsight, RootCauseAnalysis, SmartReplayStrategy } from '../../types/anomaly'
import { TagBadge } from './MessageTags'

interface InsightsDashboardProps {
  insights: AiQueueInsights
  onStartReplay?: (strategy: SmartReplayStrategy) => void
  className?: string
}

export function InsightsDashboard({ insights, onStartReplay, className = '' }: InsightsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'clusters' | 'rootCause' | 'replay'>('overview')
  
  return (
    <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{insights.entityName} Insights</h2>
            <p className="text-sm text-gray-500">
              Analyzed: {new Date(insights.analyzedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold">{insights.healthScore}</div>
              <div className="text-xs text-gray-500">Health Score</div>
            </div>
          </div>
        </div>
        
        {/* Summary */}
        <div className="mt-3 p-3 bg-gray-50 rounded text-sm text-gray-600">
          {insights.summary}
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b">
        {(['overview', 'clusters', 'rootCause', 'replay'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'rootCause' ? 'Root Cause' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="p-4">
        {activeTab === 'overview' && (
          <OverviewTab insights={insights} />
        )}
        {activeTab === 'clusters' && (
          <ClustersTab clusters={insights.clusters} />
        )}
        {activeTab === 'rootCause' && (
          <RootCauseTab rootCause={insights.rootCause} />
        )}
        {activeTab === 'replay' && insights.replayStrategy && (
          <ReplayTab strategy={insights.replayStrategy} onStart={onStartReplay} />
        )}
        {activeTab === 'replay' && !insights.replayStrategy && (
          <div className="text-gray-500 text-sm">No replay strategy available</div>
        )}
      </div>
      
      {/* Action Priority */}
      {insights.actionPriority.length > 0 && (
        <div className="p-4 border-t bg-gray-50">
          <h4 className="text-sm font-medium mb-2">Priority Actions</h4>
          <div className="space-y-2">
            {insights.actionPriority.map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  item.priority === 'immediate' ? 'bg-red-100 text-red-700' :
                  item.priority === 'soon' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {item.priority}
                </span>
                <span>{item.action}</span>
                <span className="text-gray-400 text-xs">Impact: {item.impact}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function OverviewTab({ insights }: { insights: AiQueueInsights }) {
  return (
    <div className="space-y-6">
      {/* Queue Prediction */}
      {insights.queuePrediction && (
        <div>
          <h4 className="text-sm font-medium mb-3">Queue Prediction (Next {insights.queuePrediction.timeHorizon} min)</h4>
          <div className="grid grid-cols-3 gap-4">
            <PredictionCard
              label="Predicted Depth"
              value={insights.queuePrediction.predictedDepth}
              trend={insights.queuePrediction.trend}
            />
            <PredictionCard
              label="Error Rate"
              value={`${(insights.queuePrediction.predictedErrorRate * 100).toFixed(1)}%`}
            />
            <PredictionCard
              label="DLQ Growth"
              value={insights.queuePrediction.predictedDlqGrowth}
            />
          </div>
          {insights.queuePrediction.breachRisk.slaBreachProbability > 0.3 && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm">
              <span className="font-medium text-red-700">⚠️ SLA Breach Risk: </span>
              <span className="text-red-600">
                {(insights.queuePrediction.breachRisk.slaBreachProbability * 100).toFixed(0)}% probability
                {insights.queuePrediction.breachRisk.estimatedBreachTime && 
                  ` in ~${insights.queuePrediction.breachRisk.estimatedBreachTime} minutes`}
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* Incident Predictions */}
      {insights.incidentPredictions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3">Predicted Incidents</h4>
          <div className="space-y-2">
            {insights.incidentPredictions.map((incident, i) => (
              <div key={i} className="p-3 bg-orange-50 border border-orange-200 rounded">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-orange-800">{incident.predictedIncident}</span>
                  <span className="text-sm text-orange-600">
                    {(incident.probability * 100).toFixed(0)}% in ~{incident.estimatedTime}min
                  </span>
                </div>
                {incident.preventiveActions.length > 0 && (
                  <div className="mt-2 text-sm text-orange-700">
                    Prevent: {incident.preventiveActions.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Runbook Suggestions */}
      {insights.runbookSuggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3">Suggested Runbooks</h4>
          <div className="space-y-2">
            {insights.runbookSuggestions.map((runbook, i) => (
              <div key={i} className="p-3 border rounded">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{runbook.title}</span>
                  <span className="text-xs text-gray-500">
                    {(runbook.applicability * 100).toFixed(0)}% applicable
                  </span>
                </div>
                <ol className="mt-2 text-sm text-gray-600 list-decimal list-inside">
                  {runbook.steps.map((step, j) => (
                    <li key={j}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PredictionCard({ label, value, trend }: { label: string; value: string | number; trend?: string }) {
  const trendColors: Record<string, string> = {
    stable: 'text-green-600',
    improving: 'text-blue-600',
    degrading: 'text-red-600',
    critical: 'text-red-600'
  }
  
  return (
    <div className="p-3 bg-gray-50 rounded">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {trend && (
        <div className={`text-xs ${trendColors[trend] ?? 'text-gray-500'}`}>
          {trend}
        </div>
      )}
    </div>
  )
}

function ClustersTab({ clusters }: { clusters: MessageClusterInsight[] }) {
  if (clusters.length === 0) {
    return <div className="text-gray-500 text-sm">No message clusters detected</div>
  }
  
  return (
    <div className="space-y-4">
      {clusters.map(cluster => (
        <div key={cluster.clusterId} className="p-4 border rounded">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-medium">{cluster.name}</h5>
            <span className="text-sm text-gray-500">{cluster.messageCount} messages</span>
          </div>
          
          <p className="text-sm text-gray-600 mb-3">{cluster.description}</p>
          
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-500">Avg Risk: </span>
              <span className="font-medium">{cluster.averageRiskScore.toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Tags: </span>
              {cluster.dominantTags.map(tag => (
                <TagBadge key={tag} tag={tag} size="sm" />
              ))}
            </div>
          </div>
          
          {cluster.suggestedAction && (
            <div className="mt-3 p-2 bg-blue-50 rounded text-sm text-blue-700">
              💡 {cluster.suggestedAction}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function RootCauseTab({ rootCause }: { rootCause?: RootCauseAnalysis }) {
  if (!rootCause) {
    return <div className="text-gray-500 text-sm">Insufficient data for root cause analysis</div>
  }
  
  return (
    <div className="space-y-4">
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <h5 className="font-medium text-red-800 mb-2">Primary Cause</h5>
        <p className="text-red-700">{rootCause.primaryCause}</p>
        <div className="mt-2 flex items-center gap-4 text-sm">
          <span>
            Confidence: <strong>{(rootCause.confidence * 100).toFixed(0)}%</strong>
          </span>
          <span>
            Probability: <strong>{(rootCause.probability * 100).toFixed(0)}%</strong>
          </span>
        </div>
      </div>
      
      {rootCause.supportingEvidence.length > 0 && (
        <div>
          <h5 className="text-sm font-medium mb-2">Supporting Evidence</h5>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            {rootCause.supportingEvidence.map((evidence, i) => (
              <li key={i}>{evidence}</li>
            ))}
          </ul>
        </div>
      )}
      
      {rootCause.suggestedFixes.length > 0 && (
        <div>
          <h5 className="text-sm font-medium mb-2">Suggested Fixes</h5>
          <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
            {rootCause.suggestedFixes.map((fix, i) => (
              <li key={i}>{fix}</li>
            ))}
          </ol>
        </div>
      )}
      
      {rootCause.estimatedRecoveryTime && (
        <div className="text-sm text-gray-500">
          Estimated recovery time: ~{rootCause.estimatedRecoveryTime} minutes
        </div>
      )}
    </div>
  )
}

function ReplayTab({ 
  strategy, 
  onStart 
}: { 
  strategy: SmartReplayStrategy
  onStart?: (strategy: SmartReplayStrategy) => void 
}) {
  const riskColors: Record<string, string> = {
    low: 'text-green-600',
    medium: 'text-yellow-600',
    high: 'text-red-600'
  }
  
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total" value={strategy.totalMessages} />
        <StatCard label="Safe to Replay" value={strategy.safeToReplay} color="text-green-600" />
        <StatCard label="Needs Review" value={strategy.needsReview} color="text-yellow-600" />
        <StatCard label="Do Not Replay" value={strategy.doNotReplay} color="text-red-600" />
      </div>
      
      {/* Risk Assessment */}
      <div className={`p-3 rounded border ${
        strategy.riskAssessment.level === 'high' ? 'bg-red-50 border-red-200' :
        strategy.riskAssessment.level === 'medium' ? 'bg-yellow-50 border-yellow-200' :
        'bg-green-50 border-green-200'
      }`}>
        <div className="flex items-center gap-2">
          <span className="font-medium">Risk Level:</span>
          <span className={riskColors[strategy.riskAssessment.level]}>
            {strategy.riskAssessment.level.toUpperCase()}
          </span>
        </div>
        {strategy.riskAssessment.factors.length > 0 && (
          <ul className="mt-2 text-sm list-disc list-inside">
            {strategy.riskAssessment.factors.map((factor, i) => (
              <li key={i}>{factor}</li>
            ))}
          </ul>
        )}
      </div>
      
      {/* Recommendations */}
      <div>
        <h5 className="text-sm font-medium mb-2">Recommended Settings</h5>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-2 bg-gray-50 rounded">
            <span className="text-gray-500">Batch Size: </span>
            <span className="font-medium">{strategy.recommendedBatchSize}</span>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <span className="text-gray-500">Delay: </span>
            <span className="font-medium">{strategy.recommendedDelay}s</span>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <span className="text-gray-500">Est. Duration: </span>
            <span className="font-medium">{strategy.estimatedDuration}min</span>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <span className="text-gray-500">Monitoring: </span>
            <span className="font-medium">{strategy.monitoringIntensity}</span>
          </div>
        </div>
      </div>
      
      {/* Pre-checks */}
      {strategy.preChecks.length > 0 && (
        <div>
          <h5 className="text-sm font-medium mb-2">Pre-flight Checks</h5>
          <div className="space-y-1">
            {strategy.preChecks.map((check, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className={
                  check.status === 'pass' ? 'text-green-500' :
                  check.status === 'warning' ? 'text-yellow-500' :
                  'text-red-500'
                }>
                  {check.status === 'pass' ? '✓' : check.status === 'warning' ? '⚠' : '✕'}
                </span>
                <span>{check.check}</span>
                <span className="text-gray-400">{check.details}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Stop Conditions */}
      {strategy.stopConditions.length > 0 && (
        <div>
          <h5 className="text-sm font-medium mb-2">Auto-stop Conditions</h5>
          <ul className="text-sm text-gray-600 list-disc list-inside">
            {strategy.stopConditions.map((condition, i) => (
              <li key={i}>{condition}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Start Button */}
      {onStart && strategy.safeToReplay > 0 && (
        <button
          onClick={() => onStart(strategy)}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Start Smart Replay ({strategy.safeToReplay} messages)
        </button>
      )}
    </div>
  )
}

function StatCard({ label, value, color = '' }: { label: string; value: number; color?: string }) {
  return (
    <div className="p-3 bg-gray-50 rounded text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}
