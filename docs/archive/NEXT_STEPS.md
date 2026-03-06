# Next Steps for Monorepo Completion

## ✅ Completed

1. ✅ Monorepo root structure created
2. ✅ Backend and frontend moved into apps/
3. ✅ pnpm workspaces configured
4. ✅ Turborepo configured
5. ✅ TypeScript path aliases updated
6. ✅ CI/CD workflow created
7. ✅ Shared packages structure created
8. ✅ Dockerfiles created
9. ✅ Import scanning script created

## 🔄 Immediate Next Steps

### 1. Install Dependencies
```bash
cd /Users/christoler/vitalcv
pnpm install
```

### 2. Test Build
```bash
# Build all packages
pnpm build

# Or build specific packages
pnpm turbo run build --filter='./packages/*'
pnpm turbo run build --filter='@vitalcv/api'
pnpm turbo run build --filter='@vitalcv/web'
```

### 3. Scan for Import Issues
```bash
pnpm scan:imports
```

This will identify:
- Broken imports
- Deep relative imports (../../../../)
- Non-workspace imports that should use @vitalcv/*

### 4. Update Package Dependencies

Update `apps/api/api/package.json` and `apps/web/package.json` to use workspace dependencies:

```json
{
  "dependencies": {
    "@vitalcv/shared-utils": "workspace:*"
  }
}
```

### 5. Refactor Imports

Start replacing duplicated code with imports from shared packages:

**Before:**
```typescript
// In both frontend and backend
function isValidNpi(npi: string) { ... }
```

**After:**
```typescript
// Use shared package
import { isValidNpi } from '@vitalcv/shared-utils';
```

## 📋 Remaining Tasks

### High Priority

1. **MERGE-008**: Refactor API imports for monorepo
   - Update imports in `apps/api/api/` to use workspace aliases
   - Replace relative imports with `@api/*`, `@packages/*`

2. **MERGE-009**: Refactor frontend imports for monorepo
   - Update imports in `apps/web/` to use workspace aliases
   - Replace relative imports with `@web/*`, `@packages/*`

3. **MERGE-014**: Unify scripts across repo
   - Consolidate build scripts
   - Standardize test scripts
   - Create unified dev script

### Medium Priority

4. **MERGE-015**: Normalize API controllers
   - Restructure into `/apps/api/api/src/modules/*`
   - Organize by domain/feature

5. **MERGE-016**: Extract UI components
   - Move shared components to `packages/ui`
   - Update frontend to import from `@vitalcv/ui`

6. **MERGE-017**: Add error-handling middleware
   - Create `packages/shared-utils/src/errors.ts`
   - Implement shared error classes
   - Apply in both API and web

### Lower Priority

7. **MERGE-012**: Integrate blockchain folder
   - Verify blockchain code is in correct location
   - Update imports if needed

8. **MERGE-019**: Remove legacy artifacts
   - Clean up old configs
   - Remove duplicate files
   - Standardize documentation

9. **MERGE-020**: Run full build and test pipeline
   - Fix any build errors
   - Ensure all tests pass
   - Verify CI/CD works

10. **MERGE-023**: Scan for compliance-sensitive files
    - Identify PHI/PII handling
    - Verify no data leaks in imports

## 🛠️ Development Workflow

### Starting Development
```bash
# Start all apps
pnpm dev

# Start specific app
pnpm --filter @vitalcv/api dev
pnpm --filter @vitalcv/web dev
```

### Building
```bash
# Build everything
pnpm build

# Build specific package/app
pnpm turbo run build --filter='@vitalcv/shared-utils'
pnpm turbo run build --filter='@vitalcv/api'
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm turbo run test --filter='@vitalcv/shared-utils'
```

## 📝 Notes

- The backend has a nested structure (`apps/api/api/`) which may need flattening later
- Some packages already exist in the backend repo - consider moving them to `/packages`
- TypeScript path aliases are configured but may need adjustment based on actual usage
- CI/CD workflow is basic - customize deployment steps as needed

## 🚀 Quick Start Checklist

- [ ] Run `pnpm install`
- [ ] Run `pnpm build` to verify structure
- [ ] Run `pnpm scan:imports` to find issues
- [ ] Fix critical broken imports
- [ ] Update package.json files to use workspace dependencies
- [ ] Test `pnpm dev` to ensure apps start
- [ ] Run `pnpm test` to verify tests work
- [ ] Commit and push to trigger CI/CD

