# Monorepo Refactoring Guide

## Overview

This guide helps developers refactor code to use shared packages and workspace imports.

## Shared Packages

### @vitalcv/shared-utils

Common utilities, validation schemas, and types used across frontend and backend.

**Location**: `packages/shared-utils/`

**Available exports**:
- `isValidNpi(npi: string): boolean` - NPI validation
- `formatNpi(npi: string): string` - NPI formatting
- `npiSchema` - Zod schema for NPI validation
- `emailSchema` - Zod schema for email validation
- `phoneSchema` - Zod schema for phone validation
- `ApiResponse<T>` - Generic API response type
- `PaginationParams` - Pagination parameters
- `PaginatedResponse<T>` - Paginated response type

**Usage**:
```typescript
import { isValidNpi, formatNpi, npiSchema } from '@vitalcv/shared-utils';
import type { ApiResponse, PaginatedResponse } from '@vitalcv/shared-utils';
```

## Import Path Guidelines

### ✅ Use Workspace Aliases

**Good**:
```typescript
import { isValidNpi } from '@vitalcv/shared-utils';
import { something } from '@api/services/auth';
import { Component } from '@web/components/ui';
```

### ❌ Avoid Deep Relative Imports

**Bad**:
```typescript
import { something } from '../../../../services/auth';
import { Component } from '../../../components/ui';
```

**Good**:
```typescript
import { something } from '@api/services/auth';
import { Component } from '@web/components/ui';
```

## Refactoring Steps

### Step 1: Identify Duplicated Code

Look for:
- Validation functions (NPI, email, phone, etc.)
- Utility functions (formatting, parsing, etc.)
- Type definitions
- Constants

### Step 2: Move to Shared Package

1. Add code to appropriate package in `packages/`
2. Export from `packages/*/src/index.ts`
3. Update package.json if needed

### Step 3: Update Imports

1. Add workspace dependency to `package.json`:
   ```json
   {
     "dependencies": {
       "@vitalcv/shared-utils": "workspace:*"
     }
   }
   ```

2. Replace local imports:
   ```typescript
   // Before
   import { isValidNpi } from '../lib/npi';

   // After
   import { isValidNpi } from '@vitalcv/shared-utils';
   ```

3. Remove old files (after verifying all imports updated)

### Step 4: Test

1. Run typecheck: `pnpm typecheck`
2. Run build: `pnpm build`
3. Run tests: `pnpm test`

## Backend-Specific Refactoring

### NPI Validation

The backend has a more comprehensive NPI validator (`apps/api/api/src/lib/npi-validator.ts`) with:
- Detailed error messages
- Validation result objects
- Error throwing capabilities

**Options**:
1. **Keep backend version** - If the advanced features are needed, keep the backend-specific version
2. **Enhance shared package** - Move advanced features to shared-utils if they're useful across apps
3. **Hybrid approach** - Use shared-utils for basic validation, extend in backend for advanced features

**Recommended**: Option 3 - Use shared-utils for basic checks, keep backend validator for detailed validation.

```typescript
// In backend
import { isValidNpi } from '@vitalcv/shared-utils';

export function validateNpi(npi: string): NpiValidationResult {
  // Use shared for basic check
  if (!isValidNpi(npi)) {
    return { valid: false, reason: 'checksum' };
  }
  // Add backend-specific validation logic
  // ...
}
```

## Frontend-Specific Refactoring

### Component Extraction

Move shared UI components to `packages/ui`:

1. Create component in `packages/ui/src/components/`
2. Export from `packages/ui/src/index.ts`
3. Update frontend imports:
   ```typescript
   // Before
   import { Button } from '../components/ui/button';

   // After
   import { Button } from '@vitalcv/ui';
   ```

## TypeScript Path Aliases

### Available Aliases

**From root tsconfig.base.json**:
- `@api/*` → `apps/api/src/*`
- `@web/*` → `apps/web/src/*` or `apps/web/app/*`
- `@packages/*` → `packages/*/src` or `packages/*`
- `@schemas/*` → `packages/vc-schemas/src/*`
- `@shared-utils/*` → `packages/shared-utils/src/*`
- `@ui/*` → `packages/ui/src/*`

### Usage in tsconfig.json

Each app's `tsconfig.json` should extend the base:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Common Patterns

### API Response Types

**Before**:
```typescript
// Defined in multiple places
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

**After**:
```typescript
import type { ApiResponse } from '@vitalcv/shared-utils';

function fetchData(): Promise<ApiResponse<User>> {
  // ...
}
```

### Validation Schemas

**Before**:
```typescript
// Frontend
const npiSchema = z.string().regex(/^\d{10}$/);

// Backend
const npiSchema = z.string().regex(/^\d{10}$/);
```

**After**:
```typescript
import { npiSchema } from '@vitalcv/shared-utils';

// Use in both frontend and backend
```

## Migration Checklist

- [ ] Identify duplicated code
- [ ] Create/update shared package
- [ ] Add workspace dependency to package.json
- [ ] Update imports to use shared package
- [ ] Remove old duplicated code
- [ ] Update tests
- [ ] Run typecheck
- [ ] Run build
- [ ] Run tests
- [ ] Update documentation

## Tools

### Import Scanner

Scan for import issues:
```bash
pnpm scan:imports
```

This will identify:
- Broken imports
- Deep relative imports (../../../../)
- Non-workspace imports

### Type Checking

Check TypeScript errors:
```bash
pnpm typecheck
```

### Build Verification

Verify builds work:
```bash
pnpm build
```

## Examples

### Example 1: NPI Validation (Frontend)

**Before** (`apps/web/lib/npi.ts`):
```typescript
export function isValidNpi(npi: string): boolean {
  // ... implementation
}
```

**After**:
```typescript
// apps/web/lib/npi.ts (deprecated, re-exports)
export { isValidNpi, formatNpi } from '@vitalcv/shared-utils';

// Or directly in components:
import { isValidNpi } from '@vitalcv/shared-utils';
```

### Example 2: API Types

**Before**:
```typescript
// Defined in multiple files
interface Response<T> {
  data: T;
  error?: string;
}
```

**After**:
```typescript
import type { ApiResponse } from '@vitalcv/shared-utils';

function getData(): Promise<ApiResponse<User>> {
  // ...
}
```

## Best Practices

1. **Start Small**: Begin with simple utilities (validation, formatting)
2. **Test Thoroughly**: Ensure shared code works in all contexts
3. **Document Changes**: Update README and migration guides
4. **Incremental Migration**: Don't try to refactor everything at once
5. **Backward Compatibility**: Keep re-exports during transition period

## Questions?

- Check `packages/shared-utils/src/` for available utilities
- See `NEXT_STEPS.md` for overall migration status
- Review `docs/architecture/monorepo-migration.md` for structure overview

