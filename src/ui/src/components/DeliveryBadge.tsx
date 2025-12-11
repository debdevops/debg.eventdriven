/**
 * Delivery Badge Component - Enhanced with emoji indicators
 * Smart color-coded badges: Green ✓ (0), Yellow ⚠️ (1-3), Red 🔥 (4+)
 */

import './DeliveryBadge.css'

export interface DeliveryBadgeProps {
  count: number
  size?: 'small' | 'medium' | 'large'
}

export function DeliveryBadge({ count, size = 'medium' }: DeliveryBadgeProps) {
  const getVariant = () => {
    if (count === 0) {
      return {
        color: 'green',
        emoji: '✓',
        label: 'New',
        title: 'Fresh message - not yet delivered'
      }
    }
    if (count >= 1 && count <= 3) {
      return {
        color: 'yellow',
        emoji: '⚠️',
        label: `x${count}`,
        title: `Retrying - delivered ${count} time${count !== 1 ? 's' : ''}`
      }
    }
    return {
      color: 'red',
      emoji: '🔥',
      label: `x${count}`,
      title: `Critical - delivered ${count} times, check DLQ`
    }
  }

  const variant = getVariant()

  return (
    <span 
      className={`delivery-badge-v2 delivery-badge-${variant.color} delivery-badge-${size}`} 
      title={variant.title}
    >
      <span className="delivery-badge-emoji">{variant.emoji}</span>
      <span className="delivery-badge-label">{variant.label}</span>
    </span>
  )
}
