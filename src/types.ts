/**
 * Portal Types
 *
 * Core type definitions for the portal messaging layer.
 * Designed for strong TypeScript inference with minimal any usage.
 */

// =============================================================================
// Schema Types
// =============================================================================

/**
 * Method definition in a portal schema.
 * Each method has typed params and result.
 */
export type MethodDef = {
  params: unknown[];
  result: unknown;
};

/**
 * Portal schema - maps method names to their definitions.
 * User-extensible via declaration merging or intersection types.
 *
 * @example
 * ```ts
 * type MySchema = {
 *   greet: { params: [name: string]; result: string }
 *   add: { params: [a: number, b: number]; result: number }
 * }
 * ```
 */
export type PortalSchema = Record<string, MethodDef>;

// =============================================================================
// Message Types
// =============================================================================

/**
 * Request message sent from client to host.
 */
export type PortalRequest<
  TSchema extends PortalSchema = PortalSchema,
  TMethod extends keyof TSchema = keyof TSchema,
> = {
  type: "request";
  id: number;
  method: TMethod;
  params: TSchema[TMethod]["params"];
  /**
   * Sender context from Chrome extension (injected by transport).
   * Contains tab info, URL, frame ID, etc.
   * Only present when message comes from chrome.runtime.onMessage.
   */
  _sender?: ChromeMessageSender;
};

/**
 * Chrome extension message sender context.
 */
export type ChromeMessageSender = {
  tab?: {
    id?: number;
    windowId?: number;
    url?: string;
    title?: string;
    favIconUrl?: string;
  };
  frameId?: number;
  url?: string;
  documentId?: string;
  documentUrl?: string;
  origin?: string;
};

/**
 * Response message sent from host to client.
 */
export type PortalResponse<TResult = unknown> = {
  type: "response";
  id: number;
} & ({ result: TResult; error?: never } | { result?: never; error: PortalError });

/**
 * Push message sent from host to client (no correlation).
 */
export type PortalPush<TData = unknown> = {
  type: "push";
  topic: string;
  data: TData;
};

/**
 * Union of all portal message types.
 */
export type PortalMessage<TSchema extends PortalSchema = PortalSchema> =
  | PortalRequest<TSchema>
  | PortalResponse
  | PortalPush;

// =============================================================================
// Error Types
// =============================================================================

/**
 * Standard portal error with code and optional data.
 */
export type PortalError = {
  code: number;
  message: string;
  data?: unknown;
};

/**
 * Standard error codes (aligned with JSON-RPC).
 */
export const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Custom range: -32000 to -32099
  USER_REJECTED: -32000,
  TIMEOUT: -32001,
  TRANSPORT_ERROR: -32002,
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// =============================================================================
// Transport Types
// =============================================================================

/**
 * Transport interface - abstraction over the underlying message channel.
 * Implementations: Worker, iframe postMessage, chrome.runtime, etc.
 */
export type Transport = {
  /**
   * Send a message through the transport.
   */
  send(message: PortalMessage): void;

  /**
   * Subscribe to incoming messages.
   * Returns unsubscribe function.
   */
  subscribe(handler: (message: PortalMessage) => void): () => void;

  /**
   * Optional: close/cleanup the transport.
   */
  close?(): void;
};

// =============================================================================
// Client Types
// =============================================================================

/**
 * Portal client - makes requests to a host.
 */
export type PortalClient<TSchema extends PortalSchema> = {
  /**
   * Send a request and wait for response.
   * Infers return type from schema.
   */
  request<TMethod extends keyof TSchema & string>(
    method: TMethod,
    ...params: TSchema[TMethod]["params"]
  ): Promise<TSchema[TMethod]["result"]>;

  /**
   * Subscribe to push messages on a topic.
   */
  subscribe<TData = unknown>(topic: string, handler: (data: TData) => void): () => void;

  /**
   * Close the client and cleanup.
   */
  close(): void;
};

/**
 * Client options.
 */
export type PortalClientOptions = {
  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;
};

// =============================================================================
// Host Types
// =============================================================================

/**
 * Handler context passed to method handlers.
 */
export type HandlerContext = {
  /**
   * Request ID for correlation.
   */
  id: number;
  /**
   * Sender context from Chrome extension (if provided by transport).
   * Contains tab info, URL, frame ID, etc.
   */
  sender?: ChromeMessageSender;
};

/**
 * Method handler function.
 * Receives strongly-typed params, returns result.
 */
export type MethodHandler<TParams extends unknown[] = unknown[], TResult = unknown> = (
  params: TParams,
  context: HandlerContext,
) => TResult | Promise<TResult>;

/**
 * Map of method handlers (typed from schema).
 */
export type MethodHandlers<TSchema extends PortalSchema> = {
  [K in keyof TSchema]: MethodHandler<TSchema[K]["params"], TSchema[K]["result"]>;
};

/**
 * Portal host - handles requests from clients.
 */
export type PortalHost<_TSchema extends PortalSchema> = {
  /**
   * Push a message to all connected clients.
   */
  push<TData = unknown>(topic: string, data: TData): void;

  /**
   * Close the host and cleanup.
   */
  close(): void;
};

/**
 * Host options.
 */
export type PortalHostOptions<TSchema extends PortalSchema> = {
  /**
   * Method handlers for the schema.
   */
  handlers: MethodHandlers<TSchema>;

  /**
   * Optional: handler for unknown methods.
   * If not provided, unknown methods return METHOD_NOT_FOUND error.
   */
  fallback?: (
    method: string,
    params: unknown[],
    context: HandlerContext,
  ) => unknown | Promise<unknown>;
};

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Extract method names from a schema.
 */
export type MethodNames<TSchema extends PortalSchema> = keyof TSchema & string;

/**
 * Extract params type for a method.
 */
export type ParamsOf<
  TSchema extends PortalSchema,
  TMethod extends keyof TSchema,
> = TSchema[TMethod]["params"];

/**
 * Extract result type for a method.
 */
export type ResultOf<
  TSchema extends PortalSchema,
  TMethod extends keyof TSchema,
> = TSchema[TMethod]["result"];

/**
 * Merge two schemas (for extending base with custom methods).
 */
export type MergeSchemas<TBase extends PortalSchema, TExtension extends PortalSchema> = TBase &
  TExtension;
