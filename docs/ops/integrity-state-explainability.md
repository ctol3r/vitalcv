# Integrity-State Explainability — W2-PR12B Track B

**Date:** 2026-05-08
**Reviewer role:** integrity-state explainability reviewer
**Scope:** Can an operator look at VitalCV's surfaces and correctly classify the platform's integrity state into one of five canonical buckets — CI-GREEN, CI-DEGRADED, CI-DRIFT, CI-FRAGMENTED, CI-VIOLATION — without misreading a worse state as a better one?

---

## Important: these labels do not exist in code yet

Grep across `apps/`, `packages/`, and `docs/` for `CI-GREEN | CI-DEGRADED | CI-DRIFT | CI-FRAGMENTED | CI-VIOLATION` returns **zero matches**. This wave's job is not to evaluate existing labels but to determine whether the *underlying state* a label like CI-DRIFT would describe is currently **distinguishable** to an operator from the surfaces VitalCV exposes.

**This document treats the five labels as the abstract integrity-state contract operators would need.** If the contract cannot be filled by today's surfaces, that is the finding.

---

## State-contract definitions

| State | Defined as |
|---|---|
| **CI-GREEN** | All trust subsystems coherent: live runtime matches recorded snapshots; replay reproduces capsule; export bundles round-trip; dashboard and audit agree; authority chain intact. No active degradation. |
| **CI-DEGRADED** | One or more *non-truth* surfaces are temporarily impaired (a lane is RATE_LIMITED or UNAVAILABLE) but the truth contract is intact: capsules still record decisions correctly, replays still reproduce, no audit row is wrong. |
| **CI-DRIFT** | A *measurable divergence* exists between two views of the same fact (recorded vs. recomputed, snapshot vs. live, dashboard vs. canonical) but no truth claim is contradicted; the platform is internally honest about the divergence. |
| **CI-FRAGMENTED** | A surface presents a partial view that, taken alone, would mislead — e.g., a denial reason collapsed in metrics, an audit timeline missing the runtime context, a bundle that omits a known-relevant event. The full record is somewhere; the operator-visible record is not. |
| **CI-VIOLATION** | A truth claim is wrong: a banned-string appears, a capsule fails replay, a `decisionGrade` literal is widened, an audit row says "verified" when the gate refused. This is the only state where the truth contract has actually broken. |

The five states are ordered by severity; an operator should be able to read VitalCV today and produce the **correct** label, not a less-severe one.

---

## State-by-state operator readability

### CI-GREEN — 🟠 CONFUSING (false-confidence risk)

**What an operator sees today:** No "system status: green" surface aggregates "everything is coherent." `/status` exposes per-surface foundation status (`foundation_planned`, `foundation_sketched`, `foundation_shape`) and per-lane source health, but none of it certifies that *replay still reproduces*, *bundles still round-trip*, or *audit still matches dashboard*. The closest thing operators have is "no red badges in front of me right now."

**Why this is dangerous:** "no red badges" can coexist with CI-DRIFT (e.g., a composite badge yellow-because-of-score over a BLOCKED status) or CI-FRAGMENTED (denial reasons collapsed in metrics). An operator looking for "is the platform healthy?" will infer GREEN from absence of warnings, not from positive evidence of cohesion.

**Verdict:** 🟠 CONFUSING. The label *can* be right; the operator's confidence in it is structurally unjustified.

---

### CI-DEGRADED — 🟢 EXPLAINABLE

**What an operator sees today:** [`LaneHealthSection`](apps/web/components/source-health/LaneHealthSection.tsx) renders per-lane `LIVE / RATE_LIMITED / UNAVAILABLE / UNKNOWN` with `userFacingMessage` and a retry policy. `/status` exposes the foundation/preview state honestly (`uptimeGuaranteeImplied: false`, `productionStatusPageLive: false`).

**Why this works:** The degradation is named, the lane is named, the consequence (no fresh data from this source) is implicit but inferable from the message. An operator seeing NPPES = RATE_LIMITED understands "this is degraded, not broken."

**Verdict:** 🟢 EXPLAINABLE. The strongest integrity-awareness surface VitalCV has today.

---

### CI-DRIFT — 🟠 CONFUSING

**What an operator sees today:** Drift surfaces (replay capsule vs. live, snapshot readiness vs. current readiness, composite badge vs. canonical status) all *exist as data* but none are labeled "drift" anywhere in the UI. From Track A: replay-drift is 🟡, survivability-drift 🟠, export-drift 🟠, dashboard-drift 🟠.

