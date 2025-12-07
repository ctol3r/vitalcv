# @vitalcv/messaging-guard

Message-level intent binding package for enforcing `allowed_sinks` and signature verification.

## Overview

This package provides middleware and utilities to enforce message-level intent binding, preventing rogue message hops by:
1. Verifying that messages are intended for allowed sink IDs
2. Verifying detached JWS signatures (Ed25519/EdDSA)
3. Emitting audit events for all guard decisions

## Installation

```bash
npm install @vitalcv/messaging-guard
```

## Usage

### Basic Middleware

```typescript
import express from 'express';
import { createGuardMiddleware } from '@vitalcv/messaging-guard';

const app = express();

const guardMiddleware = createGuardMiddleware({
  allowedSinks: ['svc.issuer-api', 'svc.verifier-api'],
  requireSignature: true,
  publicKey: process.env.GUARD_PUBLIC_KEY, // JWK format
  emitAudit: async (event) => {
    // Emit to audit log
    console.log('Audit:', event);
  },
});

// Apply to routes
app.post('/oidc4vci/*', guardMiddleware, (req, res) => {
  // Request verified - envelope available at req.verifiedEnvelope
  res.json({ success: true });
});
```

### Programmatic Usage

```typescript
import { MessagingGuard } from '@vitalcv/messaging-guard';

const guard = new MessagingGuard({
  allowedSinks: ['svc.issuer-api'],
  publicKey: publicKeyJWK,
  requireSignature: true,
});

const result = await guard.verify({
  sink: 'svc.issuer-api',
  signature: detachedJWS,
  payload: messagePayload,
});

if (!result.allowed) {
  console.error('Message denied:', result.reason);
}
```

## Sink ID Registry

**B95B-SEC-001**: Centralized sink ID registry with validation and testing.

Standard sink IDs are documented in the `sink-registry.ts` module. Import and use:

```typescript
import { getSinkById, getAllSinkIds, isValidSinkId } from '@vitalcv/messaging-guard';

// Get sink details
const sink = getSinkById('svc.issuer-api');
console.log(sink?.description); // "OIDC4VCI issuer service..."

// Validate sink ID format
if (isValidSinkId('svc.my-service')) {
  // Valid format
}

// Get all registered sink IDs
const allSinks = getAllSinkIds();
```

Sink IDs follow the pattern: `{type}.{service-name}` where:
- `svc.*` - Microservice endpoints
- `etl.*` - ETL/transformation services
- `job.*` - Background job processors
- `db.*` - Database sinks
- `queue.*` - Message queue sinks

See `src/sink-registry.ts` for the complete registry with descriptions, owners, and environment availability.

## Audience Claim Validation

**B95B-SEC-001 / B98B-SEC-001**: Audience claims must match the environment.

The guard validates that message audience claims match the service environment:
- `development` / `dev` → expects `dev.vitalcv.com`
- `staging` → expects `staging.vitalcv.com`
- `production` / `prod` → expects `vitalcv.com`

**B98B-SEC-001**: Audience claims are now **required by default** (fail closed). Set `requireAudience: false` for backward compatibility.

```typescript
// Message with audience claim
const envelope = {
  sink: 'svc.issuer-api',
  payload: { data: 'test' },
  audience: 'dev.vitalcv.com', // Must match environment
};

const result = await guard.verify(envelope);
```

If audience is provided but doesn't match the environment, the message is denied. When `requireAudience: true` (default), messages without audience claims are denied.

## Environment-Scoped Sink Allowlists

**B98B-SEC-001**: Sink allowlists are now environment-scoped. Only sinks registered for the current environment are allowed.

The guard automatically filters `allowedSinks` based on:
1. Current environment (development/staging/production)
2. Sink registry entries (from `sink-registry.ts`)
3. Environment availability declared in registry

```typescript
// Only sinks available in 'development' will be allowed
const guard = new MessagingGuard({
  allowedSinks: ['svc.issuer-api', 'svc.verifier-api'],
  environment: 'development',
});

// If a sink is not registered for 'development', it will be denied
const result = await guard.verify({
  sink: 'svc.production-only-service',
  payload: { data: 'test' },
  audience: 'dev.vitalcv.com',
});
// result.allowed === false
// result.reason === "Sink 'svc.production-only-service' not available in environment 'development'"
```

**Fail Closed**: If a sink is not registered for the current environment, it is automatically excluded from the allowlist, even if explicitly requested.

## Environment Variables

- `MESSAGING_GUARD_ALLOWED_SINKS` - Comma-separated list of allowed sink IDs
- `MESSAGING_GUARD_PUBLIC_KEY` - JWK public key for signature verification
- `MESSAGING_GUARD_REQUIRE_SIGNATURE` - Whether signature is required (default: true)
- `MESSAGING_GUARD_REQUIRE_AUDIENCE` - Whether audience claim is required (default: true, fail closed)
- `NODE_ENV` - Environment (development/staging/production) - used for env-scoped allowlists

## Testing

```bash
npm test
```

Tests verify:
- Sink allowlisting
- Signature verification (Ed25519)
- Audit event generation
- Middleware integration

