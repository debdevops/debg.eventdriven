/**
 * Local Message Store - Persists messages to IndexedDB
 * Allows viewing and debugging messages even after they're received/deleted
 */

import type { MessageEnvelope } from '../types'

const DB_NAME = 'ServiceBusInspector'
const DB_VERSION = 1
const STORE_NAME = 'messages'

interface StoredMessage extends MessageEnvelope {
  storedAt: string
  sessionId: string
  entityName: string
  entityType: 'queue' | 'topic' | 'subscription' | 'dlq'
  subscriptionName?: string
  action: 'peeked' | 'received'
}

class MessageStore {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { 
            keyPath: ['sessionId', 'entityName', 'messageId', 'sequenceNumber'] 
          })
          
          // Indexes for querying
          store.createIndex('sessionId', 'sessionId', { unique: false })
          store.createIndex('entityName', 'entityName', { unique: false })
          store.createIndex('storedAt', 'storedAt', { unique: false })
          store.createIndex('messageId', 'messageId', { unique: false })
          store.createIndex('sessionEntity', ['sessionId', 'entityName'], { unique: false })
        }
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
    if (!this.db) await this.init()

    const storedMessage: StoredMessage = {
      ...message,
      storedAt: new Date().toISOString(),
      sessionId,
      entityName,
      entityType,
      subscriptionName,
      action
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(storedMessage)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
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
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      let completed = 0
      const total = messages.length

      if (total === 0) {
        resolve()
        return
      }

      messages.forEach(message => {
        const storedMessage: StoredMessage = {
          ...message,
          storedAt: new Date().toISOString(),
          sessionId,
          entityName,
          entityType,
          subscriptionName,
          action
        }

        const request = store.put(storedMessage)
        
        request.onsuccess = () => {
          completed++
          if (completed === total) resolve()
        }
        
        request.onerror = () => reject(request.error)
      })
    })
  }

  async getMessages(
    sessionId: string,
    entityName: string,
    entityType?: 'queue' | 'dlq' | 'subscription' | 'topic'
  ): Promise<StoredMessage[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('sessionEntity')
      const request = index.getAll([sessionId, entityName])

      request.onsuccess = () => {
        let messages = request.result as StoredMessage[]
        
        // Filter by entityType if specified (important for Queue vs DLQ distinction)
        if (entityType) {
          messages = messages.filter(m => m.entityType === entityType)
        }
        
        // Sort by storedAt descending (newest first)
        messages.sort((a, b) => 
          new Date(b.storedAt).getTime() - new Date(a.storedAt).getTime()
        )
        resolve(messages)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getAllMessages(sessionId: string): Promise<StoredMessage[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('sessionId')
      const request = index.getAll(sessionId)

      request.onsuccess = () => {
        const messages = request.result as StoredMessage[]
        messages.sort((a, b) => 
          new Date(b.storedAt).getTime() - new Date(a.storedAt).getTime()
        )
        resolve(messages)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async deleteMessage(
    sessionId: string,
    entityName: string,
    messageId: string,
    sequenceNumber: number
  ): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete([sessionId, entityName, messageId, sequenceNumber])

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async clearEntity(sessionId: string, entityName: string): Promise<void> {
    if (!this.db) await this.init()

    const messages = await this.getMessages(sessionId, entityName)
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      let completed = 0
      const total = messages.length

      if (total === 0) {
        resolve()
        return
      }

      messages.forEach(msg => {
        const request = store.delete([sessionId, entityName, msg.messageId, msg.sequenceNumber])
        
        request.onsuccess = () => {
          completed++
          if (completed === total) resolve()
        }
        
        request.onerror = () => reject(request.error)
      })
    })
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getStats(sessionId: string): Promise<{
    total: number
    byEntity: Record<string, number>
    byAction: { peeked: number; received: number }
  }> {
    const messages = await this.getAllMessages(sessionId)
    
    const byEntity: Record<string, number> = {}
    const byAction = { peeked: 0, received: 0 }

    messages.forEach(msg => {
      const key = msg.subscriptionName 
        ? `${msg.entityName}/${msg.subscriptionName}`
        : msg.entityName
      
      byEntity[key] = (byEntity[key] || 0) + 1
      byAction[msg.action]++
    })

    return {
      total: messages.length,
      byEntity,
      byAction
    }
  }
}

export const messageStore = new MessageStore()
