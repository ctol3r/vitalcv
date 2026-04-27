# VitalCV — Backend Persistence Defer Decision (ISSUER-9)

**Decision**: `defer_until_contract_aligned`
**Decided**: 2026-04-26 (during ISSUER-9 build)
**Implied adapter kind**: `repository_candidate`
**Outcome**: No real backend persistence is wired in this slice. The no-op audit writer remains the default. The persistence adapter for `apps/web` stays at `repository_candidate` until the conditions below are satisfied.

This memo is the canonical source of truth for **why** VitalCV does not turn on backend persistence for issuer audit / PSV receipt artifacts in ISSUER-9, **what** must change first, and **how** to re-evaluate.

---

## Context

The ISSUER-1..8 chain produces seven structured artifacts at the web layer (`apps/web/lib/issuer-verification/`):

- `ReceiptCandidate` (ISSUER-2)
- `PolicyReviewDecision` and `PSVReceiptCandidate` (ISSUER-3)
- `PSVReceipt` with scope / limitations / freshness / `globalCredentialTruth: false` literal (ISSUER-4)
- `PSVReceiptReuseDecision` with revocation / supersession state (ISSUER-5)
- `IssuerRequestTimeline` and `IssuerRequestLifecycleEvent` (ISSUER-6)
- `IssuerAuditEventRecord` and `IssuerLifecycleReplay` (ISSUER-7)
- `IssuerAuditPersistenceAdapter` decision (ISSUER-8)

The existing backend repository (`apps/api/backend/repositories/psvReceipts.repo.ts`) is Prisma-bound, lives in the `chai-vc-platform-backend` package, and predates the issuer-verification chain. It stores the legacy `PsvReceiptSnapshot` shape (snake_case `receipt_id`, `fetched_at`, `ttl_seconds`, `revoked`, `source_authority`, `attestor_id`, `verification_request_id`).

ISSUER-9 was scoped to either implement or explicitly defer real backend persistence. After contract audit, **defer is the only safe path**.

---

## Why defer

The backend repository contract is structurally incompatible with the issuer-verification truth contract. Each of these blockers is independently sufficient to defer; together they require either a major schema change or a parallel, contract-aligned schema.

### 1. `contract_shape_mismatch`
- Backend `PsvReceiptSnapshot` is a flat snake_case row keyed by `receipt_id`.
- ISSUER-4 `PSVReceipt` is a nested camelCase object: `psvReceiptId`, `psvCandidateId`, `receiptCandidateId`, `requestId`, `claimId`, `claimType`, `promotedAt`, `promotedBy`, `sourceBasis`, `attributedResponder`, `scope`, `limitations`, `freshness`, `proofTier`, `decisionGrade`, `globalCredentialTruth`, `auditMetadata`.
- The two shapes do not intersect on most fields. A blind row write would silently drop the truth-contract fields the issuer chain depends on.

### 2. `missing_limitations`
- Backend row has no `limitations` array. ISSUER-4 mandates an array of `PSVReceiptLimitation` (`legally_only`, `partial_confirmation`, `contracted_agent`, `access_required`, `jurisdictional_scope`, `other`).
- A receipt without its limitations is structurally unsafe — e.g., a `legally_only` response stripped of its limitation could be misread as a full clinical confirmation.

### 3. `missing_source_basis`
- Backend row has `source_authority` (a string enum: `OIG_LEIE`, `STATE_BOARD`, etc.). ISSUER-2/3 require `SourceBasis` carrying both the source-of-record and any contracted-agent layer (`isContractedAgent`, `agentName`, `agentActsFor`).
- Persisting only `source_authority` collapses the contracted-agent / source distinction. The truth contract forbids that collapse.

### 4. `missing_responder_attribution`
- Backend row has `attestor_id` (string). ISSUER-2 requires `AttributedResponder` (`name`, `role`, `attributedAt`, `attributionMethod`).
- An `attestor_id` without the attribution method (`self_attested` / `directory_match` / `partner_assertion` / `unknown`) drops the load-bearing attribution-quality signal.

### 5. `missing_freshness_scope`
- Backend row has `ttl_seconds` (number). ISSUER-4 requires `FreshnessPolicy` (`ttlDays`, `issuedAt`, `staleAfter`) AND `PSVReceiptScope` (`claimType`, `covers`, `doesNotCover`, `sourceOrganizationName`).
- A TTL without scope language cannot bound the credential claim the receipt supports.

