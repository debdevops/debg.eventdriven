/**
 * Anomaly Panel Component
 * 
 * Displays queue anomaly analysis with metrics and recommendations
 */

import type { AnomalyAnalysis, MetricAnomaly } from '../../types/anomaly'
import { HealthBadge } from './RiskBadge'

interface AnomalyPanelProps {
  analysis: AnomalyAnalysis
  onDismiss?: () => void
  className?: string
}

export function AnomalyPanel({ analysis, onDismiss, className = '' }: AnomalyPanelProps) {
  return (
    <div className={`bg-white rounded-lg border shadow-sm p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">{analysis.entityName}</h3>
          <HealthBadge health={analysis.overallHealth} />
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>
      
      {/* Primary concern */}
      {analysis.primaryConcern && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <span className="text-sm font-medium text-yellow-800">
            ⚠️ {analysis.primaryConcern}
          </span>
        </div>
      )}
      
      {/* Anomaly count summary */}
      <div className="mb-4 flex items-center gap-4">
        <div className="text-sm">
          <span className="text-gray-500">Anomalies detected: </span>
          <span className={`font-bold ${analysis.anomalyCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {analysis.anomalyCount}
          </span>
        </div>
        <div className="text-xs text-gray-400">
          Analyzed: {new Date(analysis.timestamp).toLocaleString()}
        </div>
      </div>
      
      {/* Metrics */}
      {analysis.metrics.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Metrics</h4>
          <div className="space-y-2">
            {analysis.metrics.map((metric, index) => (
              <MetricRow key={index} metric={metric} />
            ))}
          </div>
        </div>
      )}
      
      {/* Recommendations */}
      {analysis.recommendedActions && analysis.recommendedActions.length > 0 && (
        <div className="pt-3 border-t border-gray-200">
          <h4 className="text-sm font-medium mb-2">Recommended Actions</h4>
          <ul className="space-y-1">
            {analysis.recommendedActions.map((action, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-blue-500">→</span>
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function MetricRow({ metric }: { metric: MetricAnomaly }) {
  const severityColors = {
    normal: 'text-green-600 bg-green-50',
    warning: 'text-yellow-600 bg-yellow-50',
    critical: 'text-red-600 bg-red-50'
  }
  
  const trendIcons = {
    stable: '→',
    improving: '↗',
    degrading: '↘'
  }
  
  return (
    <div className={`flex items-center justify-between p-2 rounded ${severityColors[metric.severity]}`}>
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm capitalize">
          {String(metric.metric).replace(/([A-Z])/g, ' $1').trim()}
        </span>
        {metric.isAnomaly && (
          <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
            Anomaly
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-4 text-sm">
        <span>
          <span className="text-gray-500">Current: </span>
          <span className="font-mono">{formatValue(metric.currentValue)}</span>
        </span>
        <span>
          <span className="text-gray-500">Baseline: </span>
          <span className="font-mono">{formatValue(metric.baselineValue)}</span>
        </span>
        <span>
          <span className="text-gray-500">Deviation: </span>
          <span className="font-mono">{metric.deviation.toFixed(1)}%</span>
        </span>
        {metric.trend && (
          <span title={`Trend: ${metric.trend}`}>
            {trendIcons[metric.trend]}
          </span>
        )}
      </div>
    </div>
  )
}

function formatValue(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  if (value < 1 && value > 0) return value.toFixed(2)
  return value.toString()
}

/**
 * Compact version of anomaly panel for list views
 */
interface AnomalyBadgeProps {
  analysis: AnomalyAnalysis
  onClick?: () => void
}

export function AnomalyBadge({ analysis, onClick }: AnomalyBadgeProps) {
  if (analysis.anomalyCount === 0) return null
  
  const bgColor = analysis.overallHealth === 'critical' ? 'bg-red-100 border-red-300' :
                  analysis.overallHealth === 'warning' ? 'bg-yellow-100 border-yellow-300' :
                  'bg-green-100 border-green-300'
  
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded border ${bgColor} hover:opacity-80`}
    >
      <span>⚠️</span>
      <span>{analysis.anomalyCount} anomal{analysis.anomalyCount === 1 ? 'y' : 'ies'}</span>
    </button>
  )
}
