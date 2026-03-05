/**
 * Portal Client
 *
 * Makes typed requests to a portal host.
 */

import { PortalErrorBase, TimeoutError } from "./errors.js";
import type {
  PortalClient,
  PortalClientOptions,
  PortalMessage,
  PortalPush,
  PortalRequest,
  PortalResponse,
  PortalSchema,
  PushSchema,
  Transport,
} from "./types.js";

const DEFAULT_TIMEOUT = 30_000;

type PendingRequest = {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * Create a portal client.
 *
 * @example
 * ```ts
 * const client = createClient<MySchema>(transport)
 *
 * // Fully typed request
 * const result = await client.request('greet', 'World')
 * //    ^? string
 * ```
 *
 * With typed push:
 * ```ts
 * const client = createClient<MySchema, MyPushSchema>(transport)
 * client.subscribe('txConfirmed', (data) => {
 *   // data is typed as MyPushSchema['txConfirmed']['data']
 * })
 * ```
 */
export function createClient<
  TSchema extends PortalSchema,
  TPushSchema extends PushSchema = PushSchema,
>(transport: Transport, options: PortalClientOptions = {}): PortalClient<TSchema, TPushSchema> {
  const { timeout = DEFAULT_TIMEOUT } = options;

  let requestId = 0;
  const pending = new Map<number, PendingRequest>();
  const subscriptions = new Map<string, Set<(data: unknown) => void>>();

  // Handle incoming messages
  const unsubscribe = transport.subscribe((message: PortalMessage) => {
    if (message.type === "response") {
      const response = message as PortalResponse;
      const request = pending.get(response.id);
      if (!request) return;

      clearTimeout(request.timer);
      pending.delete(response.id);

      if (response.error) {
        request.reject(PortalErrorBase.fromJSON(response.error));
      } else {
        request.resolve(response.result);
      }
    } else if (message.type === "push") {
      const push = message as PortalPush;
      const handlers = subscriptions.get(push.topic);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(push.data);
          } catch {
            // Ignore handler errors
          }
        }
      }
    }
  });

  return {
    request<TMethod extends keyof TSchema & string>(
      method: TMethod,
      ...params: TSchema[TMethod]["params"]
    ): Promise<TSchema[TMethod]["result"]> {
      return new Promise((resolve, reject) => {
        const id = ++requestId;

        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new TimeoutError(timeout));
        }, timeout);

        pending.set(id, {
          resolve: resolve as (result: unknown) => void,
          reject,
          timer,
        });

        const request: PortalRequest<TSchema, TMethod> = {
          type: "request",
          id,
          method,
          params,
        };

        transport.send(request as PortalMessage);
      });
    },

    subscribe<Topic extends keyof TPushSchema & string>(
      topic: Topic,
      handler: (data: TPushSchema[Topic]["data"]) => void,
    ): () => void {
      let handlers = subscriptions.get(topic);
      if (!handlers) {
        handlers = new Set();
        subscriptions.set(topic, handlers);
      }
      handlers.add(handler as (data: unknown) => void);

      return () => {
        handlers!.delete(handler as (data: unknown) => void);
        if (handlers!.size === 0) {
          subscriptions.delete(topic);
        }
      };
    },

    close(): void {
      unsubscribe();
      transport.close?.();

      // Reject all pending requests
      for (const [id, request] of pending) {
        clearTimeout(request.timer);
        request.reject(new Error("Client closed"));
        pending.delete(id);
      }

      subscriptions.clear();
    },
  };
}
