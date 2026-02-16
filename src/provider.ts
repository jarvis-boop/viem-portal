/**
 * Portal Viem Transport
 *
 * Implements a Viem-compatible custom transport that forwards
 * JSON-RPC calls through a portal client.
 */

import type { EIP1193RequestFn, Transport as ViemTransport } from 'viem'
import { custom } from 'viem'
import type { PortalClient, PortalSchema } from './types.js'

// =============================================================================
// JSON-RPC Schema
// =============================================================================

/**
 * JSON-RPC method definition for portal schema.
 * All Ethereum RPC methods use this signature.
 */
export type JsonRpcMethodDef = {
  params: [method: string, params?: unknown[]]
  result: unknown
}

/**
 * Base schema for Ethereum RPC via portal.
 * The `eth_request` method forwards all JSON-RPC calls.
 */
export type EthRpcSchema = {
  eth_request: JsonRpcMethodDef
}

/**
 * Check if a schema includes eth_request method.
 */
export type HasEthRequest<T extends PortalSchema> = T extends { eth_request: JsonRpcMethodDef }
  ? true
  : false

// =============================================================================
// Portal Transport
// =============================================================================

/**
 * Options for creating a portal transport.
 */
export type PortalTransportOptions = {
  /**
   * Custom key for the transport.
   * @default 'portal'
   */
  key?: string

  /**
   * Custom name for the transport.
   * @default 'Portal Transport'
   */
  name?: string

  /**
   * Number of retries on failure.
   * @default 0 (portal handles its own retry logic)
   */
  retryCount?: number

  /**
   * Delay between retries in ms.
   * @default 150
   */
  retryDelay?: number
}

/**
 * Create a Viem transport that forwards JSON-RPC calls through a portal client.
 *
 * The portal schema must include an `eth_request` method that accepts
 * `[method: string, params?: unknown[]]` and returns the RPC result.
 *
 * @example
 * ```ts
 * import { createPublicClient } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { createClient } from 'portal'
 * import { portalTransport } from 'portal/viem'
 *
 * // Create portal client with eth_request handler on the host
 * const portal = createClient<MySchema>(transport)
 *
 * // Create Viem client using portal transport
 * const client = createPublicClient({
 *   chain: mainnet,
 *   transport: portalTransport(portal),
 * })
 *
 * // All Viem methods now flow through the portal
 * const blockNumber = await client.getBlockNumber()
 * ```
 */
export function portalTransport<TSchema extends PortalSchema & EthRpcSchema>(
  portalClient: PortalClient<TSchema>,
  options: PortalTransportOptions = {},
): ViemTransport {
  const { key = 'portal', name = 'Portal Transport', retryCount = 0, retryDelay = 150 } = options

  // Create EIP-1193 request function
  const request: EIP1193RequestFn = async ({ method, params }) => {
    // Forward to portal's eth_request handler
    const result = await portalClient.request(
      'eth_request' as keyof TSchema & string,
      method,
      params ?? [],
    )
    // Cast is safe - Viem handles result types internally
    return result as never
  }

  // Use Viem's custom transport factory
  return custom(
    { request },
    {
      key,
      name,
      retryCount,
      retryDelay,
    },
  )
}

// =============================================================================
// Helper: Create RPC Handler
// =============================================================================

/**
 * Options for creating an RPC handler.
 */
export type RpcHandlerOptions = {
  /**
   * JSON-RPC endpoint URL.
   */
  rpcUrl: string

  /**
   * Optional fetch options.
   */
  fetchOptions?: RequestInit
}

/**
 * Create an eth_request handler that forwards to a JSON-RPC endpoint.
 *
 * Use this on the host side to forward RPC calls to an actual Ethereum node.
 *
 * @example
 * ```ts
 * const host = createHost<MySchema>(transport, {
 *   handlers: {
 *     eth_request: createRpcHandler({
 *       rpcUrl: 'https://eth.llamarpc.com',
 *     }),
 *     // ... other handlers
 *   },
 * })
 * ```
 */
export function createRpcHandler(options: RpcHandlerOptions) {
  const { rpcUrl, fetchOptions = {} } = options
  let id = 0

  return async ([method, params]: [string, unknown[]?]): Promise<unknown> => {
    const requestId = ++id

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        method,
        params: params ?? [],
      }),
      ...fetchOptions,
    })

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status} ${response.statusText}`)
    }

    const json = (await response.json()) as {
      id: number
      result?: unknown
      error?: { code: number; message: string; data?: unknown }
    }

    if (json.error) {
      const error = new Error(json.error.message) as Error & {
        code: number
        data?: unknown
      }
      error.code = json.error.code
      error.data = json.error.data
      throw error
    }

    return json.result
  }
}

// =============================================================================
// Helper: Mock RPC Handler
// =============================================================================

/**
 * Mock RPC responses for testing.
 */
export type MockRpcResponses = Record<string, unknown | ((...params: unknown[]) => unknown)>

/**
 * Create a mock eth_request handler for testing.
 *
 * @example
 * ```ts
 * const host = createHost<MySchema>(transport, {
 *   handlers: {
 *     eth_request: createMockRpcHandler({
 *       eth_chainId: '0x1',
 *       eth_blockNumber: '0x123',
 *       eth_getBalance: (address, block) => '0x1000',
 *     }),
 *   },
 * })
 * ```
 */
export function createMockRpcHandler(responses: MockRpcResponses) {
  return async ([method, params]: [string, unknown[]?]): Promise<unknown> => {
    const handler = responses[method]

    if (handler === undefined) {
      throw new Error(`Mock: Method not supported: ${method}`)
    }

    if (typeof handler === 'function') {
      return handler(...(params ?? []))
    }

    return handler
  }
}

// Re-export types
export type { PortalClient, PortalSchema } from './types.js'
