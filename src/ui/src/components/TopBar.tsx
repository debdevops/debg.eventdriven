/**
 * Top Navigation Bar with Namespace Switcher
 */

import { NamespaceSwitcher } from './NamespaceSwitcher'
import './TopBar.css'

interface TopBarProps {
  namespacesCount: number
  currentNamespace?: string
  onAddNamespace: () => void
  onSwitchNamespace?: () => void
}

export function TopBar({ namespacesCount, currentNamespace, onAddNamespace, onSwitchNamespace }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-content">
        <div className="topbar-left">
          <h1 className="app-title">Service Bus Inspector</h1>
          {currentNamespace && onSwitchNamespace && (
            <NamespaceSwitcher
              currentNamespace={currentNamespace}
              onSwitch={onSwitchNamespace}
              onAdd={onAddNamespace}
            />
          )}
          {!currentNamespace && (
            <span className="namespace-count">{namespacesCount} namespace{namespacesCount !== 1 ? 's' : ''}</span>
          )}
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
