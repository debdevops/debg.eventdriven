/**
 * Audit Panel - Collapsible footer showing operation history
 */

import { useState } from 'react'
import { formatTimestamp, truncate } from '../utils/formatters'
import type { AuditEntry } from '../types'
import './AuditPanel.css'

interface AuditPanelProps {
  entries: AuditEntry[]
}

export function AuditPanel({ entries }: AuditPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className={`audit-panel ${isExpanded ? 'expanded' : ''}`}>
      <div className="audit-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h4>Audit Log ({entries.length} entries)</h4>
        <button className="expand-btn" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
          {isExpanded ? '▼' : '▲'}
        </button>
      </div>

      {isExpanded && (
        <div className="audit-content">
          {entries.length === 0 ? (
            <p className="empty-audit">No audit entries yet</p>
          ) : (
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Operation</th>
                  <th>Entity</th>
                  <th>Message ID</th>
                  <th>Seq#</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={index}>
                    <td title={formatTimestamp(entry.timestamp)}>
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </td>
                    <td>
                      <span className={`operation-badge ${entry.operation.toLowerCase()}`}>
                        {entry.operation}
                      </span>
                    </td>
                    <td>{entry.entityName}</td>
                    <td className="message-id" title={entry.messageId || '-'}>
                      {entry.messageId ? truncate(entry.messageId, 20) : '-'}
                    </td>
                    <td>{entry.sequenceNumber || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
