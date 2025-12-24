/**
 * Toast Notification System
 * Lightweight notifications for user feedback
 */

import { useEffect } from 'react'
import './Toast.css'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastProps {
  id: string
  message: string
  type: ToastType
  duration?: number | null
  onRemove: (id: string) => void
}

export function Toast({ id, message, type, duration = null, onRemove }: ToastProps) {
  useEffect(() => {
    if (duration == null) return
    // FIX(toast): create timer once per toast; cleared on unmount.
    const t = window.setTimeout(() => onRemove(id), duration)
    return () => window.clearTimeout(t)
  }, [duration, id, onRemove])

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  }

  return (
    <div className={`toast toast-${type}`} role="status" aria-live="polite">
      <span className="toast-icon">{icons[type]}</span>
      <span className="toast-message">{message}</span>
      <button
        className="toast-close"
        type="button"
        onClick={() => onRemove(id)}
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

export interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type: ToastType; duration?: number | null }>
  onRemove: (id: string) => void
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}
