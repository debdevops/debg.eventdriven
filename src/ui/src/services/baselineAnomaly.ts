export type BaselineMetric = 'active' | 'dlq' | 'oldestAge' | 'dlqGrowth'

export type BaselineAnomaly = {
  metric: BaselineMetric
  /** 0..1 deterministic confidence */
  confidence: number
  /** Plain-English explanation for operators */
  explanation: string
  /** Higher means more unusual; sign indicates direction */
  zScore?: number
}

export type BaselinePoint = {
  t: number
  active: number
  dlq: number
  oldestAgeMinutes: number | null
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

const safeNum = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)

const stddev = (xs: number[]) => {
  if (xs.length < 2) return 0
  const m = mean(xs)
  const v = xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1)
  return Math.sqrt(v)
}

const zscore = (x: number, xs: number[]) => {
  const s = stddev(xs)
  if (s <= 0) return 0
  return (x - mean(xs)) / s
}

function keyFor(entityKey: string) {
  return `baseline:v1:${entityKey}`
}

function loadPoints(entityKey: string): BaselinePoint[] {
  try {
    const raw = localStorage.getItem(keyFor(entityKey))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((p: any) => ({
        t: safeNum(p.t),
        active: Math.max(0, Math.floor(safeNum(p.active))),
        dlq: Math.max(0, Math.floor(safeNum(p.dlq))),
        oldestAgeMinutes: p.oldestAgeMinutes == null ? null : Math.max(0, Math.floor(safeNum(p.oldestAgeMinutes)))
      }))
      .filter((p: BaselinePoint) => Number.isFinite(p.t) && p.t > 0)
  } catch {
    return []
  }
}

function savePoints(entityKey: string, points: BaselinePoint[]) {
  try {
    localStorage.setItem(keyFor(entityKey), JSON.stringify(points))
  } catch {
    // ignore (private mode/quota)
  }
}

export function recordAndDetectBaseline(
  entityKey: string,
  point: BaselinePoint,
  opts?: {
    maxPoints?: number
    windowPoints?: number
    zThreshold?: number
  }
): { points: BaselinePoint[]; anomalies: BaselineAnomaly[] } {
  const maxPoints = opts?.maxPoints ?? 120
  const windowPoints = opts?.windowPoints ?? 30
  const zThreshold = opts?.zThreshold ?? 2.5

  const prev = loadPoints(entityKey)
  const next = [...prev, point].slice(-maxPoints)
  savePoints(entityKey, next)

  // Need a baseline window excluding current.
  if (next.length < Math.max(8, windowPoints / 2)) {
    return { points: next, anomalies: [] }
  }

  const history = next.slice(0, -1).slice(-windowPoints)
  const current = next[next.length - 1]

  const anomalies: BaselineAnomaly[] = []

  const activeHist = history.map((p) => p.active)
  const dlqHist = history.map((p) => p.dlq)

  const zActive = zscore(current.active, activeHist)
  const zDlq = zscore(current.dlq, dlqHist)

  if (Math.abs(zActive) >= zThreshold) {
    anomalies.push({
      metric: 'active',
      confidence: clamp01(Math.min(0.95, 0.65 + Math.abs(zActive) / 6)),
      zScore: zActive,
      explanation: `Active count is ${current.active}, which is ${zActive > 0 ? 'above' : 'below'} the baseline (z=${zActive.toFixed(
        1
      )}).`
    })
  }

  if (Math.abs(zDlq) >= zThreshold) {
    anomalies.push({
      metric: 'dlq',
      confidence: clamp01(Math.min(0.95, 0.7 + Math.abs(zDlq) / 6)),
      zScore: zDlq,
      explanation: `DLQ count is ${current.dlq}, which is ${zDlq > 0 ? 'above' : 'below'} the baseline (z=${zDlq.toFixed(1)}).`
    })
  }

  // Oldest-age anomaly (only if we have non-zero history signal)
  if (current.oldestAgeMinutes != null) {
    const nonZeroAgeHist = history.map((p) => p.oldestAgeMinutes).filter((v): v is number => v != null && v > 0)
    if (nonZeroAgeHist.length >= 6) {
      const zAge = zscore(current.oldestAgeMinutes, nonZeroAgeHist)
      if (Math.abs(zAge) >= zThreshold) {
        anomalies.push({
          metric: 'oldestAge',
          confidence: clamp01(Math.min(0.95, 0.65 + Math.abs(zAge) / 6)),
          zScore: zAge,
          explanation: `Oldest message age is ${current.oldestAgeMinutes}m, which is ${zAge > 0 ? 'older' : 'younger'} than baseline (z=${zAge.toFixed(
            1
          )}).`
        })
      }
    }
  }

  // DLQ growth spike (delta compared to baseline deltas)
  if (history.length >= 8) {
    const dlqDeltas = history.slice(1).map((p, idx) => p.dlq - history[idx].dlq)
    const currentDelta = current.dlq - history[history.length - 1].dlq
    const zDelta = zscore(currentDelta, dlqDeltas)

    if (currentDelta > 0 && zDelta >= zThreshold) {
      anomalies.push({
        metric: 'dlqGrowth',
        confidence: clamp01(Math.min(0.95, 0.72 + zDelta / 6)),
        zScore: zDelta,
        explanation: `DLQ is growing faster than usual (+${currentDelta} since last sample, z=${zDelta.toFixed(1)}).`
      })
    }
  }

  return { points: next, anomalies }
}
