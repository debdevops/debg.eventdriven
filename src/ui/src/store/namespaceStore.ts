/**
 * Namespace Store - Zustand State Management
 * 
 * Manages:
 * - Current namespace selection
 * - Available namespaces list
 * - Connection status
 * - Session expiry tracking
 * 
 * Persistence: Last selected namespace saved to localStorage
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Namespace } from '../types'

/**
 * Connection status enumeration
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
  EXPIRED = 'expired'
}

/**
 * Namespace store state interface
 */
export interface NamespaceState {
  // State
  currentNamespace: Namespace | null
  namespaces: Namespace[]
  connectionStatus: ConnectionStatus
  error: string | null
  lastRefreshTime: number | null
  
  // Actions
  setCurrentNamespace: (namespace: Namespace | null) => void
  addNamespace: (namespace: Namespace) => void
  updateNamespace: (sessionId: string, updates: Partial<Namespace>) => void
  removeNamespace: (sessionId: string) => void
  setNamespaces: (namespaces: Namespace[]) => void
  setConnectionStatus: (status: ConnectionStatus) => void
  setError: (error: string | null) => void
  refreshNamespaces: () => void
  disconnect: () => void
  checkExpiry: () => boolean
  
  // Selectors (computed values)
  hasActiveNamespace: () => boolean
  isConnected: () => boolean
  getNamespaceBySessionId: (sessionId: string) => Namespace | undefined
}

/**
 * Create namespace store with middleware
 */
export const useNamespaceStore = create<NamespaceState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        currentNamespace: null,
        namespaces: [],
        connectionStatus: ConnectionStatus.DISCONNECTED,
        error: null,
        lastRefreshTime: null,

        // Actions
        setCurrentNamespace: (namespace) => {
          set((state) => {
            state.currentNamespace = namespace
            state.connectionStatus = namespace ? ConnectionStatus.CONNECTED : ConnectionStatus.DISCONNECTED
            state.error = null
          }, false, 'namespace/setCurrentNamespace')
        },

        addNamespace: (namespace) => {
          set((state) => {
            // Check if namespace already exists
            const existingIndex = state.namespaces.findIndex(
              ns => ns.sessionId === namespace.sessionId
            )
            
            if (existingIndex >= 0) {
              // Update existing namespace
              state.namespaces[existingIndex] = namespace
            } else {
              // Add new namespace
              state.namespaces.push(namespace)
            }
          }, false, 'namespace/addNamespace')
        },

        updateNamespace: (sessionId, updates) => {
          set((state) => {
            const namespace = state.namespaces.find(ns => ns.sessionId === sessionId)
            if (namespace) {
              Object.assign(namespace, updates)
            }
            
            // Update current namespace if it's the one being updated
            if (state.currentNamespace?.sessionId === sessionId) {
              Object.assign(state.currentNamespace, updates)
            }
          }, false, 'namespace/updateNamespace')
        },

        removeNamespace: (sessionId) => {
          set((state) => {
            state.namespaces = state.namespaces.filter(ns => ns.sessionId !== sessionId)
            
            // Clear current namespace if it's the one being removed
            if (state.currentNamespace?.sessionId === sessionId) {
              state.currentNamespace = null
              state.connectionStatus = ConnectionStatus.DISCONNECTED
            }
          }, false, 'namespace/removeNamespace')
        },

        setNamespaces: (namespaces) => {
          set((state) => {
            state.namespaces = namespaces
            state.lastRefreshTime = Date.now()
          }, false, 'namespace/setNamespaces')
        },

        setConnectionStatus: (status) => {
          set((state) => {
            state.connectionStatus = status
          }, false, 'namespace/setConnectionStatus')
        },

        setError: (error) => {
          set((state) => {
            state.error = error
            if (error) {
              state.connectionStatus = ConnectionStatus.ERROR
            }
          }, false, 'namespace/setError')
        },

        refreshNamespaces: () => {
          set((state) => {
            state.lastRefreshTime = Date.now()
          }, false, 'namespace/refreshNamespaces')
        },

        disconnect: () => {
          set((state) => {
            state.currentNamespace = null
            state.connectionStatus = ConnectionStatus.DISCONNECTED
            state.error = null
          }, false, 'namespace/disconnect')
        },

        checkExpiry: () => {
          const { currentNamespace } = get()
          if (!currentNamespace) return false
          
          const expiryTime = new Date(currentNamespace.expiresAtUtc).getTime()
          const now = Date.now()
          const isExpired = now >= expiryTime
          
          if (isExpired) {
            set((state) => {
              state.connectionStatus = ConnectionStatus.EXPIRED
              state.error = 'Session has expired'
            }, false, 'namespace/checkExpiry')
          }
          
          return isExpired
        },

        // Selectors
        hasActiveNamespace: () => {
          return get().currentNamespace !== null
        },

        isConnected: () => {
          return get().connectionStatus === ConnectionStatus.CONNECTED
        },

        getNamespaceBySessionId: (sessionId) => {
          return get().namespaces.find(ns => ns.sessionId === sessionId)
        }
      })),
      {
        name: 'namespace-storage',
        partialize: (state) => ({
          // Only persist current namespace and namespaces list
          currentNamespace: state.currentNamespace,
          namespaces: state.namespaces
        })
      }
    ),
    { name: 'NamespaceStore' }
  )
)

/**
 * Convenience hooks for common selections
 */
export const useCurrentNamespace = () => useNamespaceStore(state => state.currentNamespace)
export const useNamespaces = () => useNamespaceStore(state => state.namespaces)
export const useConnectionStatus = () => useNamespaceStore(state => state.connectionStatus)
export const useNamespaceActions = () => useNamespaceStore(state => ({
  setCurrentNamespace: state.setCurrentNamespace,
  addNamespace: state.addNamespace,
  updateNamespace: state.updateNamespace,
  removeNamespace: state.removeNamespace,
  disconnect: state.disconnect,
  checkExpiry: state.checkExpiry
}))
