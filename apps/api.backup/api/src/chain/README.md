# Chain Integration Module

**Batch 201 - Substrate PoA Chain Integration**

This directory contains the complete Substrate blockchain integration for the VitalCV platform.

---

## 📁 Module Structure

```
chain/
├── index.ts                    # Main exports & service initialization
├── types.ts                    # TypeScript type definitions
├── PolkadotService.ts         # WebSocket connection manager (singleton)
├── CredentialChainService.ts  # Credential anchoring & queries
├── TrustRegistryService.ts    # Trust registry validation
├── eventListener.ts           # Chain event processing
├── healthMonitor.ts           # Health monitoring & compatibility checks
├── metrics.ts                 # Prometheus metrics
├── hashBuilder.ts             # Deterministic hash utilities
├── errorNormalizer.ts         # Error handling & normalization
├── explorerLink.ts            # Block explorer link generation
├── palletIntrospection.ts     # Pallet metadata inspection
├── rateLimit.ts               # RPC rate limiting
├── timeout.ts                 # Timeout wrapper for RPC calls
├── routeInit.ts               # Route initialization helper
├── substrate.ts               # Legacy API (deprecated)
├── anchor_canary.ts           # Legacy test (deprecated)
└── README.md                  # This file
```

---

## 🔧 Core Services

### PolkadotService
**Purpose**: Manages WebSocket connection to Substrate chain

**Features**:
- Singleton pattern
- Auto-reconnect on disconnect
- Exponential backoff retry
- Connection health monitoring
- Chain metadata logging

**Usage**:
```typescript
import { PolkadotService } from './chain';

const service = PolkadotService.getInstance({
  wsUrl: 'ws://localhost:9944',
  retryAttempts: 5,
});

await service.connect();
const api = service.getApi();
```

---

### CredentialChainService
**Purpose**: Credential operations on-chain

**Methods**:
- `anchorCredential()` - Issue credential on-chain
- `revokeCredential()` - Revoke credential
- `updateCredentialStatus()` - Update status
- `getCredentialStatus()` - Query status
- `getOnChainRecord()` - Get full record

**Usage**:
```typescript
import { CredentialChainService } from './chain';

const service = new CredentialChainService(polkadotService);

const result = await service.anchorCredential({
  credentialId: 'cred-123',
  hash: '0x...',
  issuerDid: 'did:example:issuer',
});
```

---

### TrustRegistryService
**Purpose**: Query and validate trusted issuers

**Methods**:
- `getAllowedIssuers()` - Get all registered issuers
- `isIssuerPermitted()` - Validate issuer permission
- `getIssuerDetails()` - Get issuer info
- `hasCapability()` - Check specific capability

**Usage**:
```typescript
import { TrustRegistryService } from './chain';

const service = new TrustRegistryService(polkadotService);

const isPermitted = await service.isIssuerPermitted(
  'did:example:issuer',
  'issueCredential'
);
```

---

### ChainEventListener
**Purpose**: Listen for and process chain events

**Methods**:
- `startListening()` - Start event listener
- `onCredentialIssued()` - Register CredentialIssued handler
- `onCredentialRevoked()` - Register CredentialRevoked handler
- `on()` - Register custom event handler

**Usage**:
```typescript
import { ChainEventListener } from './chain';

const listener = new ChainEventListener(polkadotService);

listener.onCredentialIssued((event) => {
  console.log('Credential issued:', event.data);
});

await listener.startListening();
```

---

### ChainHealthMonitor
**Purpose**: Monitor chain health and compatibility

**Methods**:
- `startHeartbeat()` - Start periodic health checks
- `checkHealth()` - Check current health
- `checkPalletCompatibility()` - Validate pallets
- `checkTypesAlignment()` - Validate types
- `runStartupChecks()` - Run all checks

**Usage**:
```typescript
import { ChainHealthMonitor } from './chain';

const monitor = new ChainHealthMonitor(polkadotService);

monitor.startHeartbeat(30000); // Check every 30s
const health = await monitor.checkHealth();
```

---

## 🛠️ Utilities

### Hash Builder
Deterministic hash generation for credential anchoring.

```typescript
import { buildCredentialHash } from './chain/hashBuilder';

const hash = buildCredentialHash({
  id: 'cred-123',
  issuer: 'did:example:issuer',
  subject: 'did:example:subject',
  issuanceDate: '2024-01-01T00:00:00Z',
  credentialType: ['VerifiableCredential'],
});
```

### Error Normalizer
Consistent error handling for chain operations.

