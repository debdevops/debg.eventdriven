/**
 * Store Initialization and Utilities
 * 
 * This file provides initialization functions and utilities for Zustand stores.
 * Call initializeStores() in your app's entry point (main.tsx or App.tsx).
 */

import { useUIStore } from './uiStore'
import { useNamespaceStore } from './namespaceStore'

/**
 * Initialize all stores
 * Should be called once at app startup
 */
export function initializeStores() {
  // Initialize theme based on system preference or saved setting
  const uiStore = useUIStore.getState()
  uiStore.updateEffectiveTheme()
  
  // Listen for system theme changes
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', () => {
      uiStore.updateEffectiveTheme()
    })
  }
  
  // Check namespace expiry on load
  const namespaceStore = useNamespaceStore.getState()
  if (namespaceStore.currentNamespace) {
    namespaceStore.checkExpiry()
  }
  
  console.log('[Store] Zustand stores initialized')
}

/**
 * Reset all stores to initial state
 * Useful for logout or testing
 */
export function resetAllStores() {
  useNamespaceStore.getState().disconnect()
  useUIStore.getState().clearToasts()
  useUIStore.getState().closeModal()
  
  console.log('[Store] All stores reset')
}

/**
 * Subscribe to store changes for debugging
 * Only use in development
 */
export function subscribeToStores() {
  if (process.env.NODE_ENV !== 'development') return
  
  let prevNamespace = useNamespaceStore.getState().currentNamespace
  useNamespaceStore.subscribe((state) => {
    if (state.currentNamespace !== prevNamespace) {
      console.log('[Store:Namespace] Current namespace changed:', state.currentNamespace?.friendlyName)
      prevNamespace = state.currentNamespace
    }
  })
  
  let prevTheme = useUIStore.getState().effectiveTheme
  useUIStore.subscribe((state) => {
    if (state.effectiveTheme !== prevTheme) {
      console.log('[Store:UI] Theme changed:', state.effectiveTheme)
      // Apply theme to document
      document.documentElement.setAttribute('data-theme', state.effectiveTheme)
      prevTheme = state.effectiveTheme
    }
  })
}

/**
 * Get current store state snapshot
 * Useful for debugging or persistence
 */
export function getStoreSnapshot() {
  return {
    namespace: useNamespaceStore.getState(),
    ui: useUIStore.getState(),
    timestamp: new Date().toISOString()
  }
}
