/**
 * Unified Action Toolbar Component
 * Consolidates all message actions in a single 48px toolbar
 */

import './ActionToolbar.css'

export interface ActionToolbarProps {
  // Entity info
  entityName: string
  entityType: 'queue' | 'subscription' | 'dlq'
  
  // Message counts
  totalMessages: number
  selectedCount: number
  
  // Actions
  onRefresh: () => void
  onDelete?: () => void
  onMoveToDLQ?: () => void
  onReplay?: () => void
  onReplayAll?: () => void
  onExportSelected?: () => void
  onExportAll?: () => void
  onClearFilters?: () => void
  
  // State
  refreshing?: boolean
  loading?: boolean
  frozenSnapshot?: boolean
  onToggleSnapshot?: () => void
  
  // Select mode
  selectMode?: boolean
  onToggleSelectMode?: () => void
  onSelectAll?: () => void
  onClearSelection?: () => void
}

export function ActionToolbar({
  entityName,
  entityType,
  totalMessages,
  selectedCount,
  onRefresh,
  onDelete,
  onMoveToDLQ,
  onReplay,
  onReplayAll,
  onExportSelected,
  onExportAll,
  onClearFilters,
  refreshing = false,
  loading = false,
  frozenSnapshot = false,
  onToggleSnapshot,
  selectMode = false,
  onToggleSelectMode,
  onSelectAll,
  onClearSelection
}: ActionToolbarProps) {
  const isDLQ = entityType === 'dlq'
  
  return (
    <div className="action-toolbar">
      <div className="toolbar-left">
        <h3 className="toolbar-title">
          {entityName} {isDLQ && <span className="dlq-badge">DLQ</span>}
        </h3>
        <span className="message-count">
          {totalMessages} message{totalMessages !== 1 ? 's' : ''}
          {selectedCount > 0 && <span className="selected-count"> ({selectedCount} selected)</span>}
        </span>
      </div>

      <div className="toolbar-right">
        {/* Selection controls */}
        {onToggleSelectMode && (
          <div className="toolbar-group">
            <button
              className={`toolbar-btn ${selectMode ? 'active' : ''}`}
              onClick={onToggleSelectMode}
              title="Toggle selection mode (S)"
            >
              ☑ Select
            </button>
            {selectMode && onSelectAll && (
              <button
                className="toolbar-btn"
                onClick={onSelectAll}
                title="Select all (A)"
              >
                Select All
              </button>
            )}
            {selectMode && selectedCount > 0 && onClearSelection && (
              <button
                className="toolbar-btn"
                onClick={onClearSelection}
                title="Clear selection"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Snapshot control */}
        {onToggleSnapshot && (
          <div className="toolbar-group">
            <button
              className={`toolbar-btn ${frozenSnapshot ? 'active' : ''}`}
              onClick={onToggleSnapshot}
              title="Freeze/unfreeze snapshot"
            >
              {frozenSnapshot ? '❄️ Frozen' : '📷 Snapshot'}
            </button>
          </div>
        )}

        {/* Bulk actions - only show when messages selected */}
        {selectedCount > 0 && (
          <div className="toolbar-group">
            {isDLQ && onReplay && (
              <button
                className="toolbar-btn success"
                onClick={onReplay}
                disabled={loading}
                title="Replay selected messages"
              >
                ▶️ Replay ({selectedCount})
              </button>
            )}

            {!isDLQ && onMoveToDLQ && (
              <button
                className="toolbar-btn warning"
                onClick={onMoveToDLQ}
                disabled={loading}
                title="Move selected to DLQ"
              >
                ⚠️ To DLQ ({selectedCount})
              </button>
            )}

            {onDelete && (
              <button
                className="toolbar-btn danger"
                onClick={onDelete}
                disabled={loading}
                title="Delete selected messages"
              >
                🗑️ Delete ({selectedCount})
              </button>
            )}

            {onExportSelected && (
              <button
                className="toolbar-btn"
                onClick={onExportSelected}
                title="Export selected messages"
              >
                📥 Export
              </button>
            )}
          </div>
        )}

        {/* All messages actions */}
        <div className="toolbar-group">
          {isDLQ && onReplayAll && totalMessages > 0 && (
            <button
              className="toolbar-btn success"
              onClick={onReplayAll}
              disabled={loading}
              title="Replay all DLQ messages"
            >
              ▶️ Replay All
            </button>
          )}

          {onExportAll && totalMessages > 0 && (
            <button
              className="toolbar-btn"
              onClick={onExportAll}
              title="Export all messages"
            >
              📥 Export All
            </button>
          )}

          {onClearFilters && (
            <button
              className="toolbar-btn"
              onClick={onClearFilters}
              title="Clear all filters"
            >
              ✕ Clear Filters
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
