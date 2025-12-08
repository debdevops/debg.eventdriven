/**
 * Keyboard Shortcuts Help Panel
 * Shows all available keyboard shortcuts
 */

import { useEffect } from 'react'
import './KeyboardShortcutsHelp.css'

interface KeyboardShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
}

interface Shortcut {
  key: string
  description: string
}

const shortcuts: Shortcut[] = [
  { key: '?', description: 'Show keyboard shortcuts' },
  { key: 'R', description: 'Refresh entities' },
  { key: 'Escape', description: 'Close panels / Clear selection' },
  { key: 'Space', description: 'Preview selected message' },
  { key: '/', description: 'Focus search' },
  { key: '←/→', description: 'Navigate messages in detail view' },
  { key: 'Ctrl/Cmd + A', description: 'Select all messages' },
  { key: 'Ctrl/Cmd + C', description: 'Copy selected message' }
]

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="keyboard-shortcuts-overlay" onClick={onClose}>
      <div className="keyboard-shortcuts-panel" onClick={(e) => e.stopPropagation()}>
        <div className="keyboard-shortcuts-header">
          <h2 className="keyboard-shortcuts-title">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="keyboard-shortcuts-close"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="keyboard-shortcuts-list">
          {shortcuts.map(({ key, description }) => (
            <div key={key} className="keyboard-shortcut-item">
              <span className="keyboard-shortcut-description">{description}</span>
              <kbd className="keyboard-shortcut-key">{key}</kbd>
            </div>
          ))}
        </div>

        <div className="keyboard-shortcuts-footer">
          <button onClick={onClose} className="keyboard-shortcuts-close-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
