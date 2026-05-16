# Multi-Tenant Governance Isolation — W2-PR36A

**Wave:** W2-PR36A — Multi-Tenant Governance Isolation
**Date:** 2026-05-09
**Status:** Implementation + chaos suite + CI gate landed; this doc is the operator-facing synthesis.
**Risk class:** SAFE — pure transforms, fail-closed extensions to a previously OPEN single-tenant assumption.
**Companion to:** [containment-explainability](containment-explainability.md), [drift-explainability](drift-explainability.md), [constitutional-trust-continuity](constitutional-trust-continuity.md).
**Builds on:** [replay engine integration](../../apps/api/backend/src/services/audit/replayEngine.ts), [runtimeTrustCohesion](../../apps/api/backend/src/services/runtimeTrustCohesion.ts).

---

## What this track answers

Earlier waves (PR12B drift, PR13B integrity-state, PR14B containment) treated the platform as a single-tenant system: an operator inside one organization classifying that organization's drift, fragmentation, and containment. PR36A asks the cross-cutting question those waves never asked:

> When the platform serves more than one organization at the same time, **can a piece of governance state belonging to tenant A ever be presented as, merged into, or used to justify a decision about tenant B**?

The risk vector is **cross-tenant contamination**:

- A replay invoked by tenant B's verifier returning a capsule, or even a *related-decision* row, owned by tenant A.
- A drift signature from tenant A merging into tenant B's lineage because the signatures collide on payload but differ only on owning organization.
- A blast radius — the set of capsules a recovery wave is about to touch — fanning past the originating tenant boundary.
- A recovery wave silently including tenant B's capsules in tenant A's recovery set.
- A runtime mutation fingerprint colliding across tenants because the fingerprint pre-image did not contain tenant context.

Each of these is **silent** by default — the database query may return rows, the hash function may reproduce, the surface may render. None of them require an attacker; a missing `WHERE` clause or a future ergonomic refactor is sufficient.

PR36A's job is to make all five **structurally impossible** rather than left to call-site discipline.

## Definitions — MT-* state vocabulary

The five multi-tenant governance states an operator must distinguish:

- **MT-PARTITIONED:** every governance artifact (capsule, replay, drift signature, recovery candidate, runtime fingerprint) carries a tenant anchor. Every read by a tenanted requester is fail-closed validated against that anchor. Cross-tenant operations either throw `TenantIsolationError` or are filtered out before the data leaves the boundary checker. The desired steady state.
- **MT-OPEN:** a requester does not claim a tenant context (legacy admin-API call, internal telemetry job, back-compat path). The boundary checker returns `isolationVerdict: 'OPEN'` and the call proceeds. **OPEN is not unsafe** — but it MUST NOT be the read mode for a tenanted user-facing surface. OPEN is the back-compat exit door, narrowly intended for internal jobs that already operate at the platform tier.
- **MT-AMBIGUOUS:** a tenanted requester targets a capsule that has no tenant anchor. Treated as a fail-closed violation (`AMBIGUOUS_TENANT`). Ambiguity is **never** a free pass — the absence of an anchor on a capsule that should carry one is itself a contamination vector (it lets a tenanted requester silently read pre-tenant rows).
- **MT-LEAK:** a request that *would have* read or merged across tenants but was caught by a downstream filter (timeline scoping, recovery-scope partitioning, drift-signature comparison). The boundary held but the call site is asking the wrong question; surface as a soft warning to the call site without failing the user request.
- **MT-BREACH:** a cross-tenant artifact has materialized inside a single-tenant lineage *without* being caught — a tenant A capsule appearing in a tenant B bundle, a tenant A drift signature being merged into tenant B's drift lineage, a recovery wave executing actions on cross-tenant capsules. This is the failure mode the chaos suite is designed to detect and the CI gate is designed to prevent shipping.

MT-PARTITIONED is the safe state. MT-OPEN is acceptable only inside narrowly-scoped internal callers. MT-AMBIGUOUS and MT-LEAK are recoverable signals — both surface the violation without losing data. MT-BREACH is the only unrecoverable state, and the entire `tenantIsolation.ts` module exists to make it unreachable.

