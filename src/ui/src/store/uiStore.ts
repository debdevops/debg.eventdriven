/**
 * UI Store - Zustand State Management
 * 
 * Manages:
 * - Sidebar collapsed state
 * - Theme (dark/light/system)
 * - Toast notifications
 * - Modal state (message detail, confirm dialogs)
 * - Loading overlays
 * - Keyboard shortcuts enabled
 * 
 * Persistence: All UI preferences saved to localStorage
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { MessageEnvelope } from '../types'

/**
 * Theme enumeration
 */
export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

/**
 * Toast notification severity
 */
export enum ToastSeverity {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

/**
 * Toast notification interface
 */
export interface Toast {
  id: string
  message: string
  severity: ToastSeverity
  duration?: number
  timestamp: number
}

/**
 * Modal types
 */
export enum ModalType {
  NONE = 'none',
  MESSAGE_DETAIL = 'message_detail',
  CONFIRM_DELETE = 'confirm_delete',
  CONFIRM_REPLAY = 'confirm_replay',
  CONFIRM_MOVE_TO_DLQ = 'confirm_move_to_dlq',
  ADD_NAMESPACE = 'add_namespace',
  GENERATE_MESSAGES = 'generate_messages',
  AI_INSIGHTS = 'ai_insights',
  EXPORT_MESSAGES = 'export_messages',
  SESSION_EXPIRY = 'session_expiry'
}

/**
 * Modal state interface
 */
export interface ModalState {
  type: ModalType
  data?: any
  isOpen: boolean
}

/**
 * Confirm dialog configuration
 */
export interface ConfirmDialogConfig {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
  severity?: 'info' | 'warning' | 'danger'
}

/**
 * UI store state interface
 */
export interface UIState {
  // State - Layout
  sidebarCollapsed: boolean
  bottomDrawerOpen: boolean
  rightPanelOpen: boolean
  
  // State - Theme
  theme: Theme
  effectiveTheme: 'light' | 'dark'
  
  // State - Notifications
  toasts: Toast[]
  maxToasts: number
  
  // State - Modals
  modal: ModalState
  confirmDialog: ConfirmDialogConfig | null
  
  // State - Loading
  globalLoading: boolean
  loadingMessage: string | null
  
  // State - Keyboard
  keyboardShortcutsEnabled: boolean
  
  // State - Selected message detail
  selectedMessageForDetail: MessageEnvelope | null
  
  // Actions - Layout
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleBottomDrawer: () => void
  setBottomDrawerOpen: (open: boolean) => void
  toggleRightPanel: () => void
  setRightPanelOpen: (open: boolean) => void
  
  // Actions - Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  updateEffectiveTheme: () => void
  
  // Actions - Notifications
  showToast: (message: string, severity: ToastSeverity, duration?: number) => void
  dismissToast: (id: string) => void
  clearToasts: () => void
  
  // Actions - Modals
  openModal: (type: ModalType, data?: any) => void
  closeModal: () => void
  showConfirmDialog: (config: ConfirmDialogConfig) => void
  closeConfirmDialog: () => void
  
  // Actions - Loading
  setGlobalLoading: (loading: boolean, message?: string) => void
  
  // Actions - Keyboard
  setKeyboardShortcutsEnabled: (enabled: boolean) => void
  toggleKeyboardShortcuts: () => void
  
  // Actions - Message Detail
  setSelectedMessageForDetail: (message: MessageEnvelope | null) => void
  
