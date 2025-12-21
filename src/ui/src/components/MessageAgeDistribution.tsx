/**
 * Message Age Distribution Component
 * 
 * WHY: Age spikes reveal incident patterns faster than scrolling through tables.
 * Click a bucket to filter the grid - instant triage workflow.
 */

import { useMemo, useState } from 'react'
import type { MessageEnvelope } from '../types'
import { computeAgeDistribution, type AgeDistribution } from '../utils/eventTypeExtractor'
import './MessageAgeDistribution.css'

interface MessageAgeDistributionProps {
  messages: MessageEnvelope[]
  onBucketClick?: (bucketKey: keyof AgeDistribution) => void
  activeBucket?: keyof AgeDistribution | null
}

export function MessageAgeDistribution({ messages, onBucketClick, activeBucket }: MessageAgeDistributionProps) {
  const distribution = useMemo(() => computeAgeDistribution(messages), [messages])

  // Default: collapsed for maximum grid visibility
  const [collapsed, setCollapsed] = useState(true)
  
  const buckets: Array<{ key: keyof AgeDistribution; label: string; count: number; tone: 0 | 1 | 2 | 3 }> = [
    { key: 'lessThan5m', label: '<5m', count: distribution.lessThan5m, tone: 0 },
    { key: 'between5And30m', label: '5-30m', count: distribution.between5And30m, tone: 1 },
    { key: 'between30And120m', label: '30-120m', count: distribution.between30And120m, tone: 2 },
    { key: 'moreThan2h', label: '>2h', count: distribution.moreThan2h, tone: 3 },
  ]
  
  const maxCount = Math.max(...buckets.map(b => b.count), 1)
  
  return (
    <div className={`message-age-distribution ${collapsed ? 'collapsed' : ''}`}>
      <div className="distribution-header">
        <div className="distribution-header-left">
          <span className="distribution-title">Age Distribution</span>
          <span className="distribution-total">{messages.length} messages</span>
        </div>
        <button
          type="button"
          className="distribution-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>

      {!collapsed && (
      <div className="distribution-bars">
        {buckets.map(bucket => {
          const heightPercent = (bucket.count / maxCount) * 100
          const isActive = activeBucket === bucket.key
          
          return (
            <div
              key={bucket.key}
              className={`age-bucket ${isActive ? 'active' : ''} ${bucket.count === 0 ? 'empty' : ''}`}
              onClick={() => bucket.count > 0 && onBucketClick?.(bucket.key)}
              title={`${bucket.label}: ${bucket.count} messages`}
            >
              <div className="bucket-bar-container">
                <div
                  className={`bucket-bar tone-${bucket.tone}`}
                  style={{
                    height: `${heightPercent}%`
                  }}
                />
              </div>
              <div className="bucket-label">
                <span className="bucket-label-text">{bucket.label}</span>
                <span className="bucket-count">{bucket.count}</span>
              </div>
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}
