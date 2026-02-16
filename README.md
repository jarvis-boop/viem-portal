# viem-portal

[![CI](https://github.com/jarvis-boop/viem-portal/actions/workflows/ci.yml/badge.svg)](https://github.com/jarvis-boop/viem-portal/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/viem-portal)](https://www.npmjs.com/package/viem-portal)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Typed messaging layer with Viem transport integration.

## Installation

```bash
bun add viem-portal
```

## Quick Start

### Define Schema

```typescript
import type { MergeSchemas } from 'viem-portal'
import type { EthRpcSchema } from 'viem-portal/provider'

type MySchema = {
  greet: { params: [name: string]; result: string }
}

type FullSchema = MergeSchemas<EthRpcSchema, MySchema>
```

### Create Host

```typescript
import { createHost } from 'viem-portal'
import { createMockRpcHandler } from 'viem-portal/provider'

const host = createHost<FullSchema>(transport, {
  handlers: {
    ...createMockRpcHandler({
      eth_chainId: '0x1',
      eth_blockNumber: '0x10f2c5a',
    }),
    greet: ([name]) => `Hello, ${name}!`,
  },
})
```

### Create Client

```typescript
import { createClient } from 'viem-portal'

const client = createClient<FullSchema>(transport)

const greeting = await client.request('greet', 'World')
//    ^? string
```

### Viem Integration

```typescript
import { createPublicClient } from 'viem'
import { mainnet } from 'viem/chains'
import { portalTransport } from 'viem-portal/provider'

const viemClient = createPublicClient({
  chain: mainnet,
  transport: portalTransport(client),
})

const chainId = await viemClient.getChainId()
```

## API

### Core (viem-portal)

- `createClient<Schema>(transport, options?)` - Create portal client
- `createHost<Schema>(transport, options)` - Create portal host
- `createLoopbackTransports()` - Create connected transport pair for testing

### Provider (viem-portal/provider)

- `portalTransport(client)` - Create Viem-compatible transport
- `createRpcHandler({ rpcUrl })` - Spreadable RPC handler for production
- `createMockRpcHandler(responses)` - Spreadable mock handler for testing

## License

MIT
