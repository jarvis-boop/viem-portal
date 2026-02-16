/**
 * Portal Provider
 *
 * Ethereum provider integration for viem-portal.
 * Includes Viem transport and RPC handlers.
 */

import type { EIP1193RequestFn, Transport as ViemTransport } from "viem";
import { custom } from "viem";
import type { PortalClient, PortalSchema } from "./types.js";

// =============================================================================
// JSON-RPC Schema
// =============================================================================

/**
 * JSON-RPC method definition for portal schema.
 */
export type JsonRpcMethodDef = {
  params: [method: string, params?: unknown[]];
  result: unknown;
};

/**
 * Base schema for Ethereum RPC via portal.
 */
export type EthRpcSchema = {
  eth_request: JsonRpcMethodDef;
};

/**
 * Handler type for eth_request.
 */
export type EthRpcHandlers = {
  eth_request: (params: [string, unknown[]?]) => Promise<unknown>;
};

// =============================================================================
// Portal Transport
// =============================================================================

export type PortalTransportOptions = {
  key?: string;
  name?: string;
  retryCount?: number;
  retryDelay?: number;
};

/**
 * Create a Viem transport that forwards JSON-RPC calls through a portal client.
 */
export function portalTransport<TSchema extends PortalSchema & EthRpcSchema>(
  portalClient: PortalClient<TSchema>,
  options: PortalTransportOptions = {},
): ViemTransport {
  const { key = "portal", name = "Portal Transport", retryCount = 0, retryDelay = 150 } = options;

  const request: EIP1193RequestFn = async ({ method, params }) => {
    const result = await portalClient.request(
      "eth_request" as keyof TSchema & string,
      method,
      params ?? [],
    );
    return result as never;
  };

  return custom({ request }, { key, name, retryCount, retryDelay });
}

// =============================================================================
// RPC Handlers (spreadable into createHost handlers)
// =============================================================================

export type RpcHandlerOptions = {
  rpcUrl: string;
  fetchOptions?: RequestInit;
};

/**
 * Create RPC handlers that can be spread into createHost.
 *
 * @example
 * ```ts
 * const host = createHost<MySchema>(transport, {
 *   handlers: {
 *     ...createRpcHandler({ rpcUrl: 'https://eth.llamarpc.com' }),
 *     // custom handlers...
 *   },
 * })
 * ```
 */
export function createRpcHandler(options: RpcHandlerOptions): EthRpcHandlers {
  const { rpcUrl, fetchOptions = {} } = options;
  let id = 0;

  return {
    eth_request: async ([method, params]: [string, unknown[]?]): Promise<unknown> => {
      const requestId = ++id;

      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...fetchOptions.headers,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: requestId,
          method,
          params: params ?? [],
        }),
        ...fetchOptions,
      });

      if (!response.ok) {
        throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
      }

      const json = (await response.json()) as {
        id: number;
        result?: unknown;
        error?: { code: number; message: string; data?: unknown };
      };

      if (json.error) {
        const error = new Error(json.error.message) as Error & { code: number; data?: unknown };
        error.code = json.error.code;
        error.data = json.error.data;
        throw error;
      }

      return json.result;
    },
  };
}

export type MockRpcResponses = Record<string, unknown | ((...params: unknown[]) => unknown)>;

/**
 * Create mock RPC handlers for testing.
 *
 * @example
 * ```ts
 * const host = createHost<MySchema>(transport, {
 *   handlers: {
 *     ...createMockRpcHandler({
 *       eth_chainId: '0x1',
 *       eth_getBalance: (address) => '0x1000',
 *     }),
 *   },
 * })
 * ```
 */
export function createMockRpcHandler(responses: MockRpcResponses): EthRpcHandlers {
  return {
    eth_request: async ([method, params]: [string, unknown[]?]): Promise<unknown> => {
      const handler = responses[method];

      if (handler === undefined) {
        throw new Error(`Mock: Method not supported: ${method}`);
      }

      if (typeof handler === "function") {
        return handler(...(params ?? []));
      }

      return handler;
    },
  };
}

// Re-export types
export type { PortalClient, PortalSchema } from "./types.js";
