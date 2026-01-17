# Monorepo Migration Documentation

## Overview

This document outlines the migration of VitalCV from separate repositories to a unified monorepo structure.

## Migration Date

December 2024

## Structure

```text
vitalcv/
├── apps/
│   ├── api/          # Backend API
│   ├── web/          # Frontend Next.js
│   ├── issuer-api/   # OIDC4VCI Issuer API
│   ├── verifier-api/ # OIDC4VP Verifier API
│   └── ...
├── packages/         # Shared packages
│   ├── shared-utils/
│   ├── vc-schemas/
│   ├── compliance-core/
│   └── ...
├── blockchain/        # Substrate/blockchain integration
├── services/         # Shared services
└── docs/            # Documentation
```

## Rationale

1. **Code Sharing**: Enable sharing of types, utilities, and schemas between frontend and backend
2. **Consistency**: Unified tooling, linting, and formatting
3. **Developer Experience**: Single repository, unified CI/CD
4. **Type Safety**: Shared TypeScript types across the stack

## Package Organization

### Apps

- `@vitalcv/api` - Main backend API
- `@vitalcv/web` - Frontend application
- `@vitalcv/issuer-api` - Credential issuer
- `@vitalcv/verifier-api` - Credential verifier

### Packages (Planned)

- `@vitalcv/shared-utils` - Common utilities
- `@vitalcv/vc-schemas` - Verifiable Credential schemas
- `@vitalcv/compliance-core` - Compliance logic
- `@vitalcv/psv-pipeline` - Provider Screening and Verification
- `@vitalcv/ai-engines` - AI/ML engines
- `@vitalcv/ui` - Shared UI components

## Build System

- **Package Manager**: pnpm 8+
- **Build Tool**: Turborepo
- **TypeScript**: Shared base config with project references

## Migration Steps Completed

1. ✅ Created monorepo root structure
2. ✅ Moved backend repo into `/apps/api`
3. ✅ Moved frontend repo into `/apps/web`
4. ✅ Configured pnpm workspaces
5. ✅ Set up Turborepo
6. ✅ Created base TypeScript configuration

## Next Steps

1. Extract shared code into packages
2. Update import paths to use workspace aliases
3. Update CI/CD pipelines
4. Normalize API structure
5. Extract UI components
6. Run full build and test suite

## Import Paths

Use workspace aliases for cross-package imports:

```typescript
// From packages
import { something } from '@vitalcv/shared-utils';
import { VC } from '@vitalcv/vc-schemas';

// From apps (when needed)
import { apiType } from '@vitalcv/api/types';
```

## Future Scaling

- Add more apps as needed (admin panel, mobile apps, etc.)
- Extract more shared logic into packages
- Consider micro-frontends architecture if needed
