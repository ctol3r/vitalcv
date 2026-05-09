# W2-PR3B — Semantic Inflation Review

**Wave:** Wave 2, PR 3B — adversarial trust governance · **Date:** 2026-05-08 · **Status:** review only; **NO product code, NO runtime modification, NO merge** · **Reviewer posture:** semantic-inflation reviewer · **Authority:** subordinate to `TRUST_GUARANTEE_LEXICON.md`, `VITALCV_OPERATING_DOCTRINE.md`, `AUTHORIZATION_BASELINE_V1.md`

This doc subjects the parallel W2-PR3B legitimacy-instrumentation wave to adversarial semantic review. It catalogues every wording risk where the wave's instrumentation could overstate the runtime's actual guarantees.

It builds on `w2-pr2c-runtime-truth-boundary.md` (Track A) and `w2-pr2c-truth-alignment-governance.md` (Track D), now consolidated under the constitutional `TRUST_GUARANTEE_LEXICON.md`.

The central thesis: **the wave's runtime work is sound; the wave's wording risk is concentrated in seven phrases (now banned by lexicon) and four conditional phrases (now lexicon-qualified).** A merge gate that enforces the lexicon eliminates the inflation risk.

---

## 1. Inflation surfaces

The wave's wording reaches users through six surfaces. Each is a place where an inflated claim does damage.

| Surface | Audience | Damage if inflated |
|---|---|---|
| **PR description** | Reviewers, contributors, auditors | False sense of progress; later waves inherit the inflated framing |
| **Commit messages** | git history readers; future authors | Permanent record; harder to retract than PR description |
| **Audit-row metadata** | SOC analysts, forensic queries, compliance auditors | Forensic conclusions drawn from inflated labels |
| **Dashboard copy** | Operators, on-call engineers, executives | Operational decisions based on overstated metrics |
| **Code comments** | Future maintainers | Misled on what guarantees the code provides |
| **Marketing surface (vitalcv.com)** | Buyers, regulators | External commitments the runtime can't deliver |

The lexicon governs surfaces 1–5 directly. Surface 6 (marketing) is governed by CLAUDE.md banned-strings list + future marketing-claim alignment wave.

---

## 2. Inflation findings (against Lock v2 + parallel implementation expectations)

### 2.1 IF-1 — "Replay resistance"

**Source:** Lock v2 §1, §7.4 ("Replay resistance via correlationId UNIQUE per `(actorId, 24h)`").

**Adversarial paraphrase:** "if I replay a captured request, the platform refuses it."

**Runtime reality:** Lock v2 delivers correlationId observability + best-effort application-layer dedup. NO DB UNIQUE anchor. NO cryptographic nonce. Capture-replay with attacker-chosen correlationId succeeds. TOCTOU race exists.

**Lexicon disposition:** "**replay protected**" is forbidden by §1.3 of `TRUST_GUARANTEE_LEXICON.md`. "Replay resistance" is in the same family — must be replaced.

**Allowed wording:** "replay observability + best-effort idempotency check via correlationId, dedup window 24h, DB-enforced replay prevention deferred to W2-PR2B-MIG-A."

**Severity:** **HIGH**

### 2.2 IF-2 — "Mutation legitimacy"

**Source:** Lock v2 §1 ("Mutation Legitimacy Hardening").

**Adversarial paraphrase:** "the platform now ensures every mutation is legitimate."

**Runtime reality:** the wave delivers input validation + actor authentication + audit coupling. It does NOT validate that the actor has authority over the resource (per-org tenancy is deferred). "Legitimate" in governance language usually means "the actor had authority"; the wave delivers narrower properties.

**Lexicon disposition:** "Legitimacy" is not banned per §1, but is OVERLOADED across (a) input legitimacy, (b) actor legitimacy, (c) authority over resource. The lexicon's enforcement: any use of "legitimacy" must be qualified by which sense.

**Allowed wording:** "Input + actor legitimacy hardening" OR "Audit-coupling + role-gate hardening" — NOT bare "Mutation Legitimacy Hardening."

**Severity:** **MEDIUM**

### 2.3 IF-3 — "Atomic mutation+audit"

**Source:** Lock v2 §6, §8.

**Adversarial paraphrase:** "every mutation is atomic with its audit row."

**Runtime reality:**
- True for the four C-1 handlers (`accept`, `request-refresh`, `route-to-review`, `confirm-start`) — `prisma.$transaction` wraps mutation + audit + outbox.
- **Cosmetic** for `share-packet` + `packet` — single-row tx wrap; nothing to roll back besides the single audit insert.

**Lexicon disposition:** "Atomic mutation+audit" is in §3 of the lexicon (conditional phrase) — must be qualified by which handlers.

**Allowed wording:** "Atomic mutation+audit for the four `prisma.$transaction`-wrapped handlers; uniform-code-pattern wrap (no additional rollback) for share-packet + packet."

**Severity:** **MEDIUM**

### 2.4 IF-4 — "Defense in depth (role gate)"

**Source:** Lock v2 §3.4.

