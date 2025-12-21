/**
 * Pagination Component - DUAL MODE
 * 
 * INSPECTOR MODE (MessageTable):
 * - Grid renders ALL loaded messages, NO slicing
 * - Footer shows: "Showing X of Y messages (peeked)"
 * - peekSize is preference for NEXT peek cycle
 * 
 * LEGACY MODE (AiInsightsInspector):
 * - Traditional pagination with slicing
 * - Full page navigation controls
 */

import './Pagination.css'

type PaginationMode = 'inspector' | 'legacy'

interface PaginationProps {
  // Inspector mode
  filteredCount?: number
  loadedCount?: number
  totalQueueCount?: number
  peekSize?: number
  onPeekSizeChange?: (size: number) => void
  onLoadNextBatch?: () => void
  disabled?: boolean
  
  // Legacy mode
  currentPage?: number
  totalItems?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  
  pageSizeOptions?: number[]
  mode?: PaginationMode
}

export function Pagination(props: PaginationProps) {
  // Auto-detect mode based on props
  const mode: PaginationMode = props.filteredCount !== undefined ? 'inspector' : 'legacy'
  
  if (mode === 'inspector') {
    return renderInspectorMode(props)
  } else {
    return renderLegacyMode(props)
  }
}

function renderInspectorMode(props: PaginationProps) {
  const { filteredCount = 0, loadedCount = 0, totalQueueCount, peekSize = 50, onPeekSizeChange, onLoadNextBatch, pageSizeOptions = [50, 100, 200], disabled = false } = props
  
  const showPeekSizeSelector = loadedCount >= peekSize
  const hasMoreMessages = totalQueueCount !== undefined && filteredCount < totalQueueCount

  return (
    <div className="pagination-container inspector-footer">
      {/* Visual divider when more messages are available */}
      {hasMoreMessages && (
        <div className="messages-end-divider">
          <div className="divider-line"></div>
          <span className="divider-text">End of loaded messages</span>
          <div className="divider-line"></div>
        </div>
      )}
      
      <div className="pagination-info">
        <span className="inspector-footer-text">
          Showing first{' '}
          <span className="inspector-count-primary">{filteredCount}</span>
          {totalQueueCount !== undefined && (
            <>
              {' '}of{' '}
              <span className="inspector-count-total">{totalQueueCount}</span>
            </>
          )}
          {' '}messages
          <span className="inspector-mode-badge" title="Peek-based inspector tool - non-destructive read from queue">
            (Peek snapshot)
          </span>
        </span>
      </div>

      <div className="inspector-controls">
        {/* Load next batch button - enhanced visibility */}
        {hasMoreMessages && onLoadNextBatch && (
          <div className="load-next-section">
            <button
              onClick={onLoadNextBatch}
              className="btn-load-next-batch primary"
              title="Load next batch of messages using last sequence number"
              disabled={disabled}
            >
              ⬇ Load next batch ({totalQueueCount && filteredCount ? totalQueueCount - filteredCount : '?'} more)
            </button>
            <div className="peek-hint">
              Scrolling won't load more - use button above
            </div>
          </div>
        )}

        {/* Peek batch size preference selector - clearly labeled */}
        {showPeekSizeSelector && (
          <div className="inspector-peek-size">
            <label htmlFor="peek-size-select" className="peek-size-label">
              Peek batch size:
            </label>
            <select
              id="peek-size-select"
              value={peekSize}
              onChange={(e) => onPeekSizeChange?.(Number(e.target.value))}
              className="peek-size-select"
              title="Number of messages to fetch in each peek operation. This is NOT pagination - Service Bus uses sequential message reading."
              disabled={disabled}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} messages
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}

function renderLegacyMode(props: PaginationProps) {
  const { currentPage = 1, totalItems = 0, pageSize = 50, onPageChange, onPageSizeChange, pageSizeOptions = [50, 100, 200] } = props
  
  const totalPages = Math.ceil(totalItems / pageSize)
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const showPages = 5

    if (totalPages <= showPages + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)

      let start = Math.max(2, currentPage - 1)
      let end = Math.min(totalPages - 1, currentPage + 1)

      if (currentPage <= 3) {
        end = showPages
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - showPages + 1
      }

      if (start > 2) pages.push('...')

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (end < totalPages - 1) pages.push('...')

      pages.push(totalPages)
    }

    return pages
  }

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        <span className="pagination-range">
          {startItem}–{endItem} of {totalItems}
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          className="page-size-select"
        >
          {pageSizeOptions.map(size => (
            <option key={size} value={size}>
              {size} per page
            </option>
          ))}
        </select>
      </div>

      <div className="pagination-controls">
        <button
          onClick={() => onPageChange?.(1)}
          disabled={currentPage === 1}
          className="pagination-btn"
          title="First page"
        >
          ⟪
        </button>
        <button
          onClick={() => onPageChange?.(currentPage - 1)}
          disabled={currentPage === 1}
          className="pagination-btn"
          title="Previous page"
        >
          ‹
        </button>

        {getPageNumbers().map((page, idx) =>
          typeof page === 'number' ? (
            <button
              key={idx}
              onClick={() => onPageChange?.(page)}
              className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
            >
              {page}
            </button>
          ) : (
            <span key={idx} className="pagination-ellipsis">
              {page}
            </span>
          )
        )}

        <button
          onClick={() => onPageChange?.(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="pagination-btn"
          title="Next page"
        >
          ›
        </button>
        <button
          onClick={() => onPageChange?.(totalPages)}
          disabled={currentPage === totalPages}
          className="pagination-btn"
          title="Last page"
        >
          ⟫
        </button>
      </div>
    </div>
  )
}
