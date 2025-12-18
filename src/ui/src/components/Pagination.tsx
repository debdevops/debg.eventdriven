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
  const { filteredCount = 0, loadedCount = 0, totalQueueCount, peekSize = 50, onPeekSizeChange, pageSizeOptions = [50, 100, 200] } = props
  
  const showPeekSizeSelector = loadedCount >= peekSize

  return (
    <div className="pagination-container inspector-footer">
      <div className="pagination-info">
        <span className="inspector-footer-text">
          Showing{' '}
          <span className="inspector-count-primary">{filteredCount}</span>
          {totalQueueCount !== undefined && (
            <>
              {' '}of{' '}
              <span className="inspector-count-total">{totalQueueCount}</span>
            </>
          )}
          {' '}messages
        </span>
        <span className="inspector-mode-badge" title="Peek-based inspector tool">
          (peeked)
        </span>
      </div>

      {/* Peek size preference selector - informational only */}
      {showPeekSizeSelector && (
        <div className="inspector-peek-size">
          <label htmlFor="peek-size-select" className="peek-size-label">
            Next peek size:
          </label>
          <select
            id="peek-size-select"
            value={peekSize}
            onChange={(e) => onPeekSizeChange?.(Number(e.target.value))}
            className="peek-size-select"
            title="Size for next peek operation (does not affect current display)"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}
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
