/**
 * Connection status badge utilities
 */

import type { SSEConnectionStatus } from '../hooks/useSSE';

export interface ConnectionBadgeStyle {
  color: string;
  backgroundColor: string;
  text: string;
  tooltipText: string;
}

export function getConnectionBadgeStyle(
  status: SSEConnectionStatus,
  lastReconnectAttempt: Date | null,
  reconnectCount: number
): ConnectionBadgeStyle {
  const lastAttemptText = lastReconnectAttempt
    ? ` (last attempt: ${lastReconnectAttempt.toLocaleTimeString()})`
    : '';

  switch (status) {
    case 'connected':
      return {
        color: '#fff',
        backgroundColor: '#28a745',
        text: 'Connected',
        tooltipText: 'Live stream active'
      };
    
    case 'connecting':
      return {
        color: '#000',
        backgroundColor: '#ffc107',
        text: 'Connecting...',
        tooltipText: 'Establishing connection...'
      };
    
    case 'reconnecting':
      return {
        color: '#000',
        backgroundColor: '#ff9800',
        text: `Reconnecting (${reconnectCount})`,
        tooltipText: `Attempting to reconnect${lastAttemptText}`
      };
    
    case 'disconnected':
    default:
      return {
        color: '#fff',
        backgroundColor: '#dc3545',
        text: 'Disconnected',
        tooltipText: 'Not connected to live stream'
      };
  }
}

export function formatElapsedMs(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}
