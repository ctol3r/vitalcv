# TRUST-PERSIST-1 Inventory

Timestamp: 2026-05-30 16:32 PDT (America/Los_Angeles)

## Goal

Identify persistence gaps blocking enterprise-grade source-run, receipt, replay, lineage, and audit durability. This is a docs-only inventory; no schema, runtime, or migration changes were made.

## Commands Run

```bash
rg -n "inMemory|memory|Map<|new Map|source_complete|runId|receipt|replay|lineage|Prisma|model |audit|ingest|sourceRun" apps packages prisma || true
find . -iname "schema.prisma" -o -iname "*prisma*" | sort
```

Note: the repository has app-local Prisma roots; the literal top-level `prisma` path does not exist.

Schema roots found:

- `apps/api/backend/prisma/schema.prisma`
- `apps/marketing/prisma/schema.prisma`
- `apps/web/prisma/schema.prisma`

## Current Durable Storage Model

The backend schema already contains a substantial persistence spine:

- Source execution: `SourceRun`, `IngestRun`, `IngestSourceRun`, `IngestEvent`.
- Source artifacts and claims: `SourceRecord`, `ClaimRecord`, `IdentityClaimDelta`, `VerificationArtifact`.
- Receipts: `PsvReceipt`, `VerificationReceiptRecord`, `AuditReceiptRecord`, `ReceiptCandidate`.
- Audit: `AuditEvent`, `AuditSnapshot`, pilot event tables.
- Replay-facing route: `apps/api/backend/src/routes/replayRuns.ts` reads `SourceRun`, `IngestRun`, and `VerificationReceiptRecord`.
- Credential ingestion repository: `PrismaCredentialIngestionRepository` exists beside an in-memory implementation.

This means the target shape exists, but the runtime still has multiple side paths where source, replay, wallet, and audit data can be process-local.

## Probably Ephemeral / Process-Local Artifacts

Representative process-local stores found by the search:

- `packages/psv/psvStore.ts`: `PsvStore` keeps receipts in `Map` instances.
- `apps/api/backend/src/services/audit/auditLedger.ts`: append-only audit ledger is an in-memory array plus `eventIndex` map.
- `apps/web/lib/source-health/store/snapshotStore.ts`: source-health snapshots are in-memory.
- `apps/status-api/src/routes/statusList.ts`: status list is explicitly in-memory.
- `apps/admin-api/src/auth/challenge-store.ts`: WebAuthn challenges in memory.
- `apps/api/domain/canonicalPath.ts`: Recognition / Acceptance / Start events in maps.
- `apps/api/backend/src/services/credentials/credentialWallet.ts` and `credentialPresentation.ts`: credential wallet / presentation state in maps.
- `apps/issuer-api/src/services/verifierWalletStore.ts`: verifier wallet store in memory.
- `apps/issuer-api/src/services/haipPolicy.ts`: c_nonce store in memory.
- `apps/api/backend/src/services/network/passportAnalytics.ts`: passport analytics in memory.
- `apps/api/backend/src/services/revocation/revocationRegistry.ts`: revocations in a map.
- Trust-anchor registries/cache paths use maps for issuer, CRL, OCSP, and anchor state.

Not every `Map` is a persistence gap; many are local dedupe/cache helpers. The risk is specifically where a map is the system of record for trust, replay, auth, receipt, revocation, or audit semantics.

## Durable vs Ephemeral Source-Run Artifacts

Durable today:

- `SourceRun` has `sourceId`, `subjectNpi`, `idempotencyKey`, optional `runId`, optional `priorRunId`, status, summary, timestamps, and relations to source records, claim records, jobs, alerts, and receipt records.
- `IngestRun` and `IngestSourceRun` can represent a higher-level ingest and per-source child state.
- `IngestEvent` can capture sequenced events with dedupe keys and payloads.
- `VerificationReceiptRecord` can bind receipt records back to `SourceRun`, `SourceRecord`, `VerificationArtifact`, claim fields, source system, checksum, retrieved time, and integrity hash.

Probably not durable enough:

- The SSE smoke can fail before a durable `runId` is visible to the operator.
- It is unclear whether every ingest event emitted to SSE is also written to `IngestEvent`.
- It is unclear whether failed, gated, or unavailable source attempts always produce durable `SourceRun` / `IngestSourceRun` rows.
- Process-local source-health snapshots can diverge from durable source-run truth after restart.