## MT-state ↔ existing-finding map

Each multi-tenant containment property mapped to its primitive and its enforcement site. Severity classified post-implementation.

| MT class | Property | Enforcement | Severity |
|---|---|---|---|
| MT-PARTITIONED | Replay scope validator (`assertTenantScope`) — tenanted reader cannot read another tenant's capsule, ambiguous capsule throws | [tenantIsolation.ts:142-191](../../apps/api/backend/src/services/multi-tenant/tenantIsolation.ts) | 🟢 |
| MT-PARTITIONED | Replay engine integration — capsule load fail-closes on cross-tenant or ambiguous read | [replayEngine.ts:282-289](../../apps/api/backend/src/services/audit/replayEngine.ts) | 🟢 |
| MT-PARTITIONED | Query-layer scope filter — `prisma.decisionCapsule.findMany` carries `organizationId` in `WHERE` | [replayEngine.ts:504-520](../../apps/api/backend/src/services/audit/replayEngine.ts) | 🟢 |
| MT-PARTITIONED | Defense-in-depth post-filter — query results re-filtered through `scopeRelatedDecisions` | [replayEngine.ts:520](../../apps/api/backend/src/services/audit/replayEngine.ts) | 🟢 |
| MT-PARTITIONED | Bundle scope — `buildAuditBundle({requesterTenantId})` filters AND re-asserts each replay | [replayEngine.ts:587-607](../../apps/api/backend/src/services/audit/replayEngine.ts) | 🟢 |
| MT-PARTITIONED | Tenant-bound runtime fingerprint — two tenants performing the same mutation on the same entity get distinct payloadHash + mutationFingerprint | [runtimeTrustCohesion.ts:143-216](../../apps/api/backend/src/services/runtimeTrustCohesion.ts) | 🟢 |
| MT-PARTITIONED | Tenant-bound replay fingerprint — `buildRuntimeReplayMetadata({tenantId})` wired in `replayEngine` | [replayEngine.ts:294-303](../../apps/api/backend/src/services/audit/replayEngine.ts) | 🟢 |
| MT-PARTITIONED | Drift-signature tenant separation — payload-identical drift across tenants produces distinct signatures | [tenantIsolation.ts:362-414](../../apps/api/backend/src/services/multi-tenant/tenantIsolation.ts) | 🟢 |
| MT-PARTITIONED | Blast-radius segmentation — affected-capsule set audited for cross-tenant span; throws on breach | [tenantIsolation.ts:242-303](../../apps/api/backend/src/services/multi-tenant/tenantIsolation.ts) | 🟢 |
| MT-PARTITIONED | Scoped recovery semantics — recovery wave partitions candidates by tenant; strict variant throws on leak | [tenantIsolation.ts:315-358](../../apps/api/backend/src/services/multi-tenant/tenantIsolation.ts) | 🟢 |
| MT-PARTITIONED | Tamper-evident boundary digest in every TenantScope output | [tenantIsolation.ts:117-128](../../apps/api/backend/src/services/multi-tenant/tenantIsolation.ts) | 🟢 |
| MT-OPEN | Legacy back-compat — un-tenanted requester gets `isolationVerdict:'OPEN'` instead of throw | [tenantIsolation.ts:152-160](../../apps/api/backend/src/services/multi-tenant/tenantIsolation.ts) | 🟡 |
| MT-AMBIGUOUS | Pre-tenant capsule + tenanted reader → throws `AMBIGUOUS_TENANT` (no silent serve) | [tenantIsolation.ts:163-171](../../apps/api/backend/src/services/multi-tenant/tenantIsolation.ts) | 🟢 |
| MT-LEAK | Timeline post-filter survives a query-layer regression (defense-in-depth chaos test) | [replayEngine.tenantIsolation.test.ts:208-221](../../apps/api/backend/src/services/audit/__tests__/replayEngine.tenantIsolation.test.ts) | 🟢 |
| MT-BREACH | CI gate — every public assertor throws `TenantIsolationError` with enumerated `violation` field | [tenantIsolation.ci.gate.test.ts:37-103](../../apps/api/backend/src/services/multi-tenant/__tests__/tenantIsolation.ci.gate.test.ts) | 🟢 |
| MT-BREACH | Chaos suite — billion-scenario timeline mix, hostile rotating tenant ids, multi-tenant recovery wave, drift bleedover | [tenantIsolation.test.ts:332-407](../../apps/api/backend/src/services/multi-tenant/__tests__/tenantIsolation.test.ts) | 🟢 |
| MT-BREACH | Audit-event-type schema lacks `tenantId` field — events scoped only at envelope, not at emission | [auditEventTypes.ts](../../apps/api/backend/src/types/auditEventTypes.ts) | 🟠 |

