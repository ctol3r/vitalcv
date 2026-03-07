# Wave 126 Persistence Migration Report

## Scope

Wave 126 is limited to `apps/api/backend` and moves the highest-risk operational state from process memory into durable persistence without changing public API contracts.

## Audit Summary

| Domain | Current pre-wave storage | Wave 126 decision | Notes |
| --- | --- | --- | --- |
| Trust registry | In-memory `Map` in `src/services/registry/trustRegistry.ts` | Persist now | Security-critical issuer trust state must survive restarts. |
| Trust alerts | In-memory `Map` in `src/services/alerts/trustAlerts.ts` | Persist now | Alert acknowledgement state is operational state, not derived data. |
| Onboarding flows | In-memory `Map` in `src/services/missionOps/onboardingFlows.ts` | Persist now | Flow progress and blockers must survive deploys and crashes. |
| Audit receipts metadata | In-memory `Map` in `src/services/audit/receiptGenerator.ts` | Persist now | Conformance/audit receipt lookups require durability. |
| Audit ledger | In-memory array in `src/services/audit/auditLedger.ts` | Defer | Separate `AuditEvent` persistence already exists elsewhere; full migration requires append-only model reconciliation. |
| Provider provenance | In-memory `Map` in `src/services/providers/providerSourceProvenance.ts` | Defer | Important, but lower immediate operational risk than trust/alert/onboarding state; needs retention/query design. |
| Federation cache | In-memory TTL cache in `src/services/federation/federationMetadata.ts` | Remain cache | Remote metadata is derived/TTL-bound; persistence is useful but not required for launch blocking state. |
| Monitoring alerts engine | Derived at read time in `src/services/monitoring/alertEngine.ts` | Remain derived | Read model already derives from persisted monitoring inputs. |

## Immediate Persistence Plan

### Move to Prisma now

- Trust registry on existing `TrustedIssuer` with additive fields for trust level, status, PEM key, reputation, HAIP, federation metadata, and operator metadata.
- Trust alert state in new `TrustAlertRecord`.
- Mission Ops onboarding flows in new `MissionOpsOnboardingFlow`.
- Audit receipt metadata in new `AuditReceiptRecord`.

### Keep cached or derived for this wave

- Federation entity configuration cache remains an in-memory TTL cache backed by remote authority data.
- Provider provenance remains in-memory until a dedicated retention/query model is approved.
- The append-only audit ledger service remains separate from the already-persisted `AuditEvent` stream; only receipt metadata is moved in this wave.

## Schema Changes

### Extended existing table

- `TrustedIssuer`
  - Added: `publicKeyPem`, `trustLevel`, `status`, `trustScore`, `verificationCount`, `revocationCount`, `lastScoredAt`, `assuranceProfile`, `algorithmPolicy`, `haipCompliant`, `federationEntityId`, `federationTrustChain`, `federatedAt`, `registryMetadata`
  - Added indexes: `status`, `trustLevel`, `active`

### New tables

- `TrustAlertRecord`
- `MissionOpsOnboardingFlow`
- `AuditReceiptRecord`

The migration is additive only. No existing column is dropped or renamed.

## Repository / Service Abstraction

Wave 126 adds repository interfaces plus Prisma and in-memory implementations for:

- `repositories/trustRegistry.repo.ts`
- `repositories/trustAlerts.repo.ts`
- `repositories/onboardingFlows.repo.ts`
- `repositories/auditReceipts.repo.ts`

Service modules now use those repositories and keep read-side caches only where synchronous callers already exist:

- Trust registry: hydrated cache over repository
- Trust alerts: hydrated cache over repository
- Onboarding flows: hydrated cache over repository
- Audit receipts: direct repository-backed service

## Startup and Runtime Behavior

- `src/services/persistence/wave126Persistence.ts` hydrates the newly persisted domains at startup.
- `src/server.ts` awaits that hydration before marking the app ready.
- Read-only service APIs that are widely used synchronously remain synchronous by reading from hydrated caches.
- Mutating service APIs are now asynchronous and durable.

## Migration Plan

1. Apply Prisma migration `20260309000000_wave126_persistence_migration`.
2. Generate the Prisma client.
3. Deploy backend code with Wave 126 repositories/services.
4. Allow startup hydration to seed baseline trust issuers and baseline demo alerts if the tables are empty.
5. Verify:
   - `GET /api/registry`
   - `GET /api/alerts`
   - `GET /api/mission-ops/onboarding`
   - `GET /api/audit/receipts`

## Rollback Notes

1. Roll back the application release first; the schema changes are additive and do not require an emergency destructive rollback.
2. Leave the new columns/tables in place during rollback. The previous code ignores them.
3. If a second deployment retries Wave 126, startup hydration is idempotent for seed trust issuers and seed alerts.
4. If data cleanup is required later, archive rows from `TrustAlertRecord`, `MissionOpsOnboardingFlow`, and `AuditReceiptRecord` before manual deletion.

## Tests Added

- `__tests__/trustRegistry.persistence.test.ts`
- `__tests__/trustAlerts.persistence.test.ts`
- `__tests__/onboardingFlows.persistence.test.ts`
- `__tests__/auditReceipts.persistence.test.ts`

These tests exercise persistence semantics through in-memory repository doubles so Jest does not require a live database.
