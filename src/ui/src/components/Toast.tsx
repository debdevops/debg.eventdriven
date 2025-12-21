/**
 * Toast Notification System
 * Lightweight notifications for user feedback
 */

import { useEffect } from 'react'
import { useSessionV2 } from '../contexts/SessionContextV2'
import './Toast.css'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastProps {
  id: string
  message: string
  type: ToastType
  duration?: number
  onClose: () => void
}

export function Toast({ id, message, type, duration = 3000, onClose }: ToastProps) {
  const { scheduleTimeout, clearTimer } = useSessionV2()

  useEffect(() => {
    const timerName = `toast:${id}`
    scheduleTimeout(timerName, duration, onClose)
    return () => clearTimer(timerName)
  }, [clearTimer, duration, id, onClose, scheduleTimeout])

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
  toasts: Array<{ id: string; message: string; type: ToastType }>
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
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  )
}
