/**
 * Portal Client Tests
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { createClient } from "./client";
import { createHost } from "./host";
import { createLoopbackTransports } from "./transports";
import { TimeoutError } from "./errors";

// =============================================================================
// Test Schema
// =============================================================================

type TestSchema = {
  greet: { params: [name: string]; result: string };
  add: { params: [a: number, b: number]; result: number };
  echo: { params: [value: unknown]; result: unknown };
  slow: { params: [delayMs: number]; result: string };
  fail: { params: []; result: never };
};

// =============================================================================
// Tests
// =============================================================================

describe("createClient", () => {
  let clientTransport: ReturnType<typeof createLoopbackTransports>[0];
  let hostTransport: ReturnType<typeof createLoopbackTransports>[1];

  beforeEach(() => {
    [clientTransport, hostTransport] = createLoopbackTransports();
  });

  afterEach(() => {
    clientTransport.close?.();
    hostTransport.close?.();
  });

  describe("request", () => {
    test("makes typed requests and receives responses", async () => {
      const host = createHost<TestSchema>(hostTransport, {
        handlers: {
          greet: ([name]) => `Hello, ${name}!`,
          add: ([a, b]) => a + b,
          echo: ([value]) => value,
          slow: async ([delayMs]) => {
            await new Promise((r) => setTimeout(r, delayMs));
            return "done";
          },
          fail: () => {
            throw new Error("Intentional failure");
          },
        },
      });

      const client = createClient<TestSchema>(clientTransport);

      // Test string method
      const greeting = await client.request("greet", "World");
      expect(greeting).toBe("Hello, World!");

      // Test number method
      const sum = await client.request("add", 2, 3);
      expect(sum).toBe(5);

      // Test echo with various types
      expect(await client.request("echo", "string")).toBe("string");
      expect(await client.request("echo", 42)).toBe(42);
      expect(await client.request("echo", { nested: true })).toEqual({ nested: true });
      expect(await client.request("echo", [1, 2, 3])).toEqual([1, 2, 3]);
      expect(await client.request("echo", null)).toBe(null);

      client.close();
      host.close();
    });

    test("handles concurrent requests correctly", async () => {
      let callCount = 0;
      const host = createHost<TestSchema>(hostTransport, {
        handlers: {
          greet: ([name]) => `Hello, ${name}!`,
          add: async ([a, b]) => {
            callCount++;
            await new Promise((r) => setTimeout(r, 10));
            return a + b;
          },
          echo: ([value]) => value,
          slow: async ([delayMs]) => {
            await new Promise((r) => setTimeout(r, delayMs));
            return "done";
          },
          fail: () => {
            throw new Error("fail");
          },
        },
      });

      const client = createClient<TestSchema>(clientTransport);

      // Fire multiple requests concurrently
      const results = await Promise.all([
        client.request("add", 1, 1),
        client.request("add", 2, 2),
        client.request("add", 3, 3),
        client.request("add", 4, 4),
        client.request("add", 5, 5),
      ]);

      expect(results).toEqual([2, 4, 6, 8, 10]);
      expect(callCount).toBe(5);

      client.close();
      host.close();
    });

    test("propagates handler errors", async () => {
      const host = createHost<TestSchema>(hostTransport, {
        handlers: {
          greet: () => "hi",
          add: () => 0,
          echo: () => null,
          slow: () => "done",
          fail: () => {
            throw new Error("Intentional failure");
          },
        },
      });

      const client = createClient<TestSchema>(clientTransport);

      await expect(client.request("fail")).rejects.toThrow("Intentional failure");

      client.close();
      host.close();
    });

    test("times out after configured timeout", async () => {
      const host = createHost<TestSchema>(hostTransport, {
        handlers: {
          greet: () => "hi",
          add: () => 0,
          echo: () => null,
          slow: async ([delayMs]) => {
            await new Promise((r) => setTimeout(r, delayMs));
            return "done";
          },
          fail: () => {
            throw new Error("fail");
          },
        },
      });

      const client = createClient<TestSchema>(clientTransport, {
        timeout: 50,
      });

      await expect(client.request("slow", 200)).rejects.toThrow(TimeoutError);

      client.close();
      host.close();
    });

    test("returns METHOD_NOT_FOUND for unknown methods", async () => {
      // Host with no fallback
      const host = createHost<TestSchema>(hostTransport, {
        handlers: {
          greet: () => "hi",
          add: () => 0,
          echo: () => null,
          slow: () => "done",
          fail: () => {
            throw new Error("fail");
          },
        },
      });

      const client = createClient<{ unknown_method: { params: []; result: string } }>(
        clientTransport,
      );

      await expect(client.request("unknown_method")).rejects.toThrow("Method not found");

      client.close();
      host.close();
    });
  });

  describe("subscribe", () => {
    test("receives push messages on subscribed topics", async () => {
      const host = createHost<TestSchema>(hostTransport, {
        handlers: {
          greet: () => "hi",
          add: () => 0,
          echo: () => null,
          slow: () => "done",
          fail: () => {
            throw new Error("fail");
          },
        },
      });

      const client = createClient<TestSchema>(clientTransport);

      const received: string[] = [];
      const unsubscribe = client.subscribe<string>("updates", (data) => {
        received.push(data);
      });

      // Send push messages
      host.push("updates", "message 1");
      host.push("updates", "message 2");
      host.push("other-topic", "should not receive");
      host.push("updates", "message 3");

      // Wait for async delivery
      await new Promise((r) => setTimeout(r, 10));

      expect(received).toEqual(["message 1", "message 2", "message 3"]);

      // Unsubscribe and verify no more messages
      unsubscribe();
      host.push("updates", "after unsubscribe");
      await new Promise((r) => setTimeout(r, 10));
      expect(received).toEqual(["message 1", "message 2", "message 3"]);

      client.close();
      host.close();
    });

    test("handles multiple subscribers to same topic", async () => {
      const host = createHost<TestSchema>(hostTransport, {
        handlers: {
          greet: () => "hi",
          add: () => 0,
          echo: () => null,
          slow: () => "done",
          fail: () => {
            throw new Error("fail");
          },
        },
      });

      const client = createClient<TestSchema>(clientTransport);

      const received1: string[] = [];
      const received2: string[] = [];

      const unsub1 = client.subscribe<string>("topic", (data) => received1.push(data));
      const unsub2 = client.subscribe<string>("topic", (data) => received2.push(data));

      host.push("topic", "shared message");
      await new Promise((r) => setTimeout(r, 10));

      expect(received1).toEqual(["shared message"]);
      expect(received2).toEqual(["shared message"]);

      // Unsubscribe one
      unsub1();
      host.push("topic", "after unsub1");
      await new Promise((r) => setTimeout(r, 10));

      expect(received1).toEqual(["shared message"]);
      expect(received2).toEqual(["shared message", "after unsub1"]);

      unsub2();
      client.close();
      host.close();
    });
  });

  describe("close", () => {
    test("rejects pending requests on close", async () => {
      const host = createHost<TestSchema>(hostTransport, {
        handlers: {
          greet: () => "hi",
          add: () => 0,
          echo: () => null,
          slow: async ([delayMs]) => {
            await new Promise((r) => setTimeout(r, delayMs));
            return "done";
          },
          fail: () => {
            throw new Error("fail");
          },
        },
      });

      const client = createClient<TestSchema>(clientTransport);

      // Start a slow request
      const promise = client.request("slow", 1000);

      // Close immediately
      client.close();

      await expect(promise).rejects.toThrow("Client closed");

      host.close();
    });
  });
});
