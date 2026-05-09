# Runtime Trust-Class Map

**Status:** **OPERATIONAL** — frozen reference for VitalCV runtime path → trust-class assignments · **Date established:** 2026-05-08 · **Authority:** subordinate to `trust-class-taxonomy.md`, `audit-event-vocabulary-map.md`

This doc maps every runtime mutation/audit/replay/denial/export path to its operational trust class (C-1 / C-2 / T0 / R0 / D0). Goal: **every operator + dashboard + Codex audit can reason about which guarantees apply to which path.**

---

## 1. Class assignment matrix — wave-scope handlers (post-Lock-v2)

| # | Runtime path | File | Trust class | Sub-classes (R0/D0) |
|---|---|---|---|---|
| 1 | `accept` → `recordEmployerReviewAcceptance` | `apps/api/backend/src/services/entity/employerReviewActions.ts:692` | 🟢 **C-1** | + R0-Lock-v2-Denial (retry); + D0-Step-2/4/5 |
| 2 | `confirm-start` → inline `prisma.$transaction` | `apps/api/backend/src/routes/employerActions.ts:863` | 🟢 **C-1** | + D0-Step-2/4/5 |
| 3 | `request-refresh` → `recordEmployerReviewRefreshRequest` | `apps/api/backend/src/services/entity/employerReviewActions.ts:814` | 🟢 **C-1** | + R0-Lock-v2-Denial; + D0-Step-2/4/5 |
| 4 | `route-to-review` → `recordEmployerReviewRouting` | `apps/api/backend/src/services/entity/employerReviewActions.ts:903` | 🟢 **C-1** (with HITL try/catch silent-degrade caveat) | + D0-Step-2/4/5 |
| 5 | `share-packet` → `prisma.$transaction(tx => tx.auditEvent.create)` (post-Lock-v2) | `apps/api/backend/src/routes/employerActions.ts:660` | 🟡 **C-2** (cosmetic single-row tx) | + D0-Step-2/5 |
| 6 | `packet` (audit-emitting GET) → same | `apps/api/backend/src/routes/employerActions.ts:561` | 🟡 **C-2** | + D0-Step-2 |
| 7 | `view` (POST, no audit) | `apps/api/backend/src/routes/pilotKpi.ts:128` | n/a — no audit emission | n/a |

---

## 2. Class assignment — broader audit infrastructure

| # | Runtime path | File | Trust class | Notes |
|---|---|---|---|---|
| 8 | `requireAuditBeforeResponse` (T1 synchronous) | `auditService.ts:130` | 🟢 **C-1-equivalent** (T1) | Throws on DB failure; caller does not return 2xx; used by 5 canonical non-repudiation events |
| 9 | `createAuditEvent` (T0 fire-and-forget) | `auditService.ts:60` | 🟠 **T0** | In-memory + best-effort Postgres; CRITICAL log on failure |
| 10 | `appendAuditEvent` (in-memory only) | `auditLedger.ts:108` | 🟢 **C-1-equivalent for in-memory** | Synchronous; throws on validation; in-memory durability only |
| 11 | `exportAuditPage` / `exportSinceTime` (SIEM cursor) | `auditLedger.ts:162, 191` | n/a — read path; covers EX-1/EX-2 export | DL-8 SIEM coverage gap for T2 writers |

---

## 3. Class assignment — adjacent canonical paths (out of W2-PR2B scope)

| # | Runtime path | File | Trust class | Notes |
|---|---|---|---|---|
| 12 | `apps/api/backend/src/routes/passportEntity.ts` PASSPORT_SHARED | line 233 area | 🟢 **C-1-equivalent (T1)** per requireAuditBeforeResponse | Per non-repudiation list at auditService.ts:113 |
| 13 | `apps/api/backend/src/routes/hiring.ts` EMPLOYER_ACCEPTANCE_CREATED + START_ATTESTED | (in hiring.ts) | 🟢 **C-1-equivalent (T1)** per requireAuditBeforeResponse | Same |
| 14 | `apps/api/backend/src/services/ingest/ingestOrchestrator.ts` NPI_INGESTED | line 422 area | 🟢 **C-1-equivalent (T1)** | Same |

---

## 4. Class assignment — replay-instrumentation paths (R0)

| # | R0 sub-class | Substrate location | Used by |
|---|---|---|---|
| 15 | R0-Canonical (`IDEMPOTENT_REPLAY`) | `packages/audit/AuditEvent.ts:25` enum + `packages/audit/AuditScrapbook.ts:88` | UNVERIFIED in employer-review surface; used elsewhere |
| 16 | R0-Concurrency (`CONCURRENCY_GUARD_TRIGGERED`) | `packages/audit/AuditEvent.ts:26` + `packages/audit/AuditScrapbook.ts:90` | UNVERIFIED in employer-review surface |
| 17 | R0-Lock-v2-Denial (`<base>.duplicate_request`) | Lock v2 §8 — emitted at correlationId-dedup gate | All 5 mutating handlers post-Lock-v2 |
| 18 | R0-Lock-v2-Existing (`<base>.already_accepted`) | Lock v2 + `accept` handler's existing duplicate-check | `accept` (employerActions.ts:175 → audit emission post-Lock-v2) |

