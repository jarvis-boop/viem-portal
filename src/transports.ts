/**
 * Portal Transports
 *
 * Loopback transport for testing.
 */

import type { PortalMessage, Transport } from "./types.js";

/**
 * Create a pair of transports connected to each other.
 * Useful for testing without actual postMessage.
 *
 * @example
 * ```ts
 * const [clientTransport, hostTransport] = createLoopbackTransports()
 *
 * const host = createHost<MySchema>(hostTransport, { handlers })
 * const client = createClient<MySchema>(clientTransport)
 * ```
 */
export function createLoopbackTransports(): [Transport, Transport] {
  const handlersA = new Set<(message: PortalMessage) => void>();
  const handlersB = new Set<(message: PortalMessage) => void>();

  const transportA: Transport = {
    send(message: PortalMessage): void {
      queueMicrotask(() => {
        for (const handler of handlersB) {
          handler(message);
        }
      });
    },

    subscribe(handler: (message: PortalMessage) => void): () => void {
      handlersA.add(handler);
      return () => {
        handlersA.delete(handler);
      };
    },

    close(): void {
      handlersA.clear();
    },
  };

  const transportB: Transport = {
    send(message: PortalMessage): void {
      queueMicrotask(() => {
        for (const handler of handlersA) {
          handler(message);
        }
      });
    },

    subscribe(handler: (message: PortalMessage) => void): () => void {
      handlersB.add(handler);
      return () => {
        handlersB.delete(handler);
      };
    },

    close(): void {
      handlersB.clear();
    },
  };

  return [transportA, transportB];
}
