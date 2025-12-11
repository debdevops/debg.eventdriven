/**
 * GradientButton Component - Vibrant gradient buttons with icons
 * Variants: primary (blue), danger (red), success (green), purple (special actions)
 */

import React from 'react'
import './GradientButton.css'

interface GradientButtonProps {
  variant: 'primary' | 'danger' | 'success' | 'purple' | 'secondary'
  children: React.ReactNode
  icon?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  title?: string
  type?: 'button' | 'submit' | 'reset'
}

export function GradientButton({
  variant,
  children,
  icon,
  onClick,
  disabled,
  className = '',
  title,
  type = 'button'
}: GradientButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`gradient-btn gradient-btn-${variant} ${className}`}
    >
      {icon && <span className="gradient-btn-icon">{icon}</span>}
      <span className="gradient-btn-label">{children}</span>
    </button>
  )
}
