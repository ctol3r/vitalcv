# Test Investigation Summary

## Executive Summary

Attempted to fix issuer-api test failures (19 tests) as described in RELEASE_NOTES.md Phase 1. Discovered that **the actual test failures differ from what was described** in the previous session summary, and **the issuer-api build has extensive blocking issues** that prevent tests from running without a cached build.

## Key Findings

### 1. Messaging-Guard Build Fixed ✅

**Issue**: `packages/messaging-guard/src/schema.ts` was missing
**Fix**: Created stub file with validation functions:
- `formatZodError(error: unknown): string`
- `validateGuardConfig(config: unknown): { valid: boolean; error?: string }`
- `validateMessageEnvelope(envelope: unknown): { valid: boolean; error?: string }`

**Status**: ✅ Committed in `4ccabb65`

### 2. Issuer-API TSConfig Fixed ✅

**Issue**: `apps/issuer-api/tsconfig.json` had invalid project references:
- `../../backend` (doesn't exist)
- `../../services` (invalid path)

**Fix**: Removed invalid `references` array from tsconfig.json

**Status**: ✅ Committed in `4ccabb65`

### 3. Issuer-API Build Blocking Issues ❌

**Current State**: Tests CANNOT run because issuer-api fails to build

**Build Errors** (50+ errors):

#### Missing Dependencies
- `@types/cors` - Missing type definitions
- `@prisma/client` - Database client not installed
- `@chai-vc/logging-core` - Workspace package missing
- `@chai-vc/metrics-core` - Import resolution issues
- `prom-client` - Prometheus client not installed
- `@noble/ed25519` - Cryptography library not installed

#### Invalid Import Paths
- `../../../api/config/security-loader` - Referenced in `dpopGuard.ts:3` but doesn't exist
- `./services/jwksUpdater` - Referenced in `index.ts:6` but doesn't exist
- `../../../../services/identity/signingKeyProvider` - Path outside rootDir
- `../../../backend/db/prismaInstrumentation` - Invalid path
- `../../../packages/redis-client/tracing` - Invalid path

#### rootDir Violations
Multiple files import from `services/` directory which is outside the `apps/issuer-api/src` rootDir:
- `services/compacts/euRegionMap.ts`
- `services/audit/compactsEvents.ts`
- `services/org/models/TenantRegion.ts`
- `services/observability/nodeTracing.ts`
- `services/logging/serviceLogger.ts`
- `services/compacts/models/*`

These imports violate TypeScript's `rootDir` constraint.

### 4. Test Failures Analysis (From Cached Build) ⚠️

When tests ran with a cached build (before my changes), the failures were:

#### dpopGuard.test.ts (14 failures)
**Type**: Assertion mismatches on error message content
**Root Cause**: Tests expect specific error message substrings, but implementation returns different messages

Examples:
- Test expects: `StringContaining "sender-constrained tokens"`
- Actual: `"DPoP proof is required. Bearer-only tokens are rejected..."`

- Test expects: `StringContaining "signature verification failed"`
- Actual: `"Access token missing cnf.jkt claim (required for credential endpoints)"`

**Note**: The `req.originalUrl` issue mentioned in the previous session summary does NOT exist in the current code. The implementation uses `req.path.includes()` not `req.originalUrl.includes()`.

#### allowedSinksEnforcer.test.ts (4 failures)
**Type**: Assertion mismatches on response field names
**Root Cause**: Tests expect `receiptHash` field, implementation returns `receiptId` and `requestId`

Example:
```javascript
// Test expects:
{ error: 'MESSAGE_DENIED', receiptHash: expect.any(String) }

// Implementation returns:
{ error: 'MESSAGE_DENIED', receiptId: "...", requestId: "..." }
```

#### Other Test Failures
- `dpop-global-enforcement.test.ts`: `describe is not defined` (missing vitest imports)
- `allowedSinksEnforcer.test.ts`: Module resolution errors
- `routes.test.ts`: `supertest` module not found
- `eudiIssuer.test.ts`: Circular dependency initialization error

## Why Tests Were Running Before

The tests in the background bash processes (from previous session) were running because:
1. Turbo build cache had valid builds from an earlier working state
2. Cache hits allowed tests to run without rebuilding: `@vitalcv/messaging-guard:build: cache hit`
3. My changes invalidated the cache, exposing the underlying build failures

## Recommended Next Steps

### Immediate (Unblock Tests)
1. **Install missing npm packages** in `apps/issuer-api/package.json`:
   ```json
   {
     "dependencies": {
       "@prisma/client": "^5.x",
       "@noble/ed25519": "^2.x",
       "prom-client": "^15.x"
     },
     "devDependencies": {
       "@types/cors": "^2.x",
       "supertest": "^6.x",
       "@types/supertest": "^2.x"
     }
   }
   ```

2. **Create missing config module**: `apps/issuer-api/src/config/security-loader.ts`
   ```typescript
   export function getTenantMtlsConfig(tenantId?: string) { /* ... */ }
   export function isDpopRequired() { /* ... */ }
   export function getDpopAlgorithms() { /* ... */ }
   ```

3. **Fix rootDir violations** - Either:
   - Option A: Move `services/` into `apps/issuer-api/src/`
   - Option B: Add `../../services` to tsconfig `include` array
   - Option C: Create proper workspace packages for shared services

### Short-term (Fix Test Assertions)
1. Update dpopGuard test assertions to match actual error messages
2. Update allowedSinksEnforcer test assertions (receiptHash → receiptId/requestId)
3. Add missing vitest imports to dpop-global-enforcement.test.ts

### Medium-term (Architecture)
1. Resolve circular dependencies in eudiIssuer
2. Establish clear import boundaries between apps and services
3. Consider workspace package structure for shared code

## Files Modified

### Committed (main branch)
- `packages/messaging-guard/src/schema.ts` - Created stub validation functions
- `apps/issuer-api/tsconfig.json` - Removed invalid project references

### Uncommitted
- Multiple `.js` and `.d.ts` files in `services/` from partial builds (should be gitignored)

## Current Branch Status
- Branch: `main`
- Last commit: `4ccabb65` - "fix: add missing schema.ts stub..."
- v0.1-yc-mvp tag: Present and pushed

## Test Status Summary

| Package | Status | Blocker |
|---------|--------|---------|
| messaging-guard | ✅ Build passes | Tests have 5 failures (assertion mismatches) |
| issuer-api | ❌ Build fails | 50+ TypeScript errors |
| dpopGuard tests | ⏸️ Cannot run | Build failure |
| allowedSinksEnforcer tests | ⏸️ Cannot run | Build failure |

## Conclusion

The Phase 1 task "Fix issuer-api test failures (19 tests)" **cannot be completed** without first:
1. Resolving issuer-api build dependencies
2. Fixing import path structure
3. Resolving rootDir violations

The test assertions themselves appear straightforward to fix once the build succeeds.

**Recommendation**: Prioritize dependency installation and import path fixes before test assertion updates.
