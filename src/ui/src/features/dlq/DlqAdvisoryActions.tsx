import { useMemo } from 'react'
import type { FailureClassification } from '../../services/failureClassifier'
import type { BaselineAnomaly } from '../../services/baselineAnomaly'
import './DlqAdvisoryActions.css'

export type AdvisoryActionType = 'REPLAY' | 'WAIT' | 'ESCALATE' | 'QUARANTINE'

export type AdvisoryAction = {
  action: AdvisoryActionType
  confidence: number // 0..1
  reasoning: string
  preconditions: string
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

function formatPct(n: number) {
  return `${Math.round(clamp01(n) * 100)}%`
}

function buildActions(
  failure: FailureClassification | null,
  anomalies: BaselineAnomaly[]
): AdvisoryAction[] {
  const hasDlqGrowth = anomalies.some((a) => a.metric === 'dlqGrowth')
  const hasHighDlq = anomalies.some((a) => a.metric === 'dlq')

  const failureType = failure?.type ?? 'UNKNOWN'
  const baseConf = failure?.confidence ?? 0.55

  // Deterministic mapping. Advisory only.
  switch (failureType) {
    case 'TIMEOUT':
    case 'DEPENDENCY':
      return [
        {
          action: 'WAIT',
          confidence: clamp01(0.75 + (baseConf - 0.6) / 4),
          reasoning: 'Signals suggest a transient downstream dependency/timeout. Immediate replay often re-fails during an outage.',
          preconditions: 'Wait until dependency health is restored and DLQ growth stabilizes.'
        },
        {
          action: 'ESCALATE',
          confidence: clamp01((hasDlqGrowth || hasHighDlq ? 0.85 : 0.7) + (baseConf - 0.6) / 6),
          reasoning: 'If failures correlate with a dependency outage, escalation reduces time-to-recovery.',
          preconditions: 'Confirm dependency status and incident ownership (on-call/service dashboard).' 
        },
        {
          action: 'REPLAY',
          confidence: clamp01(0.6 + (baseConf - 0.6) / 5),
          reasoning: 'Replaying can be effective after the dependency is healthy again.',
          preconditions: 'Dependency healthy; no ongoing DLQ growth spike; start with a small sample replay.'
        }
      ]

    case 'RESOURCE_LIMIT':
      return [
        {
          action: 'WAIT',
          confidence: 0.8,
          reasoning: 'Resource limits/throttling are often temporary. Waiting for capacity/backoff can reduce repeated failures.',
          preconditions: 'Verify throttling/backpressure; ensure consumer scaling or quotas are addressed.'
        },
        {
          action: 'ESCALATE',
          confidence: clamp01(hasDlqGrowth ? 0.88 : 0.75),
          reasoning: 'If DLQ growth continues, capacity changes or rate limits need intervention.',
          preconditions: 'Check quota dashboards, scaling, and rate-limiting configuration.'
        },
        {
          action: 'REPLAY',
          confidence: 0.55,
          reasoning: 'Replay is reasonable after capacity stabilizes and consumer throughput is safe.',
          preconditions: 'Confirm limits lifted; throttle replay; monitor DLQ growth and processing latency.'
        }
      ]

    case 'AUTH':
      return [
        {
          action: 'ESCALATE',
          confidence: clamp01(0.85 + (baseConf - 0.6) / 6),
          reasoning: 'Authentication/authorization failures are typically permanent until credentials/roles are fixed.',
          preconditions: 'Validate managed identity/keys/secrets and access policies.'
        },
        {
          action: 'QUARANTINE',
          confidence: 0.75,
          reasoning: 'Quarantine prevents repeated failure loops while auth is being fixed.',
          preconditions: 'Ensure there is a known recovery plan for quarantined messages.'
        },
        {
          action: 'REPLAY',
          confidence: 0.35,
          reasoning: 'Replay before fixing auth is likely to re-fail.',
          preconditions: 'Fix auth issue first; verify with a single message end-to-end.'
        }
      ]

    case 'VALIDATION':
      return [
        {
          action: 'QUARANTINE',
          confidence: 0.82,
          reasoning: 'Validation/schema failures indicate message content incompatibility; bulk replay can amplify failure noise.',
          preconditions: 'Confirm schema expectations and decide on transformation/backfill strategy.'
        },
        {
          action: 'ESCALATE',
          confidence: 0.78,
          reasoning: 'Requires producer/contract fix or consumer tolerance change.',
          preconditions: 'Identify owning service and recent deployment/config changes.'
        },
        {
          action: 'REPLAY',
          confidence: 0.3,
          reasoning: 'Replay without a schema fix is unlikely to succeed.',
          preconditions: 'Only replay after a validated fix and with a small canary set.'
        }
      ]

    case 'UNKNOWN':
    default:
      return [
        {
          action: 'WAIT',
          confidence: 0.55,
          reasoning: 'Insufficient deterministic signals; avoid aggressive actions until more context is gathered.',
          preconditions: 'Check recent deployments, dependency health, and message samples.'
        },
        {
          action: 'ESCALATE',
          confidence: clamp01(hasDlqGrowth ? 0.82 : 0.65),
          reasoning: 'If DLQ continues to grow, escalation is safer than repeated manual trial-and-error.',
          preconditions: 'Collect a few representative messages and failure symptoms.'
        },
        {
          action: 'REPLAY',
          confidence: 0.4,
          reasoning: 'Replay may work for transient unknowns, but should be cautious.',
          preconditions: 'Start with a small sample; monitor processing outcomes.'
        }
      ]
  }
}

// Exported for UI composition (compact DLQ header row) without changing advisory logic.
export function getDlqAdvisoryActions(
  failure: FailureClassification | null,
  anomalies: BaselineAnomaly[]
): AdvisoryAction[] {
  return buildActions(failure, anomalies)
}

export function DlqAdvisoryActions({
  failure,
  anomalies,
  actionsOverride,
  variant = 'standalone'
}: {
  failure: FailureClassification | null
  anomalies: BaselineAnomaly[]
  actionsOverride?: AdvisoryAction[]
  variant?: 'standalone' | 'embedded'
}) {
  const computed = useMemo(() => buildActions(failure, anomalies), [failure, anomalies])
  const actions = actionsOverride ?? computed

  if (!actions || actions.length === 0) return null

  const content = (
    <>
      <div className="dlq-advisory-subtitle">Read-only guidance — no actions are executed automatically.</div>
      <div className="dlq-advisory-grid">
        {actions.map((a) => (
          <div key={a.action} className="dlq-advisory-card">
            <div className="dlq-advisory-card-top">
              <span className="dlq-advisory-action">{a.action}</span>
              <span className="dlq-advisory-confidence" title={`Confidence: ${formatPct(a.confidence)}`}>{formatPct(a.confidence)}</span>
            </div>
            <div className="dlq-advisory-reasoning">{a.reasoning}</div>
            <div className="dlq-advisory-preconditions">
              <span className="dlq-advisory-preconditions-label">Preconditions:</span> {a.preconditions}
            </div>
          </div>
        ))}
      </div>
    </>
  )

  if (variant === 'embedded') {
    return <div className="dlq-advisory-embedded">{content}</div>
  }

  return (
    <div className="dlq-advisory">
      <div className="dlq-advisory-header">
        <div className="dlq-advisory-title">Advisory actions</div>
      </div>
      <div className="dlq-advisory-content">{content}</div>
    </div>
  )
}
