/**
 * Production-Ready Logger Utility
 * 
 * Provides structured logging with configurable log levels.
 * In production builds, debug/info logs are no-ops for performance.
 * Errors and warnings are always logged.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  module: string
  message: string
  data?: unknown
  timestamp: string
}

// Environment-based log level
const isDevelopment = import.meta.env?.DEV ?? process.env.NODE_ENV === 'development'
const MIN_LOG_LEVEL: LogLevel = isDevelopment ? 'debug' : 'warn'

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LOG_LEVEL]
}

function formatLogMessage(entry: LogEntry): string {
  return `[${entry.module}] ${entry.message}`
}

class Logger {
  private module: string

  constructor(module: string) {
    this.module = module
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!shouldLog(level)) return

    const entry: LogEntry = {
      level,
      module: this.module,
      message,
      data,
      timestamp: new Date().toISOString()
    }

    const formattedMessage = formatLogMessage(entry)

    switch (level) {
      case 'debug':
        // eslint-disable-next-line no-console
        console.debug(formattedMessage, data !== undefined ? data : '')
        break
      case 'info':
        // eslint-disable-next-line no-console
        console.info(formattedMessage, data !== undefined ? data : '')
        break
      case 'warn':
        // eslint-disable-next-line no-console
        console.warn(formattedMessage, data !== undefined ? data : '')
        break
      case 'error':
        // eslint-disable-next-line no-console
        console.error(formattedMessage, data !== undefined ? data : '')
        break
    }
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data)
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data)
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data)
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data)
  }
}

/**
 * Create a logger instance for a specific module.
 * 
 * Usage:
 *   const log = createLogger('ApiClient')
 *   log.debug('Request started', { endpoint })
 *   log.error('Request failed', error)
 */
export function createLogger(module: string): Logger {
  return new Logger(module)
}

// Pre-configured loggers for common modules
export const apiLogger = createLogger('ApiClient')
export const sessionLogger = createLogger('Session')
export const sseLogger = createLogger('SSE')
export const uiLogger = createLogger('UI')
