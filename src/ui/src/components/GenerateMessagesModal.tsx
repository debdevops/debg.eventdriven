/**
 * Generate Test Messages Modal
 * Allows users to create realistic messages with controlled anomalies for AI analysis
 */

import { useState, useEffect } from 'react'
import { apiClient } from '../api/client'
import { API_BASE_URL } from '../config/api'
import './GenerateMessagesModal.css'

interface GenerateMessagesModalProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string | null
  entities: Array<{ name: string; type: string }>
  currentEntity?: string
  onSuccess: (result: {
    totalGenerated: number
    anomalousCount: number
    dlqCandidates: number
    dlqDeadLettered: number
    dlqDeadLetteredQueue: number
    dlqDeadLetteredSubscriptions: number
    dlqTopicName?: string
    dlqSubscriptionName?: string
  }) => void
}

const PRESET_COUNTS = [10, 20, 50, 100, 200, 300]

type GeneratedKind = 'normal' | 'suspicious' | 'dlq'

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return '{"error":"unstringifiable"}'
  }
}

function pickOne<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length]
}

function makeIsoWithOffsetMinutes(base: Date, offsetMinutes: number): string {
  return new Date(base.getTime() + offsetMinutes * 60_000).toISOString()
}

function buildGeneratedMessage(kind: GeneratedKind, index: number, includeDlq: boolean): {
  kind: GeneratedKind
  payload: string
  applicationProperties: Record<string, string>
} {
  const now = new Date()
  const seed = Date.now() + index * 97

  const normalEventTypes = [
    'OrderCreated',
    'PaymentProcessed',
    'InventoryUpdated',
    'ShipmentDispatched',
    'UserRegistered',
    'InvoiceIssued'
  ]
  const suspiciousEventTypes = ['UnknownEvent', 'OrderCreaetd', 'PAYMENT_PROCESSED', 'InventoryUpdatedV2']

  const baseCorrelationId = `corr-${Math.floor(seed / 1000)}`
  const eventType =
    kind === 'normal'
      ? pickOne(normalEventTypes, seed)
      : pickOne([...normalEventTypes, ...suspiciousEventTypes], seed)

  const baseBody: any = {
    eventType,
    occurredAt: now.toISOString(),
    correlationId: baseCorrelationId,
    source: 'ui-test-generator',
    version: 1,
    data: {
      orderId: `ORD-${Math.abs(seed) % 100000}`,
      customerId: `CUST-${Math.abs(seed) % 10000}`,
      amount: Number(((Math.abs(seed) % 50000) / 100).toFixed(2)),
      currency: 'USD',
      region: pickOne(['us-east', 'us-west', 'eu-north', 'ap-south'], seed)
    }
  }

  const applicationProperties: Record<string, string> = {
    timestamp: now.toISOString(),
    source: 'generate-messages-modal',
    correlationId: baseCorrelationId,
    eventType
  }

  if (kind === 'suspicious') {
    // Suspicious / anomalous variants
    const variant = Math.abs(seed) % 4

    if (variant === 0) {
      // Out-of-order timestamp (in the past)
      baseBody.occurredAt = makeIsoWithOffsetMinutes(now, -180)
      applicationProperties.anomalyType = 'out-of-order-timestamp'
    } else if (variant === 1) {
      // Field value anomaly
      baseBody.data.amount = -Math.abs(baseBody.data.amount)
      applicationProperties.anomalyType = 'negative-amount'
    } else if (variant === 2) {
      // Unexpected eventType already picked from suspicious list
      applicationProperties.anomalyType = 'unexpected-event-type'
    } else {
      // Duplicate-ish correlation
      baseBody.correlationId = 'corr-duplicate'
      applicationProperties.correlationId = 'corr-duplicate'
      applicationProperties.anomalyType = 'duplicate-correlation'
    }
  }

  if (kind === 'dlq' && includeDlq) {
    // DLQ-eligible variants (flag + invalid/missing fields)
    applicationProperties.ForceDlq = 'true'
    applicationProperties.anomalyType = 'dlq-candidate'

    const dlqVariant = Math.abs(seed) % 3
    if (dlqVariant === 0) {
      // Missing required fields
      delete baseBody.data.orderId
      baseBody.data.missingRequired = true
      applicationProperties.dlqReason = 'missing-required-fields'
    } else if (dlqVariant === 1) {
      // Invalid payload shape (data should be object)
      baseBody.data = 'INVALID_SHAPE'
      applicationProperties.dlqReason = 'invalid-payload-shape'
    } else {
      // Business rule violation
      baseBody.data.amount = 9999999
      baseBody.data.currency = 'XXX'
      applicationProperties.dlqReason = 'business-rule-violation'
    }
  }

  // Some DLQ candidates should be non-JSON to test parsers; keep it rare.
  if (kind === 'dlq' && includeDlq && Math.abs(seed) % 10 === 0) {
    return {
      kind,
      payload: `NOT_JSON|eventType=${eventType}|correlationId=${baseCorrelationId}|idx=${index}`,
      applicationProperties
    }
  }

  return {
    kind,
    payload: safeJsonStringify(baseBody),
    applicationProperties
  }
}

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  const limit = Math.max(1, Math.min(concurrency, 8))
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      await worker(items[index], index)
    }
  })
  await Promise.all(runners)
}

