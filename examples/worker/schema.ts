/**
 * Shared Schema
 *
 * Defines the portal protocol between main thread and worker.
 */

import type { MergeSchemas } from "../../src/types";
import type { EthRpcSchema } from "../../src/viem";

// =============================================================================
// Custom Methods
// =============================================================================

/**
 * Custom wallet methods beyond standard JSON-RPC.
 */
export type WalletSchema = {
  /** Get wallet connection status */
  wallet_status: {
    params: [];
    result: { connected: boolean; address: string | null; chainId: number };
  };

  /** Connect wallet to a specific chain */
  wallet_connect: {
    params: [chainId: number];
    result: { address: string; chainId: number };
  };

  /** Disconnect wallet */
  wallet_disconnect: {
    params: [];
    result: void;
  };

  /** Sign a message (requires user approval in real implementation) */
  wallet_signMessage: {
    params: [message: string];
    result: { signature: string };
  };
};

// =============================================================================
// Combined Schema
// =============================================================================

/**
 * Full portal schema = Ethereum RPC + Custom Wallet methods
 */
export type PortalSchemaType = MergeSchemas<EthRpcSchema, WalletSchema>;
