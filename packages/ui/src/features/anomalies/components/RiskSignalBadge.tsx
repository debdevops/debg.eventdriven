import React, { useState } from 'react'
import type { RiskSignal, RiskSignalType } from "@/shared/lib/services/dlqReplayAdvisor"

interface RiskSignalBadgeProps {
  signal: RiskSignal
  onDismiss?: () => void
}

const RISK_ICONS: Record<RiskSignalType, string> = {
  HIGH_DELIVERY_COUNT: '🔄',
  OLD_MESSAGE_AGE: '⏱️',
  SCHEMA_MISMATCH: '⚠️',
  MISSING_REQUIRED_FIELDS: '❓',
  DOWNSTREAM_FAILURE: '🔗'
}

const SEVERITY_COLORS = {
  low: 'bg-blue-100 text-blue-800 border-blue-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  high: 'bg-red-100 text-red-800 border-red-300'
}

/**
 * RiskSignalBadge: Displays a single risk signal with icon, description, and tooltip
 * Includes optional dismiss button for non-critical signals
 */
export const RiskSignalBadge: React.FC<RiskSignalBadgeProps> = ({ signal, onDismiss }) => {
  const [showExplanation, setShowExplanation] = useState(false)

  const colorClass = SEVERITY_COLORS[signal.severity]
  const icon = RISK_ICONS[signal.type]

  return (
    <div className="relative inline-block">
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded transition-all cursor-help ${colorClass}`}
        onMouseEnter={() => setShowExplanation(true)}
        onMouseLeave={() => setShowExplanation(false)}
        role="tooltip"
        aria-label={`Risk: ${signal.description}`}
      >
        <span className="text-sm">{icon}</span>
        <span>{signal.description}</span>
        {onDismiss && signal.severity === 'low' && (
          <button
            onClick={onDismiss}
            className="ml-1 hover:opacity-70 transition-opacity"
            aria-label="Dismiss"
            title="Dismiss this signal"
          >
            ✕
          </button>
        )}
      </div>

      {/* Tooltip with full explanation */}
      {showExplanation && (
        <div className="absolute z-50 left-0 top-full mt-1 bg-gray-900 text-white text-xs rounded shadow-lg p-2 w-48 pointer-events-none">
          <div className="font-semibold mb-1">{signal.description}</div>
          <div className="text-gray-200">{signal.explanation}</div>
        </div>
      )}
    </div>
  )
}

interface RiskSignalGroupProps {
  signals: RiskSignal[]
  maxDisplay?: number
  onDismiss?: (signal: RiskSignal) => void
}

/**
 * RiskSignalGroup: Displays multiple risk signals with optional collapse
 */
export const RiskSignalGroup: React.FC<RiskSignalGroupProps> = ({
  signals,
  maxDisplay = 3,
  onDismiss
}) => {
  const [showAll, setShowAll] = useState(false)

  if (signals.length === 0) {
    return null
  }

  const displayed = showAll ? signals : signals.slice(0, maxDisplay)
  const hasMore = signals.length > maxDisplay

  return (
    <div className="flex flex-wrap gap-1.5">
      {displayed.map((signal, idx) => (
        <RiskSignalBadge
          key={idx}
          signal={signal}
          onDismiss={onDismiss ? () => onDismiss(signal) : undefined}
        />
      ))}
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          title={`Show ${signals.length - maxDisplay} more risks`}
        >
          +{signals.length - maxDisplay}
        </button>
      )}
      {showAll && hasMore && (
        <button
          onClick={() => setShowAll(false)}
          className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
        >
          Hide
        </button>
      )}
    </div>
  )
}
