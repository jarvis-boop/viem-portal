# viem-portal

[![CI](https://github.com/jarvis-boop/viem-portal/actions/workflows/ci.yml/badge.svg)](https://github.com/jarvis-boop/viem-portal/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/viem-portal)](https://www.npmjs.com/package/viem-portal)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Typed messaging layer with Viem transport integration.

A thin, strongly-typed portal abstraction for cross-context communication. Designed for Ethereum wallet integration with first-class Viem support.

## Features

- 🔒 **Full TypeScript inference** - Params and results inferred from schema
- 🚀 **Viem-native transport** - Use Viem's full API through any portal
- 📡 **Push subscriptions** - Real-time events from host to client
- ⚡ **Minimal dependencies** - Just types at runtime (Viem optional)

## Installation

```bash
bun add viem-portal
# or
npm install viem-portal
```

## Quick Start

### 1. Define Your Schema

```typescript
import type { MergeSchemas } from 'viem-portal'
import type { EthRpcSchema } from 'viem-portal/provider'

// Custom methods
type MySchema = {
  greet: { params: [name: string]; result: string }
  add: { params: [a: number, b: number]; result: number }
}

// Extend with Ethereum RPC support
type FullSchema = MergeSchemas<EthRpcSchema, MySchema>
```

### 2. Create Host

```typescript
import { createHost, createLoopbackTransports } from 'viem-portal'
import { createMockRpcHandler } from 'viem-portal/provider'

const [clientTransport, hostTransport] = createLoopbackTransports()

const host = createHost<FullSchema>(hostTransport, {
  handlers: {
    greet: ([name]) => `Hello, ${name}!`,
    add: ([a, b]) => a + b,
    eth_request: createMockRpcHandler({
      eth_chainId: '0x1',
      eth_blockNumber: '0x10f2c5a',
    }),
  },
})
```

### 3. Create Client

```typescript
import { createClient } from 'viem-portal'

const client = createClient<FullSchema>(clientTransport)

// Fully typed requests
const greeting = await client.request('greet', 'World')
//    ^? string

const sum = await client.request('add', 1, 2)
//    ^? number

// Subscribe to push events
client.subscribe('update', (data) => {
  console.log('Received:', data)
})
```

## Viem Integration

```typescript
import { createPublicClient } from 'viem'
import { mainnet } from 'viem/chains'
import { createClient } from 'viem-portal'
import { portalTransport } from 'viem-portal/provider'

const portal = createClient<MySchema>(transport)

const viemClient = createPublicClient({
  chain: mainnet,
  transport: portalTransport(portal),
})

// All Viem methods flow through the portal
const chainId = await viemClient.getChainId()
const balance = await viemClient.getBalance({ address: '0x...' })
```

## API Reference

### Core (viem-portal)

- `createClient<Schema>(transport, options?)` - Create a portal client
- `createHost<Schema>(transport, options)` - Create a portal host
- `createLoopbackTransports()` - Create connected transport pair for testing
- `createPortTransport(port)` - Create transport from MessagePort
- `createWorkerTransport(worker)` - Main thread → Worker transport
- `createWorkerSelfTransport()` - Worker → Main thread transport

### Provider (viem-portal/provider)

- `portalTransport(client, options?)` - Create Viem-compatible transport
- `createRpcHandler(options)` - Production RPC forwarding
- `createMockRpcHandler(responses)` - Testing mocks

## License

MIT
