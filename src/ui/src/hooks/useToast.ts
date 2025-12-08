/**
 * Toast Management Hook
 */

import { useState, useCallback } from 'react'
import type { ToastType } from '../components/Toast'

interface Toast {
  id: string
  message: string
  type: ToastType
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    // Deduplicate: Check if a toast with the same message and type already exists
    setToasts(prev => {
      const duplicate = prev.find(t => t.message === message && t.type === type)
      if (duplicate) {
        // Toast already exists, don't add another
        return prev
      }
      const id = `toast-${Date.now()}-${Math.random()}`
      return [...prev, { id, message, type }]
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
