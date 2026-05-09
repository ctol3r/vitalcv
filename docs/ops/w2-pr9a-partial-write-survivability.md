# W2-PR9A — Partial Write Survivability (Track A)

**Wave:** Wave 2, PR 9A — operational failure survivability certification, partial-write track · **Date:** 2026-05-08 · **Status:** survivability analysis only; **NO product code, NO runtime modification, NO merge** · **Reviewer posture:** operational resilience reviewer · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md`, `MUTATION_GATE_SEQUENCE.md`, `w2-pr5a-audit-certification.md`, `w2-pr6a-audit-spine-certification.md`, `w2-pr7a-audit-event-convergence.md`

This doc enumerates **partial-write failure modes** — scenarios where one part of a logical operation persists while another fails — and certifies how the audit spine survives each.

The central thesis: **partial-write survivability is STRONG for the four C-1 transactional handlers (Postgres ACID); WEAK for the T0 fire-and-forget audit dual-write path; UNDEFINED for the response-delivery boundary on C-2 audit-as-persistence handlers.**

---

## 1. The partial-write taxonomy

A logical operation produces multiple persistent artifacts (mutation row, audit row, outbox event, fire-and-forget side effects, response delivery). Failure modes:

| # | Pattern | Description |
|---|---|---|
| **PW-1** | **Mutation succeeds, audit fails** | Mutation row persists; audit row fails to persist |
| **PW-2** | **Audit succeeds, mutation fails** | Audit row persists; mutation row fails |
| **PW-3** | **Audit succeeds, response delivery fails** | Audit row persists; caller never sees success response |
| **PW-4** | **Both succeed but side effects fail** | Tx commits; SEAL/learning/recompute fire-and-forget fail |
| **PW-5** | **Audit succeeds, dual-write to SIEM fails** | T0 path: in-memory ledger has it; Postgres dual-write fails |
| **PW-6** | **Audit T1 succeeds in DB, in-memory append fails** | Inverse of PW-5 (rare; happens if in-memory ledger overflows or process restarts mid-write) |
| **PW-7** | **Outbox event succeeds, downstream worker never processes** | Outbox row persists; worker queue lag or failure |
| **PW-8** | **Replay-event missing** | An IDEMPOTENT_REPLAY or duplicate_request event should have fired but didn't |
| **PW-9** | **Denial event missing** | Step-2+ denial should have emitted denied audit row but didn't |

---

## 2. Per-handler partial-write certification

### 2.1 C-1 transactional handlers (`accept`, `confirm-start`, `request-refresh`, `route-to-review`)

The atomic `prisma.$transaction` covers PW-1 + PW-2 + PW-5/6 (within tx) + most of PW-9.

| Pattern | Status | Reason |
|---|---|---|
| PW-1 (mutation succeeds, audit fails) | 🟢 **RESILIENT** — tx aborts; both roll back | Postgres ACID |
| PW-2 (audit succeeds, mutation fails) | 🟢 **RESILIENT** — same | Same |
| PW-3 (audit succeeds, response delivery fails) | 🟡 **PARTIAL** — audit persists; caller may not see 2xx | Network + serialization concern; caller may retry |
| PW-4 (side effects fire-and-forget fail) | 🟡 **PARTIAL — intentional** | Side effects intentionally fire-and-forget per `w2-pr2b-side-effect-inventory.md`; failures logged but don't roll back |
| PW-5 (audit dual-write to SIEM fails) | n/a (C-1 uses T2; not T0 dual-write) | T2 writes directly to Postgres; in-memory ledger NOT updated (DL-8) |
| PW-6 (in-memory append fails) | n/a (T2 path doesn't use in-memory) | Same |
| PW-7 (outbox event succeeds, worker never processes) | 🟠 **FRAGMENTED** — depends on worker reliability | Outbox is durable; downstream worker is separate concern |
| PW-8 (replay-event missing) | 🟢 **RESILIENT** post-Lock-v2 — denied audit emits | Lock v2 §8 mandate |
| PW-9 (denial event missing) | 🟡 **PARTIAL** — Step-1 denial silent BY DESIGN | Pre-auth denials don't write audit |

**Aggregate (C-1):** 🟡 **PARTIAL — strong tx atomicity; intentional side-effect fire-and-forget; outbox-worker chain not in scope of audit atomicity.**

### 2.2 C-2 audit-as-persistence handlers (`share-packet`, `packet`)

Cosmetic single-row tx wrap (Lock v2 §6); audit IS the persistence record.

| Pattern | Status | Reason |
|---|---|---|
| PW-1 | n/a | No companion mutation row |
| PW-2 | n/a | Same |
| PW-3 (audit succeeds, response delivery fails) | 🔴 **UNSAFE — audit-vs-delivery divergence** | For share-packet: audit row records share-token issuance; if response stream fails, caller doesn't get the URL but token EXISTS in audit. For packet: audit records "exported"; if ZIP/JSON stream fails mid-flight, caller gets partial bytes; audit says complete |
| PW-4 (side effects fail) | n/a | No side effects beyond logging |
| PW-5/6 | n/a | C-2 uses T2 direct |
| PW-7 (outbox / downstream) | n/a | No outbox |
| PW-8 (replay event) | 🟡 **PARTIAL** — share-packet retry mints fresh token; old still valid until expiry | Audit-as-persistence pattern means dedup-by-correlationId observable but each retry produces a new persistent record |
| PW-9 (denial event) | 🟢 **RESILIENT** post-Lock-v2 | Same as C-1 |

**Aggregate (C-2):** 🟠 **FRAGMENTED — audit persists; response delivery NOT atomic; for share-packet, the issued-but-undelivered token still exists.**

### 2.3 T0 fire-and-forget path (`createAuditEvent` — non-canonical events)

Per `auditService.ts:60–104`. Fire-and-forget Postgres write with CRITICAL log on failure.

| Pattern | Status | Reason |
|---|---|---|
| PW-1 | depends on whether mutation is in same code path; T0 is typically separate | If mutation is T2 elsewhere AND only audit is T0, PW-1 risk = audit-loss while mutation persists |
| PW-2 | n/a (T0 audit doesn't roll back mutation) | Mutation independence |
| PW-5 (T0 fire-and-forget DB fails) | 🟠 **FRAGMENTED** — in-memory ledger has entry; Postgres does NOT; CRITICAL log emitted | Comment at line 75–77: "On DB failure: log CRITICAL but do not throw" |
| PW-6 (in-memory append fails) | 🟢 **RESILIENT** — synchronous; throws on failure | `appendAuditEvent` validation surface |

**Aggregate (T0):** 🟠 **FRAGMENTED — partial-write states exist by design; canonical events use T1/T2 instead.**

### 2.4 T1 synchronous path (`requireAuditBeforeResponse`)

Synchronous DB write before 2xx; throws on failure.

| Pattern | Status | Reason |
|---|---|---|
| PW-1 | 🟢 **RESILIENT** — mutation rolls back on caller's exception handler | Caller doesn't return 2xx; mutation should be in same logical block |
| PW-3 (audit succeeds, response delivery fails) | 🟡 **PARTIAL** — same as C-1 PW-3 | Network concern |

**Aggregate (T1):** 🟢 **RESILIENT — strong fail-closed semantics.**

---

## 3. Orphaned lineage scenarios

### 3.1 OL-1 — Audit row exists, mutation row missing

**Causes:**
- T0 mutation succeeded earlier; T0 audit logged later in same code path; mutation reverted manually (operational error).
- C-2 share-packet / packet pattern: audit is the only persistent record; "mutation row missing" is by design.

**Detection:** query `WHERE referenceId = $X` and verify against the referenced table's existence.

**Severity:** LOW for C-2 (by design); HIGH for any C-1 case (indicates manual intervention).

### 3.2 OL-2 — Mutation row exists, audit row missing

**Causes:**
- T0 fire-and-forget audit dual-write failed silently.
- Audit retention < mutation retention (audit GC'd).
- Pre-Lock-v2 denied attempts (no audit row by design — but mutation also didn't happen, so not truly orphaned).

**Detection:** query mutation table; for each row, verify `audit_event WHERE referenceId = mutation.id` exists.

**Severity:** HIGH — mutation visible without audit trail is a forensic + compliance concern.

### 3.3 OL-3 — Audit row references non-existent mutation

**Causes:**
- Mutation row deleted (GDPR / right-to-erasure).
- Schema migration that re-IDed mutation rows.
- `referenceId` typo at write time (low probability).

**Detection:** join `audit_event.referenceId → mutation_table.id`; verify mutation exists.

**Severity:** MEDIUM — audit historical record persists; current state lookup fails.

### 3.4 OL-4 — Outbox event exists but worker never processed

**Causes:**
- Worker queue lag.
- Worker shutdown without draining.
- Worker code bug.

**Detection:** outbox table query for unprocessed rows older than worker SLA.

**Severity:** depends on worker's purpose (notifications, downstream syncs, etc.).

---

## 4. Fragmented audit chains

A logical operation produces a chain of audit events:

```
RECOGNITION → ACCEPTANCE / EMPLOYER_REVIEW_ACCEPTED → START_ATTESTED
   ↓                ↓                                       ↓
