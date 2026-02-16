/**
 * viem-portal - Typed messaging layer with Viem transport integration
 *
 * @example
 * ```ts
 * import { createClient, createHost, createLoopbackTransports } from 'viem-portal'
 * import { portalTransport } from 'viem-portal/provider'
 *
 * // Define your schema
 * type MySchema = {
 *   greet: { params: [name: string]; result: string }
 *   add: { params: [a: number, b: number]; result: number }
 * }
 *
 * // Create transports
 * const [clientTransport, hostTransport] = createLoopbackTransports()
 *
 * // Create host with handlers
 * const host = createHost<MySchema>(hostTransport, {
 *   handlers: {
 *     greet: ([name]) => `Hello, ${name}!`,
 *     add: ([a, b]) => a + b,
 *   },
 * })
 *
 * // Create client
 * const client = createClient<MySchema>(clientTransport)
 *
 * // Make typed requests
 * const greeting = await client.request('greet', 'World')
 * //    ^? string
 * ```
 */

// Core
export { createClient } from "./client.js";
export { createHost } from "./host.js";

// Errors
export {
  InternalError,
  InvalidParamsError,
  MethodNotFoundError,
  PortalErrorBase,
  TimeoutError,
  TransportError,
  UserRejectedError,
} from "./errors.js";

// Types
export {
  ErrorCodes,
  type ErrorCode,
  type HandlerContext,
  type MergeSchemas,
  type MethodDef,
  type MethodHandler,
  type MethodHandlers,
  type MethodNames,
  type ParamsOf,
  type PortalClient,
  type PortalClientOptions,
  type PortalError,
  type PortalHost,
  type PortalHostOptions,
  type PortalMessage,
  type PortalPush,
  type PortalRequest,
  type PortalResponse,
  type PortalSchema,
  type ResultOf,
  type Transport,
} from "./types.js";

// Transports
export {
  createLoopbackTransports,
  createPortTransport,
  createWorkerSelfTransport,
  createWorkerTransport,
} from "./transports.js";