export default function GenerateMessagesModal({
  isOpen,
  onClose,
  sessionId,
  entities,
  currentEntity,
  onSuccess
}: GenerateMessagesModalProps) {
  const [count, setCount] = useState(50)
  const [targetType, setTargetType] = useState<'Queue' | 'Topic' | 'Both'>('Queue')
  const [includeDlq, setIncludeDlq] = useState(true)
  const [selectedQueue, setSelectedQueue] = useState(currentEntity || '')
  const [selectedTopic, setSelectedTopic] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter entities by type (capitalize to match Entity type)
  const queues = entities.filter(e => e.type === 'Queue').map(e => e.name)
  const topics = entities.filter(e => e.type === 'Topic').map(e => e.name)

  // Handle modal open - set default entity
  useEffect(() => {
    if (isOpen && currentEntity && !selectedQueue && !selectedTopic) {
      const entity = entities.find(e => e.name === currentEntity)
      if (entity?.type === 'Queue') {
        setSelectedQueue(currentEntity)
        setTargetType('Queue')
      } else if (entity?.type === 'Topic') {
        setSelectedTopic(currentEntity)
        setTargetType('Topic')
      }
    }
  }, [isOpen, currentEntity, entities, selectedQueue, selectedTopic])

  // Validate form
  const canGenerate = () => {
    if (!sessionId) return false
    if (targetType === 'Queue' && !selectedQueue) return false
    if (targetType === 'Topic' && !selectedTopic) return false
    if (targetType === 'Both' && (!selectedQueue || !selectedTopic)) return false
    return count >= 10 && count <= 300
  }

  const handleGenerate = async () => {
    if (!sessionId || !canGenerate()) return

    setIsGenerating(true)
    setError(null)

    try {
      // If the user explicitly requests DLQ test cases, use the backend generator.
      // Only the backend can reliably place messages into the real Service Bus DLQ.
      if (includeDlq) {
        const result = await apiClient.generateMessages(
          sessionId,
          count,
          targetType === 'Queue' || targetType === 'Both' ? selectedQueue : undefined,
          targetType === 'Topic' || targetType === 'Both' ? selectedTopic : undefined,
          undefined,
          targetType,
          includeDlq
        )

        if (result.success) {
          onSuccess(result)
          onClose()
        } else {
          setError(result.errors.join('; ') || 'Generation failed')
        }
        return
      }

      // Frontend-driven generation using the existing send endpoint.
      // This avoids backend API changes and guarantees a realistic mix for AI detection.
      const queueTarget = targetType === 'Queue' || targetType === 'Both' ? selectedQueue : null
      const topicTarget = targetType === 'Topic' || targetType === 'Both' ? selectedTopic : null

      const targets: string[] = []
      if (queueTarget) targets.push(queueTarget)
      if (topicTarget) targets.push(topicTarget)

      if (targets.length === 0) {
        setError('Select a target queue/topic')
        return
      }

      // Distribution for >=50: realistic mix
      const dlqPct = includeDlq ? 0.12 : 0
      const suspiciousPct = 0.22
      const dlqCount = Math.round(count * dlqPct)
      const suspiciousCount = Math.round(count * suspiciousPct)
      const normalCount = Math.max(0, count - dlqCount - suspiciousCount)

      const planned: GeneratedKind[] = [
        ...Array.from({ length: normalCount }, () => 'normal' as const),
        ...Array.from({ length: suspiciousCount }, () => 'suspicious' as const),
        ...Array.from({ length: dlqCount }, () => 'dlq' as const)
      ]

      // Shuffle deterministically-ish
      planned.sort((a, b) => {
        const seed = Date.now() % 997
        return (a.charCodeAt(0) + seed) - (b.charCodeAt(0) + seed)
      })

      let sent = 0
      let failed = 0

      const sendOne = async (kind: GeneratedKind, i: number) => {
        const target = targets.length === 1 ? targets[0] : targets[i % targets.length]
        const generated = buildGeneratedMessage(kind, i, includeDlq)

        const response = await fetch(`${API_BASE_URL}/api/namespace/${sessionId}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityName: target,
            message: generated.payload,
            applicationProperties: {
              ...generated.applicationProperties,
              generatorKind: generated.kind,
              batchIndex: i + 1
            }
          })
        })

        if (!response.ok) {
          throw new Error(`Send failed (${response.status})`)
        }
      }

      await runWithConcurrency(planned, 6, async (kind, i) => {
        try {
          await sendOne(kind, i)
          sent++
        } catch {
          failed++
        }
      })

      if (sent === 0) {
        setError('Failed to generate messages')
        return
      }

      onSuccess({
        totalGenerated: sent,
        anomalousCount: suspiciousCount + dlqCount,
        dlqCandidates: dlqCount,
        dlqDeadLettered: 0,
        dlqDeadLetteredQueue: 0,
        dlqDeadLetteredSubscriptions: 0
      })
      onClose()
    } catch (err: any) {
      // Fallback: if send endpoint is unavailable, use existing backend generator.
      try {
        const result = await apiClient.generateMessages(
          sessionId,
          count,
          targetType === 'Queue' || targetType === 'Both' ? selectedQueue : undefined,
          targetType === 'Topic' || targetType === 'Both' ? selectedTopic : undefined,
          undefined,
          targetType,
          includeDlq
        )

        if (result.success) {
          onSuccess(result)
          onClose()
        } else {
          setError(result.errors.join('; ') || 'Generation failed')
        }
      } catch (fallbackErr: any) {
        setError(fallbackErr?.message || err?.message || 'Failed to generate messages')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleClose = () => {
    if (!isGenerating) {
      setError(null)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="modal-backdrop" onClick={handleClose} />
      <div className="generate-modal" role="dialog" aria-labelledby="generate-modal-title">
        <div className="modal-header">
          <h2 id="generate-modal-title">Generate Test Messages</h2>
          <button
            className="modal-close-btn"
            onClick={handleClose}
            disabled={isGenerating}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="form-section">
            <label className="form-label">
              Message Count
              <span className="label-hint">({count} messages with 5-10% anomalies)</span>
            </label>
            <div className="preset-buttons">
              {PRESET_COUNTS.map(preset => (
                <button
                  key={preset}
                  className={`preset-btn ${count === preset ? 'active' : ''}`}
                  onClick={() => setCount(preset)}
                  disabled={isGenerating}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="range"
              min="10"
              max="300"
              step="10"
              value={count}
              onChange={e => setCount(Number(e.target.value))}
              disabled={isGenerating}
              className="count-slider"
            />
          </div>

          <div className="form-section">
            <label className="form-label">Target Type</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="targetType"
                  value="Queue"
                  checked={targetType === 'Queue'}
                  onChange={() => setTargetType('Queue')}
                  disabled={isGenerating}
                />
                <span>Queue Only</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="targetType"
                  value="Topic"
                  checked={targetType === 'Topic'}
                  onChange={() => setTargetType('Topic')}
                  disabled={isGenerating}
                />
                <span>Topic Only</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="targetType"
                  value="Both"
                  checked={targetType === 'Both'}
                  onChange={() => setTargetType('Both')}
                  disabled={isGenerating}
                />
                <span>Both</span>
              </label>
            </div>
          </div>

          {(targetType === 'Queue' || targetType === 'Both') && (
            <div className="form-section">
              <label className="form-label" htmlFor="queue-select">
                Target Queue
              </label>
              <select
                id="queue-select"
                value={selectedQueue}
                onChange={e => setSelectedQueue(e.target.value)}
                disabled={isGenerating}
                className="entity-select"
              >
                <option value="">Select queue...</option>
                {queues.map(q => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(targetType === 'Topic' || targetType === 'Both') && (
            <div className="form-section">
              <label className="form-label" htmlFor="topic-select">
                Target Topic
              </label>
              <select
                id="topic-select"
                value={selectedTopic}
                onChange={e => setSelectedTopic(e.target.value)}
                disabled={isGenerating}
                className="entity-select"
              >
                <option value="">Select topic...</option>
                {topics.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-section">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={includeDlq}
                onChange={e => setIncludeDlq(e.target.checked)}
                disabled={isGenerating}
              />
              <span>Include DLQ test cases (messages with ForceDlq flag)</span>
            </label>
            <p className="help-text">
              Some messages will be marked to simulate DLQ scenarios for testing
            </p>
          </div>

          {error && (
            <div className="error-banner">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="info-box">
            <strong>What happens:</strong>
            <ul>
              <li>Generates {count} realistic Service Bus messages</li>
              <li>Includes 6 event types: PaymentProcessed, OrderCreated, InventoryUpdated, etc.</li>
              <li>Automatically adds 5-10% anomalies (missing fields, invalid values, duplicates)</li>
              {includeDlq && <li>Marks some messages for DLQ simulation</li>}
              <li>Sends in batches for optimal performance</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={isGenerating}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={!canGenerate() || isGenerating}
          >
            {isGenerating ? 'Generating...' : `Generate ${count} Messages`}
          </button>
        </div>
      </div>
    </>
  )
}
