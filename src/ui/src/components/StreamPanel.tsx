/**
 * Stream Panel - Main message viewing and interaction component
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSSE } from '../hooks/useSSE'
import { useSessionV2 } from '../contexts/SessionContextV2'
import { apiClient } from '../api/client'
import { messageStore } from '../services/messageStore'
import { useFrozenGuard } from '../hooks/useFrozenGuard'
import { useSelectionGuards } from '../features/shared/hooks/useSelectionGuards'
import { MessageGrid } from '../features/messages/MessageGrid'
import { DlqGrid } from '../features/dlq/DlqGrid'
import { DlqBanner, type DlqBannerModel } from '../features/dlq/DlqBanner'
import { BreadcrumbBar } from './BreadcrumbBar'
import { SnapshotBanner } from '../features/snapshot/SnapshotBanner'
import { MetricsPanel } from './MetricsPanel'
import RulesPanel from './RulesPanel'
import { MessageTableSkeleton } from './MessageTableSkeleton'
import { UnifiedInspector, InspectorMode } from './UnifiedInspector'
import { MessageDetailPanel } from './MessageDetailPanel'
import { AiPatternFilterChip } from './AiPatternFilterChip'
import { DlqReplayAdvisor } from './DlqReplayAdvisor'
import { analyzeDlqMessages, getMessageIdsByClassification, type DlqClassification } from '../services/dlqReplayAdvisor'
import { recordAndDetectBaseline, type BaselineAnomaly } from '../services/baselineAnomaly'
import { classifyFailure, type FailureClassification } from '../services/failureClassifier'
import { DlqAdvisoryActions, getDlqAdvisoryActions } from '../features/dlq/DlqAdvisoryActions'
import type { MessageEnvelope, StreamMode, AuditEntry, ToastApi, AiInsightsResult } from '../types'
import type { DlqAdvisorAnalysis, DlqMessageClassification } from '../services/dlqReplayAdvisor'
import { selectionKey, type SelectedTarget } from '../entities/selection'
import { computeDlqHealth, formatAgeMinutes } from '../utils/dlqHealth'
import { extractEventType } from '../utils/eventTypeExtractor'
import { uiLogger } from '../utils/logger'
import './StreamPanel.css'

interface StreamPanelProps {
  sessionId: string
  selectedTarget: SelectedTarget
  onAudit: (entry: AuditEntry) => void
  isSessionExpired?: boolean
  toastApi: ToastApi
  onAiInsights?: () => void
  aiInsightsLoading?: boolean
  hasAiInsights?: boolean
  aiInsights?: AiInsightsResult | null
}

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

export default function StreamPanel({ 
  sessionId, 
  selectedTarget,
  onAudit, 
  isSessionExpired = false,
  toastApi,
  onAiInsights,
  aiInsightsLoading,
  hasAiInsights,
  aiInsights
}: StreamPanelProps) {
  const mode: StreamMode = 'peek' // Read-only mode
  const { status, canInteract, scheduleInterval, clearTimer } = useSessionV2()
  const controlsDisabled = !canInteract || isSessionExpired

  const computePreviewText = useCallback((message: MessageEnvelope): string => {
    const props = message.applicationProperties ?? {}

    // Prefer non-body sources first (cheap); fall back to body extraction if needed.
    const fastEventType =
      props.eventType ??
      props.EventType ??
      props.event_type ??
      props.type ??
      props.Type ??
      props['@type'] ??
      props.$type

    const eventType = fastEventType ? String(fastEventType) : (extractEventType(message).eventType ?? 'Unknown')
    const keyIdentifier =
      (message.correlationId && String(message.correlationId)) ||
      (message.subject && String(message.subject)) ||
      (props.correlationId && String(props.correlationId)) ||
      (props.CorrelationId && String(props.CorrelationId)) ||
      message.messageId

    const dlqSuffix = message.deadLetterReason ? ` • ${String(message.deadLetterReason)}` : ''
    const raw = `${eventType} • ${keyIdentifier}${dlqSuffix}`
    const singleLine = raw.replace(/\s+/g, ' ').trim()

    const maxLen = 80
    return singleLine.length <= maxLen ? singleLine : `${singleLine.slice(0, maxLen - 1)}…`
  }, [])

  const withPreview = useCallback((message: MessageEnvelope): MessageEnvelope => {
    if (message.previewText) return message
    return { ...message, previewText: computePreviewText(message) }
  }, [computePreviewText])

  // Snapshot (Frozen View)
  const [snapshotEnabled, setSnapshotEnabled] = useState(false)
  const [snapshotCapturedAtUtc, setSnapshotCapturedAtUtc] = useState<string | null>(null)
  const [snapshotReason, setSnapshotReason] = useState<'user' | 'dlq' | null>(null)
  const frozenMessagesRef = useRef<MessageEnvelope[] | null>(null)
  const snapshotEnabledRef = useRef(false)
  const loadRequestIdRef = useRef(0)
  const autoDlqFreezeDoneRef = useRef(false)

  // Selection guards (stability): prevent stale in-flight updates when switching entities/views.
  const selectionId = useMemo(
    () => selectionKey(selectedTarget),
    [
      selectedTarget.entityType,
      selectedTarget.viewType,
      selectedTarget.entity?.name,
      selectedTarget.topicName,
      selectedTarget.subscription?.name
    ]
  )
  const { selectionIdRef, selectionAbortRef, selectionEpochRef } = useSelectionGuards(selectionId)

  // UI state (collapsed panels) must persist per selection and must not remount the grid.
  // UX rule: DLQ Snapshot details + AI Insights are collapsed by default to keep the message grid primary.
  type PanelCollapseState = { dlqInsightsCollapsed: boolean }
  const panelCollapseRef = useRef(new Map<string, PanelCollapseState>())
  const loadPanelCollapse = useCallback((key: string): PanelCollapseState => {
    const inMemory = panelCollapseRef.current.get(key)
    if (inMemory) return inMemory
    try {
      const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(`sbi.panelCollapse:${key}`) : null
      if (raw) {
        const parsed = JSON.parse(raw) as any

        // Back-compat: previous versions persisted separate snapshot/advisory collapse.
        // New UX has one shared expand/collapse.
        const legacySnapshotCollapsed = parsed?.snapshotCollapsed
        const legacyAdvisoryCollapsed = parsed?.advisoryCollapsed
        const legacyCombinedCollapsed =
          (typeof legacySnapshotCollapsed === 'boolean' ? legacySnapshotCollapsed : true)
          && (typeof legacyAdvisoryCollapsed === 'boolean' ? legacyAdvisoryCollapsed : true)

        return {
          dlqInsightsCollapsed:
            typeof parsed?.dlqInsightsCollapsed === 'boolean'
              ? parsed.dlqInsightsCollapsed
              : legacyCombinedCollapsed
        }
      }
    } catch {
      // ignore
    }
    return { dlqInsightsCollapsed: true }
  }, [])
  const savePanelCollapse = useCallback((key: string, state: PanelCollapseState) => {
    panelCollapseRef.current.set(key, state)
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(`sbi.panelCollapse:${key}`, JSON.stringify(state))
      }
    } catch {
      // ignore
    }
  }, [])

  const [dlqInsightsCollapsed, setDlqInsightsCollapsed] = useState(true)

  useEffect(() => {
    const state = loadPanelCollapse(selectionId)
    setDlqInsightsCollapsed(state.dlqInsightsCollapsed)
  }, [selectionId, loadPanelCollapse])

  const snapshotControlsDisabled = controlsDisabled || snapshotEnabled
  const { frozenRef: frozenSnapshotRef } = useFrozenGuard(snapshotEnabled)

  // FIX(selection): DLQ mode derived ONLY from explicit viewType (no implicit auto-derivation).
  const isDLQ = selectedTarget.viewType === 'dlq'

  const [activeMessages, setActiveMessages] = useState<MessageEnvelope[]>([])
  const [dlqMessages, setDlqMessages] = useState<MessageEnvelope[]>([])
  const messages = isDLQ ? dlqMessages : activeMessages
  const setMessages = isDLQ ? setDlqMessages : setActiveMessages
  const [streaming, setStreaming] = useState(false)
  const [peekSize, setPeekSize] = useState(50)
  const [loading, setLoading] = useState(false)
  // Track last refresh time
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  // Explicit fetch lifecycle for the current selection. Prevents false error flashes
  // during selection changes and separates "in-flight" from "failed".
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const frozenSnapshot = snapshotEnabled

  // Snapshot (Frozen View) rule:
  // Freeze *updates* (no peeks, no mutations) but never freeze *rendering*.
  // The grid must continue to render the existing messages while Snapshot is active.
  const snapshotMessages = snapshotEnabled ? frozenMessagesRef.current : null
  const liveMessages = messages
  const displayMessages = snapshotMessages ?? liveMessages
  const [showRules, setShowRules] = useState(false)
  
  // AI Pattern filter state
  const [aiPatternFilter, setAiPatternFilter] = useState<{
    patternId: string
    label: string
    messageIds: string[]
  } | null>(null)
  
  // DLQ Replay Advisor state
  const [dlqAdvisorAnalysis, setDlqAdvisorAnalysis] = useState<DlqAdvisorAnalysis | null>(null)

  // DLQ health sampling (used for tiered severity when NOT viewing DLQ)
  const [sampledDlqMessages, setSampledDlqMessages] = useState<MessageEnvelope[] | null>(null)
  const [oldestDlqEnqueuedTimeUtc, setOldestDlqEnqueuedTimeUtc] = useState<string | null>(null)

  // Baseline anomaly + deterministic DLQ advisory (client-side; advisory-only)
  const [baselineAnomalies, setBaselineAnomalies] = useState<BaselineAnomaly[]>([])
  const [dlqFailureSummary, setDlqFailureSummary] = useState<FailureClassification | null>(null)
  
  // Unified Inspector state
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>('closed')
  const [selectedMessage, setSelectedMessage] = useState<MessageEnvelope | null>(null)
  const [selectedMessageLoading, setSelectedMessageLoading] = useState(false)
  const [selectedMessageError, setSelectedMessageError] = useState<string | null>(null)
  const selectedMessageRequestIdRef = useRef(0)

  // Resolve target identity.
  // For subscriptions (messages or DLQ), entityName must be the topic and subscriptionName must be present.
  const entityName = selectedTarget.entityType === 'queue'
    ? selectedTarget.entity!.name
    : selectedTarget.topicName!

  const subscriptionName = selectedTarget.entityType === 'subscription'
    ? selectedTarget.subscription!.name
    : undefined

  const activeCountTotal = selectedTarget.entityType === 'subscription'
    ? (selectedTarget.subscription?.messageCount || 0)
    : (selectedTarget.entity?.messageCount || 0)

  const dlqCountTotal = selectedTarget.entityType === 'subscription'
    ? (selectedTarget.subscription?.deadLetterMessageCount || 0)
    : (selectedTarget.entity?.deadLetterMessageCount || 0)

  const totalCountForView = isDLQ ? dlqCountTotal : activeCountTotal

  const selectedEntityTypeLabel = selectedTarget.entityType === 'subscription'
    ? 'Subscription'
    : 'Queue'

  const oldestDlqFromLoadedMessages = useMemo(() => {
    if (!isDLQ || messages.length === 0) return null
    const oldest = messages.reduce((min, m) => {
      const t = new Date(m.enqueuedTimeUtc).getTime()
      const minT = new Date(min.enqueuedTimeUtc).getTime()
      return t < minT ? m : min
    }, messages[0])
    return oldest.enqueuedTimeUtc
  }, [isDLQ, messages])

  const breadcrumbs = useMemo(() => {
    const viewLabel = selectedTarget.viewType === 'dlq' ? 'DLQ' : 'Messages'

    if (selectedTarget.entityType === 'subscription') {
      const topic = selectedTarget.topicName || 'Topic'
      const sub = selectedTarget.subscription?.name || 'Subscription'
      return [{ label: 'Topics' }, { label: topic }, { label: sub }, { label: viewLabel }]
    }

    const queue = selectedTarget.entity?.name || 'Queue'
    return [{ label: 'Queues' }, { label: queue }, { label: viewLabel }]
  }, [selectedTarget])

  // Record baseline + detect anomalies on each successful refresh/load.
  useEffect(() => {
    if (snapshotEnabledRef.current || snapshotEnabled) return
    if (status !== 'connected') {
      setBaselineAnomalies([])
      return
    }
    if (!lastUpdated) return

    const now = Date.now()
    const oldestDlqTime = isDLQ ? oldestDlqFromLoadedMessages : oldestDlqEnqueuedTimeUtc
    const oldestAgeMinutes = oldestDlqTime ? Math.max(0, Math.floor((now - new Date(oldestDlqTime).getTime()) / 60000)) : null

    const entityKey = `${sessionId}:${selectionId}`
    const result = recordAndDetectBaseline(entityKey, {
      t: now,
      active: activeCountTotal,
      dlq: dlqCountTotal,
      oldestAgeMinutes
    })

    setBaselineAnomalies(result.anomalies)
  }, [status, lastUpdated, snapshotEnabled, sessionId, selectionId, activeCountTotal, dlqCountTotal, isDLQ, oldestDlqFromLoadedMessages, oldestDlqEnqueuedTimeUtc])

  // Deterministic failure classification summary for the currently loaded DLQ sample.
  useEffect(() => {
    if (!isDLQ || messages.length === 0) {
      setDlqFailureSummary(null)
      return
    }

    try {
      const byType = new Map<string, { count: number; best: FailureClassification }>()

      for (const m of messages) {
        const c = classifyFailure(m)
        const existing = byType.get(c.type)
        if (!existing) {
          byType.set(c.type, { count: 1, best: c })
        } else {
          existing.count += 1
          if (c.confidence > existing.best.confidence) existing.best = c
        }
      }

      let best: { type: string; count: number; best: FailureClassification } | null = null
      for (const entry of byType.entries()) {
        const v = { type: entry[0], ...entry[1] }
        if (!best || v.count > best.count || (v.count === best.count && v.best.confidence > best.best.confidence)) {
          best = v
        }
      }

      setDlqFailureSummary(best ? best.best : null)
    } catch {
      setDlqFailureSummary(null)
    }
  }, [isDLQ, messages])

  // Sample DLQ details (oldest age + reasons) when viewing active messages.
  // This keeps severity portal-aligned without changing backend contracts.
  useEffect(() => {
    // FIX(snapshot): Snapshot must never trigger background fetches or mutate derived state.
    // Invariant: Snapshot is a strict point-in-time render lock.
    // That means *no* network fetch is allowed to complete and call setState while frozen,
    // even for "secondary" data like DLQ sampling (otherwise the Snapshot UI can drift).
    if (snapshotEnabledRef.current || snapshotEnabled) {
      return
    }

    if (status !== 'connected') {
      setSampledDlqMessages(null)
      setOldestDlqEnqueuedTimeUtc(null)
      return
    }

    if (isDLQ || dlqCountTotal <= 0) {
      setSampledDlqMessages(null)
      setOldestDlqEnqueuedTimeUtc(null)
      return
    }

    const controller = new AbortController()

    // Tie this request to the selection-level abort controller.
    // Invariant: selection change cancels all in-flight requests so old entity/view
    // results can never land in the new selection.
    const selectionSignal = selectionAbortRef.current.signal
    if (selectionSignal.aborted) {
      try {
        controller.abort((selectionSignal as any).reason || 'selection-abort')
      } catch {
        // ignore
      }
    } else {
      selectionSignal.addEventListener(
        'abort',
        () => {
          try {
            controller.abort((selectionSignal as any).reason || 'selection-abort')
          } catch {
            // ignore
          }
        },
        { once: true }
      )
    }

    let cancelled = false
    ;(async () => {
      try {
        // Peek a small sample from DLQ.
        // Note: peek is non-destructive; it returns messages without consuming them.
        // For DLQ sampling, portal parity matters more than completeness.
        const resp = await apiClient.peekMessages(
          sessionId,
          entityName,
          10,
          subscriptionName,
          true,
          controller.signal
        )
        if (cancelled || controller.signal.aborted || snapshotEnabledRef.current) return
        setSampledDlqMessages(resp.messages)
        setOldestDlqEnqueuedTimeUtc(resp.messages.length > 0 ? resp.messages[0].enqueuedTimeUtc : null)
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return
        // Non-fatal: if sampling fails, severity falls back to ratio-only.
        if (cancelled) return
        setSampledDlqMessages(null)
        setOldestDlqEnqueuedTimeUtc(null)
      }
    })()

    return () => {
      cancelled = true
      try {
        controller.abort('cleanup')
      } catch {
        // ignore
      }
    }
  }, [status, isDLQ, dlqCountTotal, sessionId, entityName, subscriptionName, snapshotEnabled])

  const enterSnapshot = useCallback((reason: 'user' | 'dlq') => {
    if (frozenMessagesRef.current == null) {
      // Freeze current view's messages; do NOT clear live messages.
      frozenMessagesRef.current = [...messages]
    }

    // FIX(snapshot): cancel any in-flight work tied to this selection.
    // Snapshot must be a point-in-time lock: no pending fetch should complete.
    // Invariant: once Snapshot is entered, no async completion is allowed to mutate
    // any view state (messages, sampled DLQ metadata, loading flags, etc.).
    try {
      selectionAbortRef.current.abort('snapshot-enabled')
    } catch {
      // ignore
    }
    selectionAbortRef.current = new AbortController()

    setSnapshotEnabled(true)
    snapshotEnabledRef.current = true
    setSnapshotReason(reason)
    if (!snapshotCapturedAtUtc) setSnapshotCapturedAtUtc(new Date().toISOString())
    // Snapshot must never show loading or refreshing indicators.
    setLoading(false)
    setIsRefreshing(false)
    setStreaming(false)
  }, [messages, snapshotCapturedAtUtc, selectionAbortRef])

  const exitSnapshot = useCallback(() => {
    frozenMessagesRef.current = null
    setSnapshotEnabled(false)
    snapshotEnabledRef.current = false
    setSnapshotCapturedAtUtc(null)
    setSnapshotReason(null)
  }, [])

  // Keep ref in sync even if snapshotEnabled changes via other paths
  useEffect(() => {
    snapshotEnabledRef.current = snapshotEnabled
    if (snapshotEnabled) {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [snapshotEnabled])

  // Reusable function to load messages once
  const loadMessagesOnce = useCallback(async (silent = false) => {
    if (status !== 'connected') {
      return
    }

    // FIX(snapshot): Snapshot must NEVER fetch.
    if (snapshotEnabledRef.current) {
      return
    }

    const selectionEpochAtStart = selectionEpochRef.current
    const signal = selectionAbortRef.current.signal

    const requestId = ++loadRequestIdRef.current
    try {
      const entityType = isDLQ ? 'dlq' : selectedTarget.entityType
      
      // Don't show loading spinner for silent background refreshes
      if (!silent) {
        setFetchStatus('loading')
        setLoading(true)
      }
      
      // Fetch fresh from backend
      const response = await apiClient.peekMessages(
        sessionId,
        entityName,
        peekSize,
        subscriptionName,
        isDLQ,
        signal
      )

      // If selection changed mid-flight, ignore this result.
      if (selectionEpochRef.current !== selectionEpochAtStart) {
        return
      }

      // If Snapshot was enabled mid-flight (or a newer request started), ignore this result.
      if (snapshotEnabledRef.current || requestId !== loadRequestIdRef.current) {
        return
      }
      
      // Persist (optional) but render from the live response to keep DLQ vs active isolated.
      try {
        await messageStore.saveMessages(
          response.messages,
          sessionId,
          entityName,
          entityType,
          'peeked',
          subscriptionName
        )
      } catch (err) {
        // Regression protection: local persistence must never break the UI.
        console.warn('[StreamPanel] IndexedDB persist failed (non-fatal)', err)
      }

      // Never merge active+DLQ. Replace only the current view's message set.
      setMessages(response.messages.map(withPreview))
      
      setLastUpdated(new Date())
      // Clear previous error ONLY after a successful fetch.
      setError(null)
      setFetchStatus('success')
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        return
      }

      // If selection changed mid-flight, or a newer request started, ignore this failure.
      // This is the key race-condition guard that prevents transient "Failed to load" flashes
      // when the *current* selection successfully loads shortly after.
      if (
        selectionEpochRef.current !== selectionEpochAtStart ||
        snapshotEnabledRef.current ||
        requestId !== loadRequestIdRef.current
      ) {
        return
      }

      const errorMsg = err instanceof Error ? err.message : 'Failed to load messages'
      uiLogger.error('Load messages failed', err)
      
      // Handle 401 Unauthorized - session expired
      if (errorMsg.includes('401') || errorMsg.toLowerCase().includes('unauthorized')) {
        // Session expiry is now handled by SessionExpiryModal - don't set error here
        uiLogger.debug('Session expired detected - modal will handle this')
        if (!silent) setFetchStatus('idle')
      } else if (!silent) {
        // Only show error for non-silent requests
        setError(errorMsg)
        setFetchStatus('error')
      }
    } finally {
      if (!silent) {
        // Only the latest request is allowed to clear the loading indicator.
        if (requestId === loadRequestIdRef.current) {
          setLoading(false)
        }
      }
    }
  }, [status, sessionId, entityName, peekSize, subscriptionName, isDLQ, selectedTarget.entityType])
  // Snapshot must never show skeleton/loading states.
  const effectiveLoading = snapshotEnabled ? false : (fetchStatus === 'loading' || loading)
  const effectiveRefreshing = snapshotEnabled ? false : isRefreshing

  // Auto-load messages when entity changes
  useEffect(() => {
    // Selection change starts a new explicit fetch lifecycle.
    // IMPORTANT: do not clear the previous error here; we hide it via fetchStatus=loading
    // and clear it only after a successful fetch.
    setFetchStatus('loading')

    // FIX(view-scope): Snapshot is per selection (entity + view). Never carry it across view switches.
    frozenMessagesRef.current = null
    snapshotEnabledRef.current = false
    setSnapshotEnabled(false)
    setSnapshotCapturedAtUtc(null)
    setSnapshotReason(null)
    autoDlqFreezeDoneRef.current = false

    // Reset view-scoped UI state on every selection change.
    setActiveMessages([])
    setDlqMessages([])
    setAiPatternFilter(null)
    setInspectorMode('closed')
    setSelectedMessage(null)
    setSelectedMessageLoading(false)
    setSelectedMessageError(null)
    selectedMessageRequestIdRef.current += 1
    setDlqAdvisorAnalysis(null)
    setBaselineAnomalies([])
    setDlqFailureSummary(null)
    setSuccess(null)
    setStreaming(false)
    setIsRefreshing(false)
    setLastUpdated(null)

    // FIX(state): clear persisted bucket for this entity+view to avoid stale carry-over.
    void messageStore.clearView(sessionId, isDLQ ? 'dlq' : selectedTarget.entityType, entityName, subscriptionName)
    
    // Immediate load (not silent for initial load)
    const initialLoad = async () => {
      try {
        await loadMessagesOnce(false)
      } catch (err) {
        console.error('Initial load failed:', err)
      }
    }
    
    initialLoad()
  }, [sessionId, entityName, subscriptionName, isDLQ, selectedTarget.entityType, selectedTarget.viewType, loadMessagesOnce])

  // DLQ Replay Advisor Analysis - runs when messages are loaded and we're viewing DLQ
  useEffect(() => {
    if (!isDLQ || messages.length === 0) {
      setDlqAdvisorAnalysis(null)
      return
    }

    // Run analysis on DLQ messages (client-side, instant)
    try {
      const analysis = analyzeDlqMessages(messages, 5, 60) // min 5 messages, 60% confidence threshold
      setDlqAdvisorAnalysis(analysis)
    } catch (err) {
      console.error('[StreamPanel] DLQ analysis failed:', err)
      // Silently fail - don't disrupt UI
    }
  }, [messages, isDLQ])

  const dlqReplaySummary = useMemo(() => {
    if (!isDLQ || !dlqAdvisorAnalysis) return null
    const safeCount = dlqAdvisorAnalysis.classifications.filter((c: DlqMessageClassification) => c.classification === 'SAFE_TO_REPLAY').length
    const needsCount = dlqAdvisorAnalysis.classifications.filter((c: DlqMessageClassification) => c.classification === 'NEEDS_INVESTIGATION').length
    const doNotCount = dlqAdvisorAnalysis.classifications.filter((c: DlqMessageClassification) => c.classification === 'DO_NOT_REPLAY').length
    const total = safeCount + needsCount + doNotCount
    if (total <= 0) return { text: 'Replay Advisor — 0', title: 'No classifications available' }

    const top = [
      { key: 'SAFE_TO_REPLAY', label: 'Safe to Replay', count: safeCount },
      { key: 'NEEDS_INVESTIGATION', label: 'Needs Investigation', count: needsCount },
      { key: 'DO_NOT_REPLAY', label: 'Do Not Replay', count: doNotCount }
    ].sort((a, b) => b.count - a.count)[0]

    const pct = Math.round((top.count / total) * 100)
    return {
      text: `Replay Advisor — ${top.label} ${top.count} (${pct}%)`,
      title: `Replay Advisor breakdown: Safe ${safeCount}, Needs ${needsCount}, Do Not ${doNotCount}. Click Expand to view details.`
    }
  }, [isDLQ, dlqAdvisorAnalysis])

  // Create a Map of messageId -> classification for efficient lookup in grid
  const dlqClassificationsMap = useMemo(() => {
    if (!dlqAdvisorAnalysis) return null
    const map = new Map<string, DlqMessageClassification>()
    dlqAdvisorAnalysis.classifications.forEach((c: DlqMessageClassification) => {
      map.set(c.messageId, c)
    })
    return map
  }, [dlqAdvisorAnalysis])

  // Single unified auto-refresh loop with Page Visibility API
  // Pauses during session expiry or reconnect
  useEffect(() => {
    // Guard all fetch effects while Snapshot is active.
    if (snapshotEnabled) return
    const timerKey = `stream-auto-refresh-${sessionId}-${entityName}-${subscriptionName || 'none'}-${isDLQ ? 'dlq' : 'main'}`

    if (frozenSnapshot || status !== 'connected') {
      clearTimer(timerKey)
      return
    }

    let isRefreshInProgress = false

    scheduleInterval(timerKey, 10000, async () => {
      if (snapshotEnabledRef.current) return
      if (isRefreshInProgress || document.hidden || status !== 'connected') return
      try {
        isRefreshInProgress = true
        setIsRefreshing(true)
        await loadMessagesOnce(true)
      } catch (err) {
        console.error('[StreamPanel] Auto-refresh failed:', err)
      } finally {
        setIsRefreshing(false)
        isRefreshInProgress = false
      }
    })

    return () => clearTimer(timerKey)
  }, [frozenSnapshot, status, loadMessagesOnce, scheduleInterval, clearTimer, sessionId, entityName, subscriptionName, isDLQ])

  // SSE Stream
  const streamURL = apiClient.getStreamURL(sessionId, entityName, mode, subscriptionName, isDLQ)
  
  const handleMessage = useCallback((message: MessageEnvelope) => {
    // Ignore late events from a previous selection/view.
    if (selectionIdRef.current !== selectionId) return

    // Snapshot must be a pure point-in-time render lock: never mutate while frozen.
    if (snapshotEnabledRef.current) return

    // Save to local store
    const entityType = isDLQ ? 'dlq' : selectedTarget.entityType
    
    messageStore.saveMessage(
      message,
      sessionId,
      entityName,
      entityType,
      'peeked',
      subscriptionName
    ).catch(err => console.error('Failed to save message:', err))
    
    const hydrated = withPreview(message)
    setMessages(prev => {
      // Avoid duplicates
      const exists = prev.find(m => m.sequenceNumber === hydrated.sequenceNumber)
      if (exists) return prev
      return [hydrated, ...prev] // Newest first
    })
  }, [sessionId, entityName, subscriptionName, isDLQ, selectedTarget.entityType, selectionId, withPreview])

  useSSE({
    url: streamURL,
    enabled: streaming && status === 'connected' && !snapshotEnabled,
    onMessage: handleMessage
  })

  // Ensure streaming is stopped immediately when session isn't connected
  useEffect(() => {
    if (status !== 'connected' && streaming) {
      setStreaming(false)
    }
  }, [status, streaming])

  useEffect(() => {
    if (snapshotEnabled && streaming) {
      setStreaming(false)
    }
  }, [snapshotEnabled, streaming])

  // Peek Now (POST) - now just calls loadMessagesOnce
  const handlePeekNow = async () => {
    if (snapshotControlsDisabled) return
    await loadMessagesOnce(false) // Not silent - show loading and errors
    onAudit({
      timestamp: new Date().toISOString(),
      sessionId,
      entityName,
      operation: 'Peek'
    })
  }

  const handleToggleSnapshot = () => {
    if (snapshotEnabled) {
      exitSnapshot()
      return
    }
    enterSnapshot('user')
  }

  // Auto-freeze for DLQ views after first successful load.
  useEffect(() => {
    if (!isDLQ) {
      autoDlqFreezeDoneRef.current = false
      return
    }
    if (snapshotEnabled) return
    if (autoDlqFreezeDoneRef.current) return
    if (messages.length === 0) return

    autoDlqFreezeDoneRef.current = true
    enterSnapshot('dlq')
  }, [isDLQ, snapshotEnabled, messages.length, enterSnapshot])

  // Apply AI Pattern Filter
  const handleApplyAiPattern = (patternId: string, label: string, messageIds: string[]) => {
    if (snapshotEnabledRef.current) return
    setAiPatternFilter({ patternId, label, messageIds })
    toastApi.success(`Filtered to ${messageIds.length} messages in pattern "${label}"`)
    onAudit({
      timestamp: new Date().toISOString(),
      sessionId,
      entityName,
      operation: 'Peek' // Audit as a Peek operation
    })
  }

  // Clear AI Pattern Filter
  const handleClearAiPattern = () => {
    if (snapshotEnabledRef.current) return
    if (aiPatternFilter) {
      const clearedPattern = aiPatternFilter.label
      setAiPatternFilter(null)
      toastApi.success(`Cleared filter for pattern "${clearedPattern}"`)
      onAudit({
        timestamp: new Date().toISOString(),
        sessionId,
        entityName,
        operation: 'Peek' // Audit as a Peek operation
      })
    }
  }

  // Filter by DLQ Classification Category
  const handleFilterByDlqCategory = (category: DlqClassification) => {
    if (frozenSnapshotRef.current) return
    if (!dlqAdvisorAnalysis) return

    const messageIds = getMessageIdsByClassification(dlqAdvisorAnalysis, category)
    if (messageIds.length === 0) return

    const categoryLabel = category === 'SAFE_TO_REPLAY'
      ? 'Safe to Replay'
      : category === 'NEEDS_INVESTIGATION'
      ? 'Needs Investigation'
      : 'Do Not Replay'

    setAiPatternFilter({
      patternId: `dlq-${category}`,
      label: `DLQ: ${categoryLabel}`,
      messageIds
    })

    toastApi.success(`Filtered to ${messageIds.length} DLQ messages (${categoryLabel})`)

    onAudit({
      timestamp: new Date().toISOString(),
      sessionId,
      entityName,
      operation: 'Peek'
    })
  }

  // Load Next Batch - uses last message sequence number to peek from that point
  const handleLoadNextBatch = useCallback(async () => {
    if (controlsDisabled) return
    if (snapshotEnabledRef.current) return
    if (messages.length === 0) {
      uiLogger.debug('No messages loaded, cannot load next batch')
      return
    }

    const selectionEpochAtStart = selectionEpochRef.current
    const signal = selectionAbortRef.current.signal
    const requestId = ++loadRequestIdRef.current

    try {
      setFetchStatus('loading')
      setLoading(true)
      
      // Continue peeking from the highest sequence number we've already loaded.
      // Invariant: `fromSequenceNumber` must be monotonic per selection (entity + view).
      // If it ever goes backwards or repeats, peek will re-return the same messages,
      // causing duplicates or a perceived "stuck" paging experience.
      const lastSeqNum = Math.max(...messages.map(m => m.sequenceNumber))
      
      if (!Number.isFinite(lastSeqNum) || lastSeqNum <= 0) {
        if (
          selectionEpochRef.current !== selectionEpochAtStart ||
          snapshotEnabledRef.current ||
          requestId !== loadRequestIdRef.current
        ) {
          return
        }

        setError('No sequence number found in loaded messages')
        setFetchStatus('error')
        return
      }

      const entityType = isDLQ ? 'dlq' : selectedTarget.entityType
      
      // Peek from next sequence number (lastSeqNum + 1)
      // Note: backend implements this using Azure Service Bus PeekMessagesAsync(count, fromSequenceNumber).
      const response = await apiClient.peekMessages(
        sessionId,
        entityName,
        peekSize,
        subscriptionName,
        isDLQ,
        signal,
        lastSeqNum + 1
      )

      if (selectionEpochRef.current !== selectionEpochAtStart) {
        return
      }

      if (snapshotEnabledRef.current) {
        return
      }

      if (requestId !== loadRequestIdRef.current) {
        return
      }

      if (response.messages && response.messages.length > 0) {
        const nextBatch = response.messages.map(withPreview)
        // Save messages to local store
        try {
          await messageStore.saveMessages(
            nextBatch,
            sessionId,
            entityName,
            entityType,
            'peeked',
            subscriptionName
          )
        } catch (err) {
          console.warn('[StreamPanel] IndexedDB persist failed (non-fatal)', err)
        }

        // Append new messages to current list
        let addedCount = 0
        setMessages(prev => {
          // Combine and deduplicate
          const allMessages = [...prev, ...nextBatch]
          const unique = Array.from(new Map(allMessages.map(m => [m.sequenceNumber, m])).values())
          addedCount = Math.max(0, unique.length - prev.length)
          // Sort by sequence number (newest first)
          return unique.sort((a, b) => b.sequenceNumber - a.sequenceNumber)
        })

        if (addedCount > 0) {
          toastApi.success(`Loaded ${addedCount} more messages`)
        } else {
          toastApi.info('No new messages to load')
        }

        onAudit({
          timestamp: new Date().toISOString(),
          sessionId,
          entityName,
          operation: 'Peek'
        })
      } else {
        toastApi.info('No more messages to load')
      }

      setError(null)
      setFetchStatus('success')
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        return
      }

      if (
        selectionEpochRef.current !== selectionEpochAtStart ||
        snapshotEnabledRef.current ||
        requestId !== loadRequestIdRef.current
      ) {
        return
      }

      const errorMsg = err instanceof Error ? err.message : 'Failed to load next batch'
      console.error('Load next batch failed:', err)
      setError(errorMsg)
      setFetchStatus('error')
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false)
      }
    }
  }, [controlsDisabled, messages, sessionId, entityName, subscriptionName, isDLQ, selectedTarget.entityType, peekSize])

  // Message detail selection: some rows may carry partial bodies (or truncated previews).
  // UX invariant: never show an error banner until a detail hydration request actually fails.
  const openMessageDetails = useCallback(async (message: MessageEnvelope) => {
    setSelectedMessage(message)
    setSelectedMessageError(null)
    setSelectedMessageLoading(false)

    // IMPORTANT: Selecting a message row must be a purely local UI action.
    // The inspector already has the message payload from the peek/SSE pipelines.
    // Triggering an extra peek here creates noisy failures and misleading UX.
    // If a dedicated "get message details" API is added later, this is the place
    // to wire it with an explicit loading state.
    return
  }, [])

  // Start streaming
  /* const _handleStartStream = () => {
    setError(null)
    setSuccess(null)
    setStreaming(true)
  } */

  // Display name for header
  const displayName = selectedTarget.entityType === 'queue'
    ? selectedTarget.entity!.name
    : selectedTarget.subscription!.name

  const displayType = selectedTarget.entityType === 'subscription'
    ? 'Subscription'
    : 'Queue'

  const displayContext = selectedTarget.entityType === 'subscription'
    ? ` (Topic: ${selectedTarget.topicName})`
    : ''

  // Format last updated time
  const formatLastUpdated = (): string => {
    if (!lastUpdated) return 'Not yet loaded'
    const secondsAgo = Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
    if (secondsAgo < 10) return 'Just now'
    if (secondsAgo < 60) return `${secondsAgo}s ago`
    const minutesAgo = Math.floor(secondsAgo / 60)
    if (minutesAgo < 60) return `${minutesAgo}m ago`
    const hoursAgo = Math.floor(minutesAgo / 60)
    return `${hoursAgo}h ago`
  }

  // FIX(refactor): keep JSX declarative by precomputing DLQ banner fields.
  const dlqBannerModel = useMemo(() => {
    if (!isDLQ) return null

    const dlqOldestTime = oldestDlqFromLoadedMessages
    const dlqHealth = computeDlqHealth({
      dlqCount: dlqCountTotal,
      activeCount: activeCountTotal,
      oldestDlqEnqueuedTimeUtc: dlqOldestTime,
      sampledDlqMessages: messages
    })

    const oldestAgeText = dlqHealth.oldestDlqAgeMinutes === null
      ? '—'
      : formatAgeMinutes(dlqHealth.oldestDlqAgeMinutes)

    const severityBadgeClass = dlqHealth.severity === 'CRITICAL'
      ? 'critical'
      : dlqHealth.severity === 'WARNING'
        ? 'warning'
        : 'healthy'

    const model: DlqBannerModel = {
      severityBadgeClass,
      label: dlqHealth.label,
      whyTooltip: [
        dlqHealth.whyTooltip,
        dlqFailureSummary ? `Top failure type: ${dlqFailureSummary.type} (${Math.round(dlqFailureSummary.confidence * 100)}%)` : null,
        baselineAnomalies.length > 0 ? baselineAnomalies.map((a) => a.explanation).join(' ') : null
      ]
        .filter(Boolean)
        .join(' • '),
      oldestAgeText
    }

    return model
  }, [isDLQ, oldestDlqFromLoadedMessages, dlqCountTotal, activeCountTotal, messages, dlqFailureSummary, baselineAnomalies])

  const topFailureSummaryText = useMemo(() => {
    if (!dlqFailureSummary) return null
    return `${dlqFailureSummary.type} (${Math.round(dlqFailureSummary.confidence * 100)}%)`
  }, [dlqFailureSummary])

  const dlqAdvisoryActions = useMemo(
    () => getDlqAdvisoryActions(dlqFailureSummary, baselineAnomalies),
    [dlqFailureSummary, baselineAnomalies]
  )

  const aiInsightsCount = useMemo(() => {
    const analysis = isDLQ ? aiInsights?.dlqAnalysis : aiInsights?.activeQueueAnalysis
    const clusters = analysis?.clusters?.length ?? 0
    const outliers = analysis?.outliers?.length ?? 0
    return clusters + outliers
  }, [aiInsights, isDLQ])

  const topDlqAdvisory = useMemo(() => {
    if (!dlqAdvisoryActions || dlqAdvisoryActions.length === 0) return null
    const top = [...dlqAdvisoryActions].sort((a, b) => b.confidence - a.confidence)[0]
    const pct = `${Math.round(Math.max(0, Math.min(1, top.confidence)) * 100)}%`
    return { action: top.action, pct }
  }, [dlqAdvisoryActions])

  const snapshotCapturedAtLocalText = useMemo(() => {
    if (!snapshotCapturedAtUtc) return null
    try {
      const dt = new Date(snapshotCapturedAtUtc)
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(dt)
    } catch {
      return snapshotCapturedAtUtc
    }
  }, [snapshotCapturedAtUtc])

  return (
    <div className="stream-panel">
      {/* Session expired is now handled by SessionExpiryModal in NamespaceView */}
      
      {/* Full-width error banner for non-session-expired errors */}
      {fetchStatus === 'error' && error && !error.includes('Session expired') && (
        <div className="stream-panel-error">
          {error}
          <button
            onClick={() => {
              setError(null)
              setFetchStatus('idle')
            }}
            className="error-dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className="action-toolbar">
        <div className="header-left">
          <h3>
            {isDLQ && <span className="dlq-badge" title="Dead Letter Queue">💀</span>}
            {displayName}
          </h3>
          <span className="entity-type-badge" title={displayType}>{displayType}</span>
          {displayContext && <span className="entity-context" title={displayContext.substring(2, displayContext.length - 1)}>{displayContext}</span>}
          <span className="message-count-badge" title="Total messages in grid">
            {displayMessages.length}
          </span>
          <span className="read-mode-badge" title="Read-only peek mode - messages are not removed from queue">
            📖 Peek Mode
          </span>
          <span className="last-updated-badge" title={lastUpdated ? `Last updated at ${lastUpdated.toLocaleTimeString()}` : 'Not yet loaded'}>
            {formatLastUpdated()}
          </span>
        </div>

        <div className="action-buttons-compact">
          {/* Auto Mode badge (always rendered to avoid layout shift) */}
          <div
            className={`auto-mode-badge ${frozenSnapshot ? 'paused' : ''}`}
            title={
              frozenSnapshot
                ? 'Snapshot (Frozen View) active — live updates paused'
                : 'Auto-refresh active — refreshes every 10 seconds'
            }
          >
            <span className="auto-icon">⚡</span>
            <span className="auto-text">{frozenSnapshot ? 'Snapshot' : 'Auto Mode'}</span>
            {!frozenSnapshot && effectiveRefreshing && <span className="refreshing-dot"></span>}
          </div>
          
          {/* Manual refresh button */}
          <button
            onClick={handlePeekNow}
            className="btn-compact btn-primary"
            disabled={effectiveLoading || effectiveRefreshing || snapshotEnabled}
            title="Manually refresh messages now (R)"
          >
            🔄 Refresh
          </button>

          <button
            onClick={() => {
              setInspectorMode('ai-insights')
              if (onAiInsights) onAiInsights()
            }}
            className="btn-compact btn-outline"
            disabled={controlsDisabled || !!aiInsightsLoading}
            title={aiInsightsLoading ? 'AI analysis in progress…' : hasAiInsights ? 'Open AI Insights (results available)' : 'Open AI Insights'}
          >
            {aiInsightsLoading ? '⏳ AI' : hasAiInsights ? '🤖 AI ✓' : '🤖 AI'}
            <span className="btn-badge" aria-label={`AI insights count: ${aiInsightsCount}`}>{aiInsightsCount}</span>
          </button>
          
          {/* Snapshot controls (DLQ view uses the compact row under the DLQ banner) */}
          {!isDLQ && (
            !snapshotEnabled ? (
              <button
                onClick={() => {
                  void handleToggleSnapshot()
                }}
                className="btn-compact btn-outline"
                title="Freezes the message list for safe investigation. Does not lock or stop messages in Service Bus."
                disabled={controlsDisabled}
              >
                Snapshot (Frozen View)
              </button>
            ) : (
              <button
                onClick={handleToggleSnapshot}
                className="btn-compact btn-success"
                title="Exit Snapshot and resume live updates"
                disabled={controlsDisabled}
              >
                Exit Snapshot
              </button>
            )
          )}
          
          {/* Rules button for subscriptions */}
          {selectedTarget.entityType === 'subscription' && (
            <button
              onClick={() => setShowRules(true)}
              className="btn-compact btn-outline"
              title="Manage subscription rules"
            >
              ⚙️ Rules
            </button>
          )}
        </div>
      </div>

      <BreadcrumbBar items={breadcrumbs} />

      {/* Read-only badge removed intentionally; auto-refresh/pause logic remains intact */}

      {/* DLQ explanation banner - simplified one-liner */}
      {isDLQ && dlqBannerModel && (
        <DlqBanner
          snapshotEnabled={snapshotEnabled}
          selectedEntityTypeLabel={selectedEntityTypeLabel}
          entityName={entityName}
          subscriptionName={subscriptionName}
          dlqCountTotal={dlqCountTotal}
          model={dlqBannerModel}
          topFailureSummary={topFailureSummaryText}
        />
      )}

      {/* DLQ compact row: Snapshot + AI Insights with ONE shared Expand/Collapse */}
      {isDLQ && (
        <>
          <div className="dlq-insights-row" role="region" aria-label="DLQ Snapshot and AI Insights">
            <div className="dlq-insights-left">
              <div className="dlq-insights-item" title={snapshotEnabled && snapshotCapturedAtLocalText ? `Snapshot captured at ${snapshotCapturedAtLocalText}` : 'Snapshot (Frozen View)'}>
                <span className="dlq-insights-icon" aria-hidden="true">⏸</span>
                <span className="dlq-insights-text">
                  {snapshotEnabled
                    ? (
                      <>
                        <strong>Snapshot</strong>
                        {snapshotCapturedAtLocalText ? ` — Captured ${snapshotCapturedAtLocalText}` : ''}
                      </>
                    )
                    : (
                      <strong>Snapshot</strong>
                    )}
                </span>
              </div>

              <div className="dlq-insights-item" title="Deterministic advisory suggestions (read-only)">
                <span className="dlq-insights-icon" aria-hidden="true">🤖</span>
                <span className="dlq-insights-text">
                  <strong>AI Insights</strong>
                  {topDlqAdvisory && (
                    <span className="dlq-insights-top"> — {topDlqAdvisory.action} {topDlqAdvisory.pct}</span>
                  )}
                  <span className="dlq-insights-count">({dlqAdvisoryActions.length})</span>
                </span>
              </div>

              {dlqReplaySummary && (
                <div className="dlq-insights-item" title={dlqReplaySummary.title}>
                  <span className="dlq-insights-icon" aria-hidden="true">🤖</span>
                  <span className="dlq-insights-text">
                    <strong>{dlqReplaySummary.text}</strong>
                  </span>
                </div>
              )}
            </div>

            <div className="dlq-insights-actions">
              <button
                type="button"
                className="btn-compact btn-outline"
                onClick={handleToggleSnapshot}
                title={snapshotEnabled ? 'Exit Snapshot and resume live updates' : 'Enter Snapshot (Frozen View)'}
                disabled={controlsDisabled}
              >
                {snapshotEnabled ? 'Exit Snapshot' : 'Snapshot'}
              </button>

              <button
                type="button"
                className="btn-compact btn-outline"
                onClick={() => {
                  const next = !dlqInsightsCollapsed
                  setDlqInsightsCollapsed(next)
                  savePanelCollapse(selectionId, { dlqInsightsCollapsed: next })
                }}
                aria-expanded={!dlqInsightsCollapsed}
                title={dlqInsightsCollapsed ? 'Expand Snapshot + AI Insights' : 'Collapse Snapshot + AI Insights'}
              >
                {dlqInsightsCollapsed ? 'Expand' : 'Collapse'}
              </button>
            </div>
          </div>

          {/* Content is always mounted; collapse is via CSS to prevent flicker */}
          <div className={`dlq-insights-expandable ${dlqInsightsCollapsed ? 'is-collapsed' : 'is-expanded'}`}>
            <div className="dlq-insights-expandable-inner">
              {snapshotEnabled && (
                <SnapshotBanner
                  snapshotCapturedAtUtc={snapshotCapturedAtUtc}
                  snapshotReason={snapshotReason}
                />
              )}

              <DlqAdvisoryActions
                failure={dlqFailureSummary}
                anomalies={baselineAnomalies}
                actionsOverride={dlqAdvisoryActions}
                variant="embedded"
              />

              {/* DLQ Replay Advisor is shown only when expanded to keep the grid primary */}
              {dlqAdvisorAnalysis && (
                <DlqReplayAdvisor
                  analysis={dlqAdvisorAnalysis}
                  onFilterByCategory={handleFilterByDlqCategory}
                  disabled={false}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Error UI is intentionally controlled by fetchStatus above to prevent false flashes. */}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      {/* Stream-level notifications use global toast system */}

      {/* Metrics Panel */}
      {!isDLQ && (
        <MetricsPanel
          sessionId={sessionId}
          entityName={entityName}
          subscriptionName={subscriptionName}
        />
      )}

      {/* Advisory cards are rendered inside the DLQ compact row's expandable content. */}

      {/* Show skeleton loader during initial load or reconnect */}
      {((!snapshotEnabled && fetchStatus === 'loading' && displayMessages.length === 0) || status === 'connecting') ? (
        <MessageTableSkeleton />
      ) : (
        <>
          {/* AI Pattern Filter Chip - appears when filter is active */}
          {aiPatternFilter && (
            <AiPatternFilterChip
              patternLabel={aiPatternFilter.label}
              messageCount={aiPatternFilter.messageIds.length}
              onClear={handleClearAiPattern}
            />
          )}

          {isDLQ ? (
            <DlqGrid
              messages={displayMessages}
              // FIX(pagination): totalMessageCount is view-specific (messages vs DLQ).
              totalMessageCount={totalCountForView}
              activeCount={activeCountTotal}
              sessionId={sessionId}
              entityName={entityName}
              subscriptionName={subscriptionName}
              dlqCount={dlqCountTotal}
              oldestDlqEnqueuedTimeUtc={oldestDlqFromLoadedMessages}
              onRefresh={snapshotEnabled ? undefined : handlePeekNow}
              onLoadNextBatch={snapshotEnabled ? undefined : handleLoadNextBatch}
              disabled={controlsDisabled}
              frozenSnapshot={frozenSnapshot}
              onToggleSnapshot={snapshotEnabled ? exitSnapshot : undefined}
              onMessageSelect={(message) => {
                void openMessageDetails(message)
              }}
              aiPatternFilter={aiPatternFilter}
              dlqClassifications={dlqClassificationsMap}
              peekSize={peekSize}
              onPeekSizeChange={(size) => {
                if (controlsDisabled || snapshotEnabledRef.current) return
                setPeekSize(size)
              }}
            />
          ) : (
            <MessageGrid
              messages={displayMessages}
              totalMessageCount={totalCountForView}
              activeCount={activeCountTotal}
              sessionId={sessionId}
              entityName={entityName}
              subscriptionName={subscriptionName}
              dlqCount={dlqCountTotal}
              oldestDlqEnqueuedTimeUtc={oldestDlqEnqueuedTimeUtc}
              sampledDlqMessages={sampledDlqMessages}
              onRefresh={snapshotEnabled ? undefined : handlePeekNow}
              onLoadNextBatch={snapshotEnabled ? undefined : handleLoadNextBatch}
              disabled={controlsDisabled}
              frozenSnapshot={frozenSnapshot}
              onToggleSnapshot={snapshotEnabled ? exitSnapshot : undefined}
              onMessageSelect={(message) => {
                void openMessageDetails(message)
              }}
              aiPatternFilter={aiPatternFilter}
              peekSize={peekSize}
              onPeekSizeChange={(size) => {
                if (controlsDisabled || snapshotEnabledRef.current) return
                setPeekSize(size)
              }}
            />
          )}
        </>
      )}
      
      {/* Rules Panel */}
      {showRules && selectedTarget.entityType === 'subscription' && (
        <RulesPanel
          sessionId={sessionId}
          topicName={selectedTarget.topicName!}
          subscriptionName={selectedTarget.subscription!.name}
          onClose={() => setShowRules(false)}
        />
      )}

      {/* Unified Inspector Panel */}
      <UnifiedInspector
        mode={inspectorMode}
        aiInsights={aiInsights}
        sessionId={sessionId}
        entityName={entityName}
        subscriptionName={subscriptionName}
        isDLQ={isDLQ}
        onClose={() => {
          setInspectorMode('closed')
        }}
        onMessageSelect={(message) => void openMessageDetails(message)}
        onAiRefresh={onAiInsights}
        onApplyAiPattern={handleApplyAiPattern}
      />

      {/* Message Detail (Right-side modal, restored) */}
      {selectedMessage && (
        selectedMessageLoading ? (
          <div className="message-detail-modal-overlay">
            <div className="message-detail-modal-backdrop" onClick={() => {
              selectedMessageRequestIdRef.current += 1
              setSelectedMessage(null)
              setSelectedMessageLoading(false)
              setSelectedMessageError(null)
            }} />
            <div className="message-detail-modal">
              <div className="message-detail-header">
                <div className="message-detail-title">
                  <span className="message-id-label">Message ID</span>
                  <span className="message-id-value">{selectedMessage.messageId}</span>
                </div>
                <button
                  className="btn-close-panel"
                  onClick={() => {
                    selectedMessageRequestIdRef.current += 1
                    setSelectedMessage(null)
                    setSelectedMessageLoading(false)
                    setSelectedMessageError(null)
                  }}
                  aria-label="Close panel"
                >
                  ×
                </button>
              </div>
              <div className="message-detail-content">
                <div className="alert alert-info">Loading message…</div>
              </div>
            </div>
          </div>
        ) : selectedMessageError ? (
          <div className="message-detail-modal-overlay">
            <div className="message-detail-modal-backdrop" onClick={() => {
              selectedMessageRequestIdRef.current += 1
              setSelectedMessage(null)
              setSelectedMessageLoading(false)
              setSelectedMessageError(null)
            }} />
            <div className="message-detail-modal">
              <div className="message-detail-header">
                <div className="message-detail-title">
                  <span className="message-id-label">Message ID</span>
                  <span className="message-id-value">{selectedMessage.messageId}</span>
                </div>
                <button
                  className="btn-close-panel"
                  onClick={() => {
                    selectedMessageRequestIdRef.current += 1
                    setSelectedMessage(null)
                    setSelectedMessageLoading(false)
                    setSelectedMessageError(null)
                  }}
                  aria-label="Close panel"
                >
                  ×
                </button>
              </div>
              <div className="message-detail-content">
                <div className="alert alert-danger">{selectedMessageError}</div>
              </div>
            </div>
          </div>
        ) : (
        <MessageDetailPanel
          message={selectedMessage}
          messages={displayMessages}
          dlqClassification={
            isDLQ && dlqClassificationsMap
              ? dlqClassificationsMap.get(selectedMessage.messageId) || null
              : null
          }
          onClose={() => {
            selectedMessageRequestIdRef.current += 1
            setSelectedMessage(null)
            setSelectedMessageLoading(false)
            setSelectedMessageError(null)
          }}
          onPrevious={() => {
            const currentIndex = displayMessages.findIndex((m) =>
              (m.messageId && selectedMessage.messageId && m.messageId === selectedMessage.messageId) ||
              (m.sequenceNumber !== undefined && m.sequenceNumber === selectedMessage.sequenceNumber)
            )
            const safeIndex = currentIndex >= 0 ? currentIndex : 0
            if (safeIndex > 0) void openMessageDetails(displayMessages[safeIndex - 1])
          }}
          onNext={() => {
            const currentIndex = displayMessages.findIndex((m) =>
              (m.messageId && selectedMessage.messageId && m.messageId === selectedMessage.messageId) ||
              (m.sequenceNumber !== undefined && m.sequenceNumber === selectedMessage.sequenceNumber)
            )
            const safeIndex = currentIndex >= 0 ? currentIndex : 0
            if (safeIndex < displayMessages.length - 1) void openMessageDetails(displayMessages[safeIndex + 1])
          }}
        />
        )
      )}
    </div>
  )
}
