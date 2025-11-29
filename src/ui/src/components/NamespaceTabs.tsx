/**
 * Namespace Tabs Component
 */

import { useSessionExpiry } from '../hooks/useSessionExpiry'
import type { Namespace } from '../types'
import './NamespaceTabs.css'

interface NamespaceTabsProps {
  namespaces: Namespace[]
  activeNamespaceId: string | null
  onSelectNamespace: (sessionId: string) => void
  onCloseNamespace: (sessionId: string) => void
}

export function NamespaceTabs({
  namespaces,
  activeNamespaceId,
  onSelectNamespace,
  onCloseNamespace
}: NamespaceTabsProps) {
  return (
    <div className="namespace-tabs">
      {namespaces.map(ns => (
        <NamespaceTab
          key={ns.sessionId}
          namespace={ns}
          isActive={ns.sessionId === activeNamespaceId}
          onSelect={() => onSelectNamespace(ns.sessionId)}
          onClose={() => onCloseNamespace(ns.sessionId)}
        />
      ))}
    </div>
  )
}

interface NamespaceTabProps {
  namespace: Namespace
  isActive: boolean
  onSelect: () => void
  onClose: () => void
}

function NamespaceTab({ namespace, isActive, onSelect, onClose }: NamespaceTabProps) {
  const { isExpired, formatTimeRemaining } = useSessionExpiry(namespace.expiresAtUtc)

  const label = namespace.friendlyName || `Session ${namespace.sessionId.substring(0, 8)}`

  return (
    <div
      className={`namespace-tab ${isActive ? 'active' : ''} ${isExpired ? 'expired' : ''}`}
      onClick={onSelect}
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <span className="tab-label">{label}</span>
      <span className="tab-expiry">{formatTimeRemaining()}</span>
      <button
        className="tab-close"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label={`Close ${label}`}
      >
        ×
      </button>
    </div>
  )
}
