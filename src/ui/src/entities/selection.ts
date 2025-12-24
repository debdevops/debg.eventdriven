/**
 * Selection model for message viewing.
 *
 * FIX(selection): enforce explicit entityType + viewType so parent-row clicks can expand
 * without implicitly loading data, and so Messages vs DLQ state stays isolated.
 */

import type { Entity, Subscription } from '../types'

export type EntityType = 'queue' | 'subscription'
export type ViewType = 'messages' | 'dlq'

export interface SelectedTarget {
  entityType: EntityType
  viewType: ViewType
  // queue
  entity?: Entity
  // subscription
  subscription?: Subscription
  topicName?: string
}

export function selectionKey(target: SelectedTarget): string {
  return `${target.entityType}:${target.viewType}:${target.entity?.name || ''}:${target.topicName || ''}:${target.subscription?.name || ''}`
}
