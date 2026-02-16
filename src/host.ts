/**
 * Portal Host
 *
 * Handles incoming requests and dispatches to method handlers.
 */

import { InternalError, MethodNotFoundError, PortalErrorBase } from './errors.js'
import type {
  HandlerContext,
  PortalHost,
  PortalHostOptions,
  PortalMessage,
  PortalPush,
  PortalRequest,
  PortalResponse,
  PortalSchema,
  Transport,
} from './types.js'

/**
 * Create a portal host.
 *
 * @example
 * ```ts
 * const host = createHost<MySchema>(transport, {
 *   handlers: {
 *     greet: ([name]) => `Hello, ${name}!`,
 *     add: ([a, b]) => a + b,
 *   },
 * })
 * ```
 */
export function createHost<TSchema extends PortalSchema>(
  transport: Transport,
  options: PortalHostOptions<TSchema>,
): PortalHost<TSchema> {
  const { handlers, fallback } = options

  // Handle incoming messages
  const unsubscribe = transport.subscribe(async (message: PortalMessage) => {
    if (message.type !== 'request') return

    const request = message as PortalRequest<TSchema>
    const { id, method, params } = request

    const context: HandlerContext = { id }

    let response: PortalResponse

    try {
      const methodStr = method as string
      const handler = handlers[method as keyof TSchema]

      let result: unknown

      if (handler) {
        result = await handler(params, context)
      } else if (fallback) {
        result = await fallback(methodStr, params, context)
      } else {
        throw new MethodNotFoundError(methodStr)
      }

      response = {
        type: 'response',
        id,
        result,
      }
    } catch (error) {
      if (error instanceof PortalErrorBase) {
        response = {
          type: 'response',
          id,
          error: error.toJSON(),
        }
      } else {
        const internalError = new InternalError(
          error instanceof Error ? error.message : 'Unknown error',
        )
        response = {
          type: 'response',
          id,
          error: internalError.toJSON(),
        }
      }
    }

    transport.send(response)
  })

  return {
    push<TData = unknown>(topic: string, data: TData): void {
      const message: PortalPush<TData> = {
        type: 'push',
        topic,
        data,
      }
      transport.send(message as PortalMessage)
    },

    close(): void {
      unsubscribe()
      transport.close?.()
    },
  }
}