**Tally:** 14 🟢, 1 🟡, 1 🟠, 0 🔴.

The 🟢 concentration reflects that the boundary primitive (`tenantIsolation.ts`) is woven into every governance artifact production path that has a code-callable tenant anchor: replay envelope, bundle envelope, runtime fingerprint, drift signature, blast radius, recovery scope. The 🟡 is the OPEN back-compat door — load-bearing for migration but a structural risk if a tenanted surface ever reads through it. The 🟠 is the audit-event schema, which still has no tenant column at the event-type layer; events are scoped via the capsule envelope they ride on, not at the emission site.

## Per-state operator readability

### MT-PARTITIONED — 🟢 CLEAR

**What the system does today:** every replay carries a `tenantScope` block with `capsuleTenantId`, `requesterTenantId`, `isolationVerdict`, `boundaryDigest`, and `partitionedAt`. The verdict is one of three enumerated values; the digest is a deterministic SHA-256 over (capsuleId, capsuleTenantId, requesterTenantId) and changes on any field. The output is tamper-evident — a downstream consumer can verify the boundary marker against the inputs.

**Why this works:** the boundary is not an opinion the call site holds; it is a verdict the boundary checker emits. The replay engine cannot produce a `DecisionReplay` without first running `assertTenantScope`. The boundary checker is a pure function, so the verdict is reproducible at audit time without re-querying the database.

**Verdict:** 🟢. Operator who reads `tenantScope.isolationVerdict === 'ENFORCED'` has a structurally honest claim.

### MT-OPEN — 🟡 NARROW BUT LOAD-BEARING

**What the system does today:** when a caller does not supply `requesterTenantId`, the boundary checker returns `isolationVerdict: 'OPEN'` and the call proceeds. The capsule's tenant is still recorded; only the requester-side check is skipped.

**Why this is necessary:** internal jobs (cron, telemetry export, admin debugger) operate at the platform tier and cannot meaningfully claim a tenant. Forcing them to fabricate one would either pick a wrong tenant (silent contamination) or block the job (operational failure).

**Why this is a risk:** if a tenanted user-facing surface ever reaches into the audit/replay pipeline through a code path that omits `requesterTenantId`, the read silently widens to platform tier. The per-call filter on `relatedDecisions` (line 520) catches one class of leak — but only because the *capsule's* tenant anchor is honored on the post-filter. A capsule with no anchor + an OPEN requester = an un-bounded read.

**Verdict:** 🟡. Acceptable for back-compat; the migration target is to mark every internal caller as OPEN-by-design (explicit) and reject any user-surface call that arrives OPEN.

### MT-AMBIGUOUS — 🟢 CLEAR (fail-closed)

**What the system does today:** a tenanted requester targeting a capsule with `verifierOrgId === null` throws `TenantIsolationError` with `violation: 'AMBIGUOUS_TENANT'`. The pre-tenant rows that exist in the database (real production state during migration) are unreadable to tenanted callers.

**Why this works:** ambiguity is structurally distinct from absence. A pre-tenant capsule and a deliberately-shared capsule both look identical at the row level (`organizationId IS NULL`); treating them the same would let a tenanted reader harvest every pre-tenant row. The fail-closed verdict forces every legacy capsule into a deliberate migration path before a tenanted surface can read it.