**Why this is dangerous:** Drift is the most *honest* failure mode — the data is there, the platform knows it, the truth contract holds. But because it's never named, an operator looking at a divergence has three plausible interpretations:
- "the platform is wrong" (incorrect — it's drift)
- "the dashboard is broken" (incorrect — composite render is doing what code says)
- "there's been tampering" (incorrect — replay would show that as a hash mismatch)

The wrong interpretation can cascade: an operator who thinks they're seeing tampering escalates to security, who escalates to legal, while the actual answer is "the snapshot was true at T0; the live state has degraded since."

**Verdict:** 🟠 CONFUSING. CI-DRIFT is most likely to be misread as CI-VIOLATION.

---

### CI-FRAGMENTED — 🟠 CONFUSING

**What an operator sees today:** Fragmentation lives in three concrete places:
1. `EMPLOYER_REVIEW_MUTATION_DENIED` collapses three structural denial reasons into one event type — group-by-type metrics flatten them.
2. `replayMetadata.replayCategory = 'R-CAT-6'` always, even when the inner action was R-CAT-1…5 ([`runtimeTrustCohesion.test.ts:52`](apps/api/backend/src/services/__tests__/runtimeTrustCohesion.test.ts:52)).
3. Audit-bundle export carries no "ledger as-of" marker, so a bundle reader cannot tell whether the live ledger has corrected events since.

**Why this is dangerous:** Fragmentation hides itself by definition — the partial view is internally consistent, just incomplete. An operator querying `denials_per_day` and seeing a flat curve can confidently report "denials are stable" while three structurally different denial reasons drift independently.

**Verdict:** 🟠 CONFUSING. CI-FRAGMENTED is most likely to be misread as CI-GREEN.

---

### CI-VIOLATION — 🟢 EXPLAINABLE (in code paths) / 🟡 PARTIAL (operator-side)

**What an operator sees today:** Truth-contract violations are heavily defended at the code layer:
- `decisionGrade: false` is a TypeScript literal, not a boolean — caller cannot widen it.
- `proofTier` literals (`receipt_candidate`, `psv_receipt_candidate`, `psv_receipt`) cannot be reassigned.
- Banned-string list in `CLAUDE.md` is enforced via test fixtures.
- Replay tamper detection compares `storedHash` vs `recomputedHash` and emits specific `tamperEvidence` locations.
- Five-gate refusal sequence in [`policyReview.ts`](apps/web/lib/issuer-verification/policyReview.ts) prevents PSVReceiptCandidate creation when any gate fires.

**Why this works (mostly):** A real violation produces a concrete, named code-layer artifact (type error at build, test failure, hash mismatch, refusal gate). These are machine-checkable.

**Why it's only partial operator-side:** No operator surface today says "VIOLATION DETECTED — capsule X failed replay at Y." The signals exist in logs, test runs, and HTTP error responses, but there is no human-facing CI-VIOLATION dashboard. An operator without log access would not see a real violation in real time.

**Verdict:** 🟢 in code, 🟡 operator-side. The truth contract holds; the operator's view of "is the contract holding right now?" is incomplete.

---

## Hidden ambiguity, false confidence, and survivability/replay confusion

### Hidden ambiguity

The two highest-ambiguity surfaces are:
1. **Composite readiness badge** — yellow can mean "score is medium" *or* "status is BLOCKED with high score" (W2-PR7B finding). Same color, different state.
2. **`/status` page foundation labels** — `foundation_planned`, `foundation_sketched`, `foundation_shape` are honest *internally* but operators reading the surface for the first time may interpret them as "feature is rolling out" rather than "feature has not been built."

### False confidence

Three places generate false confidence:
1. **Absence of red badges** read as CI-GREEN (above).
2. **Audit bundle freshness** — bundles look canonical; nothing on the bundle says "freeze date T0; ledger may have moved since."
3. **Issuer ↔ employer seam** — passport can simultaneously read `readiness=READY` (employer view) and `unable_to_verify` (issuer's latest response). Operator reading either side may not see the other (W2-PR7B finding).

### Survivability confusion

Survivability degradation (a lane going UNAVAILABLE) is locally explainable on the LaneHealth surface but is **not** propagated into:
- the readiness badge color (still green if score is high)
- the audit timeline (no "lane went UNAVAILABLE during this acceptance" annotation)
- the replay envelope (does not surface live lane state at replay time vs. decision time)

Survivability *as a state* — "what's still trustworthy when X is degraded?" — is not a labeled UI concept anywhere.

### Replay misunderstanding

Three replay-side risks:
1. **R-CAT-6 outer label** masks inner action class — when a replay panel ships, operators will misread the category.
2. **No replay UI today** — operators relying on subjective "I trust the platform" rather than positive replay evidence.
3. **Tamper-evidence list is flat** — replay returns an array of locations; no severity ordering, no narrative ("tampering at evidenceSpine[2].sourceId is *more severe* than at evidenceSpine[2].fetchedAt").

---

## Track B summary

| Integrity state | Verdict | Most-likely misread |
|---|---|---|
| CI-GREEN | 🟠 CONFUSING | inferred from absence rather than evidence |
| CI-DEGRADED | 🟢 EXPLAINABLE | strongest surface; honest about lane state |
| CI-DRIFT | 🟠 CONFUSING | misread as CI-VIOLATION → over-escalation |
| CI-FRAGMENTED | 🟠 CONFUSING | misread as CI-GREEN → under-escalation |
| CI-VIOLATION | 🟢 in code / 🟡 operator-side | violations real-time-detected only via logs/tests |

**Pattern:** the *one* state operators can read correctly today is degradation of a non-truth surface (lanes). Every other state is currently un-named, mis-readable, or visible only in code-layer artifacts. The truth contract itself is well-defended at the type-system layer; the operator's view of *whether the contract is holding* is the gap.

**Single most impactful fix:** an `/integrity` page that aggregates four positive checks — last-replay-success, last-bundle-roundtrip, dashboard-canonical-agreement, taxonomy-completeness — and emits one of five labels. That single surface would convert four of five states from 🟠/🟡 to 🟢.
