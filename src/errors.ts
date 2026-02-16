/**
 * Portal Errors
 *
 * Error classes for portal operations.
 */

import { ErrorCodes, type ErrorCode, type PortalError } from './types.js'

/**
 * Base portal error class.
 */
export class PortalErrorBase extends Error {
  readonly code: ErrorCode
  readonly data?: unknown

  constructor(code: ErrorCode, message: string, data?: unknown) {
    super(message)
    this.name = 'PortalError'
    this.code = code
    this.data = data
  }

  /**
   * Convert to wire format.
   */
  toJSON(): PortalError {
    return {
      code: this.code,
      message: this.message,
      ...(this.data !== undefined && { data: this.data }),
    }
  }

  /**
   * Create from wire format.
   */
  static fromJSON(error: PortalError): PortalErrorBase {
    return new PortalErrorBase(error.code as ErrorCode, error.message, error.data)
  }
}

/**
 * Method not found error.
 */
export class MethodNotFoundError extends PortalErrorBase {
  constructor(method: string) {
    super(ErrorCodes.METHOD_NOT_FOUND, `Method not found: ${method}`)
    this.name = 'MethodNotFoundError'
  }
}

/**
 * Invalid params error.
 */
export class InvalidParamsError extends PortalErrorBase {
  constructor(message: string, data?: unknown) {
    super(ErrorCodes.INVALID_PARAMS, message, data)
    this.name = 'InvalidParamsError'
  }
}

/**
 * Request timeout error.
 */
export class TimeoutError extends PortalErrorBase {
  constructor(timeoutMs: number) {
    super(ErrorCodes.TIMEOUT, `Request timed out after ${timeoutMs}ms`)
    this.name = 'TimeoutError'
  }
}

/**
 * User rejected error.
 */
export class UserRejectedError extends PortalErrorBase {
  constructor(message = 'User rejected the request') {
    super(ErrorCodes.USER_REJECTED, message)
    this.name = 'UserRejectedError'
  }
}

/**
 * Internal error.
 */
export class InternalError extends PortalErrorBase {
  constructor(message: string, data?: unknown) {
    super(ErrorCodes.INTERNAL_ERROR, message, data)
    this.name = 'InternalError'
  }
}

/**
 * Transport error.
 */
export class TransportError extends PortalErrorBase {
  constructor(message: string, data?: unknown) {
    super(ErrorCodes.TRANSPORT_ERROR, message, data)
    this.name = 'TransportError'
  }
}
