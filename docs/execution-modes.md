# Execution Modes Contract

**Version:** 1.0.0
**Status:** Authoritative Policy
**Applies to:** All VitalCV services, tests, and development workflows

## Overview

VitalCV operates in three distinct execution modes with different trust boundaries, network access policies, and validation behaviors. This document defines the contract for each mode and provides implementation patterns for mode-aware code.

---

## Mode Definitions

### 1. TEST MODE

**Environment:** `NODE_ENV=test`

**Purpose:** Automated testing (unit, integration, E2E) with hermetic execution and no external dependencies.

**Trust Level:** Full simulation - real cryptographic validation, simulated infrastructure

**Characteristics:**

- ✅ **ALLOWED:** In-memory adapters, cryptographic validation, signature verification, DPoP proof validation
- ❌ **FORBIDDEN:** Outbound network calls, DNS resolution, file system writes outside temp dirs
- ⚠️ **REQUIRED:** All tests must be deterministic and parallelizable

### 2. DEV MODE

**Environment:** `NODE_ENV=development` or `NODE_ENV=dev`

**Purpose:** Local development with fast iteration, optional mocking, relaxed validation

**Trust Level:** Convenience - some validations optional, network access allowed with warnings

**Characteristics:**

- ✅ **ALLOWED:** Network calls (with timeouts), optional signature verification, hot reload
- ⚠️ **RELAXED:** Signature requirements, some trust checks (with warnings logged)
- ❌ **FORBIDDEN:** Production secrets, real blockchain writes

### 3. PROD MODE

**Environment:** `NODE_ENV=production`

**Purpose:** Live deployment with full trust validation and strict security enforcement

**Trust Level:** Zero-trust - all validations mandatory, fail-closed on errors

**Characteristics:**

- ✅ **REQUIRED:** All signature verification, DPoP enforcement, audit logging, rate limiting
- ❌ **FORBIDDEN:** Mock implementations, bypassed validation, disabled security features
- ⚠️ **FAIL-CLOSED:** Unknown states treated as failures, explicit outcomes only

---

## Behavioral Matrix

| Feature                      | TEST         | DEV                        | PROD                     |
| ---------------------------- | ------------ | -------------------------- | ------------------------ |
| **Outbound HTTP/HTTPS**      | ❌ FORBIDDEN | ✅ Allowed (warn)          | ✅ Required              |
| **DNS Resolution**           | ❌ FORBIDDEN | ✅ Allowed                 | ✅ Required              |
| **Status List Allocation**   | 🔄 In-memory | 🌐 Network (local)         | 🌐 Network (remote)      |
| **Signature Verification**   | ✅ REQUIRED  | ⚠️ Optional (configurable) | ✅ REQUIRED              |
| **DPoP Enforcement**         | ✅ REQUIRED  | ✅ REQUIRED                | ✅ REQUIRED              |
| **Message Guard Signatures** | ❌ Disabled  | ⚠️ Optional                | ✅ REQUIRED              |
| **Audit Logging**            | 📝 Console   | 📝 File + Console          | 📊 Structured + Remote   |
| **Blockchain Anchoring**     | 🔄 In-memory | ⚠️ Testnet                 | ✅ Mainnet               |
| **Cache Behavior**           | ❌ Disabled  | ✅ Enabled                 | ✅ Enabled + Distributed |
| **Error Handling**           | 🔊 Verbose   | 🔊 Verbose                 | 🔇 Sanitized             |

### Legend

- ✅ **REQUIRED**: Must be enabled, enforced
- ❌ **FORBIDDEN/Disabled**: Must not occur or be bypassed
- ⚠️ **Optional/Configurable**: Can be toggled via environment variables
- 🔄 **In-memory**: Simulated locally without network
- 🌐 **Network**: External service call
- 📝 **Logging level**: Console, file, or structured

---

## Required Environment Variables

### Core Variables

