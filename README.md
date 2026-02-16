# Portal

Typed messaging layer with Viem transport integration.

A thin, strongly-typed portal abstraction for cross-context communication (Workers, iframes, browser extensions). Designed for Ethereum wallet integration with first-class Viem support.

## Features

- 🔒 **Full TypeScript inference** - Params and results inferred from schema
- 🚀 **Viem-native transport** - Use Viem's full API through any portal
- 📡 **Push subscriptions** - Real-time events from host to client
- 🔌 **Transport agnostic** - Workers, MessageChannel, postMessage, etc.
- ⚡ **Minimal dependencies** - Just types at runtime (Viem optional)

## Installation

```bash
bun add portal
# or
npm install portal
```

## Quick Start

### 1. Define Your Schema

```typescript
import type { PortalSchema, MergeSchemas } from 'portal'
import type { EthRpcSchema } from 'portal/viem'

// Custom methods
type MySchema = {
  greet: { params: [name: string]; result: string }
  add: { params: [a: number, b: number]; result: number }
}

// Optionally extend with Ethereum RPC support
type FullSchema = MergeSchemas<EthRpcSchema, MySchema>
```

### 2. Create Host (Worker/Background)

```typescript
import { createHost } from 'portal'
import { createWorkerSelfTransport } from 'portal/worker'
import { createMockRpcHandler } from 'portal/viem'
import type { FullSchema } from './schema'

const transport = createWorkerSelfTransport()

const host = createHost<FullSchema>(transport, {
  handlers: {
    // Custom methods - params are typed!
    greet: ([name]) => `Hello, ${name}!`,
    add: ([a, b]) => a + b,

    // Ethereum RPC forwarding
    eth_request: createMockRpcHandler({
      eth_chainId: '0x1',
      eth_blockNumber: '0x10f2c5a',
    }),
  },
})

// Push events to clients
host.push('update', { count: 42 })
```

### 3. Create Client (Main Thread)

```typescript
import { createClient } from 'portal'
import { createWorkerTransport } from 'portal/worker'
import type { FullSchema } from './schema'

const worker = new Worker('./worker.ts')
const transport = createWorkerTransport(worker)

const client = createClient<FullSchema>(transport)

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

Portal provides a Viem-compatible custom transport that forwards all JSON-RPC calls through the portal.

### Client Side

```typescript
import { createPublicClient } from 'viem'
import { mainnet } from 'viem/chains'
import { createClient } from 'portal'
import { portalTransport } from 'portal/viem'

// Create portal client
const portal = createClient<MySchema>(transport)

// Create Viem client using portal
const viemClient = createPublicClient({
  chain: mainnet,
  transport: portalTransport(portal),
})

// All Viem methods now flow through the portal
const chainId = await viemClient.getChainId()
const blockNumber = await viemClient.getBlockNumber()
const balance = await viemClient.getBalance({ address: '0x...' })
```

### Host Side

```typescript
import { createHost } from 'portal'
import { createRpcHandler, createMockRpcHandler } from 'portal/viem'

// Production: Forward to real RPC
const host = createHost<MySchema>(transport, {
  handlers: {
    eth_request: createRpcHandler({
      rpcUrl: 'https://eth.llamarpc.com',
    }),
  },
})

// Testing: Use mock responses
const testHost = createHost<MySchema>(transport, {
  handlers: {
    eth_request: createMockRpcHandler({
      eth_chainId: '0x1',
      eth_getBalance: (address, block) => '0xde0b6b3a7640000',
    }),
  },
})
```

## Worker Example

See `examples/worker/` for a complete working example:

```bash
bun run examples/worker/main.ts
```

This demonstrates:
- Custom portal methods (`wallet_connect`, `wallet_signMessage`, etc.)
- Viem integration through the portal
- Push subscriptions for real-time events
- Chain switching

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Main Thread                          │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Portal      │    │ Viem        │    │ Your App    │     │
│  │ Client      │◄───┤ Transport   │◄───┤             │     │
│  └──────┬──────┘    └─────────────┘    └─────────────┘     │
│         │                                                   │
│         │ Transport (Worker postMessage)                    │
│         ▼                                                   │
├─────────────────────────────────────────────────────────────┤
│                         Worker                              │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Portal      │    │ RPC Handler │    │ Wallet      │     │
│  │ Host        │───►│             │───►│ State       │     │
│  └──────┬──────┘    └─────────────┘    └─────────────┘     │
│         │                                                   │
│         │ Push events                                       │
│         ▼                                                   │
│  ┌─────────────┐                                           │
│  │ Subscribers │                                           │
│  └─────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

## Migration from Provider v0.2

Portal follows Provider v0.2 design patterns but generalizes beyond EIP-1193:

| Provider v0.2 | Portal |
|---------------|--------|
| `provider.request({ method, params })` | `client.request(method, ...params)` |
| `handleProviderRequest()` | `createHost()` with handlers |
| `providerRequestTransport` | `Transport` interface |
| EIP-1193 only | Any typed schema |

### Key Differences

1. **Schema-first design** - Define your methods upfront, get full inference
2. **Bidirectional** - Push events from host to client
3. **Transport agnostic** - Same API works with Workers, iframes, chrome.runtime
4. **Viem-native** - Built-in transport adapter, not an afterthought

### Browser Extension Integration

```typescript
// content.ts (injected page)
import { createClient } from 'portal'
import { createPortTransport } from 'portal/worker'

const port = chrome.runtime.connect({ name: 'portal' })
const transport = createPortTransport(port)
const client = createClient<MySchema>(transport)

// background.ts
chrome.runtime.onConnect.addListener((port) => {
  const transport = createPortTransport(port)
  const host = createHost<MySchema>(transport, { handlers })
})
```

### Hardware Wallet Integration

Portal works seamlessly with hardware wallet SDKs like `viem-hw`:

```typescript
import { createLedgerAccount } from 'viem-hw/ledger'

const host = createHost<MySchema>(transport, {
  handlers: {
    wallet_signTransaction: async ([tx]) => {
      const account = await createLedgerAccount({ addressIndex: 0 })
      return account.signTransaction(tx)
    },
  },
})
```

## API Reference

### Core

- `createClient<Schema>(transport, options?)` - Create a portal client
- `createHost<Schema>(transport, options)` - Create a portal host

### Transports (portal/worker)

- `createWorkerTransport(worker)` - Main thread → Worker
- `createWorkerSelfTransport()` - Worker → Main thread
- `createPortTransport(port)` - MessagePort/chrome.runtime
- `createLoopbackTransports()` - Testing pair

### Viem (portal/viem)

- `portalTransport(client, options?)` - Create Viem transport
- `createRpcHandler(options)` - Production RPC forwarding
- `createMockRpcHandler(responses)` - Testing mocks

## License

MIT
