import { apiClient } from '../src/debug/exportForTests'
// Note: ApiClient implements credential helpers (setCredentials/getCredentials/resetClient)
// Tests focus on credentials-only behavior with fetch mocked to avoid network.

describe('ApiClient credentials behavior', () => {
  const SESSION_ID = 'test-session-123'
  const CONNECTION_STRING = 'Endpoint=sb://example.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=fakekey='

  beforeEach(() => {
    // Ensure clean slate before each test
    apiClient.resetClient()
    jest.restoreAllMocks()
  })

  test('initial state', () => {
    const creds = apiClient.getCredentials()
    expect(creds).toBeNull()
  })

  test('set credentials', () => {
    // Use public API to set credentials
    // setCredentials(sessionId, connectionString)
    // (connect() would hit network; we avoid that in unit tests)
    // @ts-expect-no-error: method exists on ApiClient
    ;(apiClient as any).setCredentials(SESSION_ID, CONNECTION_STRING)

    const creds = apiClient.getCredentials()
    expect(creds).not.toBeNull()
    expect(creds?.sessionId).toBe(SESSION_ID)
    expect(creds?.connectionString).toBe(CONNECTION_STRING)
  })

  test('reset clears credentials', () => {
    ;(apiClient as any).setCredentials(SESSION_ID, CONNECTION_STRING)
    expect(apiClient.getCredentials()).not.toBeNull()

    apiClient.resetClient()
    expect(apiClient.getCredentials()).toBeNull()
  })

  test('handle 401 clears credentials', async () => {
    // Start with valid credentials
    ;(apiClient as any).setCredentials(SESSION_ID, CONNECTION_STRING)
    expect(apiClient.getCredentials()).not.toBeNull()

    // Mock fetch to return 401 for any request
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => 'Unauthorized'
    } as Response)

    // Call a public method that triggers a request
    // health() uses request() internally and will process 401
    await expect(apiClient.health()).rejects.toBeTruthy()

    // Credentials should have been cleared after 401 handling
    expect(apiClient.getCredentials()).toBeNull()

    fetchSpy.mockRestore()
  })
})
