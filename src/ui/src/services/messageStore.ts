/**
 * Local Message Store - Persists messages to IndexedDB
 * Allows viewing and debugging messages even after they're received/deleted
 */

import type { MessageEnvelope } from '../types'
import { entityIdFromMessageStoreParams, isValidEntityId } from '../utils/entityIdentity'

const DB_NAME = 'ServiceBusInspector'
const DB_VERSION = 3
const STORE_NAME = 'messages'

interface StoredMessage extends MessageEnvelope {
  storedAt: string
  action: 'peeked' | 'received'
}

interface EntityMessagesRecord {
  entityId: string
  sessionId: string
  entityName: string
  entityType: 'queue' | 'topic' | 'subscription' | 'dlq'
  subscriptionName?: string
  messages: StoredMessage[]
}

class MessageStore {
  private db: IDBDatabase | null = null

  private warn(msg: string, err?: unknown) {
    // Regression protection: warn only; never throw.
    // eslint-disable-next-line no-console
    console.warn(`[MessageStore] ${msg}`, err)
  }

  async init(): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        this.warn('IndexedDB open failed; continuing without persistence', request.error)
        this.db = null
        resolve()
      }
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Schema change: migrate from per-message composite keys (which can become invalid
        // when optional fields are undefined) to a single stable entityId key.
        // On upgrade, delete the old store to clear any corrupted data.
        if (db.objectStoreNames.contains(STORE_NAME)) db.deleteObjectStore(STORE_NAME)

        const store = db.createObjectStore(STORE_NAME, { keyPath: 'entityId' })
        store.createIndex('sessionId', 'sessionId', { unique: false })
      }
    })
  }

  private async withDb(): Promise<IDBDatabase | null> {
    if (!this.db) await this.init()
    return this.db
  }

  private buildEntityId(
    entityType: 'queue' | 'topic' | 'subscription' | 'dlq',
    entityName: string,
    subscriptionName?: string
  ): string | null {
    // FIX(indexeddb): entityId MUST be deterministic and a valid IndexedDB key (non-empty string).
    // If subscriptionName is required (subscription), treat missing as invalid.
    if (entityType === 'subscription' && !subscriptionName) return null
    return entityIdFromMessageStoreParams(entityType, entityName, subscriptionName)
  }

  async clearView(
    sessionId: string,
    entityType: 'queue' | 'topic' | 'subscription' | 'dlq',
    entityName: string,
    subscriptionName?: string
  ): Promise<void> {
    // FIX(state): best-effort clear of the per-entity+view persistence bucket.
    // This prevents stale persisted data from carrying across navigation switches.
    void sessionId
    const db = await this.withDb()
    if (!db) return

    const entityId = this.buildEntityId(entityType, entityName, subscriptionName)
    if (!isValidEntityId(entityId)) return

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.delete(entityId)

        request.onsuccess = () => resolve()
        request.onerror = () => {
          this.warn('IndexedDB delete failed (non-fatal)', request.error)
          resolve()
        }
      } catch (err) {
        this.warn('IndexedDB transaction failed (non-fatal)', err)
        resolve()
      }
    })
  }

  async saveMessage(
    message: MessageEnvelope,
    sessionId: string,
    entityName: string,
    entityType: 'queue' | 'topic' | 'subscription' | 'dlq',
    action: 'peeked' | 'received',
    subscriptionName?: string
  ): Promise<void> {
    const db = await this.withDb()
    if (!db) return

    const entityId = this.buildEntityId(entityType, entityName, subscriptionName)
    if (!isValidEntityId(entityId)) {
      this.warn('Skipping persist: invalid entityId', { entityType, entityName, subscriptionName })
      return
    }

    const storedMessage: StoredMessage = {
      ...message,
      storedAt: new Date().toISOString(),
      action
    }

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const getReq = store.get(entityId)

        getReq.onsuccess = () => {
          const existing = getReq.result as EntityMessagesRecord | undefined
          const record: EntityMessagesRecord = existing && existing.sessionId === sessionId
            ? existing
            : {
                entityId,
                sessionId,
                entityName,
                entityType,
                subscriptionName,
                messages: []
              }

          // Merge + de-dupe by sequenceNumber.
          const bySeq = new Map<number, StoredMessage>(record.messages.map(m => [m.sequenceNumber, m]))
          bySeq.set(storedMessage.sequenceNumber, storedMessage)
          record.messages = Array.from(bySeq.values()).sort((a, b) => b.sequenceNumber - a.sequenceNumber)

          const putReq = store.put(record)
          putReq.onsuccess = () => resolve()
          putReq.onerror = () => {
            this.warn('IndexedDB put failed (non-fatal)', putReq.error)
            resolve()
          }
        }

        getReq.onerror = () => {
          this.warn('IndexedDB get failed (non-fatal)', getReq.error)
          resolve()
        }
      } catch (err) {
        this.warn('IndexedDB transaction failed (non-fatal)', err)
        resolve()
      }
    })
  }

  async saveMessages(
    messages: MessageEnvelope[],
    sessionId: string,
    entityName: string,
    entityType: 'queue' | 'topic' | 'subscription' | 'dlq',
    action: 'peeked' | 'received',
    subscriptionName?: string
  ): Promise<void> {
    const db = await this.withDb()
    if (!db) return

    if (messages.length === 0) return

    const entityId = this.buildEntityId(entityType, entityName, subscriptionName)
    if (!isValidEntityId(entityId)) {
      this.warn('Skipping persist: invalid entityId', { entityType, entityName, subscriptionName })
      return
    }

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const getReq = store.get(entityId)

        getReq.onsuccess = () => {
          const existing = getReq.result as EntityMessagesRecord | undefined
          const record: EntityMessagesRecord = existing && existing.sessionId === sessionId
            ? existing
            : {
                entityId,
                sessionId,
                entityName,
                entityType,
                subscriptionName,
                messages: []
              }

          const bySeq = new Map<number, StoredMessage>(record.messages.map(m => [m.sequenceNumber, m]))
          for (const message of messages) {
            if (!message || typeof message.sequenceNumber !== 'number') continue
            bySeq.set(message.sequenceNumber, {
              ...message,
              storedAt: new Date().toISOString(),
              action
            })
          }

          record.messages = Array.from(bySeq.values()).sort((a, b) => b.sequenceNumber - a.sequenceNumber)

          const putReq = store.put(record)
          putReq.onsuccess = () => resolve()
          putReq.onerror = () => {
            this.warn('IndexedDB put failed (non-fatal)', putReq.error)
            resolve()
          }
        }

        getReq.onerror = () => {
          this.warn('IndexedDB get failed (non-fatal)', getReq.error)
          resolve()
        }
      } catch (err) {
        this.warn('IndexedDB transaction failed (non-fatal)', err)
        resolve()
      }
    })
  }

  async getMessages(
    sessionId: string,
    entityName: string,
    entityType?: 'queue' | 'dlq' | 'subscription' | 'topic',
    subscriptionName?: string
  ): Promise<StoredMessage[]> {
    const db = await this.withDb()
    if (!db) return []

    const mappedType = entityType === 'dlq' ? 'dlq' : entityType
    if (!mappedType) return []

    const entityId = this.buildEntityId(mappedType as any, entityName, subscriptionName)
    if (!isValidEntityId(entityId)) return []

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get(entityId)

        request.onsuccess = () => {
          const record = request.result as EntityMessagesRecord | undefined
          if (!record || record.sessionId !== sessionId) {
            resolve([])
            return
          }
          resolve(record.messages || [])
        }

        request.onerror = () => {
          this.warn('IndexedDB get failed (non-fatal)', request.error)
          resolve([])
        }
      } catch (err) {
        this.warn('IndexedDB transaction failed (non-fatal)', err)
        resolve([])
      }
    })
  }

  async getAllMessages(sessionId: string): Promise<StoredMessage[]> {
    const db = await this.withDb()
    if (!db) return []

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const index = store.index('sessionId')
        const request = index.getAll(sessionId)

        request.onsuccess = () => {
          const records = request.result as EntityMessagesRecord[]
          const messages = records.flatMap(r => r.messages || [])
          messages.sort((a, b) => new Date(b.storedAt).getTime() - new Date(a.storedAt).getTime())
          resolve(messages)
        }
        request.onerror = () => {
          this.warn('IndexedDB query failed (non-fatal)', request.error)
          resolve([])
        }
      } catch (err) {
        this.warn('IndexedDB transaction failed (non-fatal)', err)
        resolve([])
      }
    })
  }

  async deleteMessage(
    sessionId: string,
    entityName: string,
    messageId: string,
    sequenceNumber: number
  ): Promise<void> {
    const db = await this.withDb()
    if (!db) return

    // Best-effort deletion for queue main only (legacy API).
    const entityId = this.buildEntityId('queue', entityName)
    if (!isValidEntityId(entityId)) return

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const getReq = store.get(entityId)

        getReq.onsuccess = () => {
          const record = getReq.result as EntityMessagesRecord | undefined
          if (!record || record.sessionId !== sessionId) {
            resolve()
            return
          }
          record.messages = (record.messages || []).filter(m => !(m.messageId === messageId && m.sequenceNumber === sequenceNumber))
          const putReq = store.put(record)
          putReq.onsuccess = () => resolve()
          putReq.onerror = () => {
            this.warn('IndexedDB put failed (non-fatal)', putReq.error)
            resolve()
          }
        }

        getReq.onerror = () => {
          this.warn('IndexedDB get failed (non-fatal)', getReq.error)
          resolve()
        }
      } catch (err) {
        this.warn('IndexedDB transaction failed (non-fatal)', err)
        resolve()
      }
    })
  }

  async clearEntity(sessionId: string, entityName: string): Promise<void> {
    // Legacy API: sessionId kept for compatibility.
    void sessionId
    const db = await this.withDb()
    if (!db) return

    // Best-effort: clear the main queue bucket.
    const entityId = this.buildEntityId('queue', entityName)
    if (!isValidEntityId(entityId)) return

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.delete(entityId)
        request.onsuccess = () => resolve()
        request.onerror = () => {
          this.warn('IndexedDB delete failed (non-fatal)', request.error)
          resolve()
        }
      } catch (err) {
        this.warn('IndexedDB transaction failed (non-fatal)', err)
        resolve()
      }
    })
  }

  async clearAll(): Promise<void> {
    const db = await this.withDb()
    if (!db) return

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.clear()
        request.onsuccess = () => resolve()
        request.onerror = () => {
          this.warn('IndexedDB clear failed (non-fatal)', request.error)
          resolve()
        }
      } catch (err) {
        this.warn('IndexedDB transaction failed (non-fatal)', err)
        resolve()
      }
    })
  }

  async getStats(sessionId: string): Promise<{
    total: number
    byEntity: Record<string, number>
    byAction: { peeked: number; received: number }
  }> {
    const db = await this.withDb()
    if (!db) {
      return { total: 0, byEntity: {}, byAction: { peeked: 0, received: 0 } }
    }

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const index = store.index('sessionId')
        const request = index.getAll(sessionId)

        request.onsuccess = () => {
          const records = request.result as EntityMessagesRecord[]
          const byEntity: Record<string, number> = {}
          const byAction = { peeked: 0, received: 0 }

          let total = 0
          for (const record of records) {
            const msgs = record.messages || []
            byEntity[record.entityId] = msgs.length
            total += msgs.length
            for (const m of msgs) {
              if (m.action === 'peeked') byAction.peeked++
              if (m.action === 'received') byAction.received++
            }
          }

          resolve({ total, byEntity, byAction })
        }

        request.onerror = () => {
          this.warn('IndexedDB stats query failed (non-fatal)', request.error)
          resolve({ total: 0, byEntity: {}, byAction: { peeked: 0, received: 0 } })
        }
      } catch (err) {
        this.warn('IndexedDB stats transaction failed (non-fatal)', err)
        resolve({ total: 0, byEntity: {}, byAction: { peeked: 0, received: 0 } })
      }
    })
  }
}

export const messageStore = new MessageStore()
