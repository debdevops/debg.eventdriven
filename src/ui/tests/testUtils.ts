import React from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App'

// We import the real apiClient via the test-only shim to mock/restore cleanly
import * as TestExports from '../src/debug/exportForTests'

let originalApiClient: any

export function mockApiClient(overrides: Partial<any> = {}) {
  if (!originalApiClient) {
    originalApiClient = { ...TestExports.apiClient }
  }
  Object.assign(TestExports.apiClient as any, overrides)
}

export function restoreApiClient() {
  if (originalApiClient) {
    Object.assign(TestExports.apiClient as any, originalApiClient)
  }
}

export function mountApp(initialRoute: string = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>
  )
}