**Adversarial paraphrase:** "if the proxy fails to deny readonly, the backend will catch it."

**Runtime reality:** both the proxy and backend consult the SAME `x-vitalcv-team-role` header (set by the proxy from JWT). Defense-in-depth code paths exist; trust-signal redundancy does NOT — a single signal is read at two layers.

**Lexicon disposition:** "Defense in depth" must be qualified by which dimension.

**Allowed wording:** "Defense-in-depth code paths (readonly denial enforced at both proxy and backend); trust-signal redundancy via independent backend JWT verification is deferred to W2-PR2B-MIG-B."

**Severity:** **MEDIUM**

### 2.5 IF-5 — "Cryptographically signed audit"

**Source:** anticipated risk in parallel implementation PR description (NOT confirmed; PR not visible).

**Adversarial paraphrase:** "audit rows are cryptographically signed."

**Runtime reality:** audit rows have `hash` (SHA-256 of canonical content) — tamper-EVIDENT given DB integrity. Audit rows are NOT signed by any key.

**Lexicon disposition:** "**cryptographically guaranteed**" is forbidden per §1.2. "Signed audit" is a variant covered by §1.4 ("**signed mutation**"). Both are forbidden without the substrate.

**Allowed wording:** "hash-checked audit row" OR "tamper-evident given DB integrity."

**Severity:** **HIGH**

### 2.6 IF-6 — "Non-repudiable mutation"

**Source:** anticipated risk; pre-existing `START_ATTESTED` audit-event type is comment-described as "non-repudiation event" in `apps/api/backend/src/routes/employerActions.ts:798–800`.

**Adversarial paraphrase:** "the actor cannot deny having performed this mutation."

**Runtime reality:** mutations are attributed via `metadata.actorId` derived from `requireClerkUserId(req)` reading the `x-clerk-user-id` header. The actor's only attestation is "the proxy said this user did it." There is NO actor signature, NO proof-of-possession, NO key attached to the mutation.

**Lexicon disposition:** "**non-repudiable**" is forbidden by §1.1 of the lexicon. The grandfathered code comment for `START_ATTESTED` remains in code; **it must NOT propagate to the wave's PR description, audit-row labels, or dashboards.**

**Allowed wording:** "audit-traceable actor attribution" OR "proxy-attributed actor" (with proxy as the trust anchor, explicit).

**Severity:** **HIGH** (because the existing code comment is a known temptation)

### 2.7 IF-7 — "Tamper-proof audit log"

**Source:** anticipated risk.

**Adversarial paraphrase:** "audit rows cannot be modified."

**Runtime reality:** the schema has `anchored Boolean @default(false)` and `merkleRoot String?` columns (lines 1487–1488 of `apps/api/backend/prisma/schema.prisma`). Whether the anchoring pipeline is live and producing `anchored: true` rows for these mutations is **NOT verified by this review**. The default is `false`; without the live pipeline, audit rows are tamper-EVIDENT (DB integrity), not tamper-PROOF.

**Lexicon disposition:** "**tamper-proof**" is forbidden by §1.5. The `anchored` and `merkleRoot` columns themselves are allowed; what's banned is the marketing-grade word.

**Allowed wording:** "tamper-evident given DB integrity" OR "anchored" (only when `anchored: true` AND the pipeline is verified).

**Severity:** **HIGH**

### 2.8 IF-8 — "Verified mutation"

**Source:** CLAUDE.md banned strings already cover "automatically verified" / "guaranteed verification" / "source confirmed before response." A wave-internal use of "verified mutation" could leak.

**Runtime reality:** mutations are **recorded**, not **verified**. Verification is a separate concern about clinician-credential claims (handled by issuer-verification + the receipt path).

**Lexicon disposition:** banned per CLAUDE.md (already in force).

**Allowed wording:** "recorded mutation" OR "audit-coupled mutation."

**Severity:** **MEDIUM**

### 2.9 IF-9 — "Trustless verification"

**Source:** unlikely in W2-PR3B but flagged because vitalcv.com's VC 2.0 alignment could invite this framing in adjacent surfaces.

**Runtime reality:** the platform is a trusted intermediary. The verifier code path (under `apps/web/components/verifier`) verifies issuer-signed receipts but contacting VitalCV is part of the flow.

**Lexicon disposition:** "**trustless**" is forbidden by §1.6.

**Allowed wording:** "third-party verifiable" or "issuer-signed and platform-verifiable."

