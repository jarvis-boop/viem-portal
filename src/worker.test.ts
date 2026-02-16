/**
 * Portal Worker Transport Tests
 */

import { describe, expect, test } from 'bun:test'
import { createClient } from './client'
import { createHost } from './host'
import { createLoopbackTransports, createWorkerTransport } from './worker'

// =============================================================================
// Test Schema
// =============================================================================

type TestSchema = {
  greet: { params: [name: string]; result: string }
  add: { params: [a: number, b: number]; result: number }
}

// =============================================================================
// Tests
// =============================================================================

describe('createLoopbackTransports', () => {
  test('creates bidirectional communication', async () => {
    const [transportA, transportB] = createLoopbackTransports()

    const receivedOnB: unknown[] = []
    const receivedOnA: unknown[] = []

    transportB.subscribe((msg) => receivedOnB.push(msg))
    transportA.subscribe((msg) => receivedOnA.push(msg))

    // Send from A to B
    transportA.send({ type: 'push', topic: 'test', data: 'from A' })
    await new Promise((r) => setTimeout(r, 10))
    expect(receivedOnB).toEqual([{ type: 'push', topic: 'test', data: 'from A' }])

    // Send from B to A
    transportB.send({ type: 'push', topic: 'test', data: 'from B' })
    await new Promise((r) => setTimeout(r, 10))
    expect(receivedOnA).toEqual([{ type: 'push', topic: 'test', data: 'from B' }])

    transportA.close?.()
    transportB.close?.()
  })

  test('works with client/host pair', async () => {
    const [clientTransport, hostTransport] = createLoopbackTransports()

    const host = createHost<TestSchema>(hostTransport, {
      handlers: {
        greet: ([name]) => `Hello, ${name}!`,
        add: ([a, b]) => a + b,
      },
    })

    const client = createClient<TestSchema>(clientTransport)

    expect(await client.request('greet', 'World')).toBe('Hello, World!')
    expect(await client.request('add', 10, 20)).toBe(30)

    client.close()
    host.close()
  })

  test('handles rapid fire requests', async () => {
    const [clientTransport, hostTransport] = createLoopbackTransports()

    const host = createHost<TestSchema>(hostTransport, {
      handlers: {
        greet: ([name]) => `Hi ${name}`,
        add: ([a, b]) => a + b,
      },
    })

    const client = createClient<TestSchema>(clientTransport)

    // Fire 100 requests rapidly
    const promises = Array.from({ length: 100 }, (_, i) => client.request('add', i, i))

    const results = await Promise.all(promises)

    // Verify all results are correct
    results.forEach((result, i) => {
      expect(result).toBe(i + i)
    })

    client.close()
    host.close()
  })
})

describe('createWorkerTransport', () => {
  test('communicates with a real Bun worker', async () => {
    // Create worker inline using Bun's worker support
    const workerCode = `
      const handlers = new Set()
      
      self.addEventListener('message', (event) => {
        const msg = event.data
        if (msg.type === 'request') {
          let result
          if (msg.method === 'greet') {
            result = 'Hello, ' + msg.params[0] + '!'
          } else if (msg.method === 'add') {
            result = msg.params[0] + msg.params[1]
          }
          self.postMessage({ type: 'response', id: msg.id, result })
        }
      })
    `

    const blob = new Blob([workerCode], { type: 'application/javascript' })
    const worker = new Worker(URL.createObjectURL(blob))

    const transport = createWorkerTransport(worker)
    const client = createClient<TestSchema>(transport)

    const greeting = await client.request('greet', 'Bun')
    expect(greeting).toBe('Hello, Bun!')

    const sum = await client.request('add', 5, 7)
    expect(sum).toBe(12)

    client.close()
  })
})

describe('unsubscribe behavior', () => {
  test('unsubscribe removes handler', async () => {
    const [transportA, transportB] = createLoopbackTransports()

    const received: unknown[] = []
    const unsub = transportA.subscribe((msg) => received.push(msg))

    transportB.send({ type: 'push', topic: 'test', data: 1 })
    await new Promise((r) => setTimeout(r, 10))
    expect(received.length).toBe(1)

    unsub()

    transportB.send({ type: 'push', topic: 'test', data: 2 })
    await new Promise((r) => setTimeout(r, 10))
    expect(received.length).toBe(1) // Still 1, not 2

    transportA.close?.()
    transportB.close?.()
  })

  test('multiple unsubscribes are safe', async () => {
    const [transportA, transportB] = createLoopbackTransports()

    const unsub = transportA.subscribe(() => {})

    // Call unsubscribe multiple times - should not throw
    unsub()
    unsub()
    unsub()

    transportA.close?.()
    transportB.close?.()
  })
})