| Variable         | TEST         | DEV           | PROD         | Default       | Description                   |
| ---------------- | ------------ | ------------- | ------------ | ------------- | ----------------------------- |
| `NODE_ENV`       | `test`       | `development` | `production` | `development` | Execution mode                |
| `CLUSTER_REGION` | `eu` or `us` | `eu` or `us`  | `eu` or `us` | `us`          | Geographic region (lowercase) |
| `CHAIN_DISABLED` | `true`       | `false`       | `false`      | `false`       | Disable blockchain anchoring  |

### Security & Trust

| Variable                            | TEST          | DEV           | PROD          | Default       | Description                           |
| ----------------------------------- | ------------- | ------------- | ------------- | ------------- | ------------------------------------- |
| `MESSAGING_GUARD_REQUIRE_SIGNATURE` | `false`       | `false`       | `true`        | `true`        | Require JWS signatures on messages    |
| `MESSAGING_GUARD_PUBLIC_KEY`        | -             | Optional      | **REQUIRED**  | -             | Public key for signature verification |
| `DPOP_ALGORITHMS`                   | `ES256,EdDSA` | `ES256,EdDSA` | `ES256,EdDSA` | `ES256,EdDSA` | Allowed DPoP algorithms               |

### External Services

| Variable             | TEST           | DEV                     | PROD         | Default                     | Description                    |
| -------------------- | -------------- | ----------------------- | ------------ | --------------------------- | ------------------------------ |
| `STATUS_URL`         | -              | `http://localhost:3001` | **REQUIRED** | `https://status.vitalcv.ai` | Status list service URL        |
| `PUBLIC_STATUS_URL`  | -              | Optional                | **REQUIRED** | -                           | Public-facing status URL       |
| `STATUS_LIST_ID`     | `default`      | `default`               | **REQUIRED** | `default`                   | Status list identifier         |
| `ISSUER_SIGNING_JWK` | Auto-generated | Auto-generated          | **REQUIRED** | -                           | Issuer signing key (EdDSA JWK) |

### Logging & Observability

| Variable     | TEST    | DEV      | PROD   | Default | Description       |
| ------------ | ------- | -------- | ------ | ------- | ----------------- |
| `LOG_LEVEL`  | `error` | `debug`  | `info` | `info`  | Minimum log level |
| `LOG_FORMAT` | `json`  | `pretty` | `json` | `json`  | Log output format |

---

## Trust Outcomes & Fail-Closed Rules

### Explicit Outcomes

All trust validation operations MUST return one of these explicit outcomes:

```typescript
type TrustOutcome =
  | 'VALID' // Cryptographic validation passed
  | 'REVOKED' // Credential revoked per status list
  | 'EXPIRED' // Credential past expiration date
  | 'INVALID_SIGNATURE' // Signature verification failed
  | 'INVALID_PROOF' // DPoP proof validation failed
  | 'UNCHECKABLE'; // Unable to verify (network down, missing config)
```

### Fail-Closed Policy

**Rule:** When trust cannot be established, REJECT the operation.

**Examples:**

#### Scenario 1: Status List Unreachable (PROD)

```typescript
// ❌ WRONG: Assume valid
if (!statusCheckResult) return 'VALID';

// ✅ CORRECT: Fail closed
if (!statusCheckResult) return 'UNCHECKABLE';
```

#### Scenario 2: Missing Signature Verification Key (PROD)

```typescript
// ❌ WRONG: Skip verification
if (!publicKey) return true;

// ✅ CORRECT: Reject operation
if (!publicKey) throw new Error('Signature verification key required in production');
```

#### Scenario 3: DPoP Proof Missing (ALL MODES)

```typescript
// ✅ CORRECT: DPoP always enforced
if (!dpopHeader) {
  return res.status(401).json({
    error: 'use_dpop',
    error_description: 'DPoP proof required',
  });
}
```

### Mode-Specific Outcomes

| Scenario                | TEST                | DEV                  | PROD                   |
| ----------------------- | ------------------- | -------------------- | ---------------------- |
| Status list fetch fails | `VALID` (in-memory) | `UNCHECKABLE` (warn) | `UNCHECKABLE` (reject) |
| Signature key missing   | Error (fail test)   | Warn + skip          | Error (reject request) |
| DPoP proof invalid      | 401 error           | 401 error            | 401 error              |
| Network timeout         | N/A (no network)    | `UNCHECKABLE` (warn) | `UNCHECKABLE` (reject) |

