/**
 * Portal Viem Transport Tests
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { createPublicClient } from "viem";
import { mainnet } from "viem/chains";
import { createClient } from "./client";
import { createHost } from "./host";
import { createLoopbackTransports } from "./worker";
import {
  portalTransport,
  createMockRpcHandler,
  createRpcHandler,
  type EthRpcSchema,
} from "./provider";
import type { MergeSchemas } from "./types";

// =============================================================================
// Test Schema (extends EthRpcSchema with custom methods)
// =============================================================================

type CustomSchema = {
  ping: { params: []; result: "pong" };
  wallet_connect: { params: [chainId: number]; result: { address: string } };
};

type TestSchema = MergeSchemas<EthRpcSchema, CustomSchema>;

// =============================================================================
// Tests
// =============================================================================

describe("portalTransport", () => {
  let clientTransport: ReturnType<typeof createLoopbackTransports>[0];
  let hostTransport: ReturnType<typeof createLoopbackTransports>[1];

  beforeEach(() => {
    [clientTransport, hostTransport] = createLoopbackTransports();
  });

  afterEach(() => {
    clientTransport.close?.();
    hostTransport.close?.();
  });

  test("creates a valid Viem transport", async () => {
    const host = createHost<TestSchema>(hostTransport, {
      handlers: {
        eth_request: createMockRpcHandler({
          eth_chainId: "0x1",
        }),
        ping: () => "pong",
        wallet_connect: () => ({ address: "0x123" }),
      },
    });

    const portalClient = createClient<TestSchema>(clientTransport);
    const transport = portalTransport(portalClient);

    // The transport factory should be a function
    expect(typeof transport).toBe("function");

    portalClient.close();
    host.close();
  });

  test("forwards eth_chainId correctly", async () => {
    const host = createHost<TestSchema>(hostTransport, {
      handlers: {
        eth_request: createMockRpcHandler({
          eth_chainId: "0x1",
        }),
        ping: () => "pong",
        wallet_connect: () => ({ address: "0x123" }),
      },
    });

    const portalClient = createClient<TestSchema>(clientTransport);

    const viemClient = createPublicClient({
      chain: mainnet,
      transport: portalTransport(portalClient),
    });

    const chainId = await viemClient.getChainId();
    expect(chainId).toBe(1);

    portalClient.close();
    host.close();
  });

  test("forwards eth_blockNumber correctly", async () => {
    const host = createHost<TestSchema>(hostTransport, {
      handlers: {
        eth_request: createMockRpcHandler({
          eth_chainId: "0x1",
          eth_blockNumber: "0x10f2c5a", // 17829978
        }),
        ping: () => "pong",
        wallet_connect: () => ({ address: "0x123" }),
      },
    });

    const portalClient = createClient<TestSchema>(clientTransport);

    const viemClient = createPublicClient({
      chain: mainnet,
      transport: portalTransport(portalClient),
    });

    const blockNumber = await viemClient.getBlockNumber();
    // 0x10f2c5a = 17829978
    expect(blockNumber).toBe(BigInt(0x10f2c5a));

    portalClient.close();
    host.close();
  });

  test("handles eth_getBalance with params", async () => {
    const host = createHost<TestSchema>(hostTransport, {
      handlers: {
        eth_request: createMockRpcHandler({
          eth_chainId: "0x1",
          eth_getBalance: (address: unknown, block: unknown) => {
            expect(address).toBe("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
            expect(block).toBe("latest");
            return "0x8ac7230489e80000"; // 10 ETH
          },
        }),
        ping: () => "pong",
        wallet_connect: () => ({ address: "0x123" }),
      },
    });

    const portalClient = createClient<TestSchema>(clientTransport);

    const viemClient = createPublicClient({
      chain: mainnet,
      transport: portalTransport(portalClient),
    });

    const balance = await viemClient.getBalance({
      address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
    });

    expect(balance).toBe(10000000000000000000n);

    portalClient.close();
    host.close();
  });

  test("propagates RPC errors correctly", async () => {
    const host = createHost<TestSchema>(hostTransport, {
      handlers: {
        eth_request: createMockRpcHandler({
          eth_chainId: "0x1",
          eth_call: () => {
            const error = new Error("execution reverted") as Error & { code: number };
            error.code = -32000;
            throw error;
          },
        }),
        ping: () => "pong",
        wallet_connect: () => ({ address: "0x123" }),
      },
    });

    const portalClient = createClient<TestSchema>(clientTransport);

    const viemClient = createPublicClient({
      chain: mainnet,
      transport: portalTransport(portalClient),
    });

    await expect(
      viemClient.call({
        to: "0x0000000000000000000000000000000000000000",
        data: "0x",
      }),
    ).rejects.toThrow();

    portalClient.close();
    host.close();
  });

  test("handles custom portal methods alongside eth_request", async () => {
    const host = createHost<TestSchema>(hostTransport, {
      handlers: {
        eth_request: createMockRpcHandler({
          eth_chainId: "0x1",
        }),
        ping: () => "pong",
        wallet_connect: ([chainId]) => ({
          address: `0x${chainId.toString(16).padStart(40, "0")}`,
        }),
      },
    });

    const portalClient = createClient<TestSchema>(clientTransport);

    // Custom method through portal
    const pong = await portalClient.request("ping");
    expect(pong).toBe("pong");

    // Custom wallet method
    const wallet = await portalClient.request("wallet_connect", 1);
    expect(wallet.address).toBe("0x0000000000000000000000000000000000000001");

    // Viem method through portal
    const viemClient = createPublicClient({
      chain: mainnet,
      transport: portalTransport(portalClient),
    });

    const chainId = await viemClient.getChainId();
    expect(chainId).toBe(1);

    portalClient.close();
    host.close();
  });
});

describe("createMockRpcHandler", () => {
  test("returns static values", async () => {
    const handler = createMockRpcHandler({
      eth_chainId: "0x1",
      eth_blockNumber: "0x100",
    });

    expect(await handler(["eth_chainId", []])).toBe("0x1");
    expect(await handler(["eth_blockNumber", []])).toBe("0x100");
  });

  test("calls functions with params", async () => {
    const handler = createMockRpcHandler({
      eth_getBalance: (address: unknown, block: unknown) => {
        return `balance:${address}:${block}`;
      },
    });

    const result = await handler(["eth_getBalance", ["0x123", "latest"]]);
    expect(result).toBe("balance:0x123:latest");
  });

  test("throws for unknown methods", async () => {
    const handler = createMockRpcHandler({
      eth_chainId: "0x1",
    });

    await expect(handler(["unknown_method", []])).rejects.toThrow("Mock: Method not supported");
  });
});

describe("createRpcHandler", () => {
  test("formats JSON-RPC requests correctly", async () => {
    // Mock fetch
    const originalFetch = globalThis.fetch;
    let capturedBody: unknown;

    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options?.body as string);
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: (capturedBody as { id: number }).id,
          result: "0x1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    try {
      const handler = createRpcHandler({
        rpcUrl: "https://example.com/rpc",
      });

      const result = await handler(["eth_chainId", []]);
      expect(result).toBe("0x1");
      expect(capturedBody).toMatchObject({
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("propagates RPC errors", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          error: { code: -32000, message: "Internal error" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    try {
      const handler = createRpcHandler({
        rpcUrl: "https://example.com/rpc",
      });

      await expect(handler(["eth_chainId", []])).rejects.toThrow("Internal error");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
