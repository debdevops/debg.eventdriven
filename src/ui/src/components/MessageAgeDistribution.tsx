/**
 * Message Age Distribution Component
 * 
 * WHY: Age spikes reveal incident patterns faster than scrolling through tables.
 * Click a bucket to filter the grid - instant triage workflow.
 */

import { useMemo } from 'react'
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
  
  const buckets: Array<{ key: keyof AgeDistribution; label: string; count: number; color: string }> = [
    { key: 'lessThan5m', label: '<5m', count: distribution.lessThan5m, color: '#4ade80' },
    { key: 'between5And30m', label: '5-30m', count: distribution.between5And30m, color: '#60a5fa' },
    { key: 'between30And120m', label: '30-120m', count: distribution.between30And120m, color: '#fbbf24' },
    { key: 'moreThan2h', label: '>2h', count: distribution.moreThan2h, color: '#f87171' },
  ]
  
  const maxCount = Math.max(...buckets.map(b => b.count), 1)
  
  return (
    <div className="message-age-distribution">
      <div className="distribution-header">
        <span className="distribution-title">Age Distribution</span>
        <span className="distribution-total">{messages.length} messages</span>
      </div>
      
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
                  className="bucket-bar"
                  style={{
                    height: `${heightPercent}%`,
                    backgroundColor: bucket.color
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
    </div>
  )
}