---

## Mode Checklist

### Before Merging Code

#### TEST Mode Requirements

- [ ] No `fetch()` or `http.request()` calls in test execution path
- [ ] No DNS lookups (getaddrinfo)
- [ ] All external services mocked or in-memory
- [ ] Tests pass in parallel (`vitest --parallel`)
- [ ] No file writes outside `os.tmpdir()`
- [ ] All randomness seeded or deterministic
- [ ] DPoP validation enforced (real signature verification)
- [ ] Status list allocation uses in-memory allocator

#### DEV Mode Requirements

- [ ] Fast iteration (<5s for most changes)
- [ ] Clear error messages with stack traces
- [ ] Optional mock toggles documented
- [ ] Local service URLs configurable via .env
- [ ] Signature verification can be disabled with warning
- [ ] Hot reload works for source changes

#### PROD Mode Requirements

- [ ] All environment variables validated at startup
- [ ] Fail-fast on missing required config
- [ ] Signature verification CANNOT be disabled
- [ ] DPoP enforcement CANNOT be disabled
- [ ] All network calls have timeouts (<30s)
- [ ] Rate limiting enabled
- [ ] Structured logging (JSON)
- [ ] Secrets never logged
- [ ] Error messages sanitized (no stack traces)
- [ ] Health check endpoint responds

---

## Pattern: Test-Safe In-Memory Adapters

### When to Use

Create an in-memory adapter when:

1. Feature requires external service in production
2. Tests must run without network access
3. Behavior is deterministic and stateful

### Implementation Pattern

