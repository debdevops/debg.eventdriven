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

      <select
        value={filterDeliveryCount ?? ''}
        onChange={(e) => onFilterDeliveryCountChange(e.target.value ? Number(e.target.value) : null)}
        disabled={disabled}
        title="Filter by delivery count"
      >
        <option value="">All deliveries</option>
        <option value="1">Delivery = 1</option>
        <option value="2">Delivery ≥ 2</option>
        <option value="5">Delivery ≥ 5</option>
      </select>

      <div className="message-filters-count" title="Filtered message count">
        {resultCount} results
      </div>
    </div>
  )
}