audit row 1     audit row 2                            audit row 3
```

Cross-row joining via `metadata.traceId` (when populated) OR `referenceId` chain (StartAttestation.acceptanceId → EmployerAcceptance.id → audit.referenceId).

### 4.1 Chain fragmentation modes

| # | Fragmentation | Cause |
|---|---|---|
| **CF-1** | Missing intermediate event | T0 audit failed for one event; downstream events have no anchor for chain reconstruction |
| **CF-2** | Trace ID drift | Different events in chain have different traceIds (upstream propagation gap) |
| **CF-3** | Vocabulary drift in chain | Some events use canonical literal; others use free-form alias (e.g., ACCEPTANCE → EMPLOYER_REVIEW_ACCEPTED → START_ATTESTED uses 3 different vocabularies) |
| **CF-4** | Time-skew across writers | Different process clocks slightly off; chain ordering ambiguous |
| **CF-5** | Audit retention drops middle event | Older events GC'd; chain reconstruction returns gap |

**Detection:** chain reconstruction queries (`canonical-query-model.md` Q-CANON-8) returning fewer rows than expected.

**Severity:** MEDIUM — chain visible but incomplete; lineage integrity weakened.

---

## 5. Attribution discontinuity

A logical operation's attribution can drift across the chain:

| # | Discontinuity | Cause |
|---|---|---|
| **AD-1** | Acceptance attributed to actor A, START_ATTESTED to actor B | Different actors performed acceptance vs start (legitimate; both within same org likely) — but cross-actor attribution-at-decision must be queryable |
| **AD-2** | `metadata.actorId` populated in some rows; `metadata.employerId` in others | Lock v2 transition; both fields carried during deprecation timeline |
| **AD-3** | Actor identity changes mid-chain (Clerk userId rotation) | Rare but possible |
| **AD-4** | One row in chain has actorId = 'system' | Pre-Lock-v2 audit writes by system service; not user-attributable |
| **AD-5** | Stale-session window: actor's org membership changed mid-chain | Deferred per `AUTHORIZATION_BASELINE_V1.md` §5.1 |

**Detection:** query chain by traceId or referenceId; verify actorId consistency.

**Severity:** depends on whether the discontinuity is intended (multi-actor flow) or unintended (Clerk rotation, stale session).

---

## 6. Silent degradation modes

Where partial writes degrade silently (no caller-visible signal):

| # | Silent degradation | Visibility |
|---|---|---|
| **SD-1** | T0 fire-and-forget DB fails | CRITICAL log only; caller sees 2xx |
| **SD-2** | C-2 response stream fails after audit commit | Caller sees error; audit says success |
| **SD-3** | Outbox worker silently fails | No caller-visible signal; downstream effects missing |
| **SD-4** | Side effects (SEAL, learning, recompute) fail | Logged warnings; caller unaware |
| **SD-5** | In-memory ledger overflow before dual-write | Possible CRITICAL log; SIEM stream gap |
| **SD-6** | Audit retention drops old rows | Forensic queries silently return less data |
| **SD-7** | Denial-path emission missed because handler returned early without audit call | Bug-class; should be caught by code review |

**Severity:** SD-1, SD-3, SD-5, SD-6, SD-7 are HIGH — they degrade observability without alerting. Operational alerting on CRITICAL log volume + worker queue lag mitigates.

---

## 7. Partial-write survivability classifications

### 7.1 Per-pattern (post-Lock-v2 + recommendations)

| Pattern | C-1 handlers | C-2 handlers | T0 path | T1 path |
|---|---|---|---|---|
| PW-1 mutation succeeds, audit fails | 🟢 RESILIENT | n/a | 🟠 FRAGMENTED | 🟢 RESILIENT |
| PW-2 audit succeeds, mutation fails | 🟢 RESILIENT | n/a | 🟢 RESILIENT (audit independent) | 🟢 RESILIENT |
| PW-3 audit succeeds, response delivery fails | 🟡 PARTIAL | 🔴 UNSAFE (audit-vs-delivery divergence for share-packet/packet) | n/a | 🟡 PARTIAL |
| PW-4 side effects fire-and-forget fail | 🟡 PARTIAL (intentional) | n/a | n/a | n/a |
| PW-5 dual-write SIEM fails | n/a | n/a | 🟠 FRAGMENTED | n/a |
| PW-6 in-memory append fails | n/a | n/a | 🟢 RESILIENT (throws) | n/a |
| PW-7 outbox succeeds, worker fails | 🟠 FRAGMENTED | n/a | n/a | n/a |
| PW-8 replay-event missing | 🟢 RESILIENT post-Lock-v2 | 🟡 PARTIAL | 🟡 depends | 🟢 RESILIENT |
| PW-9 denial-event missing | 🟡 PARTIAL (Step-1 silent BY DESIGN) | 🟡 PARTIAL | 🟡 PARTIAL | 🟡 PARTIAL |

### 7.2 Aggregate per-handler

| Handler | Aggregate |
|---|---|
| `accept` (C-1) | 🟡 **PARTIAL** — strong tx atomicity; intentional side-effect fire-and-forget; outbox worker out of scope |
| `confirm-start` (C-1) | 🟡 **PARTIAL** — same |
| `request-refresh` (C-1) | 🟡 **PARTIAL** — same |
| `route-to-review` (C-1) | 🟡 **PARTIAL** — same; HITL silent-degrade caveat |
| `share-packet` (C-2) | 🟠 **FRAGMENTED** — audit-vs-delivery divergence; PW-3 critical for token-issued-but-undelivered case |
| `packet` (C-2) | 🟠 **FRAGMENTED** — same; export-bytes-vs-audit-row divergence |
| Generic T0 paths (out of W2-PR2B scope) | 🟠 **FRAGMENTED** — fire-and-forget by design |
| Generic T1 paths (5 canonical non-repudiation events) | 🟢 **RESILIENT** — synchronous fail-closed |

---

## 8. Recommendations

| # | Recommendation | Priority |
|---|---|---|
| **PW-Rec-1** | For C-2 handlers: capture response-delivery success/failure as a separate audit row (post-mutation) so PW-3 is forensically queryable | MEDIUM |
| **PW-Rec-2** | Document T0 fire-and-forget partial-write semantics in operational runbook; ensure wave-scope handlers do NOT use T0 | HIGH |
| **PW-Rec-3** | Add Sentry breadcrumb on T0 CRITICAL log emission for partial-write detection | MEDIUM |
| **PW-Rec-4** | For outbox events: define worker-SLA + alerting on un-processed-row backlog | MEDIUM |
| **PW-Rec-5** | Document chain-fragmentation modes in operational runbook with reconstruction queries | HIGH |
| **PW-Rec-6** | Document attribution-discontinuity scenarios with example detection queries | MEDIUM |
| **PW-Rec-7** | Operational alerting on silent-degradation modes (SD-1, SD-3, SD-5, SD-6, SD-7) | HIGH |

---

## 9. Track A determination

| Question | Answer |
|---|---|
| Are mutation+audit atomic for C-1 handlers? | YES — 🟢 RESILIENT |
| Is response-delivery atomic with audit for C-2 handlers? | NO — 🔴 UNSAFE PW-3 divergence |
| Is T0 fire-and-forget partial-write survivable? | PARTIAL — 🟠 FRAGMENTED (intentional) |
| Are silent-degradation modes enumerated? | YES — 7 (SD-1..SD-7) |
| Are orphaned-lineage modes enumerated? | YES — 4 (OL-1..OL-4) |
| Are fragmented-chain modes enumerated? | YES — 5 (CF-1..CF-5) |
| Are attribution-discontinuity modes enumerated? | YES — 5 (AD-1..AD-5) |

**Track A classification:** 🟡 **PARTIAL — RESILIENT for C-1 transactional handlers; FRAGMENTED for C-2 audit-as-persistence handlers (PW-3 audit-vs-delivery divergence); FRAGMENTED for T0 fire-and-forget (intentional).**

---

## 10. Closing principle (Track A)

Partial-write survivability is the discipline of making each failure mode either ATOMIC (rolled back) or EXPLICITLY OBSERVABLE (logged + alertable). The wave's C-1 handlers achieve atomicity via `prisma.$transaction`. The C-2 handlers preserve audit but NOT delivery. The T0 path is intentionally fire-and-forget. Each design choice has trade-offs.

**The platform survives partial writes IF: (a) C-1 handlers are used for canonical mutations, (b) C-2 audit-as-persistence is documented as such, (c) T0 fire-and-forget failures alert operationally, (d) orphan + chain + attribution discontinuities are queryable.** The wave's contribution is enumeration; the durable mitigation is operational alerting + runbook discipline.