**Severity:** **LOW** (not anticipated in the wave's surfaces)

### 2.10 IF-10 — "Provably secure"

**Source:** unlikely but flagged for completeness.

**Runtime reality:** no formal security proof exists for the platform's mechanisms.

**Lexicon disposition:** "**provably secure**" forbidden per §1.7.

**Allowed wording:** the testable claim itself ("fail-closed under degraded auth," "constant-time-compared," etc.).

**Severity:** **LOW**

---

## 3. Severity rollup

| Severity | Findings | Closure mechanism |
|---|---|---|
| HIGH | IF-1, IF-5, IF-6, IF-7 | Lock v2 wording fix + Codex audit prompt scan |
| MEDIUM | IF-2, IF-3, IF-4, IF-8 | Lock v2 wording fix |
| LOW | IF-9, IF-10 | Reviewer awareness; lexicon enforcement at PR review |
| **TOTAL** | **10 findings** | All addressable via wording discipline |

**Notable:** zero findings require code changes. The wave's runtime work is sound. The risk is entirely in describing-language.

---

## 4. The "describing-language drift" mechanism

A wave's wording can drift through three phases:

1. **Author phase** — author writes lock + scaffolding (e.g., Lock v2). Wording is initial.
2. **Implementation phase** — implementer writes PR description, commit messages, audit-row literals. Wording can drift toward simpler but inflated forms.
3. **Consumption phase** — dashboards, downstream code, ops runbooks, marketing pull from the implementation phase's wording. Inflation amplifies.

The lexicon stops phase 2 from drifting into the forbidden seven. Without it, phase 3 inherits the drift.

---

## 5. Audit-row label discipline (action-literal vocabulary)

Per the existing `recordEmployerReview*` services + `confirm-start` inline tx, the audit-event type literals are:

| Event type | Pre-existing comment / context |
|---|---|
| `EMPLOYER_REVIEW_ACCEPTED` | Aligned with `'employer_review.accept'` action literal |
| `EMPLOYER_REVIEW_REFRESH_REQUESTED` | Aligned |
| `EMPLOYER_REVIEW_ROUTED_TO_REVIEW` | Aligned |
| `EMPLOYER_PACKET_SHARED` | Audit IS persistence record |
| `START_ATTESTED` | Code comment says "non-repudiation event" — **grandfathered** in code; lexicon-banned in surfaces |
| `ARTIFACT_EXPORTED` | Aligned |

Lock v2 introduces denied-path suffixes: `<base>.role_denied`, `<base>.duplicate_request`, etc. These are aligned with the lexicon's allowed format §4 of `TRUST_GUARANTEE_LEXICON.md`.

**Adversarial finding IF-AUDIT-LITERAL-A:** the implementation PR must NOT introduce new event types or action-literal suffixes that contain banned tokens (`signed_`, `verified_`, `cryptographic_`, etc.). Codex SAFE audit prompt scans for these patterns.

---

## 6. PR description template (recommended for parallel wave)

A PR description that satisfies the lexicon:

```
W2-PR2C / W2-PR3B Implementation: Audit-coupling + role-gate
hardening for employer-review

Mission: tighten input legitimacy + actor legitimacy + audit
coupling on the employer-review mutation surface. Scope frozen
per Lock v2 (5 product files + 1 test).

Delivered:
- Per-action role gate (admin+ for accept/confirm-start; member+
  for others); readonly POST denied at proxy AND backend (defense-
  in-depth code paths; trust-signal redundancy via backend JWT
  verification is deferred).
- correlationId-stamped audit rows on permitted AND denied paths;
  application-layer dedup within 24h window. Replay observability
  + best-effort idempotency check; DB-enforced replay prevention
  is deferred to W2-PR2B-MIG-A.
- Atomic mutation+audit for the four prisma.$transaction-wrapped
  handlers (accept / request-refresh / route-to-review / confirm-
  start); uniform-code-pattern wrap (no additional rollback
  semantics) for share-packet + packet.
- Forbidden ownership inputs (body tenantId / orgId / org_id /
  organization / organizationContextId) discarded for authorization
  purposes; descriptive attribution echo retained in audit metadata
  with `untrusted_attribution_echo` flag.

NOT delivered (deferred per Lock v2):
- Per-org tenant ownership (W2-PR2B-MIG-C).
- Backend JWT verification (W2-PR2B-MIG-B).
- DB UNIQUE anchors for replay prevention (W2-PR2B-MIG-A).
- Cross-tenant 404 wire on resource-row lookups (deferred).

Forbidden lexicon check (per TRUST_GUARANTEE_LEXICON.md):
- This PR does NOT use: "non-repudiable," "cryptographically
  guaranteed," "replay protected," "signed mutation," "tamper-
  proof," "trustless," "provably secure."
- Conditional phrases used with required qualifiers per lexicon §3.

Codex SAFE audit transcript: <link>
Founder approval: <link to approval thread>
```

**Adversarial check:** if the actual implementation PR's description departs from this shape, the merge gate flags.

---

## 7. Closing principle (semantic inflation)

Semantic inflation is the gap between what code does and what its describers say it does. The wave's code does narrow, useful, runtime-honest work. Its describing-language is the threat surface.

**The wave is safe IF the lexicon is enforced at PR review. The wave is unsafe if the lexicon is not yet adopted.** Adoption is a doc-merge decision, costless to runtime, and high-leverage for governance integrity.

**Highest semantic inflation risk:** "non-repudiable" leaking from the grandfathered `START_ATTESTED` code comment into the wave's PR description, dashboard copy, or audit-row labels — IF-6 in the catalogue above. This single phrase carries the most dangerous regulatory and cryptographic weight; a merge gate must explicitly scan for it.