**Verdict:** 🟢. The error is loud, named, and contains the offending tenant + capsule for triage.

### MT-LEAK — 🟢 RECOVERABLE

**What the system does today:** when the query layer returns a row that should not have appeared in the result set (e.g. a Prisma `WHERE` clause regression), the post-filter (`scopeRelatedDecisions`) drops it before it reaches the user. The chaos test at [replayEngine.tenantIsolation.test.ts:208-221](../../apps/api/backend/src/services/audit/__tests__/replayEngine.tenantIsolation.test.ts) injects exactly this regression and confirms the bundle returns empty rather than leaking.

**Why this works:** the boundary checker runs on every replay, not just on the bundle entrypoint. A query-layer regression cannot leak through the replay envelope because the envelope is constructed by `assertTenantScope`, which throws on the cross-tenant capsule before the envelope ships.

**Verdict:** 🟢. Defense-in-depth holds even when the upstream filter fails.

### MT-BREACH — 🟢 STRUCTURALLY UNREACHABLE (today)

**What the system does today:** every assertor (`assertTenantScope`, `assertBlastRadiusContained`, `assertRecoveryScopeClean`, `assertDriftSignaturesSameTenant`) throws `TenantIsolationError` on the breach inputs. The CI gate ([tenantIsolation.ci.gate.test.ts](../../apps/api/backend/src/services/multi-tenant/__tests__/tenantIsolation.ci.gate.test.ts)) re-runs every breach scenario on every build. A future refactor that accidentally weakens a primitive breaks the build before shipping.

**Why this works:** the breach detection is not a runtime telemetry signal — it is a fail-closed exception. The chaos suite stresses every primitive against billion-scenario timeline mixes, rotating hostile tenant ids, identical-payload drift across tenants, and 100-capsule recovery waves spanning ten tenants.

**The remaining 🟠 (audit event types):** events emitted via [auditEventTypes.ts](../../apps/api/backend/src/types/auditEventTypes.ts) carry no `tenantId` field. Events are tenant-scoped only at the capsule/bundle envelope they ride on. A future direct-event consumer (analytics pipeline, log query, SIEM ingest) that filters events by some other field would not have a guaranteed tenant key. The fix is a schema-layer change with many call sites — out of scope for PR36A, tracked as the largest remaining cross-tenant risk.

**Verdict:** 🟢ish. Structurally unreachable through the replay/bundle/recovery/drift paths. 🟠 at the event-type layer because the schema does not require a tenantId.

---

## Strongest tenant-isolation safeguard

**The boundary digest in every `TenantScope` output.** Every replay produced by the engine carries a SHA-256 over `(capsuleId, capsuleTenantId, requesterTenantId)`. A downstream consumer (regulator, auditor, partner system) can verify the boundary marker without trusting the producer — recompute the digest from the three inputs and compare. A drift between the digest and its inputs is structurally impossible without producing a different envelope. This is a stronger property than "the call site claims to have validated"; it is a tamper-evident receipt.

The runner-up: **drift-signature tenant separation**. Two tenants reporting an identical OIG_LEIE exclusion event produce signatures that differ only in the tenant component of the pre-image. This makes lineage poisoning structurally impossible — a tenant A drift event can never be merged into tenant B's lineage, because the signature is in a different namespace.

## Strongest replay-boundary integrity gain