## SSE Persistence Gaps

Current blocker: authenticated SSE smoke is still auth-blocked, so live source-run emission is not verified.

Gaps to close:

- Emit `runId` only after an `IngestRun` or `SourceRun` row is durable.
- Persist each SSE lifecycle event to `IngestEvent` with sequence and dedupe key.
- Persist terminal source state even for `FAILED`, `GATED`, `UNAVAILABLE`, and `ACCESS_REQUIRED`.
- Make replay reconstruction read from durable events rather than reconstructing from partial source/receipt rows only.
- Add an operator-safe way to inspect run state without exposing cookies, tokens, PHI, or raw source payloads.

## `source_complete` Persistence Path

PR #423 brought NPPES `source_complete` truth-state behavior to `main`, but live SSE validation remains blocked by auth. The durable target appears to be:

`POST /api/ingest/:npi` -> source orchestration -> `SourceRun` / `SourceRecord` / `VerificationReceiptRecord` -> SSE `source_complete` -> replay route reads `SourceRun`.

The unproven part is whether the runtime always writes those rows before or at the same time as emitting the corresponding SSE event. That is the core TRUST-PERSIST-1 code question.

## Receipt / Replay / Lineage Gaps

- `packages/psv/psvStore.ts` remains a process-local receipt store, while backend Prisma receipt models also exist.
- `apps/api/backend/src/services/audit/auditLedger.ts` returns synchronous in-memory audit entries, while `AuditEvent` is a durable table.
- Replay routes read `SourceRun` and `VerificationReceiptRecord`, but there is no confirmed single writer contract saying every replay-visible event must be durable before response.
- `SourceRun.priorRunId` can model lineage, but continuity guarantees and gap detection need explicit write/read tests.
- Receipt candidates, verification receipts, PSV receipts, and audit receipts are not yet clearly unified under one canonical receipt lifecycle.

## Top 10 Enterprise Persistence Risks

1. A successful-looking SSE event may not correspond to a committed durable row.
2. A failed/gated source attempt may disappear after process restart.
3. `runId` can be absent, late, or not tied to an `IngestRun` visible to the operator.
4. Replay routes may reconstruct partial history while missing process-local events.
5. The in-memory audit ledger can satisfy local callers without guaranteeing `AuditEvent` persistence.
6. PSV receipts can exist in process-local `PsvStore` without a durable receipt record.
7. Source-health panels can read in-memory snapshots that do not survive deploys/restarts.
8. Revocation/trust-anchor state can be process-local in several services, undermining revocation-first validity.
9. Multiple receipt tables/models can drift without a canonical lifecycle and idempotency contract.
10. Enterprise audit exports cannot be relied on until source, receipt, replay, and audit writes share durable transaction boundaries.

## Recommended Next Code PRs

1. `trust-persist-1a`: make ingest start create a durable `IngestRun` and return only a durable `runId`.
2. `trust-persist-1b`: persist all SSE events to `IngestEvent` with sequence, dedupe key, and terminal state.
3. `trust-persist-1c`: require terminal `IngestSourceRun` state for every source in the canonical ingest set.
4. `trust-persist-1d`: wire replay inspection to durable `IngestEvent` + `SourceRun` history and add gap detection tests.
5. `trust-persist-1e`: route PSV receipt writes through a Prisma-backed writer for backend runtime paths.
6. `trust-persist-1f`: replace in-memory audit-ledger success semantics with an explicit durable `AuditEvent` confirmation boundary.
7. `trust-persist-1g`: persist source-health snapshots or derive them from durable `SourceRun` / `IngestSourceRun` rows.
8. `trust-persist-1h`: add tests for failed/gated/unavailable sources proving durable terminal rows exist.
9. `trust-persist-1i`: define canonical receipt lifecycle across `ReceiptCandidate`, `PsvReceipt`, `VerificationReceiptRecord`, and `AuditReceiptRecord`.
10. `trust-persist-1j`: add an operator-safe run inspection endpoint that exposes run status without secrets, tokens, PHI, or raw source payloads.

## Risk Rating

Risk: high for enterprise auditability.

Reason: schema foundations exist, but there are still process-local systems of record in trust-adjacent paths. Until the ingest/SSE/replay/audit writers are confirmed durable by tests, VitalCV should not claim enterprise-grade replay or source-run audit completeness.
