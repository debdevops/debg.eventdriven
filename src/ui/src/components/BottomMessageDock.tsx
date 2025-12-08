/**
 * Bottom Message Drawer - Enterprise overlay panel
 * Collapsible button at bottom expands into a modal overlay (38% default height)
 * Backdrop dims main content, drawer overlays on top with no content push
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

  // Handle backdrop click to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsExpanded(false)
    }
  }

  return (
    <>
      {/* Collapsed Button Bar - only shown when drawer is closed */}
      {!isExpanded && (
        <div className="bottom-dock-bar">
          <button
            className="dock-trigger-button"
            onClick={() => setIsExpanded(true)}
            title="Click to open Send Message drawer (Esc to close)"
            aria-label="Open Send Message drawer"
          >
            <span className="dock-icon">✉</span>
            <span className="dock-label">Send Message to Service Bus</span>
            <span className="dock-chevron">▼</span>
          </button>
        </div>
      )}

      {/* Drawer Overlay - fixed position overlay with backdrop */}
      {isExpanded && (
        <>
          {/* Backdrop - dims background, allows click-to-close */}
          <div 
            className="drawer-backdrop" 
            onClick={handleBackdropClick}
            role="presentation"
          />
          
          {/* Drawer Panel */}
          <div
            ref={dockRef}
            className="bottom-drawer-panel"
            data-testid="bottom-message-drawer"
          >
            <div className="drawer-header">
              <h3 className="drawer-title">Send Message to Service Bus</h3>
              <button
                className="drawer-close-button"
                onClick={() => setIsExpanded(false)}
                title="Close drawer (Esc)"
                aria-label="Close Send Message drawer"
              >
                ✕
              </button>
            </div>
            <div className="drawer-content">
              <MessageSender
                sessionId={sessionId}
                entities={entities}
                currentEntity={currentEntity}
              />
            </div>
          </div>
        </>
      )}
    </>
  )
}

