/**
 * Centralized UI Logger Service
 * Provides consistent logging with optional remote logging support.
 * Replaces scattered console.log/error/warn calls throughout the codebase.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  context?: string
  timestamp: Date
  data?: unknown
}

// In-memory buffer for recent logs (useful for debugging)
const LOG_BUFFER_SIZE = 100
const logBuffer: LogEntry[] = []

// Check if we're in development mode
const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV === 'development'

/**
 * Add entry to log buffer (circular buffer)
 */
function addToBuffer(entry: LogEntry): void {
  logBuffer.push(entry)
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift()
  }
}

/**
 * Format log message with context
 */
function formatMessage(context: string | undefined, message: string): string {
  return context ? `[${context}] ${message}` : message
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, context?: string, data?: unknown): void {
  const entry: LogEntry = {
    level,
    message,
    context,
    timestamp: new Date(),
    data
  }
  
  addToBuffer(entry)
  
  const formattedMessage = formatMessage(context, message)
  
  // Only log to console in development mode
  if (isDev) {
    switch (level) {
      case 'debug':
        console.debug(formattedMessage, data ?? '')
        break
      case 'info':
        console.info(formattedMessage, data ?? '')
        break
      case 'warn':
        console.warn(formattedMessage, data ?? '')
        break
      case 'error':
        console.error(formattedMessage, data ?? '')
        break
    }
  }
}

/**
 * UI Logger - centralized logging service
 */
export const uiLogger = {
  /**
   * Debug level logging - development only
   */
  debug(message: string, data?: unknown, context?: string): void {
    log('debug', message, context, data)
  },
  
  /**
   * Info level logging
   */
  info(message: string, data?: unknown, context?: string): void {
    log('info', message, context, data)
  },
  
  /**
   * Warning level logging
   */
  warn(message: string, data?: unknown, context?: string): void {
    log('warn', message, context, data)
  },
  
  /**
   * Error level logging
   */
  error(message: string, error?: unknown, context?: string): void {
    log('error', message, context, error)
  },
  
  /**
   * Get recent log entries (useful for debugging)
   */
  getRecentLogs(): readonly LogEntry[] {
    return [...logBuffer]
  },
  
  /**
   * Clear log buffer
   */
  clearLogs(): void {
    logBuffer.length = 0
  },
  
  /**
   * Create a scoped logger with a fixed context
   */
  scope(context: string) {
    return {
      debug: (message: string, data?: unknown) => log('debug', message, context, data),
      info: (message: string, data?: unknown) => log('info', message, context, data),
      warn: (message: string, data?: unknown) => log('warn', message, context, data),
      error: (message: string, error?: unknown) => log('error', message, context, error)
    }
  }
}

// Export for global access (debugging in console)
if (typeof window !== 'undefined') {
  (window as unknown as { __uiLogger: typeof uiLogger }).__uiLogger = uiLogger
}

export default uiLogger