  // Selectors
  hasActiveToasts: () => boolean
  getActiveTheme: () => 'light' | 'dark'
}

/**
 * Generate unique toast ID
 */
const generateToastId = (): string => {
  return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create UI store with middleware
 */
export const useUIStore = create<UIState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        sidebarCollapsed: false,
        bottomDrawerOpen: false,
        rightPanelOpen: false,
        
        theme: Theme.SYSTEM,
        effectiveTheme: 'light',
        
        toasts: [],
        maxToasts: 5,
        
        modal: {
          type: ModalType.NONE,
          data: undefined,
          isOpen: false
        },
        confirmDialog: null,
        
        globalLoading: false,
        loadingMessage: null,
        
        keyboardShortcutsEnabled: true,
        
        selectedMessageForDetail: null,

        // Layout actions
        toggleSidebar: () => {
          set((state) => {
            state.sidebarCollapsed = !state.sidebarCollapsed
          }, false, 'ui/toggleSidebar')
        },

        setSidebarCollapsed: (collapsed) => {
          set((state) => {
            state.sidebarCollapsed = collapsed
          }, false, 'ui/setSidebarCollapsed')
        },

        toggleBottomDrawer: () => {
          set((state) => {
            state.bottomDrawerOpen = !state.bottomDrawerOpen
          }, false, 'ui/toggleBottomDrawer')
        },

        setBottomDrawerOpen: (open) => {
          set((state) => {
            state.bottomDrawerOpen = open
          }, false, 'ui/setBottomDrawerOpen')
        },

        toggleRightPanel: () => {
          set((state) => {
            state.rightPanelOpen = !state.rightPanelOpen
          }, false, 'ui/toggleRightPanel')
        },

        setRightPanelOpen: (open) => {
          set((state) => {
            state.rightPanelOpen = open
          }, false, 'ui/setRightPanelOpen')
        },

        // Theme actions
        setTheme: (theme) => {
          set((state) => {
            state.theme = theme
          }, false, 'ui/setTheme')
          get().updateEffectiveTheme()
        },

        toggleTheme: () => {
          const currentTheme = get().theme
          const nextTheme = currentTheme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT
          get().setTheme(nextTheme)
        },

        updateEffectiveTheme: () => {
          const { theme } = get()
          let effectiveTheme: 'light' | 'dark' = 'light'
          
          if (theme === Theme.SYSTEM) {
            effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
          } else {
            effectiveTheme = theme === Theme.DARK ? 'dark' : 'light'
          }
          
          set((state) => {
            state.effectiveTheme = effectiveTheme
          }, false, 'ui/updateEffectiveTheme')
        },

        // Notification actions
        showToast: (message, severity, duration = 5000) => {
          const toast: Toast = {
            id: generateToastId(),
            message,
            severity,
            duration,
            timestamp: Date.now()
          }
          
          set((state) => {
            state.toasts.push(toast)
            
            // Limit number of toasts
            if (state.toasts.length > state.maxToasts) {
              state.toasts.shift()
            }
          }, false, 'ui/showToast')
          
          // Auto-dismiss after duration
          if (duration > 0) {
            setTimeout(() => {
              get().dismissToast(toast.id)
            }, duration)
          }
        },

        dismissToast: (id) => {
          set((state) => {
            state.toasts = state.toasts.filter(t => t.id !== id)
          }, false, 'ui/dismissToast')
        },

        clearToasts: () => {
          set((state) => {
            state.toasts = []
          }, false, 'ui/clearToasts')
        },

        // Modal actions
        openModal: (type, data) => {
          set((state) => {
            state.modal = {
              type,
              data,
              isOpen: true
            }
          }, false, 'ui/openModal')
        },

        closeModal: () => {
          set((state) => {
            state.modal = {
              type: ModalType.NONE,
              data: undefined,
              isOpen: false
            }
          }, false, 'ui/closeModal')
        },

        showConfirmDialog: (config) => {
          set((state) => {
            state.confirmDialog = config
          }, false, 'ui/showConfirmDialog')
        },

        closeConfirmDialog: () => {
          set((state) => {
            state.confirmDialog = null
          }, false, 'ui/closeConfirmDialog')
        },

        // Loading actions
        setGlobalLoading: (loading, message) => {
          set((state) => {
            state.globalLoading = loading
            state.loadingMessage = message || null
          }, false, 'ui/setGlobalLoading')
        },

        // Keyboard actions
        setKeyboardShortcutsEnabled: (enabled) => {
          set((state) => {
            state.keyboardShortcutsEnabled = enabled
          }, false, 'ui/setKeyboardShortcutsEnabled')
        },

        toggleKeyboardShortcuts: () => {
          set((state) => {
            state.keyboardShortcutsEnabled = !state.keyboardShortcutsEnabled
          }, false, 'ui/toggleKeyboardShortcuts')
        },

        // Message detail actions
        setSelectedMessageForDetail: (message) => {
          set((state) => {
            state.selectedMessageForDetail = message
          }, false, 'ui/setSelectedMessageForDetail')
        },

        // Selectors
        hasActiveToasts: () => {
          return get().toasts.length > 0
        },

        getActiveTheme: () => {
          return get().effectiveTheme
        }
      })),
      {
        name: 'ui-storage',
        partialize: (state) => ({
          // Persist UI preferences
          sidebarCollapsed: state.sidebarCollapsed,
          theme: state.theme,
          keyboardShortcutsEnabled: state.keyboardShortcutsEnabled
        })
      }
    ),
    { name: 'UIStore' }
  )
)

/**
 * Convenience hooks for common selections
 */
export const useSidebarCollapsed = () => useUIStore(state => state.sidebarCollapsed)
export const useTheme = () => useUIStore(state => state.theme)
export const useEffectiveTheme = () => useUIStore(state => state.effectiveTheme)
export const useToasts = () => useUIStore(state => state.toasts)
export const useModal = () => useUIStore(state => state.modal)
export const useUIActions = () => useUIStore(state => ({
  toggleSidebar: state.toggleSidebar,
  showToast: state.showToast,
  dismissToast: state.dismissToast,
  openModal: state.openModal,
  closeModal: state.closeModal,
  showConfirmDialog: state.showConfirmDialog,
  setTheme: state.setTheme
}))
