/**
 * Loading Skeleton for Message Table
 * Displays while messages are being fetched
 */

import './MessageTableSkeleton.css'

export function MessageTableSkeleton() {
  return (
    <div className="skeleton-wrapper">
      <div className="skeleton-header">
        <div className="skeleton-box skeleton-search"></div>
        <div className="skeleton-box skeleton-filter"></div>
        <div className="skeleton-box skeleton-filter"></div>
      </div>
      
      <div className="skeleton-table">
        <div className="skeleton-table-header">
          <div className="skeleton-box skeleton-th"></div>
          <div className="skeleton-box skeleton-th"></div>
          <div className="skeleton-box skeleton-th"></div>
          <div className="skeleton-box skeleton-th"></div>
          <div className="skeleton-box skeleton-th"></div>
        </div>
        
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton-table-row">
            <div className="skeleton-box skeleton-td"></div>
            <div className="skeleton-box skeleton-td"></div>
            <div className="skeleton-box skeleton-td"></div>
            <div className="skeleton-box skeleton-td"></div>
            <div className="skeleton-box skeleton-td"></div>
          </div>
        ))}
      </div>
    </div>
  )
}
