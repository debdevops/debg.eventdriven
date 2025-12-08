/**
 * Reconnect Integration Test
 * Tests the reconnect flow after session expiration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useReconnect } from '../useReconnect'
import { apiClient } from '../../api/client'
import type { Namespace } from '../../types'

// Mock API client
vi.mock('../../api/client', () => ({
  apiClient: {
    listEntities: vi.fn()
  }
}))

describe('useReconnect', () => {
  const mockNamespace: Namespace = {
    sessionId: 'test-session-123',
    friendlyName: 'Test Namespace',
    expiresAtUtc: new Date(Date.now() + 3600000).toISOString(),
    queues: [],
    topics: []
  }

  const mockToast = {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should successfully reconnect and reload entities', async () => {
    const mockEntities = {
      queues: [{ name: 'test-queue', messageCount: 5 }],
      topics: [{ name: 'test-topic' }]
    }

    ;(apiClient.listEntities as any).mockResolvedValue(mockEntities)

    const onUpdateNamespace = vi.fn()
    const onSuccess = vi.fn()

    const { result } = renderHook(() => useReconnect())

    expect(result.current.isReconnecting).toBe(false)

    // Trigger reconnect
    act(() => {
      result.current.reconnect({
        namespace: mockNamespace,
        onUpdateNamespace,
        toast: mockToast,
        onSuccess
      })
    })

    // Should be reconnecting
    expect(result.current.isReconnecting).toBe(true)
    expect(mockToast.info).toHaveBeenCalledWith('Reconnecting...')

    // Wait for async operations
    await waitFor(() => {
      expect(result.current.isReconnecting).toBe(false)
    })

    // Should have reloaded entities
    expect(apiClient.listEntities).toHaveBeenCalledWith('test-session-123')
    expect(onUpdateNamespace).toHaveBeenCalledWith(
      expect.objectContaining({
        queues: mockEntities.queues,
        topics: expect.any(Array)
      })
    )

    // Should show success
    expect(mockToast.success).toHaveBeenCalledWith('Reconnected successfully')
    expect(onSuccess).toHaveBeenCalled()
  })

  it('should handle reconnect errors gracefully', async () => {
    const error = new Error('Network error')
    ;(apiClient.listEntities as any).mockRejectedValue(error)

    const onError = vi.fn()

    const { result } = renderHook(() => useReconnect())

    act(() => {
      result.current.reconnect({
        namespace: mockNamespace,
        onUpdateNamespace: vi.fn(),
        toast: mockToast,
        onError
      })
    })

    await waitFor(() => {
      expect(result.current.isReconnecting).toBe(false)
    })

    expect(mockToast.error).toHaveBeenCalledWith(
      expect.stringContaining('Reconnection failed')
    )
    expect(onError).toHaveBeenCalledWith('Network error')
  })

  it('should be idempotent - ignore duplicate reconnect calls', async () => {
    ;(apiClient.listEntities as any).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    )

    const { result } = renderHook(() => useReconnect())

    // First reconnect call
    act(() => {
      result.current.reconnect({
        namespace: mockNamespace,
        onUpdateNamespace: vi.fn(),
        toast: mockToast
      })
    })

    expect(result.current.isReconnecting).toBe(true)

    // Second reconnect call (should be ignored)
    act(() => {
      result.current.reconnect({
        namespace: mockNamespace,
        onUpdateNamespace: vi.fn(),
        toast: mockToast
      })
    })

    // Should still only have one API call
    expect(apiClient.listEntities).toHaveBeenCalledTimes(1)
  })

  it('should clear all timers on reconnect', () => {
    const { result } = renderHook(() => useReconnect())

    // Register some mock timers
    const timer1 = setInterval(() => {}, 1000)
    const timer2 = setInterval(() => {}, 2000)

    act(() => {
      result.current.registerTimer(timer1)
      result.current.registerTimer(timer2)
    })

    // Clear all timers
    act(() => {
      result.current.clearAllTimers()
    })

    // Timers should be cleared (we can't directly test clearInterval was called,
    // but we can verify the internal state is cleaned)
    expect(vi.getTimerCount()).toBe(0)
  })
})
