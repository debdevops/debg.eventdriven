/**
 * Message Store - Zustand State Management
 * 
 * Manages:
 * - Active queue messages
 * - DLQ messages
 * - Selected messages (multi-select)
 * - Filters (search, correlation, event type, age)
 * - Sorting configuration
 * 
 * Integrates with: IndexedDB for persistence (via existing messageStore.ts)
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { MessageEnvelope } from '../types'
import type { AgeDistribution } from '../utils/eventTypeExtractor'

/**
 * Message filters interface
 */
export interface MessageFilters {
  searchTerm: string
  correlationId: string
  eventType: string
  ageBucket: keyof AgeDistribution | null
  aiPatternFilter: {
    messageIds: string[]
    patternName: string
  } | null
}

/**
 * Sorting configuration
 */
export interface SortConfig {
  field: keyof MessageEnvelope
  ascending: boolean
}

/**
 * Message view mode
 */
export type MessageViewMode = 'table' | 'grid' | 'timeline'

/**
 * Message store state interface
 */
export interface MessageState {
  // State
  activeMessages: MessageEnvelope[]
  dlqMessages: MessageEnvelope[]
  selectedMessageIds: Set<number> // sequenceNumber as key
  filters: MessageFilters
  sortConfig: SortConfig
  viewMode: MessageViewMode
  selectMode: boolean
  frozenSnapshot: boolean
  peekSize: number
  
  // Current selection context
  currentEntityName: string | null
  currentSubscriptionName: string | null
  isDLQ: boolean
  
  // Loading states
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  
  // Actions - Messages
  setActiveMessages: (messages: MessageEnvelope[]) => void
  setDLQMessages: (messages: MessageEnvelope[]) => void
  addMessage: (message: MessageEnvelope, isDLQ?: boolean) => void
  removeMessage: (sequenceNumber: number, isDLQ?: boolean) => void
  clearMessages: (isDLQ?: boolean) => void
  
  // Actions - Selection
  selectMessage: (sequenceNumber: number) => void
  deselectMessage: (sequenceNumber: number) => void
  selectAll: (messages: MessageEnvelope[]) => void
  clearSelection: () => void
  toggleSelectMode: () => void
  
  // Actions - Filters
  setSearchTerm: (term: string) => void
  setCorrelationId: (id: string) => void
  setEventType: (type: string) => void
  setAgeBucket: (bucket: keyof AgeDistribution | null) => void
  setAIPatternFilter: (filter: { messageIds: string[]; patternName: string } | null) => void
  clearFilters: () => void
  updateFilters: (filters: Partial<MessageFilters>) => void
  
  // Actions - Sorting
  setSortConfig: (config: SortConfig) => void
  toggleSortDirection: () => void
  
  // Actions - View
  setViewMode: (mode: MessageViewMode) => void
  setPeekSize: (size: number) => void
  toggleSnapshot: () => void
  
  // Actions - Context
  setContext: (entityName: string, subscriptionName: string | null, isDLQ: boolean) => void
  clearContext: () => void
  
  // Actions - Loading
  setLoading: (loading: boolean) => void
  setRefreshing: (refreshing: boolean) => void
  setError: (error: string | null) => void
  
  // Selectors
  getSelectedMessages: () => MessageEnvelope[]
  getActiveFilteredMessages: () => MessageEnvelope[]
  hasActiveFilters: () => boolean
  getMessageBySequence: (sequenceNumber: number, isDLQ?: boolean) => MessageEnvelope | undefined
}

/**
 * Create message store with middleware
 */
