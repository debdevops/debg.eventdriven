/**
 * Message Tags Component
 * 
 * Displays message tags as colored badges
 */

import type { MessageTag, AppliedTag, TagAnalysis } from '../../types/anomaly'

// Tag display configuration - all MessageTag values from anomaly.ts
const TAG_CONFIG: Record<MessageTag, { color: string; icon: string; label: string }> = {
  SUSPICIOUS: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '🔍', label: 'Suspicious' },
  ANOMALOUS: { color: 'bg-purple-100 text-purple-800 border-purple-300', icon: '📊', label: 'Anomalous' },
  BAD: { color: 'bg-red-100 text-red-800 border-red-300', icon: '❌', label: 'Bad' },
  QUARANTINE: { color: 'bg-red-100 text-red-800 border-red-300', icon: '🔒', label: 'Quarantine' },
  DUPLICATE: { color: 'bg-blue-100 text-blue-800 border-blue-300', icon: '📑', label: 'Duplicate' },
  SLOW: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '🐢', label: 'Slow' },
  TIMEOUT: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '⏱️', label: 'Timeout' },
  RETRY_EXHAUSTED: { color: 'bg-orange-100 text-orange-800 border-orange-300', icon: '🔄', label: 'Retry Exhausted' },
  SCHEMA_INVALID: { color: 'bg-orange-100 text-orange-800 border-orange-300', icon: '📋', label: 'Schema Invalid' },
  ENCODING_ERROR: { color: 'bg-orange-100 text-orange-800 border-orange-300', icon: '🔤', label: 'Encoding Error' },
  POISON: { color: 'bg-red-100 text-red-800 border-red-300', icon: '☠️', label: 'Poison' },
  TRANSIENT_FAILURE: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '⚡', label: 'Transient Failure' },
  PERMANENT_FAILURE: { color: 'bg-red-100 text-red-800 border-red-300', icon: '💥', label: 'Permanent Failure' },
  SAFE_TO_REPLAY: { color: 'bg-green-100 text-green-800 border-green-300', icon: '✅', label: 'Safe to Replay' },
  DO_NOT_REPLAY: { color: 'bg-red-100 text-red-800 border-red-300', icon: '⛔', label: 'Do Not Replay' },
  NEEDS_INVESTIGATION: { color: 'bg-orange-100 text-orange-800 border-orange-300', icon: '🔎', label: 'Needs Investigation' },
  SLA_BREACH: { color: 'bg-red-100 text-red-800 border-red-300', icon: '📉', label: 'SLA Breach' },
  HIGH_PRIORITY: { color: 'bg-purple-100 text-purple-800 border-purple-300', icon: '🔥', label: 'High Priority' },
  LOW_PRIORITY: { color: 'bg-gray-100 text-gray-600 border-gray-300', icon: '📭', label: 'Low Priority' }
}

interface SingleTagProps {
  tag: MessageTag
  confidence?: number
  showConfidence?: boolean
  size?: 'sm' | 'md'
  onClick?: () => void
}

export function TagBadge({ tag, confidence, showConfidence = false, size = 'sm', onClick }: SingleTagProps) {
  const config = TAG_CONFIG[tag]
  if (!config) return null
  
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'
  
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded border ${config.color} ${sizeClasses} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
      {showConfidence && confidence !== undefined && (
        <span className="opacity-60">({Math.round(confidence * 100)}%)</span>
      )}
    </span>
  )
}

interface MessageTagsProps {
  tags: AppliedTag[]
  maxVisible?: number
  showConfidence?: boolean
  size?: 'sm' | 'md'
  onTagClick?: (tag: MessageTag) => void
}

export function MessageTags({ 
  tags, 
  maxVisible = 3, 
  showConfidence = false, 
  size = 'sm',
  onTagClick 
}: MessageTagsProps) {
  if (!tags || tags.length === 0) return null
  
  const visibleTags = tags.slice(0, maxVisible)
  const remainingCount = tags.length - maxVisible
  
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visibleTags.map((appliedTag, index) => (
        <TagBadge
          key={`${appliedTag.tag}-${index}`}
          tag={appliedTag.tag}
          confidence={appliedTag.confidence}
          showConfidence={showConfidence}
          size={size}
          onClick={onTagClick ? () => onTagClick(appliedTag.tag) : undefined}
        />
      ))}
      {remainingCount > 0 && (
        <span className="text-xs text-gray-500">+{remainingCount} more</span>
      )}
    </div>
  )
}

interface TagAnalysisDisplayProps {
  analysis: TagAnalysis
  showActions?: boolean
  className?: string
}

export function TagAnalysisDisplay({ analysis, showActions = false, className = '' }: TagAnalysisDisplayProps) {
  const riskColors = {
    low: 'text-green-600',
    medium: 'text-yellow-600',
    high: 'text-orange-600',
    critical: 'text-red-600'
  }
  
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Tags</span>
        <span className={`text-sm font-bold ${riskColors[analysis.riskCategory]}`}>
          Risk: {analysis.riskScore}%
        </span>
      </div>
      
      <MessageTags tags={analysis.tags} showConfidence />
      
      {showActions && analysis.suggestedActions.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <span className="text-xs font-medium text-gray-600">Suggested Actions:</span>
          <ul className="mt-1 text-xs text-gray-600 list-disc list-inside">
            {analysis.suggestedActions.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
