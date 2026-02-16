/**
 * Portal Worker Transport
 *
 * Transport implementations for Bun/Web Workers.
 */

import type { PortalMessage, Transport } from './types.js'

// =============================================================================
// Main Thread Transport (talks to worker)
// =============================================================================

/**
 * Create a transport for the main thread to communicate with a worker.
 *
 * @example
 * ```ts
 * // main.ts
 * const worker = new Worker(new URL('./worker.ts', import.meta.url))
 * const transport = createWorkerTransport(worker)
 * const client = createClient<MySchema>(transport)
 *
 * const result = await client.request('greet', 'World')
 * ```
 */
export function createWorkerTransport(worker: Worker): Transport {
  const handlers = new Set<(message: PortalMessage) => void>()

  const messageHandler = (event: MessageEvent<PortalMessage>) => {
    for (const handler of handlers) {
      handler(event.data)
    }
  }

  worker.addEventListener('message', messageHandler)

  return {
    send(message: PortalMessage): void {
      worker.postMessage(message)
    },

    subscribe(handler: (message: PortalMessage) => void): () => void {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },

    close(): void {
      worker.removeEventListener('message', messageHandler)
      handlers.clear()
      worker.terminate()
    },
  }
}

// =============================================================================
// Worker Thread Transport (talks to main)
// =============================================================================

/**
 * Global self reference in worker context.
 */
declare const self: {
  postMessage(message: unknown): void
  addEventListener(type: 'message', handler: (event: MessageEvent) => void): void
  removeEventListener(type: 'message', handler: (event: MessageEvent) => void): void
}

/**
 * Create a transport for a worker to communicate with the main thread.
 *
 * @example
 * ```ts
 * // worker.ts
 * const transport = createWorkerSelfTransport()
 * const host = createHost<MySchema>(transport, {
 *   handlers: {
 *     greet: ([name]) => `Hello, ${name}!`,
 *   },
 * })
 * ```
 */
export function createWorkerSelfTransport(): Transport {
  const handlers = new Set<(message: PortalMessage) => void>()

  const messageHandler = (event: MessageEvent<PortalMessage>) => {
    for (const handler of handlers) {
      handler(event.data)
    }
  }

  self.addEventListener('message', messageHandler)

  return {
    send(message: PortalMessage): void {
      self.postMessage(message)
    },

    subscribe(handler: (message: PortalMessage) => void): () => void {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },

    close(): void {
      self.removeEventListener('message', messageHandler)
      handlers.clear()
    },
  }
}

// =============================================================================
// Channel Transport (MessageChannel / BroadcastChannel)
// =============================================================================

/**
 * Create a transport using a MessagePort (from MessageChannel).
 *
 * Useful for iframe communication or complex worker setups.
 *
 * @example
 * ```ts
 * // Create a channel
 * const channel = new MessageChannel()
 *
 * // One side uses port1
 * const clientTransport = createPortTransport(channel.port1)
 *
 * // Other side uses port2
 * const hostTransport = createPortTransport(channel.port2)
 * ```
 */
export function createPortTransport(port: MessagePort): Transport {
  const handlers = new Set<(message: PortalMessage) => void>()

  const messageHandler = (event: Event) => {
    const data = (event as unknown as { data: PortalMessage }).data
    for (const handler of handlers) {
      handler(data)
    }
  }

  port.addEventListener('message', messageHandler)
  port.start()

  return {
    send(message: PortalMessage): void {
      port.postMessage(message)
    },

    subscribe(handler: (message: PortalMessage) => void): () => void {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },

    close(): void {
      port.removeEventListener('message', messageHandler)
      handlers.clear()
      port.close()
    },
  }
}

// =============================================================================
// Loopback Transport (for testing)
// =============================================================================

/**
 * Create a pair of transports connected to each other.
 * Useful for testing without actual worker/postMessage.
 *
 * @example
 * ```ts
 * const [clientTransport, hostTransport] = createLoopbackTransports()
 *
 * const host = createHost<MySchema>(hostTransport, { handlers })
 * const client = createClient<MySchema>(clientTransport)
 *
 * const result = await client.request('greet', 'World')
 * ```
 */
export function createLoopbackTransports(): [Transport, Transport] {
  const handlersA = new Set<(message: PortalMessage) => void>()
  const handlersB = new Set<(message: PortalMessage) => void>()

  const transportA: Transport = {
    send(message: PortalMessage): void {
      // Async to simulate real transport
      queueMicrotask(() => {
        for (const handler of handlersB) {
          handler(message)
        }
      })
    },

    subscribe(handler: (message: PortalMessage) => void): () => void {
      handlersA.add(handler)
      return () => {
        handlersA.delete(handler)
      }
    },

    close(): void {
      handlersA.clear()
    },
  }

  const transportB: Transport = {
    send(message: PortalMessage): void {
      queueMicrotask(() => {
        for (const handler of handlersA) {
          handler(message)
        }
      })
    },

    subscribe(handler: (message: PortalMessage) => void): () => void {
      handlersB.add(handler)
      return () => {
        handlersB.delete(handler)
      }
    },

    close(): void {
      handlersB.clear()
    },
  }

  return [transportA, transportB]
}

// Re-export types
export type { PortalMessage, Transport } from './types.js'
