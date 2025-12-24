/**
 * Toast Management Hook
 */

import { useState, useCallback, useRef } from 'react'
import type { ToastType } from '../components/Toast'

interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number | null
}

function durationFor(type: ToastType): number | null {
  // FIX(toast): auto-dismiss all toasts after 4–5 seconds.
  // This keeps notifications lightweight and non-blocking.
  void type
  return 4500
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const lastShownRef = useRef<Record<string, number>>({})

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    // Avoid rapid repeat success/info/warning noise.
    const key = `${type}:${message}`
    const now = Date.now()
    const last = lastShownRef.current[key] || 0
    const throttleWindowMs = type === 'success' ? 2500 : 1500
    if (now - last < throttleWindowMs) {
      return
    }
    lastShownRef.current[key] = now

    // Deduplicate: Check if a toast with the same message and type already exists
    setToasts(prev => {
      const duplicate = prev.find(t => t.message === message && t.type === type)
      if (duplicate) {
        // Toast already exists, don't add another
        return prev
      }
      const id = `toast-${Date.now()}-${Math.random()}`
      return [...prev, { id, message, type, duration: durationFor(type) }]
    })
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const success = useCallback((message: string) => addToast(message, 'success'), [addToast])
  const error = useCallback((message: string) => addToast(message, 'error'), [addToast])
  const info = useCallback((message: string) => addToast(message, 'info'), [addToast])
  const warning = useCallback((message: string) => addToast(message, 'warning'), [addToast])

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
    warning
  }
}
