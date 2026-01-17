# LS1-0: Baseline Snapshot

**Date:** 2026-01-12
**Status:** COMPLETE

## Repository Structure Analysis

### Workspace Packages (from pnpm-workspace.yaml)

```yaml
packages:
  - apps/*
  - packages/*
  - services/* # ⚠️ Single package, not per-service
  - blockchain/*
```

### Key Findings

#### 1. Services Boundary Violations

**Current State:**

- `/services/` is a SINGLE workspace package (`@vitalcv/services`)
- Contains 107 subdirectories (compacts, logging, org, identity, etc.)
- Subdirectories are NOT separate packages - they're internal modules
- Apps import using deep relative paths: `../../../../services/compacts/euRegionMap`

**Problem:**

- `services/package.json` only declares `zod` as dependency
- Individual service modules have undeclared npm dependencies:
  - `services/logging` needs `@chai-vc/logging-core` ❌
  - `services/compacts` needs `zod` ✅ (declared at parent level)
  - `services/org` needs `zod` ✅

**Import Pattern:**

```typescript
// apps/issuer-api/src/services/eudiIssuer.ts
import { Region } from '../../../../services/org/models/region-types';
import { isEudiEligible } from '../../../../services/compacts/euRegionMap';
import { getActiveSigningKey } from '../../../../services/identity/signingKeyProvider';
```

#### 2. Build/Test Graph Pain Points

**Turbo Configuration:**

- Already using Turbo 2.x `tasks` format ✅
- **PROBLEM:** `test: dependsOn: ["^build"]` forces full repo build before ANY test
- **PROBLEM:** `typecheck: dependsOn: ["^build"]` blocks type checking on build completion

**Current Coupling:**

```json
{
  "test": {
    "dependsOn": ["^build"], // ⚠️ Forces full workspace build
    "outputs": ["coverage/**"],
    "cache": false
  }
}
```

#### 3. Compiled Artifacts Status

**CLEAN:** ✅

- No `.js` files shadowing `.ts` sources in `/services`
- Only `.d.ts` declaration files present (expected from compilation)
- No build artifacts causing resolution conflicts

#### 4. Cross-Boundary Import Violations

**Apps → Services Imports:**

```text
apps/issuer-api/src/services/eudiIssuer.ts         → services/org, services/compacts
apps/issuer-api/src/oidc4vci/routes.ts             → services/identity
apps/issuer-api/src/services/sdJwtIssuer.ts        → services/*
apps/issuer-api/src/services/clinicianIdentityIssuer.ts → services/*
apps/issuer-api/src/services/compactsStatusIssuer.ts → services/compacts
```

**Issue:** Apps don't declare `@vitalcv/services` as dependency, relying on relative path resolution

#### 5. Test Environment Issues (FIXED)

**Previously Fixed:**

- ✅ Status list allocation now uses in-memory allocator for NODE_ENV=test
- ✅ DPoP validation working with proper path resolution
- ✅ Messaging guard test mode enabled
- ✅ Region validation case-sensitive matching

## Workspace Packages Inventory

### Apps (11 packages)

- `apps/web`, `apps/issuer-api`, `apps/verifier-api`, `apps/api/*`, `apps/status-api`, `apps/authz`, `apps/admin-api`, `apps/router`

### Packages (18 packages)

- All in `packages/*` have proper `package.json`
- Dependencies correctly declared
- Workspace protocol used (`workspace:*`, `workspace:^`)

### Services (1 mega-package)

- **Name:** `@vitalcv/services`
- **Subdirs:** 107 directories, NO individual package.json files
- **Dependencies:** Only `zod` declared
- **Problem:** Transitive dependency leakage from consuming apps

### Blockchain

- Separate workspace area (out of scope for LS1)

## Violation Patterns to Detect

### Pattern 1: Deep Relative Imports to Services

```typescript
// BAD
import { X } from '../../../../services/foo/bar';

// GOOD
import { X } from '@vitalcv/services/foo/bar';
```

### Pattern 2: Undeclared Service Dependencies

- Service module uses npm package
- Package not in `services/package.json` dependencies
- Relies on transitive resolution from consuming app

### Pattern 3: Test Depends On Build

```json
// BAD
"test": { "dependsOn": ["^build"] }

// GOOD (for most tests)
"test": { "dependsOn": [] }  // or ["^build"] only if truly needed
```

## Metrics

**Workspace Packages:**

- Apps: 11
- Packages: 18
- Services: 1 (mega-package with 107 subdirs)
- Total: 30 packages

**Import Violations:**

- Deep relative imports to services: ~5 files in issuer-api alone
- Estimated total: 20-50 files across all apps

**Build Coupling:**

- Test blocked on build: 100% of workspaces
- Typecheck blocked on build: 100% of workspaces

## Next Steps (LS1-1)

1. **Bundle A (Scanner):** Create violation detection scripts
2. **Bundle B (Fixer):** Fix highest-frequency violations
3. **Validation:** Measure violation reduction

---

**Generated:** 2026-01-12T16:30:00Z
**Tool:** Claude Code LS1-0 Baseline
