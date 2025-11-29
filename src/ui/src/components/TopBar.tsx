/**
 * Top Navigation Bar
 */

import './TopBar.css'

interface TopBarProps {
  namespacesCount: number
  onAddNamespace: () => void
}

export function TopBar({ namespacesCount, onAddNamespace }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-content">
        <div className="topbar-left">
          <h1 className="app-title">Service Bus Inspector</h1>
          <span className="namespace-count">{namespacesCount} namespace{namespacesCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="topbar-right">
          <button
            onClick={onAddNamespace}
            className="btn-primary"
            aria-label="Add namespace"
          >
            + Add Namespace
          </button>
        </div>
      </div>
    </header>
  )
}
