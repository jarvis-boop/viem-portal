/**
 * Portal Host
 *
 * Handles incoming requests and dispatches to method handlers.
 */

import { InternalError, MethodNotFoundError, PortalErrorBase } from "./errors.js";
import type {
  HandlerContext,
  PortalHost,
  PortalHostOptions,
  PortalMessage,
  PortalPush,
  PortalRequest,
  PortalResponse,
  PortalSchema,
  PushSchema,
  Transport,
} from "./types.js";

/**
 * Create a portal host.
 *
 * @example
 * ```ts
 * // Basic usage
 * const host = createHost<MySchema>(transport, {
 *   handlers: {
 *     greet: ([name]) => `Hello, ${name}!`,
 *   },
 * })
 *
 * // With typed push
 * const host = createHost<MySchema, MyPushSchema>(transport, {
 *   handlers: { ... },
 * })
 * host.push('txConfirmed', { hash: '0x...' }) // typed!
 * ```
 */
export function createHost<
  TSchema extends PortalSchema,
  TPushSchema extends PushSchema = PushSchema,
>(transport: Transport, options: PortalHostOptions<TSchema>): PortalHost<TSchema, TPushSchema> {
  const { handlers, fallback } = options;

  // Handle incoming messages
  const unsubscribe = transport.subscribe(async (message: PortalMessage) => {
    if (message.type !== "request") return;

    const request = message as PortalRequest<TSchema>;
    const { id, method, params, _sender } = request;

    const context: HandlerContext = { id, sender: _sender };

    let response: PortalResponse;

    try {
      const methodStr = method as string;
      const handler = handlers[method as keyof TSchema];

      let result: unknown;

      if (handler) {
        result = await handler(params, context);
      } else if (fallback) {
        result = await fallback(methodStr, params, context);
      } else {
        throw new MethodNotFoundError(methodStr);
      }

      response = {
        type: "response",
        id,
        result,
      };
    } catch (error) {
      if (error instanceof PortalErrorBase) {
        response = {
          type: "response",
          id,
          error: error.toJSON(),
        };
      } else {
        const internalError = new InternalError(
          error instanceof Error ? error.message : "Unknown error",
        );
        response = {
          type: "response",
          id,
          error: internalError.toJSON(),
        };
      }
    }

    transport.send(response);
  });

  return {
    push<Topic extends keyof TPushSchema & string>(
      topic: Topic,
      data: TPushSchema[Topic]["data"],
    ): void {
      const message: PortalPush<TPushSchema[Topic]["data"]> = {
        type: "push",
        topic,
        data,
      };
      transport.send(message as PortalMessage);
    },

    close(): void {
      unsubscribe();
      transport.close?.();
    },
  };
}
