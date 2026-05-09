# Trust-Class Taxonomy

**Status:** **CONSTITUTIONAL** — frozen reference for VitalCV operational trust classes · **Date established:** 2026-05-08 · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md`, `MUTATION_GATE_SEQUENCE.md`, `audit-event-vocabulary-map.md`, `replay-taxonomy-map.md`, `canonical-query-model.md`, `w2-pr9a-operational-resilience-matrix.md`

This doc formalizes **VitalCV's operational trust classes** — a small, named set of guarantee profiles that runtime paths inherit. Goal: **prevent T0 paths from being mistaken for C-1 guarantees.** Operators, dashboards, and Codex audits classify every runtime path against this taxonomy.

The taxonomy: **C-1, C-2, T0, R0, D0.**

---

## 1. The 5 trust classes

| Class | Name | One-sentence definition |
|---|---|---|
| **C-1** | **Transactional canonical** | Mutation + audit row co-commit in a single Postgres `prisma.$transaction`; failure of either rolls back both |
| **C-2** | **Cosmetic transactional** | Single audit row wrapped in a `prisma.$transaction` (no companion mutation); audit IS the persistence record; delivery side is NOT atomic |
| **T0** | **Fire-and-forget eventual** | Audit write dispatched via `void`-discarded Promise OR `.catch(...)` that swallows errors; in-memory ledger has the entry but Postgres dual-write may fail silently |
| **R0** | **Replay-instrumentation** | Operations that emit replay-related audit events (`IDEMPOTENT_REPLAY`, `CONCURRENCY_GUARD_TRIGGERED`, `<base>.duplicate_request`); observability-grade, NOT prevention-grade |
| **D0** | **Denial-instrumentation** | Operations that emit denied audit rows post-Lock-v2 (`metadata.outcome: 'denied'`); covers Step-2+ denials only; Step-1 (no auth) and Step-6 (tx rollback) intentionally silent |

---

## 2. Per-class certification dimensions

Each class is profiled across 7 dimensions:

| Dimension | What it measures |
|---|---|
| **Lineage durability** | Survival of the audit row + chain across process restart / DB outage / retention sweep |
| **Replay survivability** | Visibility of replay attempts (R-OBSERVED / R-DENIED / R-ACCEPTED / R-COLLAPSED) |
| **Attribution durability** | Survival of `metadata.actorId` + chain attribution across degraded conditions |
| **Export durability** | Visibility through EX-1 SIEM, EX-2 SIEM time, EX-3 Postgres direct, EX-4 scrapbook |
| **Denial survivability** | Emission + persistence of denied audit rows (post-Lock-v2 + DC-Rec-2 mandate) |
| **Async survivability** | Survival across worker delays, side-effect dispatch, scheduled-job lag |
| **Forensic survivability** | Reconstructibility of full lineage 6+ months later (depends on retention SLA) |

---

## 3. C-1 — Transactional canonical

**Substrate:** `prisma.$transaction(async (tx) => { await tx.<mutation>.create(...); await tx.outboxEvent.create(...); await tx.auditEvent.create(...); })`.

**Wave-scope handlers:** `accept`, `confirm-start`, `request-refresh`, `route-to-review`.

**Guarantees:**

| Dimension | Status | Wording |
|---|---|---|
| Lineage durability | 🟢 STRONG | Atomic mutation+audit; both commit OR both roll back |
| Replay survivability | 🟢 STRONG post-Lock-v2 | correlationId-stamped on permitted + denied audit rows |
| Attribution durability | 🟢 STRONG (within scope of T2 topology assumption) | actorId in `metadata.actorId`; survives audit retention |
| Export durability | 🟡 PARTIAL — EX-3 STRONG; EX-1/EX-2 FRAGMENTED (DL-8 SIEM gap) | Audit visible in Postgres direct; bypasses in-memory ledger |
| Denial survivability | 🟢 STRONG post-Lock-v2 + DC-Rec-2 | Step-2+ denials emit denied audit rows |
| Async survivability | 🟡 PARTIAL | Mutation+audit committed before async side effects fire; side-effect failure does NOT roll back |
| Forensic survivability | 🟡 PARTIAL — DEPENDS on retention SLA | Postgres durable indefinitely IF retention permits |

**Lexicon-aligned wording:** "atomic mutation+audit for the four C-1 handlers; tamper-evident given DB integrity (L2)."

---

## 4. C-2 — Cosmetic transactional

**Substrate:** `prisma.$transaction(async (tx) => { await tx.auditEvent.create(...); })` — single-row tx wrap (Lock v2 §6).

**Wave-scope handlers:** `share-packet`, `packet`.

**Guarantees:**

| Dimension | Status | Wording |
|---|---|---|
| Lineage durability | 🟡 PARTIAL — audit IS the persistence record; no companion mutation row | Audit row commits atomically; "atomic" wording is cosmetic vs C-1 |
| Replay survivability | 🟡 PARTIAL | correlationId stamped; share-packet retry mints fresh token (R-ACCEPTED-equivalent) |
| Attribution durability | 🟢 STRONG | actorId stamped |
| Export durability | 🟡 PARTIAL — same as C-1 (EX-3 STRONG; SIEM FRAGMENTED) | |
| Denial survivability | 🟡 PARTIAL post-Lock-v2 | Step-2+ denials emit |
| Async survivability | n/a — no async side effects on C-2 | |
| Forensic survivability | 🟠 FRAGMENTED — audit IS the share-token / export receipt; retention DIRECTLY affects token TTL | Operationally: audit retention SLA must respect longest token TTL |

**KEY DIFFERENCE FROM C-1:** the response-delivery side is NOT atomic (PW-3 from `w2-pr9a-partial-write-survivability.md`). Audit row says "issued/exported"; caller may not have received the URL/bytes.

**Lexicon-aligned wording:** "single-row tx wrap for code uniformity; audit-as-persistence pattern; delivery NOT atomic with audit."

---

## 5. T0 — Fire-and-forget eventual

**Substrate:** `apps/api/backend/src/services/audit/auditService.ts:60` (`createAuditEvent`). Calls `appendAuditEvent` (in-memory) then `void prisma.auditEvent.create({...}).catch(...)` — Postgres dual-write fire-and-forget with CRITICAL log on failure.

**Wave-scope handlers:** NONE — wave's 6 in-scope handlers do NOT use T0.

**Used by:** non-canonical events; operational telemetry; auxiliary audit emissions.

**Guarantees:**

| Dimension | Status | Wording |
|---|---|---|
| Lineage durability | 🟠 FRAGMENTED — partial-write states exist by design | In-memory ledger entry + best-effort Postgres dual-write |
| Replay survivability | 🟠 FRAGMENTED | Lock v2 NOT applicable to T0 path |
| Attribution durability | 🟠 FRAGMENTED — in-memory lost on process restart pre-dual-write | T0 dual-write race window |
| Export durability | 🟡 PARTIAL — SIEM stream covers; Postgres may have partial coverage | SIEM stream sees in-memory entries IF dual-write hasn't fired yet |
| Denial survivability | n/a — T0 not designed for denial-path | |
| Async survivability | n/a — T0 IS the async path | |
| Forensic survivability | 🟠 FRAGMENTED | Postgres rows present only if dual-write succeeded |

**Lexicon-aligned wording:** "T0 fire-and-forget audit dual-write; in-memory ledger primary, Postgres best-effort with CRITICAL log on failure."

**CRITICAL operator-discipline:** **T0 paths are NOT C-1 paths.** A consumer that reads audit rows via Postgres direct (EX-3) and assumes T0 events are present is making an unsafe assumption.

---

## 6. R0 — Replay-instrumentation

**Substrate:** Operations that emit replay-related audit events.

**Sub-classes:**

- **R0-Canonical:** `IDEMPOTENT_REPLAY` (canonical AUDIT_EVENT_TYPES) — operation processed as idempotent repeat.
- **R0-Concurrency:** `CONCURRENCY_GUARD_TRIGGERED` (canonical) — concurrency guard fired.
- **R0-Lock-v2-Denial:** `<base>.duplicate_request` (Lock v2 metadata.action) — application-layer dedup denial.
- **R0-Lock-v2-Existing:** `<base>.already_accepted` (Lock v2 + existing handler) — content-match denial.

**Guarantees (per state — see `replay-taxonomy-map.md`):**

| State | Lineage | Attribution | Export | Forensic |
|---|---|---|---|---|
| R-OBSERVED (R0-Canonical) | 🟢 STRONG (Postgres durable) | 🟢 STRONG | 🟢 STRONG (canonical event type) | 🟢 STRONG |
| R-DENIED (R0-Lock-v2-Denial) | 🟢 STRONG (T2 atomic) | 🟢 STRONG | 🟡 PARTIAL (SIEM gap; EX-3 strong) | 🟢 STRONG |
| R-ACCEPTED (no marker) | n/a — no row | n/a | n/a — forensic detection only | 🟠 FRAGMENTED (requires payloadHash) |
| R-COLLAPSED (R0-Concurrency) | 🟢 STRONG | 🟢 STRONG | 🟢 STRONG | 🟢 STRONG |
| R-AMBIGUOUS | 🟡 PARTIAL — multi-row scenario | 🟡 PARTIAL | 🟡 PARTIAL | 🟡 PARTIAL — disambiguation queries |

**Lexicon-aligned wording:** "replay observability + best-effort idempotency check via correlationId; replay-protected/replay-resistant phrasing FORBIDDEN per `TRUST_GUARANTEE_LEXICON.md` §1.3."

---

## 7. D0 — Denial-instrumentation

**Substrate:** Operations that emit denied audit rows post-Lock-v2 with `metadata.outcome: 'denied'` + `metadata.action: '<base>.<reason>'`.

**Sub-classes:**

- **D0-Step-2:** RBAC denials (role_denied, no_org_context).
- **D0-Step-4:** Ownership denials (entity_not_found, cross_tenant when MIG-C lands).
- **D0-Step-5:** Workflow denials (acceptance_blocked, already_accepted, no_prior_acceptance, archived_review, wrong_review_state, malformed_resource_id).
- **D0-Replay:** Replay denials (duplicate_request — overlaps with R0).
- **D0-Step-1-Silent:** No-auth denials — INTENTIONALLY NOT EMITTED (no actor to record).
- **D0-Step-6-Silent:** Tx-rollback denials — INTENTIONALLY NOT EMITTED (no row by Postgres ACID).

**Guarantees:**

| Dimension | D0-Step-2 / D0-Step-4 / D0-Step-5 / D0-Replay | D0-Step-1-Silent / D0-Step-6-Silent |
|---|---|---|
| Lineage durability | 🟢 STRONG post-Lock-v2 | 🔴 BY DESIGN ABSENT |
| Attribution durability | 🟢 STRONG | n/a (no actor / no row) |
| Export durability | 🟡 PARTIAL — EX-3 STRONG; SIEM FRAGMENTED | n/a |
| Denial survivability (the meta-property) | 🟢 STRONG post-Lock-v2 + DC-Rec-2; 🔴 COLLAPSED if regression (F-4) | n/a |

**Lexicon-aligned wording:** "denial emission for Step-2+ paths post-Lock-v2; pre-auth and tx-rollback denials intentionally NOT audit-emitting (web-layer logs cover pre-auth)."

**CRITICAL operator-discipline:** Step-1 + Step-6 silent gaps must be DISCLOSED. A consumer that assumes "every denied attempt produces an audit row" is making an unsafe assumption.

---

## 8. Per-class summary table

| Class | Lineage | Replay | Attribution | Export | Denial | Async | Forensic |
|---|---|---|---|---|---|---|---|
| **C-1** | 🟢 STRONG | 🟢 STRONG | 🟢 STRONG | 🟡 PARTIAL | 🟢 STRONG | 🟡 PARTIAL | 🟡 PARTIAL |
| **C-2** | 🟡 PARTIAL | 🟡 PARTIAL | 🟢 STRONG | 🟡 PARTIAL | 🟡 PARTIAL | n/a | 🟠 FRAGMENTED |
| **T0** | 🟠 FRAGMENTED | 🟠 FRAGMENTED | 🟠 FRAGMENTED | 🟡 PARTIAL | n/a | n/a | 🟠 FRAGMENTED |
| **R0** | varies (see §6) | (this IS the dimension) | 🟢 STRONG | varies | varies | n/a | varies |
| **D0** | 🟢 STRONG / 🔴 BY DESIGN ABSENT | n/a | 🟢 STRONG | 🟡 PARTIAL | (this IS the dimension) | n/a | 🟡 PARTIAL |

---

## 9. Class-substitution rules

**Operationally CRITICAL:** these classes are NOT substitutable.

| Mistake | Hazard |
|---|---|
| Treating T0 as C-1 | Assumes atomic mutation+audit; T0 is fire-and-forget. Mutation may persist while audit is lost. |
| Treating C-2 as C-1 | Assumes mutation+audit atomicity; C-2 has audit-as-persistence + non-atomic delivery. |
| Treating R-OBSERVED as R-DENIED | Opposite outcomes. Conflating means treating processed-replay as rejected. |
| Treating D0-Step-1-Silent as audit-emitted | Assumes pre-auth probes audit; they don't. |
| Treating SIEM stream as canonical for D0-Lock-v2 denials | DL-8 SIEM gap — T2 writers bypass in-memory ledger; SIEM misses Lock v2 denied rows. |
| Treating C-2 audit row as proof of delivery | Audit row records "issued/exported"; caller may not have received. |

---

## 10. Class assignment per runtime path

For every audit-emitting runtime path, the assigned class:

| Runtime path | Class |
|---|---|
| `accept` route → `recordEmployerReviewAcceptance` (post-Lock-v2) | **C-1** + R0-Lock-v2-Denial (on retry) + D0-Step-5 (on workflow gate) |
| `confirm-start` route → inline `prisma.$transaction` | **C-1** + D0-Step-5 |
| `request-refresh` → `recordEmployerReviewRefreshRequest` | **C-1** + R0-Lock-v2-Denial |
| `route-to-review` → `recordEmployerReviewRouting` | **C-1** + D0-Step-5 |
| `share-packet` → `prisma.$transaction(tx => tx.auditEvent.create)` (post-Lock-v2) | **C-2** + D0-Step-5 |
| `packet` → same | **C-2** + D0-Step-5 |
| `auditService.createAuditEvent` (non-canonical events) | **T0** |
| `requireAuditBeforeResponse` (5 canonical non-repudiation events) | **C-1-equivalent** (T1 synchronous; throws on failure) |
| Web middleware degraded auth fail-closed | not audit-emitting; web-layer log only |

---

## 11. Update protocol

This taxonomy is amended when:

- A new trust class is identified (e.g., a proposed `C-3` for cross-region replicated tx).
- A new substrate is introduced (e.g., DPoP nonce → new R0-Cryptographic sub-class).
- A class's profile changes (e.g., MIG-A DB UNIQUE introduces R-COLLAPSED for wave handlers).

Updates require:

1. Founder approval per `TRUST_GUARANTEE_LEXICON.md` §6.
2. Codex SAFE audit confirming the new class doesn't conflict with existing classes.
3. Update to `runtime-trust-class-map.md` with class assignments.

---

## 12. Closing principle (taxonomy)

The trust-class taxonomy is the operational vocabulary for what each runtime path actually guarantees. It prevents the most dangerous operator mistake: assuming all audit-emitting paths have C-1 atomicity. They do NOT.

**The taxonomy makes the divergence explicit. C-1 is the gold standard. C-2 is uniform-code-pattern. T0 is fire-and-forget. R0 is observability-grade. D0 is post-auth coverage.**

Operators classify; dashboards label; Codex audits verify. The platform's operational guarantees are bounded BY THE CLASS — never beyond it.
