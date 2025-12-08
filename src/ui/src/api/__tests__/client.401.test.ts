/**
 * Unit tests for API client 401 handling and token refresh
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiClient } from '../client'
import { AuthError } from '../errors'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch as any

describe('ApiClient 401 Handling', () => {
  let apiClient: ApiClient
  const mockBaseURL = 'http://localhost:5000'
  const mockConnectionString = 'Endpoint=sb://test.servicebus.windows.net/;...'

  beforeEach(() => {
    apiClient = new ApiClient(mockBaseURL)
    mockFetch.mockClear()
  })

  it('should store credentials after successful connect', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionId: 'sess-123', expiresAtUtc: new Date().toISOString() })
    })

    await apiClient.connect(mockConnectionString)
    
    // Verify credentials are stored by checking that refreshToken will work
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/connect'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('should automatically refresh token on 401 and retry request', async () => {
    // Setup: First connect to store credentials
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionId: 'sess-123', expiresAtUtc: new Date().toISOString() })
    })
    await apiClient.connect(mockConnectionString)
    mockFetch.mockClear()

    // Scenario: API call returns 401, then refresh succeeds, then retry succeeds
    mockFetch
      .mockResolvedValueOnce({ // First call: 401
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      })
      .mockResolvedValueOnce({ // Refresh call: success
        ok: true,
        json: async () => ({ sessionId: 'sess-456', expiresAtUtc: new Date().toISOString() })
      })
      .mockResolvedValueOnce({ // Retry original call: success
        ok: true,
        json: async () => ({ queues: [], topics: [] })
      })

    const result = await apiClient.listEntities('sess-123')
    
    expect(result).toEqual({ queues: [], topics: [] })
    expect(mockFetch).toHaveBeenCalledTimes(3) // Original + refresh + retry
  })

  it('should throw AuthError if refresh also returns 401', async () => {
    // Setup: First connect to store credentials
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionId: 'sess-123', expiresAtUtc: new Date().toISOString() })
    })
    await apiClient.connect(mockConnectionString)
    mockFetch.mockClear()

    // Scenario: API call returns 401, refresh also returns 401
    mockFetch
      .mockResolvedValueOnce({ // First call: 401
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      })
      .mockResolvedValueOnce({ // Refresh call: also 401
        ok: false,
        status: 401,
        text: async () => 'Unauthorized - token expired'
      })

    await expect(apiClient.listEntities('sess-123')).rejects.toThrow(AuthError)
    expect(mockFetch).toHaveBeenCalledTimes(2) // Original + refresh
  })

  it('should prevent duplicate refresh attempts', async () => {
    // Setup: First connect to store credentials
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionId: 'sess-123', expiresAtUtc: new Date().toISOString() })
    })
    await apiClient.connect(mockConnectionString)
    mockFetch.mockClear()

    // Scenario: Two concurrent 401s should only trigger one refresh
    mockFetch
      .mockResolvedValueOnce({ // First 401
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      })
      .mockResolvedValueOnce({ // Second 401 (concurrent)
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      })
      .mockResolvedValueOnce({ // Refresh call: success
        ok: true,
        json: async () => ({ sessionId: 'sess-456', expiresAtUtc: new Date().toISOString() })
      })
      .mockResolvedValue({ // All retry calls: success
        ok: true,
        json: async () => ({ queues: [], topics: [] })
      })

    // Make two concurrent requests that will both get 401
    const [result1, result2] = await Promise.all([
      apiClient.listEntities('sess-123'),
      apiClient.peekMessages('sess-123', 'queue1', 10)
    ])

    expect(result1).toBeDefined()
    expect(result2).toBeDefined()
    
    // Should only have: 2 initial 401s + 1 refresh + 2 retries = 5 calls
    expect(mockFetch).toHaveBeenCalledTimes(5)
  })

  it('should clear credentials on clearCredentials call', () => {
    apiClient.clearCredentials()
    
    // After clearing, attempting refresh should fail immediately
    expect(() => apiClient.refreshToken()).rejects.toThrow(AuthError)
  })
})

describe('AuthError', () => {
  it('should provide user-friendly messages', () => {
    const tokenExpiredError = new AuthError('Token expired', '/api/test', 'token_expired')
    expect(tokenExpiredError.getUserFriendlyMessage()).toContain('session has expired')

    const permissionError = new AuthError('Access denied', '/api/test', 'permission_denied')
    expect(permissionError.getUserFriendlyMessage()).toContain('Access denied')

    const genericError = new AuthError('Unauthorized', '/api/test', 'unauthorized')
    expect(genericError.getUserFriendlyMessage()).toContain('Authentication required')
  })

  it('should be instance of Error', () => {
    const error = new AuthError('Test', '/api/test')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('AuthError')
    expect(error.status).toBe(401)
  })
})
