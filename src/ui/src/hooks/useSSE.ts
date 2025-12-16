/**
 * Production-grade SSE Hook with:
 * - Exponential backoff reconnection: 500ms → 1s → 2s → 4s → 8s, then 30s forever
 * - Batch message updates (aggregate 200-300ms to prevent re-render storms)
 * - Connection status tracking with timestamps
 * - Heartbeat handling
 * - Message buffer flushing on disconnect
 * 
 * Configuration (tune these for production):
 * - BATCH_DELAY_MS: Aggregate incoming messages for this duration before setState (default 250ms)
 * - INITIAL_BACKOFF_MS: First reconnection delay (default 500ms)
 * - MAX_FAST_RETRIES: Number of fast exponential retries before switching to slow retry (default 5)
 * - SLOW_RETRY_INTERVAL_MS: Retry interval after fast retries exhausted (default 30000ms = 30s)
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { MessageEnvelope } from '../types';

// Configuration constants - TUNE THESE FOR YOUR NEEDS
const BATCH_DELAY_MS = 50; // Message batching window
const INITIAL_BACKOFF_MS = 500; // First retry delay
const MAX_FAST_RETRIES = 5; // Number of exponential backoff attempts
const SLOW_RETRY_INTERVAL_MS = 30000; // Retry every 30s after fast retries

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
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [status, setStatus] = useState<SSEConnectionStatus>('disconnected');
  const [reconnectCount, setReconnectCount] = useState(0);
  const [lastConnected, setLastConnected] = useState<Date | null>(null);
  const [lastReconnectAttempt, setLastReconnectAttempt] = useState<Date | null>(null);

  // Exponential backoff: 500ms → 1s → 2s → 4s → 8s, then 30s forever
  const getBackoffDelay = useCallback((attempt: number): number => {
    if (attempt < MAX_FAST_RETRIES) {
      // Exponential: 500ms, 1000ms, 2000ms, 4000ms, 8000ms
      return INITIAL_BACKOFF_MS * Math.pow(2, attempt);
    }
    // After fast retries, use slow retry interval
    return SLOW_RETRY_INTERVAL_MS;
  }, []);

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

    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, [onBatchMessages, onMessage]);

  // Queue a message for batched delivery
  const queueMessage = useCallback((message: MessageEnvelope) => {
    batchQueueRef.current.push(message);

    // Schedule flush if not already scheduled
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(() => {
        flushBatch();
      }, BATCH_DELAY_MS);
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

    // Clear any pending reconnect timer
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
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

        // Schedule reconnection if still enabled
        if (enabled) {
          const delay = getBackoffDelay(reconnectCount);
          setStatus('reconnecting');
          setLastReconnectAttempt(new Date());

          reconnectTimerRef.current = setTimeout(() => {
            setReconnectCount(prev => prev + 1);
            connect();
          }, delay);
        } else {
          setStatus('disconnected');
        }
      };

    } catch (err) {
      console.error('[useSSE] Connection error:', err);
      setStatus('disconnected');
    }
  }, [enabled, url, reconnectCount, getBackoffDelay, queueMessage, flushBatch, onOpen, onHeartbeat, onClose]);

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
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
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
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
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
