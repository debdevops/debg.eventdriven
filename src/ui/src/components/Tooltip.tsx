/**
 * Standardized Tooltip Component
 * 
 * ACCESSIBILITY & UX FEATURES:
 * - 300ms delay before show (prevents flickering)
 * - Keyboard accessible (focus trigger + Escape to close)
 * - ARIA compliant (aria-describedby)
 * - Mobile-friendly (tap to show, tap outside to hide)
 * - Smart positioning (auto-adjust to viewport)
 * - Dark mode support
 * 
 * USAGE:
 * <Tooltip content="Your tooltip text">
 *   <button>Hover me</button>
 * </Tooltip>
 */

import { useState, useRef, useEffect, useCallback, ReactNode } from 'react'
import './Tooltip.css'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  delay?: number
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
  disabled?: boolean
  className?: string
  maxWidth?: number
}

export function Tooltip({ 
  content, 
  children, 
  delay = 300,
  position = 'auto',
  disabled = false,
  className = '',
  maxWidth = 300
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [computedPosition, setComputedPosition] = useState(position)
  const timeoutRef = useRef<NodeJS.Timeout>()
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipId = useRef(`tooltip-${Math.random().toString(36).substr(2, 9)}`)

  // Show tooltip with delay
  const showTooltip = useCallback(() => {
    if (disabled) return
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
      // Calculate smart position if auto
      if (position === 'auto' && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const spaceAbove = rect.top
        const spaceBelow = window.innerHeight - rect.bottom
        const spaceLeft = rect.left
        const spaceRight = window.innerWidth - rect.right

        // Prefer top if enough space, otherwise bottom
        if (spaceAbove > 150) {
          setComputedPosition('top')
        } else if (spaceBelow > 150) {
          setComputedPosition('bottom')
        } else if (spaceRight > 200) {
          setComputedPosition('right')
        } else if (spaceLeft > 200) {
          setComputedPosition('left')
        } else {
          setComputedPosition('top')
        }
      } else {
        setComputedPosition(position)
      }
    }, delay)
  }, [disabled, position, delay])

  // Hide tooltip immediately
  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }, [])

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        hideTooltip()
      }
    }

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isVisible, hideTooltip])

  // Mobile tap outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isVisible && 
          triggerRef.current && 
          tooltipRef.current &&
          !triggerRef.current.contains(e.target as Node) &&
          !tooltipRef.current.contains(e.target as Node)) {
        hideTooltip()
      }
    }

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isVisible, hideTooltip])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Mobile: tap to toggle
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    if (isVisible) {
      hideTooltip()
    } else {
      showTooltip()
    }
  }

  if (!content || disabled) {
    return <>{children}</>
  }

  return (
    <div 
      ref={triggerRef}
      className="tooltip-trigger"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      onTouchStart={handleTouchStart}
      aria-describedby={isVisible ? tooltipId.current : undefined}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          id={tooltipId.current}
          role="tooltip"
          className={`tooltip tooltip-${computedPosition} ${className}`}
          style={{ maxWidth: `${maxWidth}px` }}
        >
          <div className="tooltip-content">
            {content}
          </div>
          <div className="tooltip-arrow"></div>
        </div>
      )}
    </div>
  )
}

/**
 * Keyboard Shortcut Tooltip
 * Specialized tooltip for showing keyboard shortcuts
 */
interface KeyboardShortcutTooltipProps {
  shortcut: string
  description: string
  children: ReactNode
}

export function KeyboardShortcutTooltip({ 
  shortcut, 
  description, 
  children 
}: KeyboardShortcutTooltipProps) {
  const content = (
    <div className="keyboard-shortcut-tooltip">
      <div className="shortcut-description">{description}</div>
      <kbd className="shortcut-key">{shortcut}</kbd>
    </div>
  )

  return (
    <Tooltip content={content} delay={500}>
      {children}
    </Tooltip>
  )
}
