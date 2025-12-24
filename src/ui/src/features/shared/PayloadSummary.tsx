import { createPortal } from 'react-dom'
import { forwardRef } from 'react'
import type { MessageEnvelope } from '../../types'

export type PayloadTooltipState = {
  content: string
  anchorRect: DOMRect
  anchorKey: number
}

const toSingleLine = (value: string) => value.replace(/\s+/g, ' ').trim()

const safeParseJson = (text: string): any | null => {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

const ellipsize = (text: string, maxChars: number) => {
  const singleLine = toSingleLine(text)
  if (singleLine.length <= maxChars) return singleLine
  return singleLine.slice(0, maxChars) + '…'
}

const getValueByKey = (obj: any, key: string): string | null => {
  if (!obj || typeof obj !== 'object') return null
  const value = obj[key]
  if (value === undefined || value === null) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

const pruneForTooltip = (value: any, depth: number): any => {
  if (value === null || value === undefined) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (depth <= 0) {
    return Array.isArray(value) ? '[…]' : '{…}'
  }

  if (Array.isArray(value)) {
    const maxItems = 20
    const sliced = value.slice(0, maxItems).map((v) => pruneForTooltip(v, depth - 1))
    if (value.length > maxItems) sliced.push('…')
    return sliced
  }

  if (typeof value === 'object') {
    const out: Record<string, any> = {}
    const keys = Object.keys(value).slice(0, 30)
    for (const k of keys) {
      const lk = k.toLowerCase()
      // Exclude system/internal keys from tooltip to reduce noise.
      if (
        lk === 'message_id' ||
        lk === 'messageid' ||
        lk === 'id' ||
        lk === 'correlationid' ||
        lk === 'generationid' ||
        lk === 'internal' ||
        lk === 'system' ||
        lk.startsWith('_') ||
        lk.startsWith('$')
      ) {
        continue
      }
      out[k] = pruneForTooltip(value[k], depth - 1)
    }
    if (Object.keys(value).length > keys.length) {
      out['…'] = '…'
    }
    return out
  }

  return String(value)
}

export function buildPayloadSummaryAndTooltip(message: MessageEnvelope, maxChars = 120) {
  const rawBody = message.body || ''
  if (!rawBody) {
    return { summary: '—', tooltip: '' }
  }

  const json = safeParseJson(rawBody)
  const data = json && typeof json === 'object' ? (json.data ?? null) : null
  const top = json && typeof json === 'object' && !Array.isArray(json) ? json : null

  const getAny = (...candidates: Array<[any, string]>) => {
    for (const [obj, key] of candidates) {
      const v = getValueByKey(obj, key)
      if (v) return v
    }
    return null
  }

  const eventType =
    getAny(
      [data, 'event_type'],
      [data, 'eventType'],
      [top, 'event_type'],
      [top, 'eventType'],
      [message.applicationProperties, 'event_type'],
      [message.applicationProperties, 'eventType']
    ) || message.subject || null

  const correlationId =
    getAny(
      [message, 'correlationId'],
      [message.applicationProperties, 'correlationId'],
      [message.applicationProperties, 'correlation_id'],
      [data, 'correlationId'],
      [data, 'correlation_id'],
      [top, 'correlationId'],
      [top, 'correlation_id']
    ) || null

  const payloadTimestamp =
    getAny(
      [data, 'timestamp'],
      [data, 'time'],
      [top, 'timestamp'],
      [top, 'time']
    ) || null

  const preferredKeys = [
    'entityId',
    'orderId',
    'paymentId',
    'accountId',
    'sku',
    'amount',
    'currency',
    'status',
    'reason',
    'failureReason',
    'customerId',
    'carrier',
    'quantity',
    'delta'
  ]

  const excludedKeys = new Set([
    'message_id',
    'messageid',
    'messageId',
    'id',
    'sequenceNumber',
    'sequencenumber',
    'sequence_number',
    'generationid',
    'event_type',
    'eventtype',
    'internal',
    'system'
  ])

  const collectFromObject = (obj: any) => {
    const pairs: Array<[string, string]> = []
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return pairs

    for (const key of preferredKeys) {
      const lk = key.toLowerCase()
      if (excludedKeys.has(lk)) continue
      const v = getValueByKey(obj, key)
      if (v) pairs.push([key, v])
    }

    return pairs
  }

  const pairs: Array<[string, string]> = []

  if (eventType) pairs.push(['eventType', String(eventType)])
  if (correlationId) pairs.push(['correlationId', String(correlationId)])
  if (payloadTimestamp) pairs.push(['timestamp', String(payloadTimestamp)])

  for (const [k, v] of collectFromObject(data)) {
    if (!pairs.some(([ek]) => ek === k)) pairs.push([k, v])
  }
  for (const [k, v] of collectFromObject(top)) {
    if (!pairs.some(([ek]) => ek === k)) pairs.push([k, v])
  }

  if (pairs.length === 0 && top) {
    const keys = Object.keys(top)
      .filter((k) => {
        const lk = k.toLowerCase()
        if (excludedKeys.has(lk)) return false
        if (lk.startsWith('_') || lk.startsWith('$')) return false
        return true
      })
      .slice(0, 3)

    for (const k of keys) {
      const v = getValueByKey(top, k)
      if (v) pairs.push([k, v])
    }
  }

  const selectedPairs = pairs.slice(0, 4)
  const baseSummary =
    selectedPairs.length > 0
      ? selectedPairs.map(([k, v]) => `${k}=${v}`).join(' · ')
      : (() => {
          const raw = toSingleLine(rawBody)
          if (eventType && raw === String(eventType)) return `body=${raw}`
          return raw
        })()

  const summary = ellipsize(baseSummary, maxChars)

  const importantLines: string[] = []
  if (eventType) importantLines.push(`★ eventType: ${eventType}`)
  const findPair = (key: string) => selectedPairs.find(([k]) => k === key)?.[1] || null
  const orderId = findPair('orderId')
  const reason = findPair('reason') || findPair('failureReason')
  const status = findPair('status')
  if (orderId) importantLines.push(`★ orderId: ${orderId}`)
  if (reason) importantLines.push(`★ reason: ${reason}`)
  if (status) importantLines.push(`★ status: ${status}`)

  let payloadBlock = ''
  if (json) {
    const pruned = pruneForTooltip(json, 2)
    payloadBlock = JSON.stringify(pruned, null, 2)
  } else {
    payloadBlock = rawBody
  }

  const maxTooltipChars = 4000
  const tooltipRaw = [
    importantLines.length > 0 ? ['IMPORTANT', ...importantLines].join('\n') : '',
    '---',
    'PAYLOAD',
    payloadBlock
  ]
    .filter(Boolean)
    .join('\n')

  const tooltip = tooltipRaw.length > maxTooltipChars ? tooltipRaw.slice(0, maxTooltipChars) + '\n…' : tooltipRaw

  return { summary, tooltip }
}

export const PayloadTooltipPortal = forwardRef<
  HTMLDivElement,
  {
    tooltip: PayloadTooltipState | null
  }
>(function PayloadTooltipPortal({ tooltip }, ref) {
  if (!tooltip) return null

  const { anchorRect, content } = tooltip
  const margin = 12
  const maxWidth = 420
  const maxHeight = 520

  const leftCandidate = anchorRect.right + margin
  const left = Math.min(Math.max(leftCandidate, 12), window.innerWidth - maxWidth - 12)
  const top = Math.min(Math.max(anchorRect.top, 12), window.innerHeight - maxHeight - 12)

  return createPortal(
    <div
      className="payload-tooltip"
      role="tooltip"
      aria-label="Payload tooltip"
      style={{ position: 'fixed', left, top, maxWidth, maxHeight, zIndex: 2000 }}
      ref={ref}
    >
      <div className="payload-tooltip-title">Payload (pretty JSON)</div>
      <pre className="payload-tooltip-pre">{content}</pre>
    </div>,
    document.body
  )
})

export function PayloadSummaryCell({
  message,
  isDLQ,
  snapshotLocked,
  onToggleTooltip,
  onClearTooltip
}: {
  message: MessageEnvelope
  isDLQ: boolean
  snapshotLocked: boolean
  onToggleTooltip: (anchorKey: number, tooltip: string, anchorEl: HTMLElement) => void
  onClearTooltip?: () => void
}) {
  const { summary, tooltip } = buildPayloadSummaryAndTooltip(message, 120)
  const dlqPrefix = isDLQ ? '⚠️ ' : ''

  return (
    <td
      className="body-col"
      data-payload-cell="1"
      onClick={(e) => {
        e.stopPropagation()
        if (snapshotLocked) return
        if (!tooltip) {
          onClearTooltip?.()
          return
        }
        onToggleTooltip(message.sequenceNumber, tooltip, e.currentTarget as HTMLElement)
      }}
      title={snapshotLocked ? undefined : 'Click to view payload'}
    >
      <span className={`message-body-preview ${isDLQ ? 'dlq' : ''}`}>{dlqPrefix}{summary}</span>
    </td>
  )
}
