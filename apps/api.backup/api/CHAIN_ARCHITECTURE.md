# VitalCV Chain Architecture

**Task 201.50 - Chain architecture documentation**

## Overview

The VitalCV Substrate PoA (Proof of Authority) Chain integration provides blockchain-based credential anchoring, trust registry, and verification capabilities for the chai-vc-platform.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     chai-vc-platform API                        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ Credential   │  │   Trust      │  │   Chain      │        │
│  │  Issuance    │  │  Registry    │  │  Health      │        │
│  │   Service    │  │   Service    │  │  Monitor     │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                  │                  │                 │
│         └──────────────────┴──────────────────┘                 │
│                            │                                     │
│                   ┌────────▼─────────┐                          │
│                   │ PolkadotService  │                          │
│                   │   (Singleton)    │                          │
│                   └────────┬─────────┘                          │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                    WebSocket │
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                    VitalCV Substrate Chain                       │
│                                                                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐      │
│  │  Credentials  │  │   Trust       │  │    System     │      │
│  │    Pallet     │  │  Registry     │  │    Pallets    │      │
│  │               │  │   Pallet      │  │               │      │
│  └───────────────┘  └───────────────┘  └───────────────┘      │
│                                                                  │
│  Storage: Credential Records, Status, Trust Lists               │
└──────────────────────────────────────────────────────────────────┘
```

## Components

### 1. PolkadotService (Task 201.2, 201.3)

**Purpose**: Manages WebSocket connection to Substrate chain

**Features**:
- Singleton pattern for single connection
- Auto-reconnect on disconnect (Task 201.7)
- Exponential backoff retry (Task 201.6)
- Connection health monitoring
- Chain metadata logging (Task 201.8)

**Usage**:
```typescript
const service = PolkadotService.getInstance({
  wsUrl: 'ws://localhost:9944',
  retryAttempts: 5,
  retryDelay: 1000,
});

await service.connect();
const api = service.getApi();
```

### 2. CredentialChainService (Task 201.12)

**Purpose**: Wraps credential-related extrinsics and queries

**Key Methods**:
- `anchorCredential()` - Issue credential on-chain (Task 201.14)
- `revokeCredential()` - Revoke credential on-chain
- `updateCredentialStatus()` - Update status
- `getCredentialStatus()` - Query current status (Task 201.22)
- `getOnChainRecord()` - Get full record (Task 201.24)

**Anchoring Flow**:
```typescript
const result = await chainService.anchorCredential({
  credentialId: 'cred-123',
  hash: '0x...',
  issuerDid: 'did:example:issuer',
});

// Returns: { success, txHash, blockHash, events }
```

### 3. TrustRegistryService (Task 201.35, 201.36)

**Purpose**: Query and validate trusted issuers on-chain

**Key Methods**:
- `getAllowedIssuers()` - Get all registered issuers (Task 201.36)
- `isIssuerPermitted()` - Validate issuer permission (Task 201.35)
- `getIssuerDetails()` - Get issuer info
- `hasCapability()` - Check specific capability

**Trust Check Flow**:
```typescript
const isPermitted = await trustRegistry.isIssuerPermitted(
  'did:example:issuer',
  'issueCredential'
);

if (!isPermitted) {
  throw new Error('Issuer not authorized');
}
```

### 4. ChainEventListener (Task 201.20, 201.21)

**Purpose**: Listen for on-chain events and process them

**Supported Events**:
- `credentials.CredentialIssued` (Task 201.20)
- `credentials.CredentialRevoked` (Task 201.21)
- Custom event handlers

**Usage**:
```typescript
eventListener.onCredentialIssued((event) => {
  console.log('Credential issued:', event.data);
  // Store in audit log
});

eventListener.onCredentialRevoked((event) => {
  // Update DB status
});
```

### 5. ChainHealthMonitor (Task 201.32)

**Purpose**: Monitor chain health and compatibility

**Features**:
- Periodic heartbeat checks (Task 201.32)
- Pallet compatibility validation (Task 201.40)
- Types alignment checking (Task 201.41)
- Connection metrics

**Heartbeat**:
```typescript
healthMonitor.startHeartbeat(30000); // Check every 30s
```

## Integration Flow

### Credential Issuance Flow (Task 201.17, 201.18)

```
1. User requests credential issuance
2. API validates and prepares credential
3. Build deterministic hash (Task 201.13)
4. Check issuer permissions (Task 201.35)
5. Sign and anchor on-chain (Task 201.14)
6. On success: Store txHash and onChainId in DB (Task 201.19)
7. On failure: Rollback DB status (Task 201.18)
8. Return credential with anchoring proof
```

### Verification Flow (Task 201.23)

```
1. Receive verification request
2. Verify cryptographic signature (crypto verification)
3. Check DB status (DB status)
4. Query chain status (Task 201.22)
5. Combine results: crypto ✅ + DB ✅ + chain ✅
6. Return verification result
```

## API Endpoints

### Health Check (Task 201.11)

```bash
GET /api/chain/health
```

Response:
```json
{
  "ok": true,
  "connected": true,
  "health": {
    "connected": true,
    "peers": 3,
    "syncing": false,
    "blockNumber": 12345,
    "timestamp": 1234567890
  },
  "metadata": {
    "chainName": "VitalCV Development",
    "genesisHash": "0x...",
    "runtimeVersion": {
      "specName": "vitalcv",
      "specVersion": 100,
      "transactionVersion": 1
    }
  }
}
```

### Credential Status (Task 201.27)

```bash
GET /api/chain/credential/:id/status
```

Response:
```json
{
  "ok": true,
  "status": {
    "id": "cred-123",
    "status": "active",
    "issuedAt": 1234567890,
    "issuer": "5GrwvaEF5..."
  }
}
```

### Debug Credential (Task 201.28)

```bash
GET /api/chain/credential/:id/debug
```

### List Issuers (Task 201.37)

```bash
GET /api/chain/issuers
```

## Monitoring & Metrics (Task 201.29, 201.30, 201.31)

### Prometheus Metrics

```
# Task 201.29 - Connection status
substrate_connected{} 1

