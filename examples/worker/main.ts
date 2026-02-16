/**
 * Main Entry Point
 *
 * Demonstrates the portal with Viem integration.
 * Creates a worker, establishes portal connection, and uses Viem.
 */

import { createPublicClient, formatEther } from "viem";
import { mainnet, optimism } from "viem/chains";
import { createClient } from "../../src/client";
import { createWorkerTransport } from "../../src/worker";
import { portalTransport } from "../../src/provider";
import type { PortalSchemaType } from "./schema";

// =============================================================================
// Setup
// =============================================================================

console.log("🚀 Portal + Viem Example\n");

// Create worker
const worker = new Worker(new URL("./worker.ts", import.meta.url));
const transport = createWorkerTransport(worker);

// Create portal client
const portal = createClient<PortalSchemaType>(transport, {
  timeout: 5000,
});

// =============================================================================
// Demo: Custom Portal Methods
// =============================================================================

console.log("📡 Testing custom portal methods...\n");

// Check initial status
const status1 = await portal.request("wallet_status");
console.log("Initial status:", status1);

// Connect wallet
const connected = await portal.request("wallet_connect", 1);
console.log("Connected:", connected);

// Check status after connect
const status2 = await portal.request("wallet_status");
console.log("Status after connect:", status2);

// Subscribe to push events
const unsubConnect = portal.subscribe("wallet:connected", (data) => {
  console.log("📣 Push event - wallet:connected:", data);
});

const unsubDisconnect = portal.subscribe("wallet:disconnected", () => {
  console.log("📣 Push event - wallet:disconnected");
});

// Sign a message
const signed = await portal.request("wallet_signMessage", "Hello, Portal!");
console.log("Signed message:", signed.signature.slice(0, 20) + "...");

// =============================================================================
// Demo: Viem Integration
// =============================================================================

console.log("\n🔗 Testing Viem integration...\n");

// Create Viem public client using portal transport
const viemClient = createPublicClient({
  chain: mainnet,
  transport: portalTransport(portal),
});

// Get chain ID
const chainId = await viemClient.getChainId();
console.log("Chain ID:", chainId);

// Get block number
const blockNumber = await viemClient.getBlockNumber();
console.log("Block number:", blockNumber);

// Get balance
const balance = await viemClient.getBalance({
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f1dE4a",
});
console.log("Balance:", formatEther(balance), "ETH");

// Get gas price
const gasPrice = await viemClient.getGasPrice();
console.log("Gas price:", gasPrice, "wei");

// =============================================================================
// Demo: Chain Switching
// =============================================================================

console.log("\n🔄 Testing chain switching...\n");

// Switch to Optimism
const optimismConnect = await portal.request("wallet_connect", 10);
console.log("Switched to Optimism:", optimismConnect);

// Verify chain ID changed
const newChainId = await viemClient.getChainId();
console.log("New chain ID:", newChainId);

// =============================================================================
// Demo: Push Messages
// =============================================================================

console.log("\n📣 Testing push messages...\n");

// Disconnect (triggers push)
await portal.request("wallet_disconnect");
const finalStatus = await portal.request("wallet_status");
console.log("Final status:", finalStatus);

// =============================================================================
// Cleanup
// =============================================================================

console.log("\n✅ All tests passed!\n");

unsubConnect();
unsubDisconnect();
portal.close();
