# W2-PR5A — Audit Coupling Certification (Track C)

**Wave:** Wave 2, PR 5A — runtime legitimacy certification, audit track · **Date:** 2026-05-08 · **Status:** certification analysis only; **NO product code, NO runtime modification, NO merge** · **Reviewer posture:** audit-coupling certifier · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md`, `MUTATION_GATE_SEQUENCE.md` §4, `w2-pr3b-audit-strength-review.md` (5-level taxonomy); consolidates `w2-pr2c-audit-coupling-review.md`

This doc certifies the **audit coupling** posture of the employer-review surface using the 5-level audit-strength taxonomy from `w2-pr3b-audit-strength-review.md`.

The central thesis: **the wave delivers L1+L2+atomic-coupling for the four C-1 transactional handlers and L1+L2+single-row-tx-cosmetic for the two C-2 audit-only handlers. L3 (anchored across DB compromise) is UNVERIFIED. L4 (per-row signature) and L5 (non-repudiable) are ABSENT and explicitly forbidden by the lexicon.**

---

## 1. The 5-level audit-strength taxonomy (recap)

| Level | Property | Substrate |
|---|---|---|
| **L1: Recorded** | An event was written to a table | Insert |
| **L2: Tamper-evident given DB integrity** | Modification detectable IF DB trusted | SHA-256 `hash` over canonical content |
| **L3: Tamper-evident across DB compromise** | Detection survives DB compromise | Append-only ledger + external anchor |
| **L4: Cryptographically attestable per row** | Row carries verifiable signature | Per-row signing key |
| **L5: Non-repudiable** | Actor cannot deny signing | Actor's private key + PoP |

Lock v2 + Lock v2's runtime substrate maps to:

- **L1: ✅ all 6 in-scope branches.**
- **L2: ✅ via existing `AuditEvent.hash` column.**
- **Atomic-coupling: ✅ for 4 C-1 handlers (`prisma.$transaction`); cosmetic for 2 C-2 handlers (single-row tx wrap, no companion mutation).**
- **L3: ⚠ UNVERIFIED — schema columns `anchored` / `merkleRoot` exist; live anchoring pipeline coverage for these event types not confirmed by this review.**
- **L4: ❌ no per-row signature column.**
- **L5: ❌ no actor key, no PoP.**

---

## 2. Atomicity consistency — per-handler

### 2.1 The 5-shape coupling taxonomy (from `w2-pr2c-audit-coupling-review.md`)

| Shape | Description | Handlers |
|---|---|---|
| **C-1: True transactional** | Mutation + audit + outbox in same `$transaction` | `accept`, `request-refresh`, `route-to-review`, `confirm-start` |
| **C-2: Cosmetic transactional** | Single audit row wrapped in `$transaction` (no mutation companion) | `share-packet`, `packet` (post-Lock-v2) |
| **C-3: Audit-only with side effects** | Audit row + fire-and-forget telemetry | (not in scope of this wave) |
| **C-4: No coupling (read with telemetry)** | Read response + fire-and-forget learning event | `status`, `acceptance-history` |
| **C-5: Pre-tx side-effect dependency** | Pre-tx reads (passport, snapshot, lookup) influence mutation | All C-1 handlers (race window) |

### 2.2 Per-handler atomicity certification

| Handler | Today (`9eb5cdee`) | Post-Lock-v2 (under review) |
|---|---|---|
| `accept` | 🟢 **C-1 CERTIFIED** — `recordEmployerReviewAcceptance` wraps insert + outbox + audit in `prisma.$transaction` (line 738) | 🟢 CERTIFIED + denied-path audit emission |
| `confirm-start` | 🟢 **C-1 CERTIFIED** — inline `prisma.$transaction` at route-handler level (line 863) | 🟢 CERTIFIED + denied-path emission |
| `request-refresh` | 🟢 **C-1 CERTIFIED** — `recordEmployerReviewRefreshRequest` wraps outbox + audit (line 846) | 🟢 CERTIFIED |
| `route-to-review` | 🟢 **C-1 CERTIFIED — with HITL try/catch caveat** — `recordEmployerReviewRouting` wraps optional HITL + outbox + audit (line 927); HITL silently degrades to outbox-only on throw | 🟢 CERTIFIED + Sentry breadcrumb on degrade (Lock v2 §6) |
| `share-packet` | 🟠 **NOT C-1** — `prisma.auditEvent.create` standalone (line 699); audit IS persistence | 🟡 **C-2 CERTIFIED-IN-CONTRACT** — single-row tx wrap; cosmetic atomicity |
| `packet` (audit-emitting GET) | 🟠 **NOT C-1** — `prisma.auditEvent.create` standalone (line 611) | 🟡 **C-2 CERTIFIED-IN-CONTRACT** — same |

**Track C finding AC-1:** the four C-1 handlers are GENUINELY ATOMIC — `prisma.$transaction` semantics (READ COMMITTED isolation; failure of any insert rolls back all). The two C-2 handlers' "atomic mutation+audit" framing is cosmetic — the wrap doesn't add rollback semantics beyond what a bare `prisma.auditEvent.create` already provides.

**Lexicon enforcement:** `TRUST_GUARANTEE_LEXICON.md` §3 requires "atomic mutation+audit" to carry the qualifier "for the four `prisma.$transaction`-wrapped handlers." Bare-form is forbidden.

---

## 3. Audit survivability

### 3.1 Per-row survivability dimensions

| Dimension | Status |
|---|---|
| Row exists 6 months later | UNVERIFIED — no documented retention SLA |
| `hash` column populated and recomputable | CERTIFIED — `auditService.ts` canonicalization is stable for current event types |
| `metadata` JSON contents survive schema changes | DEPENDS on schema-change discipline |
| `referenceId` resolves to a meaningful row | DEPENDS on the referenced row's retention |
| Row not GC'd by manual operations | CONTROLLED by ops discipline; not enforced |

**Track C finding AC-2:** audit retention SLA is not formalized. For `share-packet` + `packet` (audit-as-persistence), retention < token TTL silently breaks share-resolution. Recommendation: retention SLA respecting longest token TTL (`SHARE_TOKEN_TTL_MS`) AND forensic-recovery horizon (typically 6–24 months).

### 3.2 Cross-row survivability

The audit log's value depends on cross-row consistency:

| Property | Status |
|---|---|
| Two paired rows (mutation + audit) survive together | YES (when atomically committed) |
| Audit row's `referenceId` matches a real mutation row | YES at write time; depends on FK (none today) and retention symmetry |
| `EMPLOYER_PACKET_SHARED` audit row's `shareTokenHash` resolves at downstream `share-token/:token` GET | DEPENDS on audit retention |
| Series of audit rows for one canonical-path traversal (recognition → acceptance → start) preserves the chain | YES at write time; depends on retention |

**Track C finding AC-3:** there are no FKs between `EmployerAcceptance` ↔ `AuditEvent`, or `StartAttestation` ↔ `AuditEvent`. The relationship is by `referenceId` string match. Operational pruning of one without the other breaks the chain silently.

---

## 4. Mutation/audit divergence risks

### 4.1 Pre-tx reads (C-5)

Per `w2-pr2c-audit-coupling-review.md` §2.2.1:

| Handler | Pre-tx read | Race window |
|---|---|---|
| `accept` | `buildPassport` (line 191), duplicate-check (line 175), `buildDecisionTrustSnapshot` (line 727) | Passport state can flip between read and tx commit |
| `confirm-start` | Acceptance `findFirst` (line 829) | Concurrent acceptance creation can race |
| `request-refresh` | Snapshot (line 825) | Snapshot can be stale at tx commit |
| `route-to-review` | Snapshot (line 925) | Same |

The audit row records the SNAPSHOT-TIME state, not the COMMIT-TIME state. A passport that flips `BLOCKED` between snapshot and commit results in an audit recording the pre-flip posture as if it were the decision-time posture.

**Track C finding AC-4:** the audit's `trustSnapshot` is bounded by snapshot-time, not commit-time. Lexicon-aligned wording: "snapshot-time decision state, captured before transaction." Implementation PR must NOT describe this as "commit-time decision state."

### 4.2 Side-effect divergence (post-tx)

Per `w2-pr2b-side-effect-inventory.md`, post-tx fire-and-forget calls:

- `captureEmployerDecision` (SEAL)
- `captureDecisionSignal` (learning)
- `recomputeMatchBoosts` (recommender)
- `captureStartOutcome` (KPI funnel; confirm-start only)

Failures here do NOT roll back the audit row. The audit log says "permitted"; the SEAL/learning/recompute may or may not have landed.

**Track C finding AC-5:** the wave does NOT introduce side-effect coupling. Existing pattern is intentionally fire-and-forget. Lexicon-aligned wording: "fire-and-forget side effects post-commit; do NOT claim end-to-end-atomic semantics for these flows."

### 4.3 Response-delivery divergence

For `share-packet` and `packet`:
- Audit row commits inside (cosmetic) tx.
- Response writes the share URL or streams the packet bytes.
- If response fails (network drop, stream closed), audit persists; caller never receives.

**Track C finding AC-6:** audit-as-persistence pattern means audit-success ≠ caller-success. Forensics says "exported"; reality may be "audit recorded, delivery dropped." Recommendation: response-delivery telemetry recorded as separate audit metadata field on retry / completion.

---

## 5. Denied-path audit coverage

### 5.1 Today (`9eb5cdee`)

| Denial path | Audit row written today? |
|---|---|
| `accept` returns 422 `acceptance_blocked` | NO (route returns early) |
| `accept` returns 409 `already_accepted` | NO |
| `confirm-start` returns 409 `no_prior_acceptance` | NO |
| `request-refresh` returns 4xx | NO |
| `route-to-review` returns 4xx | NO |
| `share-packet` returns 400 (NPI mismatch) | NO |
| Any handler returns 401 `unauthorized` | NO |
| Any handler returns 4xx for malformed body | NO |

**Today: zero denied-path audit emission.** The audit log shows ONLY successful mutations.

### 5.2 Post-Lock-v2

Lock v2 §8 + §9 mandate denied-path audit emission for every denial that reached at least Step 2 (auth-present):

| Denial reason | Audit literal | Wire |
|---|---|---|
| `no_org_context` (post-Lock-v2's role gate) | `<base>.no_org_context` | 403 |
| `role_denied` (readonly POST) | `<base>.role_denied` | 403 |
| `entity_not_found` | `<base>.entity_not_found` | 404 |
| `acceptance_blocked` (passport gate, accept) | `<base>.acceptance_blocked` | 422 |
| `already_accepted` | `<base>.already_accepted` | 409 |
| `no_prior_acceptance` (confirm-start) | `<base>.no_prior_acceptance` | 409 |
| `duplicate_request` (correlationId dedup) | `<base>.duplicate_request` | 409 (no NEW row; prior stands) |
| `malformed_resource_id` | `<base>.malformed_resource_id` | 400 |

**Track C finding AC-7:** denied-path audit emission is a **NEW capability** Lock v2 introduces. Pre-auth denials (Step 1 — no Clerk session) intentionally write NO audit row (no actor to record). Surfaces describing audit coverage MUST clarify "audit-coupled at Step 2 and beyond; pre-auth probes are bounded by web-layer logs."

### 5.3 Per-handler denied-path coverage post-Lock-v2

| Handler | Denied paths emitting audit (post-Lock-v2) |
|---|---|
| `accept` | role_denied, no_org_context, acceptance_blocked, already_accepted, entity_not_found, malformed_resource_id |
| `confirm-start` | role_denied, no_org_context, no_prior_acceptance, entity_not_found, malformed_resource_id |
| `request-refresh` | role_denied, no_org_context, archived_review (if introduced), entity_not_found |
| `route-to-review` | role_denied, no_org_context, wrong_review_state (if introduced), entity_not_found |
| `share-packet` | role_denied, no_org_context, archived_review, entity_not_found, NPI_mismatch |
| `packet` (GET) | role_denied (if added), entity_not_found |

---

## 6. Tx-boundary consistency

### 6.1 The transaction's scope

For each C-1 handler:

```
prisma.$transaction(async (tx) => {
  await tx.<mutation_table>.create(...);  // mutation row
  await tx.outboxEvent.create(...);       // outbox event
  await tx.auditEvent.create(...);        // audit row
})
```

For each C-2 handler post-Lock-v2:

```
prisma.$transaction(async (tx) => {
  await tx.auditEvent.create(...);        // audit-only persistence
})
```

### 6.2 Tx-boundary properties

| Property | Status |
|---|---|
| Transaction is local (single DB connection) | YES — `prisma.$transaction` defaults |
| Isolation is `READ COMMITTED` (Postgres default) | LIKELY — not explicitly set in code |
| No external HTTP calls inside tx | YES (verified — no fetches inside tx blocks) |
| Tx duration low (ms) | YES — small inserts |
| Tx rolls back on any insert failure | YES — Prisma transaction semantics |
| Tx commits all writes atomically | YES — Postgres ACID |
| Tx isolation prevents reading uncommitted siblings | YES at READ COMMITTED |
| Tx isolation prevents serialization anomalies | NO at READ COMMITTED — phantom reads possible |

**Track C finding AC-8:** isolation level is the Prisma default (READ COMMITTED). Higher levels (REPEATABLE READ, SERIALIZABLE) would close phantom-read concerns but introduce serialization-failure / contention concerns. The current isolation is appropriate for the volume but should be documented.

---

## 7. Audit-coupling certification per L1–L5

### 7.1 L1 — Recorded

| Status | All 6 in-scope branches |
|---|---|
| Today (`9eb5cdee`) | 🟢 CERTIFIED for permitted path; 🔴 NOT for denied path |
| Post-Lock-v2 | 🟢 **CERTIFIED for permitted AND denied (post-auth) paths** |

### 7.2 L2 — Tamper-evident given DB integrity

| Status | All 6 in-scope branches |
|---|---|
| Today | 🟢 CERTIFIED via `AuditEvent.hash` |
| Post-Lock-v2 | 🟢 CERTIFIED — unchanged |

**Lexicon:** the qualifier "given DB integrity" must accompany "tamper-evident."

### 7.3 L3 — Tamper-evident across DB compromise

| Status | All 6 in-scope branches |
|---|---|
| Today | 🟠 **UNVERIFIED** — schema columns `anchored Boolean @default(false)` + `merkleRoot String?` exist (lines 1487–1488); live anchoring pipeline coverage for the 6 event types not verified by this review |
| Post-Lock-v2 | 🟠 **UNVERIFIED** — Lock v2 does not address |

**Track C finding AC-9:** `apps/api/backend/src/services/audit/auditService.ts:148` writes `anchored: false` for the `requireAuditBeforeResponse` path. The pipeline that flips `anchored` to `true` is NOT inspected by this review. Until verified live for the 6 in-scope event types, the L3 claim is **NOT CERTIFIABLE** — and the lexicon's "anchored" / "tamper-proof" wording is forbidden.

### 7.4 L4 — Per-row signature

| Status |
|---|
| Today + Post-Lock-v2 | 🔴 **ABSENT** — no per-row signature column |

**Lexicon:** "cryptographically guaranteed" / "signed mutation" / "signed audit" forbidden.

### 7.5 L5 — Non-repudiable

| Status |
|---|
| Today + Post-Lock-v2 | 🔴 **ABSENT** — no actor key, no PoP |

**Lexicon:** "non-repudiable" forbidden in any new surface (grandfathered in code comments per `w2-pr4b-inflation-detection-register.md`).

---

## 8. Tiered audit-write infrastructure (existing)

A pre-existing nuance worth certifying: `apps/api/backend/src/services/audit/auditService.ts` provides a TIERED audit-write infrastructure:

| Tier | Function | Behavior |
|---|---|---|
| **T0: Fire-and-forget** | `createAuditEvent` (line 60) | DB write is `void`-discarded `.catch(...)` with CRITICAL log on failure |
| **T1: Synchronous before 2xx** | `requireAuditBeforeResponse` (line 130) | Awaits DB write; throws on failure (caller does not return 2xx) |
| **T2: Atomic with mutation** | `prisma.$transaction((tx) => ...)` (used in handler / service code directly) | Both rows commit together |

The 5 canonical non-repudiation audit paths (per code comment lines 75, 113, 117–122) are documented to use T1 (`requireAuditBeforeResponse`) or T2 (transaction). The C-1 handlers in this wave use T2.

**Track C finding AC-10:** the audit-write infrastructure is mature and tiered. The wave operates at T2 (highest tier). The lexicon-aligned wording "atomic mutation+audit" applies precisely to the C-1 handlers; the C-2 handlers use T2 (cosmetic) by Lock v2's wrap.

---

## 9. Audit-coupling certification — summary

### 9.1 Per-property

| Property | Today | Post-Lock-v2 |
|---|---|---|
| L1 (recorded) — permitted | 🟢 CERTIFIED | 🟢 CERTIFIED |
| L1 (recorded) — denied (post-auth) | 🔴 NOT | 🟢 CERTIFIED-IN-CONTRACT |
| L2 (tamper-evident given DB integrity) | 🟢 CERTIFIED | 🟢 CERTIFIED |
| Atomicity (4 C-1 handlers) | 🟢 CERTIFIED | 🟢 CERTIFIED + denied-path |
| Atomicity (2 C-2 handlers) | 🔴 NOT (standalone insert) | 🟡 **COSMETIC** (single-row tx wrap; no functional change) |
| L3 (anchored) | 🟠 UNVERIFIED | 🟠 UNVERIFIED |
| L4 (per-row signature) | 🔴 ABSENT | 🔴 ABSENT |
| L5 (non-repudiable) | 🔴 ABSENT | 🔴 ABSENT |
| Pre-tx read race (snapshot/passport/lookup) | 🟠 EXISTS | 🟠 UNCHANGED |
| Post-tx side-effect divergence | 🟠 EXISTS (intentional) | 🟠 UNCHANGED |
| Response-delivery divergence (C-2 handlers) | 🟠 EXISTS | 🟠 UNCHANGED |
| Audit retention SLA | 🟠 UNDOCUMENTED | 🟠 UNCHANGED |

### 9.2 Aggregate

**Audit coupling is GENUINELY STRONG at L1+L2+atomic-coupling for the four C-1 handlers post-Lock-v2.** The wave is the most defensible runtime work in the entire bundle. Its risks are exclusively language (lexicon enforcement) and operational (retention SLA, anchoring pipeline verification).

---

## 10. Required disclaimers (lexicon-aligned)

Any surface describing the wave's audit work must include:

1. **L1+L2+atomic for 4 C-1 handlers; cosmetic single-row tx wrap for 2 C-2 handlers** — qualified per-handler.
2. **L3 (anchored) status unverified;** must NOT use "anchored" / "tamper-proof" until pipeline coverage confirmed (AS-Rec-1).
3. **L4/L5 absent;** must NOT use "signed audit" / "non-repudiable" / "cryptographically guaranteed."
4. **`metadata.payloadHash` mandate (RG-Rec-2):** required on every audit row for capture-replay forensic detection.
5. **Pre-tx read race disclosure** for the C-5 dependency in C-1 handlers.
6. **Side-effect coupling explicitly fire-and-forget** — do NOT claim end-to-end atomic.

---

## 11. Track C determination

| Question | Answer |
|---|---|
| Is L1 (recorded) certifiable? | **YES — permitted today; permitted+denied post-Lock-v2** |
| Is L2 (tamper-evident given DB integrity) certifiable? | **YES — both today and post-Lock-v2** |
| Is L3 (anchored) certifiable? | **NO — UNVERIFIED; pipeline coverage unconfirmed** |
| Is L4 (per-row signature) certifiable? | **NO — ABSENT** |
| Is L5 (non-repudiable) certifiable? | **NO — ABSENT; lexicon-forbidden phrase** |
| Is the wave's atomicity claim L1+L2+atomic for 4 handlers + cosmetic for 2? | **YES — but ONLY when qualified per-handler** |
| Is denied-path audit coverage certified post-Lock-v2? | **CERTIFIABLE-IN-CONTRACT; implementation diff inspection required** |

**Track C classification: CERTIFIABLE-IN-CONTRACT at L1+L2+atomic for the 4 C-1 handlers; cosmetic at L1+L2 for the 2 C-2 handlers; UNVERIFIED at L3; ABSENT at L4+L5.**

The wave's audit work IS the strongest claim in the bundle. The risk is exclusively in language (avoiding "anchored" / "non-repudiable" / "signed audit" without substrate) and operational (audit retention, anchoring pipeline verification).

---

## 12. Closing principle (Track C)

Audit coupling is the wave's most legitimately certifiable work. The 4 C-1 handlers are GENUINELY ATOMIC. The 2 C-2 handlers achieve code-uniformity. Denied-path emission is a real coverage extension. Lexicon-enforced wording prevents the legitimate strength from being inflated to claims the substrate doesn't carry.

**Audit certification: STRONG at L1+L2+atomic; UNVERIFIED at L3; ABSENT at L4+L5.** This is the honest framing. It is also the certifiable framing. Anything beyond it is forbidden by the lexicon — which is itself the discipline that lets the strength remain credible.
