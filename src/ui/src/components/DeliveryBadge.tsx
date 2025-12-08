/**
 * Delivery Badge Component
 * Color-coded badge for message delivery count
 * Green (0-2), Yellow (3-5), Red (6+)
 */

import './DeliveryBadge.css'

export interface DeliveryBadgeProps {
  count: number
  size?: 'small' | 'medium' | 'large'
}

export function DeliveryBadge({ count, size = 'medium' }: DeliveryBadgeProps) {
  const getColorClass = (): string => {
    if (count <= 2) return 'green'
    if (count <= 5) return 'yellow'
    return 'red'
  }

  const getLabel = (): string => {
    return count === 0 ? 'New' : `${count}x`
  }

  return (
    <span className={`delivery-badge ${getColorClass()} ${size}`} title={`Delivered ${count} time${count !== 1 ? 's' : ''}`}>
      {getLabel()}
    </span>
  )
}
