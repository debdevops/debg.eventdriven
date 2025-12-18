/**
 * Multi-Action FAB - Floating Action Button with multiple actions
 * Provides quick access to Send Message and Generate Test Messages
 */

import { useState, useEffect } from 'react'
import './MultiFab.css'

interface MultiFabProps {
  onSendMessage: () => void
  onGenerateMessages: () => void
}

export default function MultiFab({ onSendMessage, onGenerateMessages }: MultiFabProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }

  const handleAction = (action: () => void) => {
    action()
    setIsExpanded(false)
  }

  // Close on Escape
  useEffect(() => {
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
    <>
      {/* Backdrop - click to close */}
      {isExpanded && (
        <div className="fab-backdrop" onClick={() => setIsExpanded(false)} />
      )}

      <div className={`multi-fab ${isExpanded ? 'expanded' : ''}`}>
        {/* Action Buttons - shown when expanded */}
        {isExpanded && (
          <div className="fab-actions">
            <button
              className="fab-action-btn"
              onClick={() => handleAction(onGenerateMessages)}
              title="Generate test messages with anomalies"
            >
              <span className="action-icon">🤖</span>
              <span className="action-label">Generate Test Messages</span>
            </button>
            <button
              className="fab-action-btn"
              onClick={() => handleAction(onSendMessage)}
              title="Send a custom message"
            >
              <span className="action-icon">✉️</span>
              <span className="action-label">Send Message</span>
            </button>
          </div>
        )}

        {/* Main FAB Button */}
        <button
          className="fab-main-btn"
          onClick={handleToggle}
          title={isExpanded ? 'Close menu' : 'Quick actions'}
          aria-label={isExpanded ? 'Close menu' : 'Quick actions'}
        >
          <span className={`fab-icon ${isExpanded ? 'rotate' : ''}`}>
            {isExpanded ? '✕' : '⚡'}
          </span>
        </button>
      </div>
    </>
  )
}
