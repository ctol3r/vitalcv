# Wave 126: Database Migration Plan

## Overview

VitalCV currently uses in-memory stores for several critical services.
This document outlines the migration path to Prisma/PostgreSQL persistence.

## Current In-Memory Services

| Service | Location | Data Size | Priority |
|---------|----------|-----------|----------|
| Audit Ledger | `auditLedger.ts` | Unbounded (grows with usage) | **P0 — Critical** |
| Trust Registry | `trustRegistry.ts` | Small (seeded issuers) | **P1 — High** |
| Revocation Registry | `revocationRegistry.ts` | Medium (grows with revocations) | **P0 — Critical** |
| Provider Provenance | `providerSourceProvenance.ts` | Medium (per-NPI chains) | P2 |
| Onboarding Flows | `onboardingFlows.ts` | Small | P2 |
| Federation Cache | `federationMetadata.ts` | Small (cached entities) | P2 |
| Auth Sessions | `apiAuth.ts` | Small (active sessions) | P1 (→ Redis) |
| API Keys | `apiAuth.ts` | Small | P1 (→ Prisma) |
| Audit Baseline | `auditBaseline.ts` | Small (rolling windows) | P3 (can stay in-memory) |

## Proposed Prisma Schema Extensions

### P0: Audit Ledger → AuditEvent model

```prisma
model AuditEvent {
  id            String   @id @default(cuid())
  eventId       String   @unique
  time          DateTime @default(now())
  traceId       String?
  categories    String[] // PostgreSQL array
  actor         String
  resource      String
  severity      String   @default("INFO")
  requestFields Json?
  resultFields  Json?
  receiptHash   String
  createdAt     DateTime @default(now())

  @@index([time])
  @@index([traceId])
  @@index([severity])
  @@index([actor])
}
```

### P0: Revocation → RevocationEntry model

```prisma
model RevocationEntry {
  id            String   @id @default(cuid())
  credentialId  String   @unique
  npi           String?
  reason        String?
  permanent     Boolean  @default(true)
  revokedAt     DateTime @default(now())
  revokedBy     String?

  @@index([npi])
  @@index([revokedAt])
}
```

### P1: Trust Registry → TrustedIssuer model

```prisma
model TrustedIssuerRecord {
  id                String   @id @default(cuid())
  issuerId          String   @unique
  issuerName        String
  publicKey         String
  trustLevel        String
  status            String   @default("ACTIVE")
  trustScore        Int?     @default(0)
  verificationCount Int?     @default(0)
  revocationCount   Int?     @default(0)
  haipCompliant     Boolean? @default(false)
  registeredAt      DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([status])
  @@index([trustLevel])
}
```

### P1: API Keys (already exists as SubscriptionApiKey)

Already modeled — migrate `apiAuth.ts` in-memory store to use
`SubscriptionApiKey` model + `apiKeyService.ts`.

### P1: Sessions → Redis

Sessions should move to Redis (not Postgres) for:
- TTL-based expiry
- Fast lookup
- No DB write per request

```
Redis key: `session:{sessionId}`
Redis value: JSON { clinicianId, npi, expiresAt }
Redis TTL: session TTL
```

## Migration Strategy

### Phase A: Schema + Dual-Write (non-breaking)
1. Add new Prisma models
2. Run `prisma migrate dev`
3. Modify services to write to BOTH in-memory AND Prisma
4. Read continues from in-memory (zero risk)

### Phase B: Read Migration
1. Switch reads to Prisma
2. Keep in-memory as cache/fallback
3. Verify with shadow comparison

### Phase C: Cleanup
1. Remove in-memory stores
2. Remove dual-write code
3. Update tests to use test database or mocks

## Risks

- **Data loss during restart**: Current in-memory stores lose data on process restart.
  Migration to Postgres eliminates this.
- **Schema conflicts**: New models must not conflict with existing ones.
  Use distinct model names (e.g., `TrustedIssuerRecord` vs existing code).
- **Test impact**: Tests currently rely on in-memory state isolation.
  Need test database or jest-prisma mock setup.

## Timeline

- Phase A: Next wave after Wave 129
- Phase B: Following wave
- Phase C: Following wave

## Decision

Migration is **planned but deferred** — the in-memory architecture works
for development and demo. Production deployment requires Phase A minimum.
