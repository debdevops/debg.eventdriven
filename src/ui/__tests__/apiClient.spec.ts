import { apiClient } from '../src/debug/exportForTests'

describe('ApiClient credentials (stub)', () => {
  beforeEach(() => {
    apiClient.resetClient()
  })

  it('getCredentials returns null initially', () => {
    expect(apiClient.getCredentials()).toBeNull()
  })

  it('resetClient clears credentials', () => {
    ;(apiClient as any).setCredentials('s-1', 'Endpoint=...')
    expect(apiClient.getCredentials()).not.toBeNull()
    apiClient.resetClient()
    expect(apiClient.getCredentials()).toBeNull()
  })
})
