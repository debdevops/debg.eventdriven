/**
 * Top Navigation Bar with Namespace Switcher and Session Status
 */

import { useSessionV2 } from '../contexts/SessionContextV2'
import { StatusDot } from './StatusDot'
import { NamespaceSwitcher } from './NamespaceSwitcher'
import './TopBar.css'

interface TopBarProps {
  namespacesCount: number
  currentNamespace?: string
  expiresAtUtc?: string
  onAddNamespace: () => void
  onSwitchNamespace?: () => void
  onReconnect?: () => void
}

export function TopBar({ 
  namespacesCount, 
  currentNamespace, 
  expiresAtUtc,
  onAddNamespace, 
  onSwitchNamespace,
  onReconnect
}: TopBarProps) {
  const { status } = useSessionV2()

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
          {currentNamespace && (
            <div className="session-status-bar">
              <span className="session-name">{currentNamespace}</span>
              <StatusDot
                status={status === 'connected' ? 'connected' : status === 'expired' ? 'expired' : 'connecting'}
                expiresAtUtc={expiresAtUtc || null}
                namespaceName={currentNamespace}
                onReconnect={onReconnect || (() => {})}
              />
            </div>
          )}
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
