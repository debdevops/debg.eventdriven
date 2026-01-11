/**
 * Zustand Store Index - Central Export Point
 * 
 * This file exports all stores and convenience hooks for the application.
 * Use these hooks in components for type-safe access to global state.
 * 
 * USAGE:
 * ```tsx
 * import { useCurrentNamespace, useUIActions } from '@/store'
 * 
 * function MyComponent() {
 *   const namespace = useCurrentNamespace()
 *   const { showToast } = useUIActions()
 *   // ...
 * }
 * ```
 */

// Store exports
export { 
  useNamespaceStore,
  ConnectionStatus,
  type NamespaceState
} from './namespaceStore'

export { 
  useMessageStore,
  type MessageFilters,
  type SortConfig,
  type MessageViewMode,
  type MessageState
} from './messageStore'

export { 
  useUIStore,
  Theme,
  ToastSeverity,
  ModalType,
  type Toast,
  type ModalState,
  type ConfirmDialogConfig,
  type UIState
} from './uiStore'

export { 
  useAIInsightsStore,
  AnalysisStatus,
  type AnomalyFilter,
  type AIInsightsState
} from './aiInsightsStore'

// Convenience hooks - Namespace
export {
  useCurrentNamespace,
  useNamespaces,
  useConnectionStatus,
  useNamespaceActions
} from './namespaceStore'

// Convenience hooks - Messages
export {
  useActiveMessages,
  useDLQMessages,
  useSelectedMessages,
  useMessageFilters,
  useMessageActions
} from './messageStore'

// Convenience hooks - UI
export {
  useSidebarCollapsed,
  useTheme,
  useEffectiveTheme,
  useToasts,
  useModal,
  useUIActions
} from './uiStore'

// Convenience hooks - AI Insights
export {
  useActiveQueueAnalysis,
  useDLQAnalysis,
  useAnomalyFilter,
  useSelectedCluster,
  useSelectedOutlier,
  useAIInsightsActions
} from './aiInsightsStore'