---

## 5. Class assignment — denial-instrumentation paths (D0)

| # | D0 sub-class | Substrate | Coverage |
|---|---|---|---|
| 19 | D0-Step-2 (RBAC) | `metadata.action LIKE '%role_denied' OR '%no_org_context'` | All 5 mutating handlers post-Lock-v2 |
| 20 | D0-Step-4 (Ownership) | `metadata.action LIKE '%entity_not_found'` (today); `'cross_tenant'` post-MIG-C | All 5 + `packet` post-Lock-v2 |
| 21 | D0-Step-5 (Workflow) | `metadata.action LIKE '%acceptance_blocked' OR '%already_accepted' OR '%no_prior_acceptance' OR '%duplicate_request' OR '%malformed_resource_id' OR '%archived_review' OR '%wrong_review_state'` | All 5 mutating handlers post-Lock-v2 |
| 22 | D0-Step-1-Silent (no auth) | (no row by design) | All routes that require auth |
| 23 | D0-Step-6-Silent (tx rollback) | (no row by Postgres ACID) | All C-1 handlers |

---

## 6. Hidden class ambiguity

### 6.1 HCA-1 — `accept`'s existing duplicate-check (line 175) is OUTSIDE the tx

`apps/api/backend/src/routes/employerActions.ts:175` — `prisma.employerAcceptance.findFirst({...status: 'ACCEPTED'})` runs BEFORE the `prisma.$transaction` block. Pre-tx read.

**Class implication:** while the WRITE is C-1, the PRE-TX READ has no atomicity guarantee. TOCTOU race window exists between the read and the tx commit.

**Operator mistake:** treating "accept is C-1" as meaning "duplicate-check is atomic with insert." It is NOT.

### 6.2 HCA-2 — `route-to-review`'s HITL silent-degrade

`apps/api/backend/src/services/entity/employerReviewActions.ts:932` — `tx.hITLReviewItem?.create({...})` wrapped in try/catch.

**Class implication:** the audit row commits even if HITL doesn't. C-1 atomicity holds for outbox + audit, NOT for HITL row.

**Operator mistake:** treating "route-to-review is C-1" as meaning "HITL row is guaranteed." It is NOT (depends on HITL model presence).

**Audit visibility:** audit metadata records `reviewItemCreated: false` per `recordEmployerReviewRouting`.

### 6.3 HCA-3 — Side-effect post-tx fire-and-forget

All C-1 handlers fire side effects (SEAL, learning, recompute) AFTER the tx commits, with `void` discard. These are T0-equivalent for failure semantics.

**Class implication:** the C-1 path has C-1 atomicity for mutation+audit ONLY. Side-effect coupling is T0-grade.

**Operator mistake:** assuming "C-1 means everything is atomic." Side effects are intentionally NOT.

### 6.4 HCA-4 — `appendAuditEvent` synchronous BUT in-memory only

`auditLedger.ts:108` — `appendAuditEvent` synchronously appends to in-memory ledger. Throws on validation failure.

**Class implication:** STRONG within-process atomicity. ZERO cross-process durability. Consumer reading from in-memory loses entries on process restart unless dual-write fired.

**Operator mistake:** assuming "auditLedger is durable." It is for IN-MEMORY only; Postgres durability requires the dual-write.

### 6.5 HCA-5 — `prisma.$transaction` isolation level not explicitly set

`prisma.$transaction((tx) => ...)` uses Prisma's default isolation (typically READ COMMITTED for Postgres). Higher levels (REPEATABLE READ, SERIALIZABLE) would close phantom-read concerns but introduce serialization-failure / contention.

**Class implication:** C-1 atomicity is per-row + within-tx; cross-tx serialization is NOT guaranteed.

**Operator mistake:** assuming "C-1 means cross-actor concurrency is serialized." It is NOT.

---

## 7. Misleading survivability assumptions

