export type Credentials = { secretName?: string; raw?: string }

let currentCreds: Credentials | null = null

export function setCredentials(creds: Credentials) {
  currentCreds = creds
}

export function getCredentials(): Credentials | null {
  return currentCreds
}

export function resetClient() {
  currentCreds = null
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071'

export async function register(): Promise<{ ok: true }> {
  // Placeholder for future registration flow
  return { ok: true }
}

export async function connectSession(creds: Credentials): Promise<{ sessionId: string }> {
  // Placeholder: simulate a new session id
  setCredentials(creds)
  return { sessionId: Math.random().toString(36).slice(2) }
}
