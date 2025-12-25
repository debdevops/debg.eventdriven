import type { MessageEnvelope } from '../types'

export type FailureType =
  | 'TIMEOUT'
  | 'VALIDATION'
  | 'AUTH'
  | 'RESOURCE_LIMIT'
  | 'DEPENDENCY'
  | 'UNKNOWN'

export type FailureClassification = {
  type: FailureType
  /** 0..1 deterministic confidence */
  confidence: number
  /** Deterministic evidence tokens used for classification */
  evidence: string[]
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

const normalize = (value: unknown): string => {
  if (value == null) return ''
  return String(value).trim().toLowerCase()
}

const includesAny = (haystack: string, needles: string[]) => {
  for (const n of needles) {
    if (haystack.includes(n)) return true
  }
  return false
}

const scoreMatches = (haystack: string, needles: string[], evidence: string[], evidenceTag: string) => {
  let hits = 0
  for (const n of needles) {
    if (haystack.includes(n)) {
      hits += 1
      evidence.push(`${evidenceTag}:${n}`)
    }
  }
  return hits
}

export function classifyFailure(message: MessageEnvelope): FailureClassification {
  const reason = normalize((message as any).deadLetterReason)
  const description = normalize((message as any).deadLetterErrorDescription)
  const subject = normalize((message as any).subject)
  const body = normalize((message as any).body)

  const text = [reason, description, subject].filter(Boolean).join(' | ')

  // Strong signals (ordered): AUTH, VALIDATION, RESOURCE_LIMIT, TIMEOUT, DEPENDENCY
  const evidence: string[] = []

  const authNeedles = [
    'unauthorized',
    'forbidden',
    'access denied',
    'authentication',
    'authorization',
    'token',
    'jwt',
    'signature',
    'expired token',
    '401',
    '403'
  ]

  const validationNeedles = [
    'validation',
    'invalid',
    'schema',
    'deserialization',
    'deserialize',
    'missing field',
    'required',
    'bad request',
    '400',
    'format',
    'cannot parse'
  ]

  const resourceNeedles = [
    'quota',
    'throttle',
    'throttl',
    'rate limit',
    'too many requests',
    '429',
    'resource limit',
    'out of memory',
    'oom',
    'service busy',
    'server busy',
    'capacity'
  ]

  const timeoutNeedles = [
    'timeout',
    'timed out',
    'operation timed out',
    'request timeout',
    'deadline exceeded',
    'context deadline',
    'canceled',
    'cancelled'
  ]

  const dependencyNeedles = [
    '502',
    '503',
    '504',
    'bad gateway',
    'gateway timeout',
    'service unavailable',
    'connection refused',
    'connection reset',
    'dns',
    'socket',
    'ssl',
    'tls',
    'http',
    'grpc',
    'cosmos',
    'sql',
    'redis',
    'kafka',
    'eventhub',
    'storage'
  ]

  const authHits = scoreMatches(text, authNeedles, evidence, 'auth')
  const validationHits = scoreMatches(text, validationNeedles, evidence, 'validation')
  const resourceHits = scoreMatches(text, resourceNeedles, evidence, 'resource')
  const timeoutHits = scoreMatches(text, timeoutNeedles, evidence, 'timeout')
  const dependencyHits = scoreMatches(text, dependencyNeedles, evidence, 'dependency')

  // Body can contain structured error payloads; treat as weak signal only.
  if (body) {
    if (includesAny(body, ['timeout', 'timed out'])) evidence.push('body:timeout')
    if (includesAny(body, ['unauthorized', 'forbidden', 'token'])) evidence.push('body:auth')
    if (includesAny(body, ['validation', 'schema', 'invalid'])) evidence.push('body:validation')
  }

  type Candidate = { type: FailureType; hits: number }
  const candidates: Candidate[] = [
    { type: 'AUTH', hits: authHits },
    { type: 'VALIDATION', hits: validationHits },
    { type: 'RESOURCE_LIMIT', hits: resourceHits },
    { type: 'TIMEOUT', hits: timeoutHits },
    { type: 'DEPENDENCY', hits: dependencyHits }
  ]

  const best = candidates.reduce((a, b) => (b.hits > a.hits ? b : a), { type: 'UNKNOWN', hits: 0 })

  if (best.hits === 0) {
    // Give UNKNOWN a conservative confidence; raise slightly if reason/description exist.
    const base = text ? 0.55 : 0.5
    return { type: 'UNKNOWN', confidence: base, evidence: text ? ['unknown:unmatched'] : ['unknown:no-signal'] }
  }

  // Deterministic confidence heuristic:
  // - 1 hit: 0.70
  // - 2 hits: 0.82
  // - 3+ hits: 0.90
  // Boost if the DLQ reason itself contains the keyword (stronger than description).
  let confidence = best.hits === 1 ? 0.7 : best.hits === 2 ? 0.82 : 0.9

  const reasonBoostNeedles: Record<FailureType, string[]> = {
    AUTH: authNeedles,
    VALIDATION: validationNeedles,
    RESOURCE_LIMIT: resourceNeedles,
    TIMEOUT: timeoutNeedles,
    DEPENDENCY: dependencyNeedles,
    UNKNOWN: []
  }

  if (best.type !== 'UNKNOWN' && reason && includesAny(reason, reasonBoostNeedles[best.type])) {
    evidence.push('boost:deadLetterReason')
    confidence += 0.05
  }

  return {
    type: best.type,
    confidence: clamp01(confidence),
    evidence
  }
}
