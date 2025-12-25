/**
 * API Configuration
 */

// Injected by Vite at build/dev time via `define` in vite.config.ts.
// Intentionally avoids `import.meta.env` so Jest/Node (CJS) can parse this file.
declare const __API_BASE_URL__: string | undefined

const envBaseUrl =
  (typeof __API_BASE_URL__ !== 'undefined' && __API_BASE_URL__) ||
  (typeof process !== 'undefined' && (process as any).env?.VITE_API_BASE_URL) ||
  'http://localhost:5002'

export const API_BASE_URL = envBaseUrl

export const API_ENDPOINTS = {
  connect: '/api/namespace/connect',
  listEntities: (sessionId: string) => `/api/namespace/${sessionId}/entities`,
  peek: (sessionId: string, entityName: string) => `/api/queue/${sessionId}/${entityName}/peek`,
  receive: (sessionId: string, entityName: string) => `/api/queue/${sessionId}/${entityName}/receive`,
  stream: (sessionId: string, entityName: string, mode: string, prefetch = 50, batch = 100) =>
    `/api/stream/${sessionId}/${entityName}?mode=${mode}&prefetch=${prefetch}&batch=${batch}`,
  health: '/api/health'
} as const
