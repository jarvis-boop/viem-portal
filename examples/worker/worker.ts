/**
 * Worker Entry Point
 *
 * Runs in a Bun Worker and hosts the portal.
 * Handles both JSON-RPC forwarding and custom wallet methods.
 */

import { createHost } from '../../src/host'
import { createWorkerSelfTransport } from '../../src/worker'
import { createMockRpcHandler } from '../../src/provider'
import type { PortalSchemaType } from './schema'

// =============================================================================
// Wallet State (simulated)
// =============================================================================

let walletState = {
  connected: false,
  address: null as string | null,
  chainId: 1,
}

// Mock addresses for demo
const MOCK_ADDRESSES: Record<number, string> = {
  1: '0x742d35Cc6634C0532925a3b844Bc9e7595f1dE4a', // Mainnet
  10: '0x8Ba1f109551bD432803012645Ac136ddd64DBA72', // Optimism
  137: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // Polygon
}

// =============================================================================
// RPC Handler
// =============================================================================

/**
 * Mock RPC handler that simulates Ethereum node responses.
 * In production, this would forward to a real RPC endpoint.
 */
const rpcHandler = createMockRpcHandler({
  // Chain info
  eth_chainId: () => `0x${walletState.chainId.toString(16)}`,

  // Block info
  eth_blockNumber: () => `0x${Math.floor(Date.now() / 12000).toString(16)}`,

  // Account info
  eth_accounts: () => (walletState.address ? [walletState.address] : []),

  eth_requestAccounts: () => {
    if (!walletState.connected) {
      throw new Error('Wallet not connected')
    }
    return [walletState.address]
  },

  // Balance (mock: 1 ETH)
  eth_getBalance: (address: unknown, _block: unknown) => {
    console.log(`[Worker] eth_getBalance for ${address}`)
    return '0xde0b6b3a7640000' // 1 ETH
  },

  // Gas price (mock)
  eth_gasPrice: () => '0x3b9aca00', // 1 gwei

  // Call (mock: return empty)
  eth_call: () => '0x',

  // Estimate gas (mock)
  eth_estimateGas: () => '0x5208', // 21000

  // Transaction count
  eth_getTransactionCount: () => '0x0',

  // Block by number
  eth_getBlockByNumber: (_block: unknown, _full: unknown) => ({
    number: '0x10f2c5a',
    hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    timestamp: `0x${Math.floor(Date.now() / 1000).toString(16)}`,
    transactions: [],
  }),
})

// =============================================================================
// Create Host
// =============================================================================

const transport = createWorkerSelfTransport()

const host = createHost<PortalSchemaType>(transport, {
  handlers: {
    // Forward all eth_* methods to RPC handler
    eth_request: rpcHandler,

    // Custom wallet methods
    wallet_status: () => ({
      connected: walletState.connected,
      address: walletState.address,
      chainId: walletState.chainId,
    }),

    wallet_connect: ([chainId]) => {
      console.log(`[Worker] Connecting to chain ${chainId}`)
      const address = MOCK_ADDRESSES[chainId] ?? MOCK_ADDRESSES[1]
      walletState = {
        connected: true,
        address,
        chainId,
      }

      // Push connection event
      host.push('wallet:connected', { address, chainId })

      return { address, chainId }
    },

    wallet_disconnect: () => {
      console.log('[Worker] Disconnecting wallet')
      walletState = {
        connected: false,
        address: null,
        chainId: 1,
      }

      // Push disconnection event
      host.push('wallet:disconnected', {})
    },

    wallet_signMessage: ([message]) => {
      if (!walletState.connected) {
        throw new Error('Wallet not connected')
      }

      console.log(`[Worker] Signing message: ${message}`)

      // Mock signature (in production, this would use the private key)
      const signature = `0x${'ab'.repeat(32)}${'cd'.repeat(32)}1b`

      return { signature }
    },
  },
})

console.log('[Worker] Portal host ready')

// Cleanup on termination
self.addEventListener('unload', () => {
  host.close()
})
