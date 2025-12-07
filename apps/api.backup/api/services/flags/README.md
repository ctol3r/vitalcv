# Feature Flags Service

## Overview

Feature flag system with multi-level scoping (GLOBAL, ORG, USER) and in-memory caching for fast evaluation.

## Components

### 1. FeatureFlag Model (B149A-FF-001)

Database model for feature flags with:
- `key`: Unique identifier (e.g., 'applyWithVC', 'eudiVerify')
- `description`: Human-readable description
- `defaultValue`: Default value (JSON - can be boolean, string, number, object, array)
- `allowedValues`: Optional array of allowed values for validation
- `scope`: GLOBAL, ORG, or USER

### 2. Feature Flag Service (B149A-FF-002)

**File**: `services/flags/featureFlagService.ts`

**Functions**:
- `getFlag(prisma, key, context)`: Get flag value with precedence: org → user → global
- `getAllFlags(prisma, context)`: Get all flags with resolved values
- `clearCache(key?)`: Clear cache for a flag or all flags

**Caching**: Results cached per process for 60 seconds

**Example**:
```typescript
import { getFlag } from 'services/flags/featureFlagService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get flag value for a specific org and user
const result = await getFlag(prisma, 'applyWithVC', {
  orgId: 'org-123',
  userId: 'user-456',
});

console.log(result.value); // true/false/string/etc
console.log(result.source); // 'org' | 'user' | 'global'
```

### 3. Kill Switch (B149A-FF-006)

**File**: `services/flags/killSwitch.ts`

Fast in-memory kill switch for instant feature disabling.

**Functions**:
- `killSwitch(key)`: Disable feature instantly
- `reviveSwitch(key)`: Re-enable feature
- `isKilled(key)`: Check if feature is killed
- `isFeatureEnabled(getFlagFn, key)`: Guard function that checks killset before DB

**Example**:
```typescript
import { killSwitch, isFeatureEnabled, getFlag } from 'services/flags';

// Kill a feature instantly
killSwitch('applyWithVC');

// Use guard function
const enabled = await isFeatureEnabled(
  () => getFlag(prisma, 'applyWithVC', { orgId: 'org-1' }),
  'applyWithVC'
);
// Returns false (killed) even if DB says true
```

### 4. Admin API (B149A-FF-003)

**File**: `apps/api/src/routes/admin/flags.ts`

**Endpoints**:
- `GET /api/admin/flags`: List all flags with values
- `GET /api/admin/flags/:key`: Get specific flag
- `PATCH /api/admin/flags/:key`: Update flag value or override

**Protected by**: Admin role check

**Example**:
```bash
# List all flags
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/admin/flags

# Update global default
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": false, "scope": "global"}' \
  http://localhost:4000/api/admin/flags/applyWithVC

# Set org override
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": true, "scope": "org", "orgId": "org-123"}' \
  http://localhost:4000/api/admin/flags/ehrFacade
```

### 5. Seed Data (B149A-FF-007)

**File**: `db/seeds/seedFeatureFlags.ts`

Seeds initial critical flags:
- `applyWithVC`: Enable VC workflow (default: true)
- `eudiVerify`: Enable EUDI wallet (default: false)
- `ehrFacade`: Enable EHR integration (default: true, scope: ORG)
- `payerEnrollments`: Enable payer workflows (default: true, scope: ORG)
- `notifications`: Enable notifications (default: true)

**Usage**:
```bash
npx ts-node db/seeds/seedFeatureFlags.ts
```

## Precedence

Flag evaluation follows this precedence (highest to lowest):
1. **Kill switch** (if killed, always returns false)
2. **Org override** (if orgId provided and override exists)
3. **User override** (if userId provided and override exists)
4. **Global default** (from FeatureFlag.defaultValue)

## Migration

To create the database migration:

```bash
cd backend
npx prisma migrate dev --name add_feature_flags
npx prisma generate
```

## Testing

Run tests:
```bash
npm test -- services/flags/__tests__/
```

## Usage in Code

```typescript
import { getFlag } from 'services/flags/featureFlagService';
import { isFeatureEnabled, killSwitch } from 'services/flags/killSwitch';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simple check
const flag = await getFlag(prisma, 'applyWithVC', {
  orgId: req.orgId,
  userId: req.user?.id,
});

if (flag.value) {
  // Feature is enabled
}

// With kill switch guard
const enabled = await isFeatureEnabled(
  () => getFlag(prisma, 'applyWithVC', { orgId: req.orgId }),
  'applyWithVC'
);

if (enabled) {
  // Feature is enabled (not killed)
}
```

