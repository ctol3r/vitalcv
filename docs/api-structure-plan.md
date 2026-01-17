# API Structure Normalization Plan

## Current Structure

The API currently has routes organized in `apps/api/api/src/routes/` with many individual route files.

## Proposed Structure

```text
apps/api/api/src/
├── modules/
│   ├── auth/
│   │   ├── routes.ts
│   │   ├── controller.ts
│   │   ├── service.ts
│   │   └── types.ts
│   ├── credentials/
│   │   ├── routes.ts
│   │   ├── controller.ts
│   │   ├── service.ts
│   │   └── types.ts
│   ├── compliance/
│   │   ├── routes.ts
│   │   ├── controller.ts
│   │   ├── service.ts
│   │   └── types.ts
│   ├── identity/
│   │   ├── routes.ts
│   │   ├── controller.ts
│   │   ├── service.ts
│   │   └── types.ts
│   └── ...
├── routes/
│   └── index.ts (legacy routes, to be migrated)
└── server.ts
```

## Migration Strategy

### Phase 1: Identify Domain Modules

Group related routes by domain:

- **Auth**: Authentication, authorization, OIDC
- **Credentials**: VC issuance, verification, revocation
- **Compliance**: NCQA, TJC, PSV
- **Identity**: NPI, identity fusion, verification
- **Admin**: Admin operations, exams, issuer management
- **Operations**: Health checks, metrics, monitoring

### Phase 2: Create Module Structure

For each module:

1. Create `modules/{module}/` directory
2. Move related routes to `routes.ts`
3. Extract controller logic to `controller.ts`
4. Extract business logic to `service.ts`
5. Define types in `types.ts`

### Phase 3: Update Imports

Update all imports to use new module structure:

```typescript
// Before
import { verifyCredential } from '../routes/vc-verify';

// After
import { verifyCredential } from '../modules/credentials/controller';
```

### Phase 4: Cleanup

Remove old route files after migration is complete.

## Example: Credentials Module

```typescript
// modules/credentials/routes.ts
import { Router } from 'express';
import * as controller from './controller';

const router = Router();

router.post('/verify', controller.verifyCredential);
router.post('/revoke', controller.revokeCredential);
router.get('/:id', controller.getCredential);

export default router;
```

```typescript
// modules/credentials/controller.ts
import { Request, Response } from 'express';
import * as service from './service';
import { ErrorHandler, ValidationError } from '@vitalcv/shared-utils';

export async function verifyCredential(req: Request, res: Response) {
  try {
    const result = await service.verifyCredential(req.body);
    res.json(result);
  } catch (error) {
    ErrorHandler.logError(error);
    const safeError = ErrorHandler.toSafeError(error);
    res.status(safeError.statusCode).json({ error: safeError });
  }
}
```

## Benefits

1. **Better Organization**: Related code grouped together
2. **Easier Testing**: Modules can be tested independently
3. **Clearer Dependencies**: Explicit service/controller separation
4. **Scalability**: Easy to add new modules
5. **Maintainability**: Easier to find and modify code

## Implementation Notes

- This is a **large refactoring** that should be done incrementally
- Start with one module as a proof of concept
- Keep legacy routes working during migration
- Update tests as modules are migrated
- Document each module's API surface

## Status

**Status**: Planning phase
**Priority**: Medium (can be done incrementally)
**Estimated Effort**: Large (weeks of work)