| # | Assumption | Reality | Severity |
|---|---|---|---|
| **MS-1** | "All audit-emitting paths are C-1" | T0 paths exist (e.g., `createAuditEvent`); C-2 paths exist for share-packet/packet | HIGH |
| **MS-2** | "SIEM stream has every audit event" | DL-8 SIEM coverage gap for T2-direct writers | HIGH |
| **MS-3** | "Every denied attempt produces an audit row" | Step-1 + Step-6 silent BY DESIGN | MEDIUM |
| **MS-4** | "Replay events are prevented" | Replay observability + best-effort dedup; NOT prevention | HIGH (lexicon-forbidden phrase) |
| **MS-5** | "C-2 audit means delivery succeeded" | Audit-vs-delivery divergence (PW-3) | HIGH |
| **MS-6** | "The 5 canonical non-repudiation events all use T2 atomic" | They use T1 (`requireAuditBeforeResponse`) which is synchronous-throws-on-failure but NOT in-tx with mutation | MEDIUM |
| **MS-7** | "T0 fire-and-forget is reliable enough" | DB failure window + in-memory loss on process restart | MEDIUM |
| **MS-8** | "Side effects are atomic with mutation" | Fire-and-forget by design | HIGH |
| **MS-9** | "Anchored audit is in production" | L3 anchoring pipeline UNVERIFIED for the 6 in-scope event types | HIGH |
| **MS-10** | "Audit retention is unlimited" | UNDOCUMENTED SLA; gate G7 | MEDIUM |

---

## 8. Partial-write exposure per path

Per `w2-pr9a-partial-write-survivability.md` patterns PW-1..PW-9:

| Runtime path | Partial-write exposures |
|---|---|
| `accept` (C-1) | PW-3 (audit succeeds, response delivery fails — bounded by C-1 atomicity within tx); PW-4 (side effects fail); PW-7 (outbox worker) |
| `confirm-start` (C-1) | Same |
| `request-refresh` (C-1) | Same; PW-4 only |
| `route-to-review` (C-1) | Same; HITL silent-degrade is INSIDE tx so atomic with audit |
| `share-packet` (C-2) | **PW-3 (audit-vs-delivery divergence — STRUCTURAL)** |
| `packet` (C-2) | **PW-3 (audit-vs-delivery divergence — STRUCTURAL)** |
| `createAuditEvent` (T0) | **PW-5 (T0 dual-write fail — STRUCTURAL by design)** + PW-6 (in-memory volatile) |
| `requireAuditBeforeResponse` (T1) | PW-3 (audit succeeds, response delivery fails — bounded by caller) |

---

## 9. Async lineage risk per path

| Runtime path | Async lineage risk |
|---|---|
| C-1 handlers | Side-effects post-tx are T0-equivalent for lineage; SEAL/learning/recompute may not propagate correlationId |
| C-2 handlers | Response-delivery is async-equivalent (network); PW-3 |
| T0 path | Dual-write to Postgres is async (Promise discard); DC-Rec-2 doesn't apply |
| `view` POST | `captureAdvisoryEvent` is fire-and-forget; no audit row at all |
| Outbox events from C-1 | Worker processes async; downstream lineage depends on worker reliability |

---

## 10. Per-handler aggregate class profile

| Handler | Primary class | Sub-classes active | Hidden ambiguities | Aggregate operational profile |
|---|---|---|---|---|
| `accept` | 🟢 C-1 | R0-Lock-v2-Denial + R0-Lock-v2-Existing + D0-Step-2/4/5 | HCA-1 (pre-tx duplicate-check), HCA-3 (side-effects T0), HCA-5 (isolation) | 🟢 **C-1 with explicit caveats** |
| `confirm-start` | 🟢 C-1 | D0-Step-2/4/5 | HCA-3, HCA-5; deprecation-window race for fallback-to-most-recent | 🟢 **C-1 with deprecation-window caveat** |
| `request-refresh` | 🟢 C-1 | R0-Lock-v2-Denial + D0-Step-2/4/5 | HCA-3, HCA-5 | 🟢 **C-1 with side-effect caveats** |
| `route-to-review` | 🟢 C-1 | D0-Step-2/4/5 | HCA-2 (HITL silent-degrade), HCA-3, HCA-5 | 🟢 **C-1 with HITL caveat** |
| `share-packet` | 🟡 C-2 | D0-Step-2/5 | PW-3 audit-vs-delivery; audit-as-persistence pattern | 🟡 **C-2 — audit-as-persistence; delivery NOT atomic** |
| `packet` | 🟡 C-2 | D0-Step-2 | PW-3; export-bytes-vs-audit-row divergence | 🟡 **C-2 — export-bytes NOT atomic with audit** |
| `view` | n/a | n/a | No audit row at all | n/a — telemetry-only path |

---

## 11. Closing principle (runtime trust-class map)

The map prevents the most dangerous operational mistake: **assuming every audit-emitting path has C-1 atomicity.** It does NOT. The wave's 6 handlers split 4-C-1 / 2-C-2; the broader audit infrastructure includes T0 / T1 / R0 / D0 paths; each carries different guarantees.

**Operators consult this map before trusting an audit-emitting path. Dashboards label the path's class. Codex audits verify wave PRs declare correct class assignments + hidden-ambiguity caveats.**

The runtime is honest about what it does. The map makes the runtime honesty queryable.
