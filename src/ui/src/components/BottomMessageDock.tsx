/**
 * Bottom Message Drawer - Enterprise overlay panel
 * Full drawer with header opens on demand
 * No separate collapsed bar - cleaner UI
 */

import React, { useEffect, useRef } from 'react'
import { useSessionV2 } from '../contexts/SessionContextV2'
import { MessageSender } from './MessageSender'
import './BottomMessageDock.css'

interface BottomMessageDockProps {
  sessionId: string | null
  entities?: Array<{ name: string; type: string }>
  currentEntity?: string
  isOpen?: boolean
  onClose?: () => void
}

export default function BottomMessageDock({
  sessionId,
  entities = [],
  currentEntity,
  isOpen = false,
  onClose
}: BottomMessageDockProps) {
  const dockRef = useRef<HTMLDivElement>(null)
  const { scheduleTimeout, clearTimer } = useSessionV2()

  useEffect(() => {
    if (!isOpen) {
      clearTimer('bottom-message-dock:auto-close')
    }
  }, [clearTimer, isOpen])

  // Auto-close callback for MessageSender
  const handleMessageSent = () => {
    // Close drawer 1 second after successful send
    scheduleTimeout('bottom-message-dock:auto-close', 1000, () => {
      onClose?.()
    })
  }

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Handle backdrop click to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose?.()
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Drawer Overlay - fixed position overlay with backdrop */}
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
                onClick={onClose}
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
                onMessageSent={handleMessageSent}
              />
            </div>
          </div>
        </>
  )
}

