/**
 * IdleWarningBanner - Glassmorphic warning with progress bar
 * Enhanced with backdrop blur, gradient border, and animated countdown
 */

import { useEffect } from 'react'
import './IdleWarningBanner.css'

interface IdleWarningBannerProps {
  secondsRemaining: number
  onDismiss: () => void
}

export function IdleWarningBanner({ secondsRemaining, onDismiss }: IdleWarningBannerProps) {
  // Calculate progress percentage (assuming 30 seconds total warning time)
  const progressPercent = Math.max(0, Math.min(100, (secondsRemaining / 30) * 100))
  
  // Determine urgency level
  const isUrgent = secondsRemaining <= 10
  const isCritical = secondsRemaining <= 5

  // Auto-dismiss on user activity (mousemove/keydown/touch)
  useEffect(() => {
    const dismissOnActivity = () => onDismiss()
    window.addEventListener('mousemove', dismissOnActivity, { once: true })
    window.addEventListener('keydown', dismissOnActivity, { once: true })
    window.addEventListener('touchstart', dismissOnActivity, { once: true })
    return () => {
      window.removeEventListener('mousemove', dismissOnActivity)
      window.removeEventListener('keydown', dismissOnActivity)
      window.removeEventListener('touchstart', dismissOnActivity)
    }
  }, [onDismiss])

  // Safety: if countdown jumps back up (activity detected by session timer), dismiss the banner
  useEffect(() => {
    if (secondsRemaining >= 25) {
      onDismiss()
    }
  }, [secondsRemaining, onDismiss])

  // Timeout-based auto-dismiss to avoid lingering banner
  useEffect(() => {
    const t = setTimeout(() => onDismiss(), 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className={`idle-warning-glassmorphic ${isCritical ? 'critical-shake' : ''}`} onClick={onDismiss}>
      <div className="idle-warning-glassmorphic-content">
        <span className={`idle-warning-icon-animated ${isUrgent ? 'pulse-urgent' : ''}`}>⚠️</span>
        <div className="idle-warning-text-container">
          <span className="idle-warning-text-glass">
            Session will expire in <strong className="idle-warning-countdown">{secondsRemaining} seconds</strong> due to inactivity.
          </span>
          <div className="idle-warning-progress-container">
            <div 
              className={`idle-warning-progress-bar ${isCritical ? 'critical' : isUrgent ? 'urgent' : ''}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <button className="idle-warning-dismiss-btn" onClick={onDismiss}>
          ✕
        </button>
      </div>
    </div>
  )
}

