/**
 * Generate Test Messages Modal
 * Allows users to create realistic messages with controlled anomalies for AI analysis
 */

import { useState, useEffect } from 'react'
import { apiClient } from '../api/client'
import './GenerateMessagesModal.css'

interface GenerateMessagesModalProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string | null
  entities: Array<{ name: string; type: string }>
  currentEntity?: string
  onSuccess: (result: { totalGenerated: number; anomalousCount: number; dlqCandidates: number }) => void
}

const PRESET_COUNTS = [10, 20, 50, 100, 200, 300]

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
      const result = await apiClient.generateMessages(
        sessionId,
        count,
        targetType === 'Queue' || targetType === 'Both' ? selectedQueue : undefined,
        targetType === 'Topic' || targetType === 'Both' ? selectedTopic : undefined,
        targetType,
        includeDlq
      )

      if (result.success) {
        onSuccess(result)
        onClose()
      } else {
        setError(result.errors.join('; ') || 'Generation failed')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate messages')
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
