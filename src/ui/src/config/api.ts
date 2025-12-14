/**
 * API Configuration
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5002'

export const API_ENDPOINTS = {
  connect: '/api/namespace/connect',
  listEntities: (sessionId: string) => `/api/namespace/${sessionId}/entities`,
  peek: (sessionId: string, entityName: string) => `/api/queue/${sessionId}/${entityName}/peek`,
  receive: (sessionId: string, entityName: string) => `/api/queue/${sessionId}/${entityName}/receive`,
  stream: (sessionId: string, entityName: string, mode: string, prefetch = 50, batch = 20) =>
    `/api/stream/${sessionId}/${entityName}?mode=${mode}&prefetch=${prefetch}&batch=${batch}`,
  health: '/api/health'
} as const