### 6. `no_writer_confirmation`
- Backend repo has no audit-event table; there is no writer that confirms an `IssuerAuditEventRecord` was persisted. ISSUER-7's truth contract requires a writer to flip `persistenceStatus` to `'persisted'`.

### 7. `client_server_boundary_violation`
- Importing the backend repository into `apps/web/lib/issuer-verification/` would pull server-only Prisma into the web client bundle and break Next.js builds. ISSUER-8 closed this boundary explicitly and tests assert no static import of `apps/api/`, `@vitalcv/psv`, `prisma_client`, or `psvReceipts.repo`.
- A client-safe RPC boundary (server action, REST endpoint, or RPC) is required first.

### 8. `untested_repository`
- The backend repository has no test coverage in PR-time CI. Persistence behavior — including the failure modes this defer memo cares about (idempotency, partial writes, error handling) — is not verified.

### 9. `migration_required`
- Aligning the backend schema requires adding columns/tables for: `limitations` (jsonb array), `source_basis` (jsonb), `attributed_responder` (jsonb), `scope` (jsonb), `freshness` (jsonb), candidate-vs-receipt distinction (column or separate table), and an audit-event table. This is a schema migration outside the scope of any single issuer wave.

---

## What re-enabling persistence requires

Each of the following must be true before `evaluateBackendPersistenceReadiness` returns `implement_now`:

1. **Schema alignment** — backend persistence has columns/tables matching the ISSUER-2..7 contracts (limitations, source basis, responder attribution, scope, freshness, audit events, candidate vs receipt).
2. **Server-only writer** — `apps/web/lib/issuer-verification/serverRepositoryAuditAdapter.ts` exists, is server-only (Next.js server action or RPC route), confirms each row before reporting `persisted`, and is under test.
3. **Client/server boundary tests** — automated proof that no backend module is imported into the client bundle.
4. **Repository test coverage** — backend repository has tests asserting every truth-contract field round-trips and partial writes fail loud.
5. **Operator opt-in** — the persistence adapter requires `enableRepositoryWrites: true` AND a separate operator-controlled flag before the adapter transitions to `repository_enabled`.

When all five are true, set the corresponding `BackendPersistenceCapabilityCheck` flags to `satisfied: true` in the readiness input. The decision will flip to `implement_now`.

---

## Adapter acceptance criteria

A future server-only adapter MUST satisfy:

- ✅ Returns `persisted: true` only when a real row was written and confirmed by the underlying repository.
- ✅ Carries the `IssuerAuditEventRecord` and `PSVReceipt` truth-contract fields verbatim (no field-dropping).
- ✅ Refuses to run from client code (verified by build-time checks).
- ✅ Reports `failed` with an error code when the repository rejects a row.
- ✅ Surfaces the `BackendPersistenceDecision` artifact alongside the write result for audit-trail provenance.
- ✅ Has tests covering: success path, failure path, partial-write rollback, double-write idempotency, schema-mismatch detection.

---

## Next safe implementation wave

ISSUER-10 (or named follow-up) should:

1. Open a parallel schema track that introduces the contract-aligned tables (`issuer_audit_event`, `psv_receipt_v2`, etc.) WITHOUT breaking the existing `psvReceipts.repo.ts`.
2. Land a server-only writer module under `apps/api/backend/` (NOT `apps/web/`).
3. Wire a Next.js server action or RPC under `apps/web/app/api/` that the persistence adapter can call from client code without crossing the bundle boundary.
4. Add adapter tests proving:
   - persisted=true only after writer confirmation
   - all truth-contract fields preserved
   - no client-bundle imports of backend modules
5. Re-run `evaluateBackendPersistenceReadiness` with all capabilities `satisfied: true` and confirm the decision flips to `implement_now`.
6. Toggle the persistence adapter from `repository_candidate` to `repository_enabled` — and only then.

---

## Status of this memo

This memo is **authoritative documentation**. The defer decision is encoded in:

- `apps/web/lib/issuer-verification/backendPersistenceDecision.ts` — runtime decision helpers.
- `apps/web/__tests__/issuer-backend-persistence-decision.test.ts` — tests asserting the defer path is the default.
- `apps/web/app/issuer/backend-persistence/[requestId]/page.tsx` — review surface that renders the decision.
- `docs/architecture/vitalcv-knowledge-trust-graph.{md,json}` — graph nodes / edges / rules / boundaries.

If a future change updates the runtime defaults, this memo MUST be updated in the same wave.

---

## BACKEND-1 status update (2026-04-26)

### What is now satisfied

- **Domain contract aligned at the type level.** `packages/domain-core/psvReceipts.ts` adds (additively, alongside the legacy `PsvReceiptSnapshot`):
  - `DomainPsvReceipt` with required `scope`, `limitations`, `sourceBasis`, `responderAttribution`, `freshness`, optional `candidateReference`, optional `writerConfirmation`.
  - `DomainPsvReceiptStatus` (`pending_not_persisted` / `candidate` / `persisted` / `failed_persistence` / `unavailable`).
  - `DomainPsvReceiptWriterConfirmation` with `writerMode` constrained to `'repository' | 'external'`.
  - `DomainPsvReceiptContractGap` with 10 explicit gap kinds.
- **Mapper and validator land in `packages/domain-core/psvReceiptMapping.ts`.** `mapIssuerPsvReceiptToDomainReceipt` maps an issuer-shape PSVReceipt without fabricating fields — every missing field surfaces a contract gap. `validateDomainPsvReceiptContract` emits gaps independently of the mapper. `mapLegacySnapshotToDomainReceipt` always emits a `legacy_snapshot_only` gap so the legacy backend snapshot cannot be silently treated as a full domain receipt.
- **Persisted status is gated.** A domain receipt can carry `status: 'persisted'` ONLY when (a) every required field is present AND (b) a `writerConfirmation` with `writerMode in {repository, external}` is supplied. Any structural gap blocks persisted; an invalid writer mode blocks persisted.
- **Frozen tests pin the contract.** `packages/domain-common/__tests__/psvReceipt.frozen.test.ts` adds tests asserting: missing limitations / sourceBasis / responderAttribution / freshness / scope each produce a gap; mapper does not fabricate missing fields; writer confirmation gates persisted; legacy snapshot is not a full receipt; `globalCredentialTruth` is dropped if upstream supplies it; `proofTier` and `decisionGrade` are not present on the domain receipt.
- **Backend repository carries an honesty header.** `apps/api/backend/repositories/psvReceipts.repo.ts` now opens with a comment block stating that the rows it persists are the legacy snapshot shape and MUST NOT be interpreted as a persisted issuer PSVReceipt under the truth contract. No behavioral change.

### What remains blocked

- **`stores_scoped_psv_receipt`** — the Prisma schema still stores `PsvReceiptSnapshot`; a contract-aligned schema does not exist yet.
- **`distinguishes_candidate_vs_receipt`** — the Prisma schema does not yet model `PSVReceiptCandidate` separately from a promoted `PSVReceipt`.
- **`supports_audit_event_persistence`** — there is no `issuer_audit_event` table or writer.
- **`exposes_server_only_writer`** — no client-safe RPC / server action exists; the persistence boundary still lives across the apps/api ↔ apps/web crossing.
- **`has_test_coverage`** for the legacy backend repository — the existing repo's behavior is still untested in PR-time CI.

### Acceptance criteria for a real backend writer

A future server-only writer MUST:

1. Accept a `DomainPsvReceipt` (the BACKEND-1 type) plus an internally-generated `writerConfirmation`.
2. Refuse to write if `validateDomainPsvReceiptContract` returns any gaps.
3. Map the domain receipt onto a contract-aligned schema (new tables / columns; no overloading the legacy `psvReceipt` row).
4. Return `persisted: true` only after the underlying repository confirms the row.
5. Live behind a Next.js server action / RPC route in `apps/web/app/api/...`; `apps/web/lib/issuer-verification/` MUST NOT import the writer directly.
6. Have tests covering: success path, structural-gap refusal, writer-mode invalidation, partial-write failure, double-write idempotency, no-client-bundle-import.

### Decision still in force

The runtime decision returned by `evaluateBackendPersistenceReadiness` defaults to `defer_until_contract_aligned`. BACKEND-1 closes the **type-level** contract gap; it does not close the **schema-level** or **writer-level** gaps. Real persistence remains off in production code paths.

