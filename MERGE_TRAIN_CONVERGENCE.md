# Merge Train Convergence
Generated: 2026-05-13T05:03:00Z
Branch: wave-10a/docs-status

---

## Current Branch State

wave-10a/docs-status is LOCAL only — not yet pushed to origin.
Contains 20+ commits since forking from main.

## Recommended Merge Sequence

Given the dependency graph of the work done in this session, the correct merge order is:

### Step 1: Security + Auth foundation
```
PR: security/anonymous-write-elimination
  - Anonymous write gates (pilot-ops/events, track/apply, learningTrack)
  - CORS normalizeOrigin utility
  - Receipt JWT actor attribution (azp + vcv.actor_id)
Dependencies: none
```

### Step 2: Trust discovery + runtime
```
PR: feat/trust-discovery-endpoints
  - /.well-known/did.json, openid-credential-issuer, trust.json, trust-register
  - next.config.mjs rewrites
  - /api/me/link-npi (historical — endpoint since removed; NPI binding is /api/profile/npi/bootstrap)
Dependencies: Step 1
```

### Step 3: Verifier surfaces
```
PR: feat/verifier-surfaces
  - /verify/[npi] page
  - /verify/receipt/[receiptId] page
  - /receipt/[receiptId] page
  - /investigate/[npi] page
  - TrustTierBadge, IssuerContinuityPanel, ReplayChronologyPanel
Dependencies: Step 2
```

### Step 4: Trust State Register + operator
```
PR: feat/trust-state-register
  - /trust page (TrustStateRegister, A/B/C states)
  - /trust/doctrine page (replay contract doctrine)
  - /ops operator console
  - /ops/survivability page
  - DOCTRINE.md
Dependencies: Step 3
```

### Step 5: Replay infrastructure
```
PR: feat/replay-infrastructure
  - lib/replay/getReplayInspection.ts
  - lib/replay/replayIntegrity.ts
  - /api/replay/[runId]
  - /api/receipt/[lineageKey]
  - /api/replay/integrity/[npi]
Dependencies: Step 4
```

### Step 6: Passport hydration resilience
```
PR: fix/passport-graceful-degraded-recovery
  - fetchNppesIdentityProbe
  - buildDegradedPassportStub
  - PassportEntityClient degraded mode
  - fetchWithRetry
  - x-org-id injection in proxy routes
Dependencies: Step 4
```

### Step 7: Observability + status
```
PR: feat/operational-observability
  - /api/status public endpoint
  - /status public page
  - LiveTrustStatusBoard, SourceLaneTelemetry
  - /api/runtime/ping
Dependencies: Step 5
```

### Step 8: Design system
```
PR: design/institutional-visual-system
  - All Bloomberg-label, monochrome, solid/dashed grammar changes
  - trust-register.css additions
  - FailureTaxonomyMatrix, CopyableDID, VerifierQuickReadRail
  - ReplayChronology elevation
Dependencies: Step 3 (parallel with 4-7)
```

---

## Replay Persistence PRs (future, post-merge)

```
PR: feat/replay-run-record-schema
  - Add ReplayRunRecord to Prisma schema
  - Prisma migration

PR: feat/lineage-continuity-record-schema
  - Add LineageContinuityRecord to Prisma schema

PR: feat/deterministic-jti
  - signIssuerReceipt: sha256-based jti

PR: feat/replay-persistence-write-path
  - replayPersistence.ts service
  - Wire into SourceRun completion

PR: feat/replay-inspection-db-read
  - getReplayInspection reads from ReplayRunRecord
  - Fallback to synthetic if empty
```

## Squash Strategy

Squash within each step before merge. Each step = one merge commit to main.
Use conventional commit format per step.

