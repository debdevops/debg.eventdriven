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
  onClose: () => void
}

export function Toast({ id, message, type, duration = null, onClose }: ToastProps) {
  // Keep id in props for stable keys; avoid unused param errors.
  void id
  useEffect(() => {
    if (duration == null) return
    const t = window.setTimeout(() => onClose(), duration)
    return () => window.clearTimeout(t)
  }, [duration, onClose])

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  }

  return (
    <div className={`toast toast-${type}`} onClick={onClose}>
      <span className="toast-icon">{icons[type]}</span>
      <span className="toast-message">{message}</span>
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
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  )
}
