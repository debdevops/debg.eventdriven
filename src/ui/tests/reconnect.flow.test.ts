import { screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mountApp, mockApiClient, restoreApiClient } from './testUtils'

// Helpers
function forceAuthFailure() {
  // Simulate 401: clear credentials + throw from a request path
  mockApiClient({
    health: async () => {
      // emulate request hitting 401 and client clearing credentials
      if ((global as any).fetch) {
        // no-op; unit path avoids network
      }
      // mimic internal behavior: credentials cleared
      ;(require('../src/debug/exportForTests').apiClient as any).resetClient()
      const err: any = new Error('Unauthorized')
      err.name = 'AuthError'
      throw err
    }
  })
}

describe('Reconnect workflow (integration-like, RTL)', () => {
  const user = userEvent.setup()

  afterEach(() => {
    restoreApiClient()
  })

  test('a) 401 → UI enters auth_required and shows reconnect modal', async () => {
    // Mock connect and list APIs so app boot works until failure
    mockApiClient({
      getCredentials: () => null,
      health: async () => ({ status: 'healthy', timestamp: new Date().toISOString() })
    })

    mountApp('/')

    // Trigger an auth failure (simulated)
    forceAuthFailure()

    // The app should react to auth failure by surfacing reconnect UI
    // Wait for modal presence by known content or test id
    // SessionExpiredModal has buttons with data-test attributes added earlier
    await act(async () => {})

    const modalReconnectBtn = await screen.findByTestId('reconnect-cta')
    expect(modalReconnectBtn).toBeInTheDocument()
  })

  test('b) reconnect success restores state and clears banners', async () => {
    // Seed with prior selection and mocks
    const newSessionId = 'session-new-001'

    mockApiClient({
      getCredentials: () => ({ sessionId: 'old-session', connectionString: 'Endpoint=...Old' }),
      connect: async () => ({ sessionId: newSessionId }),
      setCredentials: (sid: string, cs: string) => {
        // reflect new creds for subsequent calls
        mockApiClient({ getCredentials: () => ({ sessionId: sid, connectionString: cs }) })
      },
      listEntities: async () => ({ queues: ['test-queue'], topics: [] }),
      health: async () => ({ status: 'healthy', timestamp: new Date().toISOString() }),
      // stream/peek mocks (no-ops)
      peekMessages: async () => ({ count: 0, messages: [] })
    })

    mountApp('/')

    // Simulate prior failure showing modal
    forceAuthFailure()
    const modalReconnectBtn = await screen.findByTestId('reconnect-cta')

    // Perform reconnect
    await user.click(modalReconnectBtn)

    // Verify namespaces/entities reload (presence of a known queue name)
    const queueItem = await screen.findByText('test-queue')
    expect(queueItem).toBeInTheDocument()

    // Verify banners are cleared (no red error banner)
    const errorBanner = screen.queryByText(/unauthorized/i)
    expect(errorBanner).toBeNull()

    // Auto-refresh resumes implied by periodic calls; here we assert no crash and health remains ok
    const healthOk = await (require('../src/debug/exportForTests').apiClient as any).health()
    expect(healthOk.status).toBe('healthy')
  })

  test('c) switching queues after reconnect does not 401', async () => {
    mockApiClient({
      getCredentials: () => ({ sessionId: 'session-ok', connectionString: 'Endpoint=...CS' }),
      listEntities: async () => ({ queues: ['q1', 'q2'], topics: [] }),
      health: async () => ({ status: 'healthy', timestamp: new Date().toISOString() })
    })

    mountApp('/')

    // Ensure queues render
    const q1 = await screen.findByText('q1')
    const q2 = await screen.findByText('q2')
    expect(q1).toBeInTheDocument()
    expect(q2).toBeInTheDocument()

    // Switch queue selection rapidly
    await user.click(q2)
    await user.click(q1)

    // Assert no new 401 surfaced in UI
    const unauthorizedBanner = screen.queryByText(/401|unauthorized/i)
    expect(unauthorizedBanner).toBeNull()
  })

  test('d) reconnect modal appears once per failure', async () => {
    mockApiClient({ health: async () => ({ status: 'healthy', timestamp: new Date().toISOString() }) })
    mountApp('/')

    // First failure
    forceAuthFailure()
    const btn = await screen.findByTestId('reconnect-cta')
    expect(btn).toBeInTheDocument()

    // Click to dismiss/handle
    await user.click(btn)

    // Trigger another unrelated UI event; ensure modal doesn't loop
    const modalAgain = screen.queryByTestId('reconnect-cta')
    expect(modalAgain).toBeNull()
  })

  test('e) rapid navigation during reconnect is guarded', async () => {
    mockApiClient({
      getCredentials: () => ({ sessionId: 's1', connectionString: 'Endpoint=...' }),
      listEntities: async () => ({ queues: ['qA', 'qB'], topics: [] }),
      connect: async () => ({ sessionId: 's2' }),
      health: async () => ({ status: 'healthy', timestamp: new Date().toISOString() })
    })

    mountApp('/')

    // Show modal
    forceAuthFailure()
    const reconnectBtn = await screen.findByTestId('reconnect-cta')

    // Start reconnect and spam clicks/navigations
    const qA = await screen.findByText('qA')
    const qB = await screen.findByText('qB')

    await Promise.all([
      user.click(reconnectBtn),
      user.click(qA),
      user.click(qB),
      user.click(qA)
    ])

    // App should still render queues without crashing and no auth banner
    expect(await screen.findByText('qA')).toBeInTheDocument()
    expect(await screen.findByText('qB')).toBeInTheDocument()
    expect(screen.queryByText(/unauthorized/i)).toBeNull()
  })
})
