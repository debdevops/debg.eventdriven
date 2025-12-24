import './MessageFiltersBar.css'

export function MessageFiltersBar({
  searchTerm,
  correlationFilter,
  eventTypeFilter,
  filterDeliveryCount,
  resultCount,
  disabled,
  onSearchTermChange,
  onClearSearchTerm,
  onCorrelationFilterChange,
  onClearCorrelationFilter,
  onEventTypeFilterChange,
  onClearEventTypeFilter,
  onFilterDeliveryCountChange
}: {
  searchTerm: string
  correlationFilter: string
  eventTypeFilter: string
  filterDeliveryCount: number | null
  resultCount: number
  disabled: boolean
  onSearchTermChange: (value: string) => void
  onClearSearchTerm: () => void
  onCorrelationFilterChange: (value: string) => void
  onClearCorrelationFilter: () => void
  onEventTypeFilterChange: (value: string) => void
  onClearEventTypeFilter: () => void
  onFilterDeliveryCountChange: (value: number | null) => void
}) {
  return (
    <div className="search-filter-bar">
      <div className="search-box">
        <input
          type="text"
          placeholder="Search messages (ID, body, subject, properties...)"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          className="search-input"
          disabled={disabled}
        />
        {searchTerm && (
          <button
            onClick={onClearSearchTerm}
            className="clear-search"
            title="Clear search"
            disabled={disabled}
          >
            ✕
          </button>
        )}
      </div>

      <div className="search-box" style={{ maxWidth: '300px' }}>
        <input
          type="text"
          placeholder="Filter by Correlation ID..."
          value={correlationFilter}
          onChange={(e) => onCorrelationFilterChange(e.target.value)}
          className="search-input"
          disabled={disabled}
        />
        {correlationFilter && (
          <button
            onClick={onClearCorrelationFilter}
            className="clear-search"
            title="Clear correlation filter"
            disabled={disabled}
          >
            ✕
          </button>
        )}
      </div>

      <div className="search-box" style={{ maxWidth: '250px' }}>
        <input
          type="text"
          placeholder="Filter by Event Type..."
          value={eventTypeFilter}
          onChange={(e) => onEventTypeFilterChange(e.target.value)}
          className="search-input"
          disabled={disabled}
        />
        {eventTypeFilter && (
          <button
            onClick={onClearEventTypeFilter}
            className="clear-search"
            title="Clear event type filter"
            disabled={disabled}
          >
            ✕
          </button>
        )}
      </div>

      <div className="filter-controls">
        <select
          value={filterDeliveryCount === null ? '' : filterDeliveryCount}
          onChange={(e) => onFilterDeliveryCountChange(e.target.value === '' ? null : Number(e.target.value))}
          className="filter-select"
          disabled={disabled}
        >
          <option value="">All Deliveries</option>
          <option value="0">First Delivery</option>
          <option value="1">1 Retry</option>
          <option value="2">2+ Retries</option>
        </select>
        <span className="result-count">
          {resultCount} message{resultCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