```typescript
// ============================================================
// FILE: services/example/exampleService.ts
// ============================================================

/**
 * In-memory adapter for test mode
 * Simulates external service behavior without network calls
 */
class InMemoryExampleAdapter {
  private state: Map<string, any> = new Map();

  allocate(id: string): ExampleResult {
    if (this.state.has(id)) {
      return this.state.get(id); // Idempotent
    }

    const result = {
      id,
      index: this.state.size,
      timestamp: Date.now(),
    };

    this.state.set(id, result);
    return result;
  }

  clear(): void {
    this.state.clear();
  }

  // Expose for test assertions
  getState(id: string): any | null {
    return this.state.get(id) ?? null;
  }
}

// Singleton instance for test mode
const inMemoryAdapter = new InMemoryExampleAdapter();

/**
 * Clear in-memory state (exported for test cleanup)
 */
export function clearInMemoryState(): void {
  inMemoryAdapter.clear();
}

/**
 * Main service function with mode-aware behavior
 */
export async function allocateExample(id: string): Promise<ExampleResult> {
  if (!id) {
    throw new Error('id required for allocation');
  }

  // TEST MODE: Use in-memory adapter
  if (process.env.NODE_ENV === 'test') {
    return inMemoryAdapter.allocate(id);
  }

  // PROD/DEV MODE: Call external service
  const baseUrl = process.env.EXAMPLE_API_URL || 'https://api.example.com';

  try {
    const response = await fetch(`${baseUrl}/allocate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      throw new Error(`Allocation failed (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    // DEV: Warn and return UNCHECKABLE
    if (process.env.NODE_ENV === 'development') {
      console.warn('[DEV] Example service unreachable:', error);
      return { id, index: -1, uncheckable: true };
    }

    // PROD: Fail closed
    throw error;
  }
}
```

### Test Usage

```typescript
// ============================================================
// FILE: services/example/__tests__/exampleService.test.ts
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { allocateExample, clearInMemoryState } from '../exampleService';

describe('Example Service (TEST mode)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    clearInMemoryState(); // Reset state between tests
  });

  it('allocates with in-memory adapter', async () => {
    const result = await allocateExample('test-123');

    expect(result.id).toBe('test-123');
    expect(result.index).toBe(0);
  });

  it('is idempotent', async () => {
    const result1 = await allocateExample('test-123');
    const result2 = await allocateExample('test-123');

    expect(result1.index).toBe(result2.index);
  });

  it('never calls network', async () => {
    // If this test makes a network call, it will fail in CI
    // because DNS is blocked in test environments
    await allocateExample('test-456');
    // No network = no error
  });
});
```

### Pattern Checklist

When implementing a new in-memory adapter:

- [ ] Class contains all state (no module-level variables)
- [ ] Singleton instance created at module load
- [ ] `clear()` method exposed for test cleanup
- [ ] Behavior is deterministic (no Math.random(), Date.now() is OK)
- [ ] Idempotency preserved (same input = same output)
- [ ] Main function checks `NODE_ENV === 'test'` first
- [ ] Production path has timeout (`AbortSignal.timeout()`)
- [ ] Export `clearInMemory*()` function for test use
- [ ] Test file imports and calls cleanup in `beforeEach`
- [ ] No network calls observable in test execution

---

## Enforcement Mechanisms

### 1. Static Analysis

```bash
# Detect network calls in test files
grep -r "fetch\|http\\.request\|axios" "**/__tests__/**/*.ts"

# Detect missing NODE_ENV checks before network calls
grep -r "fetch(" "services/**/*.ts" | grep -v "NODE_ENV"
```

### 2. Runtime Guards

```typescript
// Guard: Prevent network calls in test mode
if (process.env.NODE_ENV === 'test') {
  global.fetch = () => {
    throw new Error('Network calls forbidden in test mode');
  };
}
```

### 3. CI Checks

```yaml
# .github/workflows/test.yml
- name: Run tests with network blocked
  run: |
    # Block DNS in CI
    echo "127.0.0.1 status.vitalcv.ai" | sudo tee -a /etc/hosts
    pnpm test
```

---

## Migration Guide

### Adding Mode Awareness to Existing Code

#### Step 1: Identify Network Dependencies

```bash
# Find all fetch() calls
grep -rn "fetch(" services/ apps/
```

#### Step 2: Extract to Service Module

```typescript
// Before: Inline fetch
const result = await fetch('https://api.example.com/data');

// After: Service function
const result = await fetchExampleData();
```

#### Step 3: Add In-Memory Adapter

Follow the pattern above to create mode-aware behavior.

#### Step 4: Update Tests

```typescript
import { clearInMemoryExample } from '../exampleService';

beforeEach(() => {
  clearInMemoryExample();
});
```

---

## FAQ

### Q: Can I disable DPoP in dev mode?

**A:** No. DPoP enforcement is ALWAYS required across all modes. This ensures test coverage of DPoP logic.

### Q: What if my test needs to verify network error handling?

**A:** Use a mock implementation that simulates errors:

```typescript
// In test
if (process.env.SIMULATE_NETWORK_ERROR === 'true') {
  throw new Error('Simulated network failure');
}
```

### Q: How do I test fail-closed behavior?

**A:** Set up conditions that trigger `UNCHECKABLE` outcome and assert rejection:

```typescript
it('fails closed when service unreachable', async () => {
  process.env.SIMULATE_NETWORK_ERROR = 'true';

  await expect(verifyCredential(vc)).rejects.toThrow('UNCHECKABLE');
});
```

### Q: Can I use `NODE_ENV=local` for development?

**A:** No. Only `test`, `development`, and `production` are recognized. Use `development`.

---

## Version History

| Version | Date       | Changes        |
| ------- | ---------- | -------------- |
| 1.0.0   | 2026-01-12 | Initial policy |

---

## References

- [Status List In-Memory Allocator](../apps/issuer-api/src/services/statusList.ts)
- [DPoP Guard Middleware](../apps/issuer-api/src/middleware/dpopGuard.ts)
- [Messaging Guard Configuration](../apps/issuer-api/src/middleware/guard.ts)

---

**Policy Owner:** VitalCV Engineering
**Review Cycle:** Quarterly
**Enforcement:** CI/CD + Code Review