```typescript
import { normalizeChainError } from './chain/errorNormalizer';

try {
  // Chain operation
} catch (error) {
  const normalized = normalizeChainError(error, api);
  console.error(normalized.code, normalized.message);
}
```

### Rate Limiter
Prevent DDoS and protect chain from spam.

```typescript
import { ChainRateLimiter } from './chain/rateLimit';

const limiter = new ChainRateLimiter(100, 60000); // 100 calls per 60s

await limiter.execute('anchor', async () => {
  return await chainService.anchorCredential(...);
});
```

### Timeout Wrapper
Timeout protection for RPC calls.

```typescript
import { chainCallWithTimeout } from './chain/timeout';

const result = await chainCallWithTimeout(
  () => chainService.getCredentialStatus(id),
  10000, // 10s timeout
  null   // fallback value
);
```

---

## 📊 Metrics

All metrics are exported via Prometheus format:

```
substrate_connected                      # Connection status (0/1)
substrate_rpc_latency_seconds           # RPC call duration
substrate_extrinsic_success_total       # Successful extrinsics
substrate_extrinsic_failure_total       # Failed extrinsics
substrate_block_height                   # Current block number
substrate_peers                          # Connected peers
credential_anchor_latency_seconds       # Anchoring duration
substrate_events_processed_total        # Events processed
```

---

## 🚀 Initialization

The module is initialized automatically on server startup:

```typescript
// In server.ts
import { initializeChainServices, shutdownChainServices } from './chain';

// On startup
await initializeChainServices();

// On shutdown
process.on('SIGTERM', async () => {
  await shutdownChainServices();
});
```

---

## 🔧 Configuration

Configure via environment variables:

```bash
SUBSTRATE_WS_URL=ws://localhost:9944
SUBSTRATE_ENABLED=true
SUBSTRATE_RETRY_ATTEMPTS=5
SUBSTRATE_RETRY_DELAY=1000
SUBSTRATE_MAX_RETRY_DELAY=30000
SUBSTRATE_SEED=//Alice
SUBSTRATE_NETWORK=local
```

See `CHAIN_ENV_EXAMPLE.txt` for full configuration options.

---

## 🧪 Testing

### Unit Tests
```bash
npm test -- __tests__/chain/services.test.ts
```

### Integration Tests
```bash
npm test -- __tests__/chain/integration.test.ts
```

### Manual Testing
```bash
npm run chain:test
```

---

## 📚 Documentation

- **Architecture**: `apps/api/CHAIN_ARCHITECTURE.md`
- **Quick Start**: `B201_QUICK_START.md`
- **API Examples**: `B201_API_EXAMPLES.sh`
- **Implementation Summary**: `B201_IMPLEMENTATION_SUMMARY.md`

---

## 🔐 Security

### Key Management
- Never commit `SUBSTRATE_SEED` to version control
- Use `//Alice` for development only
- Use HSM/KMS for production keys
- Rotate keys regularly

### Trust Registry
- All anchoring validates issuer permissions
- Capability-based access control
- On-chain trust list

### Rate Limiting
- Default: 100 calls per 60 seconds
- Configurable per endpoint
- DDoS protection

---

## 🐛 Troubleshooting

### Connection Issues
```bash
# Check chain is running
curl http://localhost:9933/health

# View logs
make -f Makefile.chain chain-logs

# Test connection
npm run chain:test
```

### Module Errors
```bash
# Introspect pallets
npm run chain:introspect credentials

# Check compatibility
# (runs automatically on startup)
```

### Performance Issues
```bash
# Check metrics
curl localhost:9090/metrics | grep substrate

# Monitor RPC latency
# substrate_rpc_latency_seconds
```

---

## 🎯 Task Reference

This module implements the following Batch 201 tasks:

- ✅ 201.1-201.10: Setup & connection
- ✅ 201.11-201.19: Credential operations
- ✅ 201.20-201.24: Event listening & queries
- ✅ 201.25-201.28: Utilities & endpoints
- ✅ 201.29-201.32: Metrics & monitoring
- ✅ 201.33-201.38: Trust registry
- ✅ 201.39-201.41: Compatibility & testing
- ✅ 201.48-201.49: Rate limiting & timeouts

---

## 📞 Support

For issues or questions:
1. Check `CHAIN_ARCHITECTURE.md` for detailed docs
2. Review this README
3. Run `npm run chain:test` to verify setup
4. Check logs with `make -f Makefile.chain chain-logs`

---

**Module**: Chain Integration
**Batch**: 201
**Status**: ✅ Production Ready
**Version**: 1.0.0

