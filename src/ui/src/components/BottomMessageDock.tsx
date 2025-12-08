/**
 * Bottom Message Dock - Persistent collapsible panel
 * Always visible as a 1-row bar, expands upward into MessageSender on click
 */

import React, { useState, useRef } from 'react'
import { MessageSender } from './MessageSender'
import './BottomMessageDock.css'

interface BottomMessageDockProps {
  sessionId: string | null
  entities?: Array<{ name: string; type: string }>
  currentEntity?: string
}

export default function BottomMessageDock({
  sessionId,
  entities = [],
  currentEntity
}: BottomMessageDockProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const dockRef = useRef<HTMLDivElement>(null)

  // Close dock when clicking outside
  React.useEffect(() => {
    if (!isExpanded) return

    const handleClickOutside = (e: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setIsExpanded(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isExpanded])

  // Close on Escape key
  React.useEffect(() => {
    if (!isExpanded) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded])

  return (
    <div
      ref={dockRef}
      className={`bottom-message-dock ${isExpanded ? 'expanded' : 'collapsed'}`}
      data-testid="bottom-message-dock"
    >
      {/* Collapsed Bar */}
      {!isExpanded && (
        <button
          className="dock-bar"
          onClick={() => setIsExpanded(true)}
          title="Click to open Send Message panel (Esc to close)"
        >
          <span className="dock-icon">✉</span>
          <span className="dock-label">Send Message to Service Bus</span>
          <span className="dock-chevron">▼</span>
        </button>
      )}

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="dock-panel">
          <div className="dock-header">
            <h3>Send Message to Service Bus</h3>
            <button
              className="dock-close"
              onClick={() => setIsExpanded(false)}
              title="Close (Esc)"
              aria-label="Close message sender"
            >
              ✕
            </button>
          </div>
          <div className="dock-content">
            <MessageSender
              sessionId={sessionId}
              entities={entities}
              currentEntity={currentEntity}
            />
          </div>
        </div>
      )}
    </div>
  )
}