export const useMessageStore = create<MessageState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      activeMessages: [],
      dlqMessages: [],
      selectedMessageIds: new Set(),
      filters: {
        searchTerm: '',
        correlationId: '',
        eventType: '',
        ageBucket: null,
        aiPatternFilter: null
      },
      sortConfig: {
        field: 'sequenceNumber',
        ascending: false // Newest first by default
      },
      viewMode: 'table',
      selectMode: false,
      frozenSnapshot: false,
      peekSize: 50,
      
      currentEntityName: null,
      currentSubscriptionName: null,
      isDLQ: false,
      
      isLoading: false,
      isRefreshing: false,
      error: null,

      // Message actions
      setActiveMessages: (messages) => {
        set((state) => {
          state.activeMessages = messages
          state.isLoading = false
          state.error = null
        }, false, 'message/setActiveMessages')
      },

      setDLQMessages: (messages) => {
        set((state) => {
          state.dlqMessages = messages
          state.isLoading = false
          state.error = null
        }, false, 'message/setDLQMessages')
      },

      addMessage: (message, isDLQ = false) => {
        set((state) => {
          const targetArray = isDLQ ? state.dlqMessages : state.activeMessages
          // Check if message already exists
          const exists = targetArray.some(m => m.sequenceNumber === message.sequenceNumber)
          if (!exists) {
            targetArray.push(message)
          }
        }, false, 'message/addMessage')
      },

      removeMessage: (sequenceNumber, isDLQ = false) => {
        set((state) => {
          if (isDLQ) {
            state.dlqMessages = state.dlqMessages.filter(m => m.sequenceNumber !== sequenceNumber)
          } else {
            state.activeMessages = state.activeMessages.filter(m => m.sequenceNumber !== sequenceNumber)
          }
          state.selectedMessageIds.delete(sequenceNumber)
        }, false, 'message/removeMessage')
      },

      clearMessages: (isDLQ = false) => {
        set((state) => {
          if (isDLQ) {
            state.dlqMessages = []
          } else {
            state.activeMessages = []
          }
          state.selectedMessageIds.clear()
        }, false, 'message/clearMessages')
      },

      // Selection actions
      selectMessage: (sequenceNumber) => {
        set((state) => {
          state.selectedMessageIds.add(sequenceNumber)
        }, false, 'message/selectMessage')
      },

      deselectMessage: (sequenceNumber) => {
        set((state) => {
          state.selectedMessageIds.delete(sequenceNumber)
        }, false, 'message/deselectMessage')
      },

      selectAll: (messages) => {
        set((state) => {
          state.selectedMessageIds = new Set(messages.map(m => m.sequenceNumber))
        }, false, 'message/selectAll')
      },

      clearSelection: () => {
        set((state) => {
          state.selectedMessageIds.clear()
        }, false, 'message/clearSelection')
      },

      toggleSelectMode: () => {
        set((state) => {
          state.selectMode = !state.selectMode
          if (!state.selectMode) {
            state.selectedMessageIds.clear()
          }
        }, false, 'message/toggleSelectMode')
      },

      // Filter actions
      setSearchTerm: (term) => {
        set((state) => {
          state.filters.searchTerm = term
        }, false, 'message/setSearchTerm')
      },

      setCorrelationId: (id) => {
        set((state) => {
          state.filters.correlationId = id
        }, false, 'message/setCorrelationId')
      },

      setEventType: (type) => {
        set((state) => {
          state.filters.eventType = type
        }, false, 'message/setEventType')
      },

      setAgeBucket: (bucket) => {
        set((state) => {
          state.filters.ageBucket = bucket
        }, false, 'message/setAgeBucket')
      },

      setAIPatternFilter: (filter) => {
        set((state) => {
          state.filters.aiPatternFilter = filter
        }, false, 'message/setAIPatternFilter')
      },

      clearFilters: () => {
        set((state) => {
          state.filters = {
            searchTerm: '',
            correlationId: '',
            eventType: '',
            ageBucket: null,
            aiPatternFilter: null
          }
        }, false, 'message/clearFilters')
      },

      updateFilters: (filters) => {
        set((state) => {
          Object.assign(state.filters, filters)
        }, false, 'message/updateFilters')
      },

      // Sorting actions
      setSortConfig: (config) => {
        set((state) => {
          state.sortConfig = config
        }, false, 'message/setSortConfig')
      },

      toggleSortDirection: () => {
        set((state) => {
          state.sortConfig.ascending = !state.sortConfig.ascending
        }, false, 'message/toggleSortDirection')
      },

      // View actions
      setViewMode: (mode) => {
        set((state) => {
          state.viewMode = mode
        }, false, 'message/setViewMode')
      },

      setPeekSize: (size) => {
        set((state) => {
          state.peekSize = size
        }, false, 'message/setPeekSize')
      },

      toggleSnapshot: () => {
        set((state) => {
          state.frozenSnapshot = !state.frozenSnapshot
        }, false, 'message/toggleSnapshot')
      },

      // Context actions
      setContext: (entityName, subscriptionName, isDLQ) => {
        set((state) => {
          state.currentEntityName = entityName
          state.currentSubscriptionName = subscriptionName
          state.isDLQ = isDLQ
          // Clear messages and selection when context changes
          state.activeMessages = []
          state.dlqMessages = []
          state.selectedMessageIds.clear()
          state.filters = {
            searchTerm: '',
            correlationId: '',
            eventType: '',
            ageBucket: null,
            aiPatternFilter: null
          }
        }, false, 'message/setContext')
      },

      clearContext: () => {
        set((state) => {
          state.currentEntityName = null
          state.currentSubscriptionName = null
          state.isDLQ = false
          state.activeMessages = []
          state.dlqMessages = []
          state.selectedMessageIds.clear()
        }, false, 'message/clearContext')
      },

      // Loading actions
      setLoading: (loading) => {
        set((state) => {
          state.isLoading = loading
        }, false, 'message/setLoading')
      },

      setRefreshing: (refreshing) => {
        set((state) => {
          state.isRefreshing = refreshing
        }, false, 'message/setRefreshing')
      },

      setError: (error) => {
        set((state) => {
          state.error = error
          state.isLoading = false
          state.isRefreshing = false
        }, false, 'message/setError')
      },

      // Selectors
      getSelectedMessages: () => {
        const { activeMessages, dlqMessages, selectedMessageIds, isDLQ } = get()
        const messages = isDLQ ? dlqMessages : activeMessages
        return messages.filter(m => selectedMessageIds.has(m.sequenceNumber))
      },

      getActiveFilteredMessages: () => {
        const { activeMessages, dlqMessages, filters, isDLQ } = get()
        const messages = isDLQ ? dlqMessages : activeMessages
        
        return messages.filter(msg => {
          // Search term filter
          if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase()
            const searchable = [
              msg.messageId,
              msg.body,
              msg.subject,
              msg.correlationId,
              JSON.stringify(msg.applicationProperties || {})
            ].join(' ').toLowerCase()
            
            if (!searchable.includes(term)) return false
          }
          
          // Correlation ID filter
          if (filters.correlationId && 
              !msg.correlationId?.toLowerCase().includes(filters.correlationId.toLowerCase())) {
            return false
          }
          
          // Event type filter (would need eventTypeExtractor utility)
          if (filters.eventType) {
            // TODO: Implement event type extraction logic
          }
          
          // Age bucket filter
          if (filters.ageBucket) {
            const now = Date.now()
            const ageMinutes = (now - new Date(msg.enqueuedTimeUtc).getTime()) / 60000
            
            switch (filters.ageBucket) {
              case 'lessThan5m':
                if (ageMinutes >= 5) return false
                break
              case 'between5And30m':
                if (ageMinutes < 5 || ageMinutes >= 30) return false
                break
              case 'between30And120m':
                if (ageMinutes < 30 || ageMinutes >= 120) return false
                break
              case 'moreThan2h':
                if (ageMinutes < 120) return false
                break
            }
          }
          
          // AI pattern filter
          if (filters.aiPatternFilter && filters.aiPatternFilter.messageIds.length > 0) {
            if (!filters.aiPatternFilter.messageIds.includes(msg.messageId)) return false
          }
          
          return true
        })
      },

      hasActiveFilters: () => {
        const { filters } = get()
        return !!(
          filters.searchTerm ||
          filters.correlationId ||
          filters.eventType ||
          filters.ageBucket ||
          filters.aiPatternFilter
        )
      },

      getMessageBySequence: (sequenceNumber, isDLQ = false) => {
        const { activeMessages, dlqMessages } = get()
        const messages = isDLQ ? dlqMessages : activeMessages
        return messages.find(m => m.sequenceNumber === sequenceNumber)
      }
    })),
    { name: 'MessageStore' }
  )
)

/**
 * Convenience hooks for common selections
 */
export const useActiveMessages = () => useMessageStore(state => state.activeMessages)
export const useDLQMessages = () => useMessageStore(state => state.dlqMessages)
export const useSelectedMessages = () => useMessageStore(state => state.getSelectedMessages())
export const useMessageFilters = () => useMessageStore(state => state.filters)
export const useMessageActions = () => useMessageStore(state => ({
  setActiveMessages: state.setActiveMessages,
  setDLQMessages: state.setDLQMessages,
  selectMessage: state.selectMessage,
  clearSelection: state.clearSelection,
  setSearchTerm: state.setSearchTerm,
  clearFilters: state.clearFilters,
  setContext: state.setContext
}))