---

## BACKEND-2 status update (2026-04-27)

### Decision: defer the real writer; ship the boundary only

BACKEND-2 was scoped to either implement a real server-side writer OR ship a writer boundary with a deferred default. After re-auditing the contract readiness against BACKEND-1's still-open blockers, the safe path is **boundary only**.

### Why the writer is still deferred

The schema-level blockers identified in the original memo are unchanged. A "real" writer at this point would have to choose one of three unsafe paths:

1. **Write to the legacy `psvReceipt` table.** This silently drops `limitations`, `sourceBasis` (with contracted-agent vs source distinction), `attributedResponder` (with `attributionMethod`), `scope`, `freshness`, and the candidate-vs-receipt distinction. That is a truth-contract violation — the persisted row would not be a `PSVReceipt` under ISSUER-4 semantics.
2. **Run a Prisma migration to create a contract-aligned table.** The BACKEND-2 brief explicitly forbids broad migrations: "DO NOT add broad migrations". A migration is the right answer for the next wave; it is not in scope here.
3. **Write to filesystem JSON or in-memory state.** That is fake persistence — the truth contract requires writer confirmation from a real repository, which JSON files / in-memory stores do not provide.

All three paths violate the truth contract. The boundary-only outcome is the only safe option for this wave.

### What BACKEND-2 ships

**`apps/web/lib/issuer-verification/serverPsvReceiptWriter.ts`** — the writer boundary, with:
- `ServerPsvReceiptWriter` interface, `ServerPsvReceiptWriteInput`, `ServerPsvReceiptWriteResult`, `ServerPsvReceiptWriteStatus` (`persisted` / `failed` / `unavailable` / `dry_run` / `deferred`), `ServerPsvReceiptWriterFailureReason` (7 reasons), `ServerPsvReceiptWriterConfirmation` (with `writerMode in {repository, external}`).
- `canUseServerPsvReceiptWriter()` — pure structural gate; refuses missing required fields, refuses forbidden truth-tier fields (`globalCredentialTruth`/`decisionGrade`/`proofTier`), refuses client-supplied `persisted`/`confirmation` flags.
- `buildServerPsvReceiptWriteInput()` — pure builder; strips forbidden truth-tier fields defensively.
- `writePsvReceiptWithConfirmation()` — orchestrator that invokes a writer AND validates its result. **Defensively downgrades** any writer that returns `persisted=true` without a valid `writerMode in {repository, external}` confirmation.
- `createDeferredServerPsvReceiptWriter()` — the BACKEND-2 default. Returns `'deferred'` for valid input, `'failed'` for invalid input, `'dry_run'` when requested. **NEVER returns `persisted=true`.**
- `createUnavailableServerPsvReceiptWriter()` — returns `'unavailable'` for environments with no writer wired.

**No API route ships.** `apps/web/app/api/issuer/psv-receipt/persist/route.ts` is intentionally NOT created. Per the BACKEND-2 STEP 4 rule, the unsafe path is "do not create route" — and we are unsafe because the table doesn't exist.

### Acceptance criteria for the next wave (BACKEND-3 or named follow-up)

The next wave that turns persistence ON must:

1. Land a Prisma migration that creates a contract-aligned schema (new table(s); no overloading the legacy `psvReceipt` row).
2. Implement a real server-only writer that accepts a `ServerPsvReceiptWriteInput`, talks to the new table, and returns a `ServerPsvReceiptWriterConfirmation` with `writerMode === 'repository'`.
3. Land a Next.js server action / API route under `apps/web/app/api/issuer/psv-receipt/persist/` that the persistence-adapter boundary can call from server components — never imported by client code.
4. Add tests covering: success path, structural-gap refusal, writer-mode invalidation, partial-write rollback, double-write idempotency, no-client-bundle-import, audit-event co-persistence.
5. Update `evaluateBackendPersistenceReadiness` to return `implement_now` once every capability check is satisfied.
6. Update `createRepositoryAuditAdapter` to flip from `unavailable` to `repository_enabled` (still requiring per-row writer confirmation).

The BACKEND-2 boundary is designed to drop into that future wave with no API change — the deferred writer just gets replaced by the real one.
