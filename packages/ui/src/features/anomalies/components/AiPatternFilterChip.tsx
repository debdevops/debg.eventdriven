/**
 * AI Pattern Filter Chip
 * Displays active AI pattern filter with clear button
 */

import './AiPatternFilterChip.css'

interface AiPatternFilterChipProps {
  patternLabel: string
  messageCount: number
  onClear: () => void
}

export function AiPatternFilterChip({
  patternLabel,
  messageCount,
  onClear
}: AiPatternFilterChipProps) {
  return (
    <div className="ai-pattern-filter-chip">
      <span className="chip-icon">🔍</span>
      <span className="chip-text">
        AI Pattern: <strong>{patternLabel}</strong> ({messageCount} messages)
      </span>
      <button
        onClick={onClear}
        className="chip-clear-btn"
        title="Clear AI pattern filter"
        aria-label="Clear filter"
      >
        ✕
      </button>
    </div>
  )
}
