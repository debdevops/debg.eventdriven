/**
 * IdleWarningBanner - Shows critical idle warning before session expiry
 * Non-intrusive amber banner at top of content area
 */

import './IdleWarningBanner.css'

interface IdleWarningBannerProps {
  secondsRemaining: number
  onDismiss: () => void
}

export function IdleWarningBanner({ secondsRemaining, onDismiss }: IdleWarningBannerProps) {
  return (
    <div className="idle-warning-banner" onClick={onDismiss}>
      <div className="idle-warning-content">
        <span className="idle-warning-icon">⚠️</span>
        <span className="idle-warning-text">
          Session will expire in <strong>{secondsRemaining} seconds</strong> due to inactivity.
          Click anywhere to stay connected.
        </span>
      </div>
    </div>
  )
}
