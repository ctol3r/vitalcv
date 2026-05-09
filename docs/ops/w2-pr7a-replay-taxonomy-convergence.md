# W2-PR7A — Replay Taxonomy Convergence (Track B)

**Wave:** Wave 2, PR 7A — canonical operational lineage convergence, replay taxonomy · **Date:** 2026-05-08 · **Status:** taxonomy analysis only; **NO product code, NO runtime modification, NO merge** · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md` §1.3, `w2-pr3b-replay-governance.md`, `w2-pr5a-replay-certification.md`, `w2-pr6a-audit-spine-certification.md`

This doc consolidates the **replay semantics taxonomy**: what's globally coherent, what's duplicated, what's partially divergent, what's lexicon-consistent.

The central thesis: **replay semantics are PARTIALLY DIVERGENT.** The wave introduces `correlationId` + `<base>.duplicate_request` literal, but the platform already has `IDEMPOTENT_REPLAY` and `CONCURRENCY_GUARD_TRIGGERED` as canonical event types. Two parallel taxonomies. Convergence is a doc-level problem.

---

## 1. The replay primitives — full inventory

### 1.1 Pre-existing primitives

| Primitive | Source | Substrate |
|---|---|---|
| **`IDEMPOTENT_REPLAY`** | `packages/audit/AuditEvent.ts:25` (frozen YC MVP enum) | An audit event TYPE indicating a request was an idempotent replay of a prior committed operation |
| **`CONCURRENCY_GUARD_TRIGGERED`** | `packages/audit/AuditEvent.ts:26` | An audit event TYPE indicating a concurrency guard fired (likely UNIQUE constraint or advisory lock) |
| **`AuditScrapbook` switch on these types** | `packages/audit/AuditScrapbook.ts:88,90` | Scrapbook bundles handle these as distinct categories |
| **`accept` duplicate-check** | `apps/api/backend/src/routes/employerActions.ts:175` | Query-then-create pattern: `findFirst` for existing ACCEPTED, return 409 if found |

### 1.2 Lock v2 NEW primitives

| Primitive | Source | Substrate |
|---|---|---|
| **`metadata.correlationId`** | Lock v2 §3, §6 | Per-attempt UUID stamped on every audit row (permitted + denied) |
| **`<base>.duplicate_request`** | Lock v2 §8 | Action-literal denial-reason suffix; written to `metadata.action` field on denied audit row |
| **24h dedup window** | Lock v2 §7.4 | Application-layer query: prior `(actorId, correlationId)` within 24h returns 409 |

### 1.3 The R-CAT-* taxonomy (governance-doc framework)

Per `w2-pr2c-replay-governance-review.md` §1 and `w2-pr5a-replay-certification.md` Track B:

| Category | Definition |
|---|---|
| **R-CAT-1** | Network-retry replay (honest client) |
| **R-CAT-2** | Client-bug double-click |
| **R-CAT-3** | Hostile capture-and-replay (attacker reissues) |
| **R-CAT-4** | Cross-actor replay (stolen JWT) |
| **R-CAT-5** | Long-window replay (>24h) |
| **R-CAT-6** | Fingerprint substitution (same body, fresh correlationId) |

This is a GOVERNANCE-DOC taxonomy, not a runtime primitive. It is the analytical lens for assessing what's defended, observable, or undefended.

---

## 2. Are replay semantics globally coherent?

**NO.** Three parallel taxonomies coexist:

| Taxonomy | Where | What it expresses |
|---|---|---|
| `AUDIT_EVENT_TYPES` enum (`IDEMPOTENT_REPLAY`, `CONCURRENCY_GUARD_TRIGGERED`) | `packages/audit/AuditEvent.ts` (frozen) | "An event happened that involves replay/concurrency" |
| Action-literal suffixes (`<base>.duplicate_request`) | Lock v2 metadata.action | "This denial reason involves replay-detection" |
| R-CAT-* governance taxonomy | Governance docs | "Analytical category for adversarial review" |

**Track B finding RT-1:** the three taxonomies overlap conceptually but use different primitives:

- `IDEMPOTENT_REPLAY` is an EVENT TYPE (fires when replay observed).
- `<base>.duplicate_request` is a DENIAL REASON (fires when replay caught at gate).
- `R-CAT-*` is a CATEGORICAL FRAMEWORK (used by reviewers to classify defenses).

A SOC analyst querying "all replays" must know all three. A Codex audit checking lexicon-conformant wording must use R-CAT-* AND inspect the runtime literals.

---

## 3. Are replay semantics duplicated?

### 3.1 Duplicated semantics: `IDEMPOTENT_REPLAY` vs `<base>.duplicate_request`

Both express "a duplicate was observed." They differ in:

| Axis | `IDEMPOTENT_REPLAY` | `<base>.duplicate_request` |
|---|---|---|
| Source vocabulary | Canonical AUDIT_EVENT_TYPES enum | Free-form prisma.auditEvent.type space |
| Field location | `AuditEvent.type` (top-level column) | `AuditEvent.metadata.action` (JSON path) |
| Detection mechanism | Likely ID-based (UNIQUE constraint hit OR equivalent) | application-layer query on `(actorId, correlationId)` within 24h |
| Outcome | Logs the replay as a DISTINCT event (not a denial) | Logs as DENIED audit row with outcome='denied' |
| Consumers | `AuditScrapbook` switches on it | Forensic queries filter on `metadata.action` |

**Track B finding RT-2:** the two primitives **express DIFFERENT semantics** despite sounding similar. `IDEMPOTENT_REPLAY` says "we processed this — it was idempotent." `<base>.duplicate_request` says "we REJECTED this — duplicate detected, no action taken." The wave does NOT consolidate them.

### 3.2 Duplicated semantics: `CONCURRENCY_GUARD_TRIGGERED` vs `<base>.already_accepted`

`accept`'s 409 `already_accepted` (existing) detects a concurrent acceptance. `CONCURRENCY_GUARD_TRIGGERED` (canonical) is a similar-sounding event.

| Axis | `CONCURRENCY_GUARD_TRIGGERED` | `<base>.already_accepted` |
|---|---|---|
| Source vocabulary | Canonical enum | Existing handler error path |
| Detection | Likely UNIQUE / advisory lock | `findFirst` query (TOCTOU race) |
| Field location | `AuditEvent.type` | Returned in 409 response body; today NOT audit-emitting (pre-Lock-v2) |
| Audit emission today | Used elsewhere (UNVERIFIED for employer-review surface) | NOT TODAY (post-Lock-v2: `<base>.already_accepted` denied audit) |

**Track B finding RT-3:** `accept`'s 409 path overlaps semantically with `CONCURRENCY_GUARD_TRIGGERED` but uses different primitives. The wave does not consolidate.

---

## 4. Are replay semantics partially divergent?

YES — across 4 axes:

| Axis | Divergence |
|---|---|
| **Vocabulary** | 3 taxonomies (AUDIT_EVENT_TYPES, action-literal suffixes, R-CAT-*) |
| **Detection layer** | Application-layer (`accept` duplicate-check + Lock v2 correlationId), DB-layer (`CONCURRENCY_GUARD_TRIGGERED` likely UNIQUE constraint), state-layer (`IDEMPOTENT_REPLAY` likely state-machine) |
| **Wire response** | Permitted-as-replay (200/201 with idempotent body) vs Denied-as-duplicate (409) — distinct UX semantics |
| **Audit emission** | Top-level `type` field vs `metadata.action` field |

**Track B finding RT-4:** divergence is OPERATIONAL, not just terminological. Different layers detect different replay categories with different semantics. Convergence into a single taxonomy would be a substantial architectural commitment.

---

## 5. Are replay semantics lexicon-consistent?

Per `TRUST_GUARANTEE_LEXICON.md` §1.3: "**replay protected**" is forbidden unless server-minted nonce + DB UNIQUE substrate exists.

| Phrase | Lexicon disposition |
|---|---|
| "replay protected" | 🔴 FORBIDDEN — substrate absent |
| "replay-resistant" | 🔴 FORBIDDEN (same family) |
| "replay observability" | 🟢 ALLOWED — substrate exists post-Lock-v2 |
| "best-effort idempotency check" | 🟢 ALLOWED |
| "correlationId-stamped audit rows" | 🟢 ALLOWED |
| "DB-enforced replay prevention deferred" | 🟢 ALLOWED (deferral wording) |
| "IDEMPOTENT_REPLAY event type" | 🟢 ALLOWED (it's the literal name of an event type) |
| "concurrency guard triggered" | 🟢 ALLOWED (literal event-type name) |

**Track B finding RT-5:** the wave's replay primitives are lexicon-consistent IN PRIMITIVE NAMES but the FRAMING risks are exactly the §1.3 forbidden phrases. Codex audit prompt must scan PR description / dashboard copy / marketing surfaces for "replay protected" / "replay-resistant" inflation.

---

## 6. Replay inflation vectors

Where the wave's replay semantics could be inflated:

| # | Inflation vector | Risk |
|---|---|---|
| **RT-IF-1** | PR description: "wave delivers replay protection" | HIGH — "replay protection" forbidden |
| **RT-IF-2** | Dashboard: "0 successful replays" metric | MEDIUM — implies prevention; reality is best-effort dedup |
| **RT-IF-3** | Marketing: "replay-safe mutations" | HIGH — "safe" implies guarantee |
| **RT-IF-4** | UI: "your action was idempotently processed" | MEDIUM — IDEMPOTENT_REPLAY is true if applicable; conflation with `duplicate_request` (which is denial) is the risk |
| **RT-IF-5** | Code comment: "this code path is replay-protected" | MEDIUM — same as RT-IF-1; CI-grep should flag |
| **RT-IF-6** | Audit-row label: `<base>.replay_blocked` | HIGH — "blocked" implies prevention; recommended literal is `duplicate_request` per Lock v2 §8 |
| **RT-IF-7** | Doctrine doc: "we have replay defense" | HIGH — "defense" implies prevention |

**Track B finding RT-6:** RT-IF-1, RT-IF-3, RT-IF-6, RT-IF-7 are HIGH-severity inflation vectors. Lexicon enforcement (W2-PR4B's CI-grep + Codex audit prompt) closes them.

---

## 7. Replay ambiguity vectors

Where the runtime's replay observability could lead to AMBIGUOUS forensic conclusions:

| # | Ambiguity | What query shows | What may have happened |
|---|---|---|---|
| **RT-AMB-1** | Permitted audit row + denied `duplicate_request` row for same `(actor, correlationId)` | Honest-client retry caught | OR capture-replay reusing correlationId |
| **RT-AMB-2** | Two permitted rows for same `(actor, correlationId)` | TOCTOU race produced duplicate | OR audit-row backfill artifact |
| **RT-AMB-3** | `IDEMPOTENT_REPLAY` event for an operation; no `duplicate_request` denial | Idempotent processor handled the replay successfully | OR the operation didn't reach Lock v2's correlationId gate |
| **RT-AMB-4** | `<base>.already_accepted` denied audit (post-Lock-v2) for `accept` retry | Existing duplicate-check fired | OR Lock v2 correlationId dedup fired (different reason) |
| **RT-AMB-5** | `CONCURRENCY_GUARD_TRIGGERED` for an operation; not in employer-review path | Different code path's concurrency mechanism | UNVERIFIED whether employer-review uses any |

**Track B finding RT-7:** ambiguities arise from the parallel-taxonomy reality. A runbook that explicitly maps the 5 ambiguity scenarios to disambiguating signals (which fields to check, which timestamps to compare) is required for SOC clarity.

---

## 8. Replay fragmentation

Where replay semantics fragment across the runtime:

| # | Fragmentation | Cause |
|---|---|---|
| **RT-FR-1** | Idempotent operation succeeds with `IDEMPOTENT_REPLAY` audit; denied operation fails with `<base>.duplicate_request` denied audit. Different surfaces. | Two parallel detection layers |
| **RT-FR-2** | `accept` duplicate-check (existing) at handler level vs Lock v2's correlationId dedup at service level | Different code paths trigger 409 |
| **RT-FR-3** | `CONCURRENCY_GUARD_TRIGGERED` (canonical) vs `<base>.already_accepted` (Lock v2) | Different vocabularies for similar concept |
| **RT-FR-4** | `share-packet` retry mints fresh token (no idempotency); replay observable but not prevented | Token issuance pattern is intentionally non-idempotent |
| **RT-FR-5** | `request-refresh` retry produces duplicate audit row + duplicate side effects | No idempotency anchor on the refresh path |

**Track B finding RT-8:** 5 fragmentations identified. Convergence requires either (a) deprecating one taxonomy in favor of the other (frozen YC MVP code precludes this), (b) adapter layer that maps between them, or (c) doc-level taxonomy-map (recommended; LT-Rec-1).

---

## 9. Convergence proposals

### 9.1 The R-CAT-to-runtime mapping

| R-CAT | Runtime primitive | Coverage |
|---|---|---|
| R-CAT-1 (Network-retry) | Lock v2 correlationId dedup → `<base>.duplicate_request` denied audit | OBSERVABILITY |
| R-CAT-2 (Client-bug) | Same as R-CAT-1 | OBSERVABILITY |
| R-CAT-3 (Capture-replay) | Forensic detection via `metadata.payloadHash` clustering (RG-Rec-2) | DETECTION (post-hoc) |
| R-CAT-4 (Cross-actor) | NONE — Clerk JWT-stewardship concern | NONE |
| R-CAT-5 (Long-window) | NONE — 24h cliff in Lock v2 | NONE |
| R-CAT-6 (Fingerprint substitution) | NONE — correlationId is client-controllable | NONE |
| (existing) `IDEMPOTENT_REPLAY` event | Permitted operation that was an idempotent repeat | OBSERVABILITY (when emitted) |
| (existing) `CONCURRENCY_GUARD_TRIGGERED` event | Concurrency guard fired (DB UNIQUE / advisory lock) | OBSERVABILITY |

**Track B finding RT-9:** the R-CAT framework + runtime primitives can be mapped. The map should be published in `docs/ops/replay-taxonomy-map.md` (recommendation).

### 9.2 The lexicon-aligned framing

For each runtime primitive, the lexicon-aligned wording:

| Primitive | Lexicon-aligned wording |
|---|---|
| `IDEMPOTENT_REPLAY` event | "Idempotent-replay event recorded; the operation was processed once and the replay was acknowledged with the original outcome" |
| `<base>.duplicate_request` denied audit | "Best-effort idempotency-check denied audit; correlationId match within 24h window" |
| `CONCURRENCY_GUARD_TRIGGERED` event | "Concurrency-guard event recorded; <substrate> prevented the duplicate insert" |
| `<base>.already_accepted` denied audit | "Existing-acceptance denial; duplicate-check matched a prior ACCEPTED row for `(employerId, clinicianNpi)`" |

These are explicit, narrow, lexicon-conformant. They do NOT use "replay protected" or "guaranteed dedup."

---

## 10. Per-taxonomy classifications

| Taxonomy | Coherent? | Duplicated? | Divergent? | Lexicon-consistent? | Aggregate |
|---|---|---|---|---|---|
| `AUDIT_EVENT_TYPES` enum (canonical) | YES (frozen) | partial — overlaps with action literals | partial | YES | 🟢 CANONICAL — within its scope |
| Action-literal suffixes (Lock v2) | YES — defined in Lock v2 §8 | partial — overlaps with enum | partial | YES | 🟡 PARTIAL — newly introduced, parallel to enum |
| R-CAT-* (governance-doc) | YES — within doc framework | n/a — analytical only | n/a | YES | 🟢 CANONICAL — within governance scope |

**Aggregate:** the 3 taxonomies are EACH coherent within their scope; they are PARTIALLY DUPLICATED across scopes; they are PARTIALLY DIVERGENT in detection layer + audit field. Convergence is doc-level, not code-level.

---

## 11. Track B determination

| Question | Answer |
|---|---|
| Are replay semantics globally coherent? | NO — 3 parallel taxonomies |
| Are replay semantics duplicated? | YES — `IDEMPOTENT_REPLAY` vs `<base>.duplicate_request`; `CONCURRENCY_GUARD_TRIGGERED` vs `<base>.already_accepted` |
| Are replay semantics partially divergent? | YES — 4 divergence axes |
| Are replay semantics lexicon-consistent? | YES — primitive names are conformant; FRAMING risks are exactly §1.3 forbidden phrases |
| Are inflation vectors enumerated? | YES — 7 vectors (RT-IF-1..RT-IF-7) |
| Are ambiguity vectors enumerated? | YES — 5 vectors (RT-AMB-1..RT-AMB-5) |
| Are fragmentation paths enumerated? | YES — 5 (RT-FR-1..RT-FR-5) |

**Track B classification:** 🟡 **PARTIAL — replay taxonomy is internally coherent within each of 3 vocabularies; PARTIALLY DIVERGENT across them; lexicon-consistent in primitives but inflation-prone in framing.**

---

## 12. Recommendations

| # | Recommendation | Priority |
|---|---|---|
| **RT-Rec-1** | Publish `docs/ops/replay-taxonomy-map.md` (the R-CAT-to-runtime mapping per §9.1) | HIGH |
| **RT-Rec-2** | Codex audit prompt explicitly scans for RT-IF-1..RT-IF-7 inflation vectors | HIGH |
| **RT-Rec-3** | Document the `IDEMPOTENT_REPLAY` event-type semantics + when it fires (UNVERIFIED today) | MEDIUM |
| **RT-Rec-4** | Document the `CONCURRENCY_GUARD_TRIGGERED` event-type semantics | MEDIUM |
| **RT-Rec-5** | Document RT-AMB-1..RT-AMB-5 disambiguation in the replay-observability runbook | HIGH |
| **RT-Rec-6** | Map RT-FR-1..RT-FR-5 fragmentations and document which fragmentations are accepted vs which are deferred-for-convergence | MEDIUM |

---

## 13. Closing principle (Track B)

Replay taxonomy convergence is the discipline of speaking precisely about which primitive is firing in which case. The platform has a rich set of replay-adjacent primitives (`IDEMPOTENT_REPLAY`, `CONCURRENCY_GUARD_TRIGGERED`, Lock v2's `correlationId` + `duplicate_request`) — but they are NOT consolidated into one canonical taxonomy.

**Convergence is doc-level. Closing RT-Rec-1, RT-Rec-5, RT-Rec-6 makes the platform's replay semantics genuinely reasoning-precise.** The lexicon prevents "replay protected" inflation; the taxonomy map prevents "which primitive caught this?" ambiguity.
