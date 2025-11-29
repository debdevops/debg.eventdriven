/**
 * Hook for sending messages with optimistic UI updates
 * Handles:
 * - Immediate optimistic insertion with temp ID
 * - Server reconciliation with metadata
 * - Elapsed time measurement
 * - Error handling and rollback
 */

import { useCallback } from 'react';
import { API_BASE_URL } from '../config/api';
import type { OptimisticMessage } from '../utils/optimistic';
import {
  createOptimisticMessage,
  reconcileOptimisticMessage,
  markOptimisticFailed
} from '../utils/optimistic';

interface UseSendMessageOptions {
  sessionId: string;
  onOptimisticAdd: (message: OptimisticMessage) => void;
  onMessageSent: (tempId: string, serverMessage: OptimisticMessage, elapsedMs: number) => void;
  onMessageFailed: (tempId: string, error: string) => void;
}

interface SendMessageParams {
  entityName: string;
  payload: string;
}

export function useSendMessage({
  sessionId,
  onOptimisticAdd,
  onMessageSent,
  onMessageFailed
}: UseSendMessageOptions) {
  const sendMessage = useCallback(async ({
    entityName,
    payload
  }: SendMessageParams): Promise<void> => {
    const startTime = performance.now();
    
    // Create optimistic message with temp ID
    const optimisticMsg = createOptimisticMessage(payload, entityName);
    
    // Immediately add to UI (optimistic insert)
    onOptimisticAdd(optimisticMsg);

    try {
      // Send to backend
      const response = await fetch(
        `${API_BASE_URL}/api/namespace/${sessionId}/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entityName,
            message: payload,
            applicationProperties: {
              timestamp: new Date().toISOString(),
              source: 'message-sender',
              correlationId: `msg-${Date.now()}`
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Parse response - backend may return messageId/sequenceNumber
      const result = await response.json().catch(() => ({}));
      
      // Measure elapsed time
      const elapsedMs = Math.round(performance.now() - startTime);
      
      // Reconcile with server response
      const reconciledMsg = reconcileOptimisticMessage(optimisticMsg, {
        messageId: result.messageId || optimisticMsg.messageId,
        sequenceNumber: result.sequenceNumber || optimisticMsg.sequenceNumber,
        enqueuedTimeUtc: result.enqueuedTimeUtc || optimisticMsg.enqueuedTimeUtc
      });

      onMessageSent(optimisticMsg.tempId!, reconciledMsg, elapsedMs);
    } catch (error) {
      // Mark as failed
      const failedMsg = markOptimisticFailed(
        optimisticMsg,
        error instanceof Error ? error.message : 'Send failed'
      );
      onMessageFailed(optimisticMsg.tempId!, failedMsg.error!);
    }
  }, [sessionId, onOptimisticAdd, onMessageSent, onMessageFailed]);

  return { sendMessage };
}
