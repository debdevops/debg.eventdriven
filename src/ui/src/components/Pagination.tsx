/**
 * Pagination Component - INSPECTOR MODE
 * 
 * CRITICAL: This is NOT database-style pagination.
 * We paginate LOADED (peeked) messages, not total queue messages.
 * 
 * totalQueueCount = informational only (e.g., 200 total in queue)
 * loadedCount = messages actually peeked (e.g., 20 loaded)
 * totalItems = filtered/sorted loaded messages (e.g., 15 after filters)
 */

import './Pagination.css'

interface PaginationProps {
  currentPage: number
  totalItems: number // Filtered messages count (what we're paginating)
  totalQueueCount?: number // Total in queue (informational only)
  loadedCount?: number // Raw loaded messages (before filters)
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
  inspectorMode?: boolean // Enable inspector-mode messaging
}

export function Pagination({
  currentPage,
  totalItems,
  totalQueueCount,
  loadedCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [50, 100, 200],
  inspectorMode = false
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize)
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)
  
  // INSPECTOR MODE: Hide pagination if only one page of loaded data
  const showPaginationControls = totalPages > 1
  
  // INSPECTOR MODE: Disable page size selector if loaded data fits in one page
  const disablePageSize = inspectorMode && (loadedCount || 0) <= pageSize

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
        {inspectorMode && totalQueueCount !== undefined ? (
          <>
            <span className="pagination-range inspector-mode">
              Showing {loadedCount || totalItems} of {totalQueueCount} messages
            </span>
            <span className="inspector-mode-hint" title="Only peeked messages are loaded. Pagination operates on loaded data only.">
              (peeked)
            </span>
          </>
        ) : (
          <span className="pagination-range">
            {startItem}–{endItem} of {totalItems}
          </span>
        )}
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="page-size-select"
          disabled={disablePageSize}
          title={disablePageSize ? 'All loaded messages fit in current view' : 'Change page size'}
        >
          {pageSizeOptions.map(size => (
            <option key={size} value={size}>
              {size} per page
            </option>
          ))}
        </select>
      </div>

      {/* Only show pagination controls if more than one page */}
      {showPaginationControls && (
        <div className="pagination-controls">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="pagination-btn"
          title="First page"
        >
          ⟪
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
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
              onClick={() => onPageChange(page)}
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
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="pagination-btn"
          title="Next page"
        >
          ›
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="pagination-btn"
          title="Last page"
        >
          ⟫
        </button>
      </div>
      )}
    </div>
  )
}
