# @vitalcv/domain-common

This package enforces the VitalCV canonical path:
**Recognition → Acceptance → Start**.

Any attempt to start employment without this path is invalid by design.

## Canonical Path Enforcement

The canonical path is enforced at three levels:

1. **Type-level**: `VerifiedCanonicalPath` branded type prevents bypasses at compile-time
2. **Domain guards**: `verifyCanonicalPath()` validates the complete path at runtime
3. **Authority primitive**: `emitStartAttestation()` is the sole constructor for employment start

## Invariants

- Recognition must be employer-signed (no self-reported offers)
- Acceptance must be countersigned by both employer and practitioner
- Start attestation must be employer-signed (no self-reported starts)
- Timestamps must be ordered: `recognizedAt < acceptedAt < actualStartDate`
- All DIDs must match across all events

## Usage

```typescript
import {
  verifyCanonicalPath,
  type VerifiedCanonicalPath
} from '@vitalcv/domain-common';

// Validate a complete canonical path
const verifiedPath: VerifiedCanonicalPath = verifyCanonicalPath({
  recognition,
  acceptance,
  start
});

// This branded type can only be created by passing validation
// No forgery possible - compiler enforces it
```

See `packages/domain-authority/` for the live primitives that create employment events.
