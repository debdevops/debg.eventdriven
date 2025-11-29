/**
 * Optimistic update utilities for message sending
 * Manages temporary IDs and state reconciliation
 */

import { v4 as uuidv4 } from 'uuid';
import type { MessageEnvelope } from '../types';

export interface OptimisticMessage extends MessageEnvelope {
  isOptimistic?: boolean;
  tempId?: string;
  status?: 'sending' | 'sent' | 'failed';
  error?: string;
}

/**
 * Create an optimistic message entry for immediate UI feedback
 * @param payload - Message payload/body
 * @param entityName - Queue or topic name
 */
export function createOptimisticMessage(
  payload: string,
  _entityName: string
): OptimisticMessage {
  const tempId = uuidv4();
  
  return {
    messageId: tempId,
    tempId,
    sequenceNumber: -1, // Placeholder
    enqueuedTimeUtc: new Date().toISOString(),
    deliveryCount: 0,
    body: payload,
    applicationProperties: {
      source: 'ui-optimistic',
      timestamp: new Date().toISOString()
    },
    isOptimistic: true,
    status: 'sending'
  };
}

/**
 * Reconcile optimistic message with server response
 * @param optimisticMsg - Temporary message
 * @param serverResponse - Actual message metadata from backend
 */
export function reconcileOptimisticMessage(
  optimisticMsg: OptimisticMessage,
  serverResponse: Partial<MessageEnvelope>
): MessageEnvelope {
  return {
    ...optimisticMsg,
    ...serverResponse,
    isOptimistic: false,
    status: 'sent',
    tempId: optimisticMsg.tempId // Preserve for matching
  } as MessageEnvelope;
}

/**
 * Mark optimistic message as failed
 */
export function markOptimisticFailed(
  optimisticMsg: OptimisticMessage,
  error: string
): OptimisticMessage {
  return {
    ...optimisticMsg,
    status: 'failed',
    error,
    isOptimistic: true
  };
}

/**
 * Find and replace optimistic message by tempId
 */
export function replaceOptimisticMessage(
  messages: OptimisticMessage[],
  tempId: string,
  replacement: MessageEnvelope | OptimisticMessage
): OptimisticMessage[] {
  return messages.map(msg =>
    msg.tempId === tempId ? { ...replacement, tempId } as OptimisticMessage : msg
  );
}

/**
 * Remove optimistic message by tempId
 */
export function removeOptimisticMessage(
  messages: OptimisticMessage[],
  tempId: string
): OptimisticMessage[] {
  return messages.filter(msg => msg.tempId !== tempId);
}