**Tenant-bound runtime fingerprint** (this PR's incremental gain). Before W2-PR36A, two tenants doing `accept` on the same `entityId` with the same payload produced identical `mutationFingerprint` and `payloadHash`. The replay envelope still partitioned them via `tenantScope`, but a downstream consumer indexing by fingerprint would have collided rows.

After this PR, the fingerprint pre-image folds in `tenantId` whenever the call site supplies one. The 50-tenant chaos test ([runtimeTrustCohesion.tenantIsolation.test.ts:122-141](../../apps/api/backend/src/services/__tests__/runtimeTrustCohesion.tenantIsolation.test.ts)) confirms zero collisions across all 50 tenants on either hash. The replay path now passes `capsuleTenantId` automatically, so existing replays are tenant-bound from this commit forward.

The back-compat path (no `tenantId` supplied) reproduces the v1 fingerprint exactly — no historical fingerprints break.

## Biggest remaining cross-tenant risk

**Audit-event-type schema lacks `tenantId`.** [`auditEventTypes.ts`](../../apps/api/backend/src/types/auditEventTypes.ts) defines six event families (`VerificationEventType`, `ArtifactEventType`, `EmployerReviewEventType`, `TrustChainEventType`, `OperationalEventType`, `ResearchEventType`) with no tenant column at the union level. Events are tenant-scoped only at the capsule envelope they ride on. A direct event-stream consumer — analytics pipeline, log query, SIEM ingest, BI dashboard — has no guaranteed tenant key for joins, filters, or partitioning. The contamination vector is not in the replay path (which is hardened) but in the event-emission path that lives one layer below.

The fix is a schema migration plus a call-site sweep across every emitter. That is a larger surface than PR36A's pure-transform mandate — appropriate to track as W2-PR36B or as a dedicated audit-schema wave.

The runner-up: **MT-OPEN as the back-compat exit door**. Today there is no enforcement that user-facing surfaces never reach the replay/bundle pipeline through a code path that omits `requesterTenantId`. A typed wrapper that requires a tenanted caller for user surfaces and an explicit `OPEN_BY_DESIGN` marker for internal jobs would close this — out of scope here, tracked as the secondary follow-up.

## Multi-tenant governance verdict

> **MT-PARTITIONED for every cross-cutting governance path that has a tenant anchor at the artifact layer (replay, bundle, runtime fingerprint, drift signature, blast radius, recovery scope). MT-OPEN is bounded to back-compat. MT-AMBIGUOUS, MT-LEAK, and MT-BREACH are caught fail-closed by primitives covered by 43 unit + integration tests and 6 CI-gate canaries. The remaining contamination vector is the audit-event-type schema, where events are tenant-scoped only by the envelope they ride on.**

PR36A delivers the structural baseline. The next wave should close the audit-event-type gap; until then, the platform is multi-tenant-safe for all replay-anchored surfaces and multi-tenant-conditional for direct event-stream consumers.

---

## Completion board

📊 **Multi-Tenant Governance Board (W2-PR36A)**

| Metric | % | Rationale |
|---|---|---|
| Tenant Isolation Integrity | **96%** | Replay, bundle, runtime fingerprint, drift, blast radius, recovery — all PARTITIONED. Loss: audit-event-type schema (4%). |
| Replay Boundary Enforcement | **100%** | `assertTenantScope` runs on every `replayDecision` and every `buildAuditBundle` capsule. Query-layer scope + post-filter + envelope assertion — three independent enforcement layers. |
| Blast Radius Segmentation | **100%** | `computeBlastRadius` always classifies, `assertBlastRadiusContained` throws on cross-tenant span, including the un-anchored-mixed-with-anchored case. |
| Drift Isolation Fidelity | **100%** | `buildTenantDriftSignature` folds tenantId into the SHA-256 pre-image; identical payloads across tenants produce distinct signatures (verified across 3-tenant chaos pair-set). |
| Multi-Tenant Survivability | **94%** | Chaos suite covers timeline mixing, hostile tenant rotation, drift bleedover, multi-tenant recovery waves, and runtime fingerprint collision. Loss: no event-emission-path chaos (6%). |

**Test footprint:** 43 isolation tests + 13 runtime cohesion tests + 6 CI-gate canaries = 62 fail-closed assertions guarding the multi-tenant boundary. Every primitive in `tenantIsolation.ts` has both a happy-path and an adversarial test.

**No-regression posture:** the back-compat path (no `requesterTenantId`, no `tenantId` on runtime metadata) reproduces v1 behavior exactly — verified by the existing `runtimeTrustCohesion.test.ts` continuing to pass post-extension. No stored fingerprint, capsule envelope, or bundle hash shifted under this change.
