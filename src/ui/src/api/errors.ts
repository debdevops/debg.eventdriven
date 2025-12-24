/**
 * Custom API error classes for granular error handling
 */

export class ApiError extends Error {
  public errorCode?: string
  public raw?: unknown

  constructor(
    message: string,
    public status: number,
    public endpoint: string,
    public timestamp: Date = new Date(),
    errorCode?: string,
    raw?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
    this.errorCode = errorCode
    this.raw = raw
  }

  get statusCode(): number {
    return this.status
  }
}

export class AuthError extends ApiError {
  constructor(
    message: string,
    endpoint: string,
    public reason: 'token_expired' | 'permission_denied' | 'unauthorized' = 'unauthorized',
    statusCode: number = 401
  ) {
    super(message, statusCode, endpoint)
    this.name = 'AuthError'
  }

  getUserFriendlyMessage(): string {
    switch (this.reason) {
      case 'token_expired':
        return 'Your session has expired. Please sign in again.'
      case 'permission_denied':
        return 'Access denied. Please check your KeyVault credentials.'
      case 'unauthorized':
      default:
        return 'Authentication required. Please reconnect to continue.'
    }
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public originalError: Error
  ) {
    super(message)
    this.name = 'NetworkError'
  }
}

