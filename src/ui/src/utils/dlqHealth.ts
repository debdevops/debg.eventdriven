import type { MessageEnvelope } from '../types'

export type DlqSeverity = 'HEALTHY' | 'WARNING' | 'CRITICAL'

export interface DlqHealthInput {
  dlqCount: number
  activeCount: number
  /** Optional: oldest DLQ enqueued time (ISO string). If omitted, age is treated as unknown. */
  oldestDlqEnqueuedTimeUtc?: string | null
  /** Optional: sampled DLQ messages (e.g., from DLQ view peek). Used to detect MaxDeliveryExceeded. */
  sampledDlqMessages?: MessageEnvelope[] | null
}

export interface DlqHealthResult {
  severity: DlqSeverity
  dlqCount: number
  activeCount: number
  ratio: number
  oldestDlqAgeMinutes: number | null
  hasMaxDeliveryExceeded: boolean
  label: 'Healthy' | 'Warning' | 'Critical'
  why: string
  whyTooltip: string
}

const MAX_DELIVERY_EXCEEDED = 'MaxDeliveryExceeded'

const safeNumber = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

const clampNonNegative = (n: number): number => (n < 0 ? 0 : n)

export const formatAgeMinutes = (minutes: number): string => {
  if (!Number.isFinite(minutes)) return '—'
  const m = clampNonNegative(Math.floor(minutes))
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h ${m % 60}m`
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`
}

const computeOldestAgeMinutes = (oldestDlqEnqueuedTimeUtc?: string | null): number | null => {
  if (!oldestDlqEnqueuedTimeUtc) return null
  const t = new Date(oldestDlqEnqueuedTimeUtc).getTime()
  if (!Number.isFinite(t)) return null
  return Math.floor((Date.now() - t) / 60000)
}

const hasReason = (messages: MessageEnvelope[] | null | undefined, reason: string): boolean => {
  if (!messages || messages.length === 0) return false
  const needle = reason.toLowerCase()
  return messages.some((m) => (m.deadLetterReason || '').toLowerCase() === needle)
}

/**
 * Central DLQ health model (queues + subscriptions).
 *
 * Rules:
 * - HEALTHY: dlqCount === 0
 * - WARNING: dlqCount > 0 AND ratio < 5% AND oldestDlqAge < 30m
 * - CRITICAL: ratio >= 5% OR oldestDlqAge >= 30m OR any sampled DLQ reason == MaxDeliveryExceeded
 *
 * Notes:
 * - If oldest DLQ age is unknown (not sampled), we classify purely by ratio to avoid false CRITICAL.
 */
export const computeDlqHealth = (input: DlqHealthInput): DlqHealthResult => {
  const dlqCount = clampNonNegative(safeNumber(input.dlqCount))
  const activeCount = clampNonNegative(safeNumber(input.activeCount))

  const ratio = dlqCount === 0
    ? 0
    : activeCount === 0
      ? 1
      : dlqCount / activeCount

  const oldestDlqAgeMinutes = computeOldestAgeMinutes(input.oldestDlqEnqueuedTimeUtc ?? null)
  const hasMaxDeliveryExceeded = hasReason(input.sampledDlqMessages ?? null, MAX_DELIVERY_EXCEEDED)

  let severity: DlqSeverity = 'HEALTHY'
  if (dlqCount === 0) {
    severity = 'HEALTHY'
  } else {
    const ratioCritical = ratio >= 0.05
    const ageCritical = oldestDlqAgeMinutes !== null ? oldestDlqAgeMinutes >= 30 : false

    const ratioWarning = ratio < 0.05
    const ageWarning = oldestDlqAgeMinutes !== null ? oldestDlqAgeMinutes < 30 : true

    if (hasMaxDeliveryExceeded || ratioCritical || ageCritical) {
      severity = 'CRITICAL'
    } else if (ratioWarning && ageWarning) {
      severity = 'WARNING'
    } else {
      // Fallback should be rare; keep deterministic.
      severity = 'WARNING'
    }
  }

  const label = severity === 'HEALTHY' ? 'Healthy' : severity === 'WARNING' ? 'Warning' : 'Critical'

  const ratioPct = Math.round(ratio * 1000) / 10 // 0.1% precision
  const ageText = oldestDlqAgeMinutes === null ? 'unknown' : formatAgeMinutes(oldestDlqAgeMinutes)

  const reasons: string[] = []
  if (dlqCount === 0) {
    reasons.push('DLQ is empty')
  } else {
    if (hasMaxDeliveryExceeded) {
      reasons.push('DeadLetterReason indicates MaxDeliveryExceeded')
    }
    if (ratio >= 0.05) {
      reasons.push(`DLQ ratio is ${ratioPct}% (≥ 5%)`)
    } else {
      reasons.push(`DLQ ratio is ${ratioPct}% (< 5%)`)
    }
    if (oldestDlqAgeMinutes !== null) {
      reasons.push(`Oldest DLQ age is ${ageText}${oldestDlqAgeMinutes >= 30 ? ' (≥ 30m)' : ' (< 30m)'}`)
    } else {
      reasons.push('Oldest DLQ age not sampled yet')
    }
  }

  const why =
    severity === 'HEALTHY'
      ? 'DLQ is empty.'
      : `Marked ${label} because ${dlqCount} of ${activeCount} active messages (${ratioPct}%) are in DLQ${oldestDlqAgeMinutes !== null ? ` and the oldest DLQ message is ${ageText} old` : ''}.`

  const whyTooltip =
    severity === 'HEALTHY'
      ? 'Healthy because DLQ count is 0.'
      : [
          `Status: ${label}`,
          `DLQ count: ${dlqCount}`,
          `Active count: ${activeCount}`,
          `DLQ ratio: ${ratioPct}%`,
          `Oldest DLQ age: ${ageText}`,
          hasMaxDeliveryExceeded ? `Reason: ${MAX_DELIVERY_EXCEEDED}` : '',
          '',
          'Rules:',
          '- Warning: DLQ > 0 AND ratio < 5% AND oldest < 30m',
          '- Critical: ratio ≥ 5% OR oldest ≥ 30m OR reason == MaxDeliveryExceeded'
        ]
          .filter(Boolean)
          .join('\n')

  return {
    severity,
    dlqCount,
    activeCount,
    ratio,
    oldestDlqAgeMinutes,
    hasMaxDeliveryExceeded,
    label,
    why,
    whyTooltip
  }
}
