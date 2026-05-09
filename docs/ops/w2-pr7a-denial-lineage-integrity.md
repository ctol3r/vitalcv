# W2-PR7A — Denial-Lineage Integrity (Track D)

**Wave:** Wave 2, PR 7A — canonical operational lineage convergence, denial-lineage track · **Date:** 2026-05-08 · **Status:** integrity analysis only; **NO product code, NO runtime modification, NO merge** · **Authority:** subordinate to `w2-pr6a-denial-path-certification.md`, `w2-pr7a-audit-event-convergence.md`, `TRUST_GUARANTEE_LEXICON.md`

This doc certifies whether **denied mutations preserve trace continuity, attribution continuity, replay visibility, and export survivability**.

The central thesis: **denial lineage is asymmetric to permitted lineage** — it inherits the permitted-path lineage primitives (traceId, correlationId, payloadHash, actorId) post-Lock-v2 but fragments at the export and scrapbook layers because of the audit-event vocabulary divergence (Track C).

---

## 1. Permitted-vs-denied lineage symmetry

A logical operation produces lineage in different shapes depending on outcome:

| Lineage primitive | Permitted-path post-Lock-v2 | Denied-path post-Lock-v2 |
|---|---|---|
| `traceId` (in audit metadata) | YES (when propagated) | YES (when propagated) |
| `correlationId` | YES | YES |
| `payloadHash` | YES (per Lock v2 §8) | YES (per ML-Rec-1 + DC-Rec-2 — recommended extension) |
| `metadata.actorId` | YES | YES |
| `metadata.outcome` | `'permitted'` | `'denied'` |
| `metadata.action` | `<base>` (e.g., `employer_review.accept`) | `<base>.<reason>` (e.g., `employer_review.accept.role_denied`) |
| Mutation row written | YES | NO |
| Outbox event written | YES (C-1 handlers) | NO |
| SEAL/learning/recompute side effects fired | YES (post-tx) | NO (correct — denials shouldn't train recommenders) |
| Audit row written via T2 transaction | YES | YES (denied audit row is the only persisted artifact) |

**Track D finding DL-1:** denied lineage symmetry is achieved post-Lock-v2 + ML-Rec-1 + DC-Rec-2. Pre-Lock-v2 lacks denial emission entirely.

---

## 2. Trace continuity for denied paths

### 2.1 Within-process trace propagation on denial

```
Step 1: Authenticate
   ├─ Pass: continue
   └─ Fail (no Clerk session): 401/403 → no audit row → trace LOST (no actor)
   ↓
Step 2: RBAC validate
   ├─ Pass: continue
   └─ Fail: emit denied audit row with traceId in metadata
   ↓
Step 3: Derive ownership (server-side; no fail)
   ↓
Step 4: Validate ownership
   ├─ Pass: continue
   └─ Fail: emit denied audit row with traceId
   ↓
Step 5: Validate workflow
   ├─ Pass: continue
   └─ Fail: emit denied audit row with traceId
   ↓
Step 6: Atomic write
   ├─ Success: emit permitted audit row with traceId
   └─ Failure: tx rolls back → no audit row → trace LOST (correct)
```

**Track D finding DL-2:** trace continuity is preserved on denial paths IF traceId propagates from upstream AND the denial audit row's metadata.traceId is populated. Step-1 (no auth) and Step-6 (tx rollback) intentionally lose trace continuity — these are documented design choices.

### 2.2 Cross-process trace propagation on denial

A denied audit row written via T2 (`prisma.$transaction((tx) => tx.auditEvent.create(...))`) commits atomically. Postgres durability preserves the trace. The in-memory ledger (Subsystem B) does NOT participate in the T2 path — denied rows from direct prisma writers do NOT appear in the SIEM stream.

**Track D finding DL-3:** denial rows from T2-direct writers (employer-review handlers post-Lock-v2) are SIEM-INVISIBLE under the current SIEM-from-in-memory pattern. SIEM coverage of denial paths requires either (a) SIEM consumes Postgres directly, OR (b) T2 writers also call `appendAuditEvent` for in-memory dual-path.

---

## 3. Attribution continuity for denied paths

### 3.1 Per-step attribution

| Step | Attribution available |
|---|---|
| Step 1: no auth | NONE — no `actorId` to record |
| Step 2: auth-present, RBAC fails | YES — `metadata.actorId = userId` (Clerk validated) |
| Step 4: cross-tenant 404 (if applicable post-MIG-C) | YES — caller's actorId, NOT resource's tenant |
| Step 5: workflow gate fails | YES |
| Step 6: tx rollback | n/a (no row) |

**Track D finding DL-4:** denied audit rows attribute to the CALLER (who the proxy says is acting), not to who they are PROBING. This clusters probing patterns by the prober. A SOC analyst querying "all denials by actor X" sees X's probing attempts (correct).

### 3.2 Attribution-vs-ownership distinction on denials

A `cross_tenant` denial (post-MIG-C) records:
- `metadata.actorId` = caller's userId
- `metadata.subjectId` = entityId being probed
- `metadata.action` = `<base>.cross_tenant`

The audit row says "actor X tried to access entity Y owned by another tenant." It does NOT say "entity Y belongs to org Z." That information is implicit (the resource's tenantId, when MIG-C lands).

**Track D finding DL-5:** denial attribution preserves the actor + subject explicitly; ownership context is implicit. Forensic queries clustering by "all probes against entity Y" must use `metadata.subjectId`, not infer ownership from attribution.

---

## 4. Replay visibility for denied paths

A replay attempt that hits the dedup window:

```
Original request: actor A, correlationId C, mutation payload P
   ↓
T0: Audit row written (permitted) with metadata.correlationId = C, metadata.payloadHash = SHA-256(P)
   ↓
[Time passes]
   ↓
Retry request: actor A, correlationId C (or fresh), payload P
   ↓
Service: queries prior (actorId=A, correlationId=C) within 24h
   ├─ FOUND: 409 duplicate_request → emit denied audit row with metadata.action = '<base>.duplicate_request'
   └─ NOT FOUND (because correlationId was fresh): proceeds → potentially TWO permitted rows (capture-replay)
```

### 4.1 Replay-detection visibility

| Scenario | Audit visibility |
|---|---|
| Retry with same correlationId within 24h | DENIED audit row with `<base>.duplicate_request` |
| Retry with fresh correlationId (capture-replay or honest-but-bug) | PERMITTED audit row → forensic detection requires payloadHash clustering |
| Retry with same correlationId BUT TOCTOU race | TWO PERMITTED audit rows; no denied row — audit-invisible duplication |
| Retry past 24h window | PERMITTED audit row (no dedup); long-window cliff |

**Track D finding DL-6:** denied-path replay visibility is STRONG when correlationId is reused within 24h; WEAK against capture-replay with fresh correlationId; INVISIBLE against TOCTOU race + long-window replay. payloadHash clustering (post-ML-Rec-1) recovers forensic detection of capture-replay attempts.

### 4.2 Replay-blind denial paths

Some denials produce NO replay-visible signal:

| Denial | Replay-blind reason |
|---|---|
| Step-1 no-auth | No audit row written |
| Step-6 tx rollback | No audit row written |
| `<base>.malformed_resource_id` | Audit row written, but malformed input may not have a meaningful payloadHash for clustering |
| `<base>.entity_not_found` | Audit row written; for non-existent entity, no resource-side context |

**Track D finding DL-7:** Step-1 + Step-6 denials are replay-blind by design. `malformed_resource_id` and `entity_not_found` are replay-visible but offer limited clustering signal because the input itself may be the probe.

---

## 5. Export survivability for denied paths

### 5.1 SIEM export

Per AC-CONV-7 (Track C): SIEM streams from in-memory ledger (Subsystem B), NOT Postgres (Subsystem C). Direct prisma writers (T2 — employer-review) bypass the in-memory ledger. **Denied audit rows from T2 writers are SIEM-invisible** unless SIEM consumes Postgres directly.

**Track D finding DL-8:** SIEM coverage of denied paths is the LARGEST denial-lineage survivability gap. Mitigations:
1. Add `appendAuditEvent` call in T2 writers (dual-write to in-memory ledger).
2. SIEM source extended to query Postgres directly.
3. Document the gap and operate on a Postgres-direct query path for denial forensics.

### 5.2 Scrapbook export

Per `AuditScrapbook.ts:88,90`, the scrapbook switches on event types `IDEMPOTENT_REPLAY` and `CONCURRENCY_GUARD_TRIGGERED`. It does NOT recognize free-form denied-path types (e.g., a row with `type='EMPLOYER_REVIEW_ACCEPTED'` AND `metadata.outcome='denied'`).

**Track D finding DL-9:** scrapbook export of denied rows is UNVERIFIED. The scrapbook's known event-type cases don't include the Lock v2 denial taxonomy. Recommendation: verify scrapbook coverage of Lock v2 denial-path rows; if coverage missing, document or extend.

### 5.3 Cursor-based pagination on denied rows

`exportAuditPage` paginates the in-memory ledger. As above, T2-written denied rows are NOT in the in-memory ledger → invisible to cursor pagination.

`exportSinceTime` similarly streams in-memory.

**Track D finding DL-10:** cursor-based export coverage of denied rows depends on in-memory presence. SIEM forensic analysis of denial trends requires Postgres queries today.

---

## 6. Silent denial branches

| # | Silent denial | Cause |
|---|---|---|
| **SD-LIN-1** | Step-1 (no auth) — no audit row | By design (no actor); web-layer access logs cover |
| **SD-LIN-2** | Step-6 (tx rollback) — no audit row | By design (no partial state); 5xx wire visible to caller |
| **SD-LIN-3** | T2 denied row written but SIEM doesn't see it | DL-8 — SIEM source doesn't cover Postgres |
| **SD-LIN-4** | Pre-Lock-v2 denial (any reason) | Pre-Lock-v2 has zero denied emission |
| **SD-LIN-5** | T0 fire-and-forget DB failure on denied dual-write | In-memory ledger has it; Postgres doesn't; CRITICAL log only |
| **SD-LIN-6** | Proxy returns 200 silently on backend error | DL — deployment correctness; SD-3 from `w2-pr6a-denial-path-certification.md` |
| **SD-LIN-7** | Backend throws uncaught exception, returns 500 without audit | Backend error-handler discipline; no audit on uncaught throw |

**Track D finding DL-11:** SD-LIN-1, SD-LIN-2 are by-design accepted (must be disclosed). SD-LIN-3 is the operationally-significant SIEM gap. SD-LIN-4 is closed by Lock v2. SD-LIN-5, SD-LIN-6, SD-LIN-7 are operational concerns requiring discipline + alerting.

---

## 7. Degraded-denial visibility

When the platform itself degrades, denial visibility further fragments:

| Degradation | Effect on denial lineage |
|---|---|
| Clerk down (auth degraded) | W2-PR1A returns 503 with `x-rbac-fail-closed: clerk_unavailable` — NO audit row (Step 1 silent); web-layer log captures |
| Proxy regression | Requests not reaching backend → no backend audit; web-layer logs cover |
| Backend DB down | T1/T2 throw → 5xx → no audit (correct fail-closed); backend access log captures |
| In-memory ledger overflow / process restart | Pre-dual-write entries lost from in-memory; Postgres rows preserved |
| SIEM consumer disconnected | Denials accumulate in in-memory + Postgres; SIEM catches up on reconnect |

**Track D finding DL-12:** denial visibility under degradation is bounded by FAIL-CLOSED + multiple log surfaces (web access, backend access, in-memory ledger, Postgres). No single-point-of-failure for denial visibility — but the SIEM stream specifically loses T2-writer denials regardless of degradation.

---

## 8. Replay-blind denial path summary

| Denial type | Replay visibility | Cause |
|---|---|---|
| Step-1 (no auth) | INVISIBLE | No audit row by design |
| Step-2 (RBAC) | OBSERVABLE post-Lock-v2 | correlationId stamped on denied audit row |
| Step-4 (ownership / cross-tenant) | OBSERVABLE post-Lock-v2 + MIG-C | Same |
| Step-5 (workflow gate) | OBSERVABLE post-Lock-v2 | Same |
| Step-6 (tx rollback) | INVISIBLE | No audit row by Postgres ACID |

Replay-blind paths are 2 of 6 — both intentional. The 4 observable paths gain replay visibility post-Lock-v2.

---

## 9. Denial-lineage integrity classifications

### 9.1 Per-property

| Property | Pre-Lock-v2 | Post-Lock-v2 + recommendations |
|---|---|---|
| Trace continuity on Step-2+ denials | 🔴 N/A (no denial audit) | 🟢 CERTIFIED-IN-CONTRACT (when traceId propagates) |
| Attribution continuity on Step-2+ denials | 🔴 N/A | 🟢 CERTIFIED-IN-CONTRACT |
| Replay visibility on Step-2+ denials | 🔴 N/A | 🟢 CERTIFIED-IN-CONTRACT (correlationId-stamped) |
| Export survivability via SIEM | 🔴 N/A | 🟠 FRAGMENTED — DL-8 SIEM-invisible for T2 writers |
| Export survivability via Postgres direct | 🔴 N/A | 🟢 CERTIFIED |
| Denial of Step-1 (no auth) | 🔴 NEVER AUDITED | 🔴 UNCHANGED (by design) |
| Denial of Step-6 (tx rollback) | 🔴 NEVER AUDITED | 🔴 UNCHANGED (correct) |
| Side-effects-do-not-fire-on-denial | 🟢 CORRECT TODAY | 🟢 PRESERVED |

### 9.2 Aggregate

**Denial-lineage integrity:** 🟡 **PARTIAL post-Lock-v2 + recommendations.** Strong on trace + attribution + replay visibility for Step-2+ denials; FRAGMENTED on SIEM survivability (DL-8); intentionally INVISIBLE for Step-1 + Step-6 denials.

---

## 10. Recommendations

| # | Recommendation | Priority |
|---|---|---|
| **DL-Rec-1** | Document SIEM coverage gap for T2-writer denied rows (DL-8); recommend either (a) dual-write to in-memory ledger from T2 writers, OR (b) SIEM extended to query Postgres | HIGH |
| **DL-Rec-2** | Document Step-1 (no-auth) + Step-6 (tx-rollback) silent-denial gaps as accepted-by-design in `audit-row-schema.md` | HIGH |
| **DL-Rec-3** | Verify scrapbook coverage of Lock v2 denied-path rows (DL-9) | MEDIUM |
| **DL-Rec-4** | Document SD-LIN-1..SD-LIN-7 in operational runbook with alerting recommendations for the 3 concerning ones (SD-LIN-5, SD-LIN-6, SD-LIN-7) | MEDIUM |
| **DL-Rec-5** | Add `metadata.payloadHash` to denied rows (extends ML-Rec-1) for capture-replay forensic detection | HIGH |

---

## 11. Track D determination

| Question | Answer |
|---|---|
| Do denied mutations preserve trace continuity? | YES post-Lock-v2 for Step-2+; intentionally NO for Step-1 + Step-6 |
| Do denied mutations preserve attribution continuity? | YES post-Lock-v2 |
| Do denied mutations preserve replay visibility? | YES post-Lock-v2 with correlationId; STRONGER with payloadHash mandate |
| Do denied mutations preserve export survivability? | PARTIAL — Postgres durable; SIEM in-memory-ledger-bound (DL-8 gap) |
| Are silent denial branches enumerated? | YES — 7 (SD-LIN-1..SD-LIN-7) |
| Are degraded denial scenarios documented? | YES — 5 |
| Are replay-blind denial paths enumerated? | YES — 2 of 6 (intentional) |

**Track D classification:** 🟡 **PARTIAL — denial lineage integrity is genuine for Step-2+ paths post-Lock-v2; FRAGMENTED at the SIEM surface (DL-8); intentionally GAPPED at Step-1 + Step-6.**

---

## 12. Closing principle (Track D)

Denial lineage integrity is the discipline of preserving forensic visibility of REJECTED actions. Pre-Lock-v2's denial audit-emission gap is closed for Step-2+ denials. Step-1 + Step-6 silent gaps are accepted-by-design (and must be disclosed). The dominant remaining gap is SIEM coverage of T2-writer denied rows (DL-8).

**Denial lineage is CERTIFIABLE-IN-CONTRACT post-Lock-v2 + DL-Rec-1 + DL-Rec-5; FRAGMENTED until the SIEM gap closes.** Closing DL-Rec-1 + DL-Rec-2 + DL-Rec-5 advances denial lineage from PARTIAL to CERTIFIED.
