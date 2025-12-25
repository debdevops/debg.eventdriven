/**
 * Risk Badge Component
 * 
 * Displays a colored badge indicating risk level
 */

interface RiskBadgeProps {
  level: 'low' | 'medium' | 'high' | 'critical'
  score?: number
  showScore?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const levelConfig = {
  low: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-300',
    label: 'Low Risk'
  },
  medium: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-300',
    label: 'Medium Risk'
  },
  high: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-300',
    label: 'High Risk'
  },
  critical: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
    label: 'Critical'
  }
}

const sizeConfig = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base'
}

export function RiskBadge({
  level,
  score,
  showScore = false,
  size = 'md',
  className = ''
}: RiskBadgeProps) {
  const config = levelConfig[level]
  const sizeClasses = sizeConfig[size]
  
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
    >
      <span>{config.label}</span>
      {showScore && score !== undefined && (
        <span className="opacity-75">({score})</span>
      )}
    </span>
  )
}

/**
 * Health Badge Component
 * 
 * Displays queue health status
 */
interface HealthBadgeProps {
  health: 'healthy' | 'warning' | 'critical' | 'unknown'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const healthConfig = {
  healthy: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-300',
    icon: '✓',
    label: 'Healthy'
  },
  warning: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-300',
    icon: '⚠',
    label: 'Warning'
  },
  critical: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
    icon: '✕',
    label: 'Critical'
  },
  unknown: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-300',
    icon: '?',
    label: 'Unknown'
  }
}

export function HealthBadge({
  health,
  size = 'md',
  className = ''
}: HealthBadgeProps) {
  const config = healthConfig[health]
  const sizeClasses = sizeConfig[size]
  
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  )
}
