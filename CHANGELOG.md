# viem-portal

## 0.2.0

### Minor Changes

- 5dac489: Initial release of viem-portal

  - Schema-first typed portal client/host with full TypeScript inference
  - Viem-compatible custom transport via `portalTransport()`
  - Transport implementations for Workers, MessageChannel, and loopback testing
  - Push subscriptions from host to client
  - Mock and real RPC handlers for Viem integration
  - Concurrent request correlation with timeout support