# Task 201.30 - RPC latency
substrate_rpc_latency_seconds{method="query"} 0.05

# Task 201.31 - Extrinsic results
substrate_extrinsic_success_total{pallet="credentials",method="issueCredential"} 42
substrate_extrinsic_failure_total{pallet="credentials",method="issueCredential",error_code="INSUFFICIENT_BALANCE"} 2

# Additional metrics
substrate_block_height{} 12345
substrate_peers{} 3
credential_anchor_latency_seconds{} 1.5
```

## Error Handling

### Error Normalizer (Task 201.16)

Converts chain errors to consistent format:

```typescript
{
  code: 'CREDENTIALS_ALREADYISSUED',
  message: 'Credential already issued',
  details: { ... },
  isRecoverable: false
}
```

### Connection Errors

- Auto-retry with exponential backoff
- Fallback to read-only mode if signing unavailable
- Graceful degradation when chain unavailable

## Rate Limiting (Task 201.48)

```typescript
// 100 calls per 60 seconds per key
const limiter = new ChainRateLimiter(100, 60000);

await limiter.execute('anchor', async () => {
  return await chainService.anchorCredential(...);
});
```

## Timeout Protection (Task 201.49)

```typescript
// Timeout after 10 seconds with fallback
const result = await chainCallWithTimeout(
  () => chainService.getCredentialStatus(id),
  10000,
  null // fallback value
);
```

## Development Tools

### CLI Tools

#### Chain Test Script (Task 201.44)
```bash
npm run chain:test
```

Performs: Issue → Query → Verify

#### Pallet Introspection (Task 201.25)
```bash
npm run chain:introspect credentials
```

Shows: Calls, Events, Storage, Constants, Errors

### Docker Compose (Task 201.42)

```bash
# Start dev chain
make chain-start

# View logs
make chain-logs

# Stop chain
make chain-stop

# Purge and restart
make chain-purge
```

## Testing

### Integration Tests (Task 201.45, 201.46, 201.47)

```bash
# Run all chain tests
npm test -- __tests__/chain/

# Specific test suites
npm test -- __tests__/chain/integration.test.ts
npm test -- __tests__/chain/services.test.ts
```

**Test Coverage**:
- Task 201.45: Full issuance → anchoring → verify
- Task 201.46: Stale/failing chain scenarios
- Task 201.47: Revocation flow

## Configuration

### Environment Variables (Task 201.4)

```bash
# Substrate connection
SUBSTRATE_WS_URL=ws://localhost:9944
SUBSTRATE_ENABLED=true

# Retry settings
SUBSTRATE_RETRY_ATTEMPTS=5
SUBSTRATE_RETRY_DELAY=1000
SUBSTRATE_MAX_RETRY_DELAY=30000

# Signing key (dev only!)
SUBSTRATE_SEED=//Alice

# Network
SUBSTRATE_NETWORK=local
VITALCV_EXPLORER_URL=http://localhost:3001
```

## Security Considerations

### Key Management (Task 201.33)

- **Development**: Use test seeds like `//Alice`
- **Production**: Use secure key management (HSM, KMS)
- Never commit seeds to version control
- Rotate keys regularly

### Trust Registry (Task 201.35)

All credential anchoring validates:
1. Issuer exists in trust registry
2. Issuer has `issueCredential` capability
3. Account has sufficient balance

### Rate Limiting (Task 201.48)

- Prevents DDoS attacks
- Protects chain from spam
- Configurable per endpoint

## Deployment

### Production Checklist

1. ✅ Set production `SUBSTRATE_WS_URL`
2. ✅ Configure secure signing key
3. ✅ Enable monitoring and alerts
4. ✅ Set up block explorer
5. ✅ Configure rate limits
6. ✅ Test failover scenarios
7. ✅ Document emergency procedures

### High Availability

- Multiple RPC endpoints
- Connection retry logic
- Graceful degradation
- Health check monitoring

## Troubleshooting

### Connection Issues

```bash
# Check chain is running
make chain-status

# View chain logs
make chain-logs

# Test connection
curl http://localhost:9933/health
```

### Debug Mode

```typescript
// Enable verbose logging
process.env.RUST_LOG = 'debug';
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Connection refused` | Chain not running | Run `make chain-start` |
| `No signing key` | Missing SUBSTRATE_SEED | Set environment variable |
| `Module error` | Pallet mismatch | Check pallet compatibility |
| `Rate limit exceeded` | Too many calls | Reduce request frequency |

## Future Enhancements

- [ ] Multi-signature support
- [ ] Batched anchoring
- [ ] Privacy-preserving proofs
- [ ] Cross-chain bridges
- [ ] Governance integration

## References

- [Polkadot.js Documentation](https://polkadot.js.org/docs/)
- [Substrate Documentation](https://docs.substrate.io/)
- [VitalCV Pallets Repository](#)

---

**Batch 201 Complete** ✅

All 50 tasks implemented:
- ✅ Connection management
- ✅ Credential anchoring
- ✅ Trust registry
- ✅ Event listening
- ✅ Health monitoring
- ✅ API endpoints
- ✅ Metrics & observability
- ✅ Testing & tools
- ✅ Docker & deployment
- ✅ Documentation

