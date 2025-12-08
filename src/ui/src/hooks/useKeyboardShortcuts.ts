/**
 * Custom hook for global keyboard shortcuts
 * R: Refresh, S: Select mode, A: Select all, Escape: Close panels
 */

import { useEffect } from 'react'

export interface KeyboardShortcutHandlers {
  onRefresh?: () => void
  onToggleSelectMode?: () => void
  onSelectAll?: () => void
  onEscape?: () => void
  onSearch?: () => void
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore shortcuts when user is typing in an input/textarea
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape to work even in inputs
        if (event.key === 'Escape' && handlers.onEscape) {
          handlers.onEscape()
          event.preventDefault()
        }
        return
      }

      // Handle keyboard shortcuts
      switch (event.key.toLowerCase()) {
        case 'r':
          if (handlers.onRefresh) {
            event.preventDefault()
            handlers.onRefresh()
          }
          break

        case 's':
          if (handlers.onToggleSelectMode) {
            event.preventDefault()
            handlers.onToggleSelectMode()
          }
          break

        case 'a':
          if (handlers.onSelectAll && !event.ctrlKey && !event.metaKey) {
            event.preventDefault()
            handlers.onSelectAll()
          }
          break

        case 'escape':
          if (handlers.onEscape) {
            event.preventDefault()
            handlers.onEscape()
          }
          break

        case '/':
          if (handlers.onSearch) {
            event.preventDefault()
            handlers.onSearch()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handlers, enabled])
}
