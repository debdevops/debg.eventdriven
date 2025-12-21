/**
 * Top Navigation Bar with Gradient Background and Session Status
 * Enhanced with vibrant gradients, circular timer, pulsing connection indicator
 */

import { useSessionV2 } from '../contexts/SessionContextV2'
import { StatusDot } from './StatusDot'
import { NamespaceSwitcher } from './NamespaceSwitcher'
import { GradientButton } from './GradientButton'
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
  const { sessionState } = useSessionV2()

  return (
    <header className="topbar-gradient">
      <div className="topbar-content">
        <div className="topbar-left">
          <h1 className="app-title-gradient">Service Bus Inspector</h1>
          {currentNamespace && onSwitchNamespace && (
            <NamespaceSwitcher
              currentNamespace={currentNamespace}
              onSwitch={onSwitchNamespace}
              onAdd={onAddNamespace}
            />
          )}
          {!currentNamespace && (
            <span className="namespace-count-badge">{namespacesCount} namespace{namespacesCount !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="topbar-right">
          {currentNamespace && (
            <div className="session-status-modern">
              <span className="session-name-modern">{currentNamespace}</span>
              <StatusDot
                status={
                  sessionState === 'connected' || sessionState === 'idle-warning'
                    ? 'connected'
                    : sessionState === 'expired'
                      ? 'expired'
                      : sessionState === 'failed'
                        ? 'failed'
                        : 'connecting'
                }
                expiresAtUtc={expiresAtUtc || null}
                namespaceName={currentNamespace}
                onReconnect={onReconnect || (() => {})}
              />
            </div>
          )}
          <GradientButton
            variant="primary"
            onClick={onAddNamespace}
            icon={<span>+</span>}
          >
            Add Namespace
          </GradientButton>
        </div>
      </div>
    </header>
  )
}

