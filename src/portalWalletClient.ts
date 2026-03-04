/**
 * Portal Transport for viem
 *
 * Custom transport that routes requests through the portal messaging system.
 * This enables hardware wallet signing through the extension popup context.
 */

import type { Transport, PortalMessage } from "./types.js";

/**
 * EIP-1193 Request function signature
 */
export type PortalRequestFn = (args: { method: string; params?: unknown[] }) => Promise<unknown>;

/**
 * Create a viem-compatible transport from a portal transport.
 *
 * This transport converts viem's EIP-1193 requests into portal messages
 * and routes them to the popup context where hardware wallet signing happens.
 */
export function createPortalTransport(params: {
  /** The key of the transport. */
  key?: string;
  /** The name of the transport. */
  name?: string;
  /** The portal transport for messaging */
  portalTransport: Transport;
  /** Methods to include or exclude from executing RPC requests. */
  methods?: Record<string, boolean>;
  /** The max number of times to retry. */
  retryCount?: number;
  /** The base delay (in ms) between retries. */
  retryDelay?: number;
}): Transport & { request: PortalRequestFn } {
  const {
    key = "portal",
    name = "Portal Transport",
    portalTransport,
    methods,
    retryCount = 3,
    retryDelay = 150,
  } = params;

  // Map of request handlers
  const pendingRequests = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  let requestId = 0;

  // Subscribe to incoming portal messages
  const unsubscribe = portalTransport.subscribe((message: PortalMessage) => {
    if (message.type === "response") {
      const handler = pendingRequests.get(message.id);
      if (!handler) return;

      pendingRequests.delete(message.id);

      if ("error" in message && message.error) {
        handler.reject(new Error(message.error.message));
      } else {
        handler.resolve((message as { result: unknown }).result);
      }
    }
  });

  // EIP-1193 request function
  const request: PortalRequestFn = async ({ method, params: requestParams }) => {
    // Check if method is allowed
    if (methods) {
      if (method in methods && !methods[method]) {
        throw new Error(`Method ${method} is not supported`);
      }
    }

    // Only handle signing methods - forward others to JSON-RPC
    const signingMethods = [
      "eth_signTransaction",
      "eth_sign",
      "personal_sign",
      "eth_signTypedData_v4",
    ];

    if (!signingMethods.includes(method)) {
      throw new Error(`Method ${method} requires a JSON-RPC transport. Use fallback transport.`);
    }

    // Send request through portal
    return new Promise((resolve, reject) => {
      const id = ++requestId;

      pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      const portalMessage = {
        type: "request",
        id,
        method,
        params: requestParams || [],
      };

      portalTransport.send(portalMessage as unknown as PortalMessage);

      // Simple timeout
      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error("Request timeout"));
        }
      }, 30000);
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transport: any = {
    key,
    name,
    type: "portal",
    request,
    async: true,
    subscribe(_callback: (message: unknown) => void): () => void {
      return () => {};
    },
    connect(): Promise<{ accounts: string[]; chainId: number }> {
      return Promise.resolve({ accounts: [], chainId: 1 });
    },
    disconnect(): Promise<void> {
      return Promise.resolve();
    },
    getAddresses(): Promise<string[]> {
      return Promise.resolve([]);
    },
    getChainId(): Promise<number> {
      return Promise.resolve(1);
    },
    getPermissions(): Promise<unknown[]> {
      return Promise.resolve([]);
    },
    onAccountsChanged(_accounts: string[]): void {},
    onChainChanged(_chainId: number | string): void {},
    onDisconnect(): void {},
    onMessage(_message: unknown): void {},
    retryCount,
    retryDelay,
    close() {
      unsubscribe();
      portalTransport.close?.();
    },
  };

  return transport;
}

// Re-export types
export type { Transport, PortalMessage } from "./types.js";
