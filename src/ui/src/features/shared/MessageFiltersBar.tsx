import './MessageFiltersBar.css'

export function MessageFiltersBar({
  searchTerm,
  correlationFilter,
  eventTypeFilter,
  disabled,
  onSearchTermChange,
  onClearSearchTerm,
  onCorrelationFilterChange,
  onClearCorrelationFilter,
  onEventTypeFilterChange,
  onClearEventTypeFilter,
}: {
  searchTerm: string
  correlationFilter: string
  eventTypeFilter: string
  disabled: boolean
  onSearchTermChange: (value: string) => void
  onClearSearchTerm: () => void
  onCorrelationFilterChange: (value: string) => void
  onClearCorrelationFilter: () => void
  onEventTypeFilterChange: (value: string) => void
  onClearEventTypeFilter: () => void
}) {
  return (
    <div className="message-filters">
      <div className="message-filters-field">
        <input
          type="text"
          placeholder="Search payload..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          disabled={disabled}
        />
        {searchTerm && (
          <button
            type="button"
            className="btn-icon-only message-filters-clear"
            title="Clear search"
            onClick={onClearSearchTerm}
            disabled={disabled}
          >
            ✕
          </button>
        )}
      </div>

      <div className="message-filters-field">
        <input
          type="text"
          placeholder="Correlation ID..."
          value={correlationFilter}
          onChange={(e) => onCorrelationFilterChange(e.target.value)}
          disabled={disabled}
        />
        {correlationFilter && (
          <button
            type="button"
            className="btn-icon-only message-filters-clear"
            title="Clear correlation"
            onClick={onClearCorrelationFilter}
            disabled={disabled}
          >
            ✕
          </button>
        )}
      </div>

      <div className="message-filters-field">
        <input
          type="text"
          placeholder="Event type..."
          value={eventTypeFilter}
          onChange={(e) => onEventTypeFilterChange(e.target.value)}
          disabled={disabled}
        />
        {eventTypeFilter && (
          <button
            type="button"
            className="btn-icon-only message-filters-clear"
            title="Clear event type"
            onClick={onClearEventTypeFilter}
            disabled={disabled}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
