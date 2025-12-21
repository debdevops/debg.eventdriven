/**
 * SSE Hook (hardened for deterministic session lifecycle)
 *
 * Session policy:
 * - No internal timers/reconnect loops.
 * - SessionController owns reconnect + all timers.
 * - When `enabled` flips false (expired/reconnecting/failed), SSE stops immediately.
 *
 * Performance:
 * - Microtask batching (no setTimeout) to avoid render storms.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { MessageEnvelope } from '../types';

export type SSEConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

export interface SSEConnectionInfo {
  status: SSEConnectionStatus;
  lastConnected: Date | null;
  lastReconnectAttempt: Date | null;
  reconnectCount: number;
}

interface UseSSEOptions {
  url: string;
  enabled: boolean;
  onMessage?: (message: MessageEnvelope) => void;
  onBatchMessages?: (messages: MessageEnvelope[]) => void;
  onHeartbeat?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export function useSSE({
  url,
  enabled,
  onMessage,
  onBatchMessages,
  onHeartbeat,
  onOpen,
  onClose
}: UseSSEOptions): SSEConnectionInfo {
  const eventSourceRef = useRef<EventSource | null>(null);
  const batchQueueRef = useRef<MessageEnvelope[]>([]);
  const flushScheduledRef = useRef(false);
  
  const [status, setStatus] = useState<SSEConnectionStatus>('disconnected');
  const [reconnectCount, setReconnectCount] = useState(0);
  const [lastConnected, setLastConnected] = useState<Date | null>(null);
  const [lastReconnectAttempt, setLastReconnectAttempt] = useState<Date | null>(null);

  // Flush batched messages
  const flushBatch = useCallback(() => {
    if (batchQueueRef.current.length > 0) {
      const batch = [...batchQueueRef.current];
      batchQueueRef.current = [];

      if (onBatchMessages) {
        onBatchMessages(batch);
      } else if (onMessage) {
        batch.forEach(msg => onMessage(msg));
      }
    }

    flushScheduledRef.current = false;
  }, [onBatchMessages, onMessage]);

  // Queue a message for batched delivery
  const queueMessage = useCallback((message: MessageEnvelope) => {
    batchQueueRef.current.push(message);

    // Schedule a single microtask flush for this tick.
    if (!flushScheduledRef.current) {
      flushScheduledRef.current = true;
      queueMicrotask(() => flushBatch());
    }
  }, [flushBatch]);

  // Connect to SSE endpoint
  const connect = useCallback(() => {
    if (!enabled || !url) return;

    // Cleanup existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setStatus('connecting');

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        setStatus('connected');
        setLastConnected(new Date());
        setReconnectCount(0); // Reset on successful connection
        onOpen?.();
      };

      es.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          queueMessage(data);
        } catch (err) {
          console.error('[useSSE] Failed to parse message:', err);
        }
      });

      es.addEventListener('heartbeat', () => {
        onHeartbeat?.();
      });

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        
        // Flush pending messages
        flushBatch();
        onClose?.();

        // No internal reconnect loop. SessionController owns reconnect.
        setStatus(enabled ? 'reconnecting' : 'disconnected');
        setLastReconnectAttempt(new Date());
        setReconnectCount(prev => prev + 1);
      };

    } catch (err) {
      console.error('[useSSE] Connection error:', err);
      setStatus('disconnected');
    }
  }, [enabled, url, queueMessage, flushBatch, onOpen, onHeartbeat, onClose]);

  // Effect: manage connection lifecycle
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      // Disconnect and cleanup
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      flushBatch();
      setStatus('disconnected');
      setReconnectCount(0);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      flushBatch();
    };
  }, [enabled, connect, flushBatch]);

  return {
    status,
    lastConnected,
    lastReconnectAttempt,
    reconnectCount
  };
}
