# Governance Awareness Survivability — W2-PR12B Track D

**Date:** 2026-05-08
**Reviewer role:** governance-visibility / survivability-explainability reviewer
**Scope:** When the platform enters a degraded runtime state, replay ambiguity, export degradation, or lineage fragmentation, does VitalCV preserve the *visibility* of governance, integrity, drift, and survivability — or does the degraded state silently become invisible?

---

## What survivability of awareness means

A platform can be *operationally degraded* and still be *operationally honest*: it can keep telling the operator what is degraded, what that costs, and what is still trustworthy. The opposite — a platform that loses its *self-description* during degradation — is dangerous specifically because the operator's confidence stays high while the truth contract slips.

Four awareness vectors:

| Vector | What stays visible during degradation? |
|---|---|
| Governance visibility | Who decided, under what policy, with what gate? |
| Integrity visibility | Did this decision pass the integrity contract or fall to a refusal/denial? |
| Drift visibility | Is there a divergence between recorded and live, and is it named? |
| Survivability honesty | What is *still* trustworthy when X is degraded? |

For each I evaluate four degraded-runtime scenarios:

1. **Lane outage** — NPPES or another canonical source is UNAVAILABLE
2. **Replay ambiguity** — replay produces partial recompute (some fields succeed, some fail)
3. **Export degradation** — bundle is exported but a downstream event corrects it
4. **Lineage fragmentation** — authority chain has a renamed enum or missing label

---

## D.1 Governance visibility

### What "governance" means in code today

Five-gate refusal sequence at [`policyReview.ts`](apps/web/lib/issuer-verification/policyReview.ts) (`action_does_not_create_candidate`, `wrong_office_cannot_create_candidate`, `unable_to_verify_cannot_create_candidate`, `conflict_review_unresolved`, `review_state_not_ready`, `legally_only_requires_limitation_note`). Plus the issuer-verification ReceiptCandidateReviewState union (`ready_for_policy_review`, `review_required`, `conflict_review_required`, `release_required`, `reroute_required`, `unable_to_verify`).

Plus the truth-contract literals (`decisionGrade: false`, `proofTier: 'receipt_candidate' | 'psv_receipt_candidate' | 'psv_receipt'`).

| Scenario | Governance visibility |
|---|---|
| Lane outage | 🟡 PARTIAL — gates fire correctly (no acceptance writes if a gate refuses), but the operator-facing surface only shows the *outcome* (refusal), not *which gate* fired. The `refusalGate` enum is internal. |
| Replay ambiguity | 🟢 EXPLAINABLE — replay envelope preserves authorityChain regardless of recompute success. Governance lineage survives partial recompute. |
| Export degradation | 🟠 CONFUSING — exported bundles preserve the gate refusal at the time of export, but a downstream audit event that corrects it is not back-linked into the bundle. |
| Lineage fragmentation | 🟡 PARTIAL — authorityChain links are pinned to enums (NPPES, STATE_BOARD, etc.) so renames don't break lineage; but human-readable labels in `SOURCE_LABELS` are live, so a rename retroactively re-labels old chains. |

**Composite verdict:** 🟡 PARTIAL — governance is *enforced* well in code; *visibility of which governance fired* is not consistently surfaced.

---

## D.2 Integrity visibility

### What "integrity" means here

`storedHash` vs. `recomputedHash`, `tamperEvidence` array, refusalGate firing, banned-string non-occurrence, capsule-replay reproduction.

| Scenario | Integrity visibility |
|---|---|
| Lane outage | 🟢 EXPLAINABLE — integrity is computed from *stored* capsule, independent of live source state; replay survives full upstream outage. |
| Replay ambiguity | 🟡 PARTIAL — partial recompute returns evidence-spine compare results. Tamper-evidence array is flat (not severity-ordered) so an operator cannot distinguish "metadata mismatch on `fetchedAt`" from "content mismatch on `sourceId`" without reading the array semantics. |
| Export degradation | 🟢 EXPLAINABLE — bundle is content-addressed; a corrupted bundle fails the schema check at the verifier. |
| Lineage fragmentation | 🟡 PARTIAL — chain enum is canonical, but if a label is renamed an old capsule's chain renders with new labels; integrity-of-text is not pinned to capsule. |

**Composite verdict:** 🟡 PARTIAL — integrity *holds* under degradation but the operator's view of *which check passed and which failed* is unstructured.

---

## D.3 Drift visibility

Established in Track A: every drift class except dashboard-composite is at minimum 🟡 today, and three (survivability, export, dashboard) are 🟠.

| Scenario | Drift visibility |
|---|---|
| Lane outage | 🟠 CONFUSING — survivability drift between captured snapshot and live lane state is structurally invisible; no surface places them side-by-side. |
| Replay ambiguity | 🟡 PARTIAL — replay returns recorded vs. computed; an operator with the JSON can compute the divergence; no UI does this for them. |
| Export degradation | 🟠 CONFUSING — export drift (bundle vs. live ledger) has no marker in the bundle to notice. |
| Lineage fragmentation | 🟡 PARTIAL — chain enums survive; labels can drift silently. |

**Composite verdict:** 🟠 CONFUSING — drift is the weakest visibility class. This is consistent with Track A.

---

## D.4 Survivability honesty

### What "survivability honesty" means

When source X degrades, does the platform clearly tell the operator (a) what is *still* trustworthy from prior captures, (b) what is *not* trustworthy now, and (c) how the operator should treat acceptances made before vs. after the degradation began?

| Scenario | Survivability honesty |
|---|---|
| Lane outage | 🟡 PARTIAL — `LaneHealthMount` (rendered on `/passport`, `/passport/[id]`, `/employer/dashboard`) honestly shows lane state, retry policy, and userFacingMessage. But it does *not* annotate prior acceptances with "this acceptance was made when the lane was LIVE — current state is UNAVAILABLE — this is expected." Survivability of the *historical record* is implicit, not surfaced. |
| Replay ambiguity | 🟢 EXPLAINABLE — replay is a pure recompute; it can run during full source outage; the operator who runs a replay during a lane outage gets the same answer as one who runs it during normal operation. This is the strongest survivability surface. |
| Export degradation | 🟠 CONFUSING — bundles do not carry a "live ledger has moved since" marker, so a bundle's *survivability as a forensic artifact* depends on out-of-band knowledge. |
| Lineage fragmentation | 🟡 PARTIAL — the chain enum survives renames; the rendered label does not. |

**Composite verdict:** 🟡 PARTIAL — survivability is honest where it is *automatic* (replay, lane health) and confusing where it depends on operator-side reconciliation (export, prior-acceptance interpretation).

---

## Awareness-survivability matrix

| Vector / Scenario | Lane outage | Replay ambiguity | Export degradation | Lineage fragmentation |
|---|---|---|---|---|
| Governance visibility | 🟡 | 🟢 | 🟠 | 🟡 |
| Integrity visibility | 🟢 | 🟡 | 🟢 | 🟡 |
| Drift visibility | 🟠 | 🟡 | 🟠 | 🟡 |
| Survivability honesty | 🟡 | 🟢 | 🟠 | 🟡 |

**Patterns:**
- **Replay ambiguity** is the scenario the platform handles best — replay is pure, capsules are content-addressed, lineage is enum-pinned.
- **Export degradation** is the scenario the platform handles worst — bundles have no temporal self-description.
- **Lane outage** is asymmetric: integrity is 🟢, drift is 🟠. The platform stays honest about *what failed* but is silent about *what diverged*.
- **Lineage fragmentation** is uniformly 🟡 — well-defended at the enum layer, soft at the label layer.

---

## Six survivability concerns specific to operator trust

1. **Operator interprets stale-but-accurate as wrong.** A six-month-old acceptance whose snapshot was correct at T0 looks "untrustworthy" today if the operator only sees current lane state. The platform has the data to defend the prior acceptance; no surface does it.

2. **Bundle without "as-of" marker.** A bundle exported today is presented as authoritative. Two weeks from now the same operator (or a downstream auditor) cannot tell whether subsequent ledger events have corrected anything in the bundle. Survivability of the bundle as evidence is reduced.

3. **Refusal gate identity hidden.** When `policyReview.ts` refuses to create a `PSVReceiptCandidate`, the *outcome* is visible (refusal) but the *gate* is not (`refusalGate` enum is internal). An auditor reading the audit timeline sees "rejected"; not "rejected because of `unable_to_verify_cannot_create_candidate`."

4. **Composite badge override of canonical state.** Yellow can mean "score is medium" or "status is BLOCKED with high score." The composite renders the same way; the operator cannot tell from the badge alone which meaning applies. Survivability of *truth* is fine (the canonical field is intact); survivability of *operator inference* is not.

5. **R-CAT-6 envelope masking.** When the replay panel ships, every replay will be labeled R-CAT-6 (dossier-replay) at the envelope level — even when the inner action was R-CAT-1 (acceptance) or R-CAT-5 (denial). Survivability of *runtime classification across replay* is partial.

6. **Persistence-state language ambiguity.** `pending_not_written` reads to an operator as "in flight" rather than "feature flag off, this is not durable yet." TRUST-PERSIST-1 mid-rollout creates a window where survivability of audit-row durability is uneven.

---

## Track D summary

**Strongest awareness-survivability surface:** **Replay during source outage.** Pure recompute over content-addressed capsules with enum-pinned authority chain stays honest under nearly all degradation scenarios. This is VitalCV's structural strength.

**Weakest awareness-survivability surface:** **Bundle-as-evidence over time.** Lacking an "as-of" marker, bundles cannot be safely re-read by an auditor weeks later without out-of-band knowledge. This is a single-fix concern (add a `ledgerHeadAtExport` field to `AuditBundle`) with high payoff.

**Biggest hidden survivability risk:** **The implicit "stale acceptance" problem.** A platform that captures snapshots faithfully and then degrades a lane will, in operator perception, render *all prior acceptances tied to that lane* as untrustworthy — even though the snapshot was correct at T0. The data to defend those acceptances exists; no surface does the defending.

| Vector | Composite verdict |
|---|---|
| Governance visibility | 🟡 PARTIAL |
| Integrity visibility | 🟡 PARTIAL |
| Drift visibility | 🟠 CONFUSING |
| Survivability honesty | 🟡 PARTIAL |

The platform's *truth contract* is well-defended at the type-system and capsule layers and stays intact under all four degraded scenarios. The platform's *awareness contract* — its ability to keep telling the operator what is happening as things degrade — is intact in code paths and partial in operator-facing surfaces. The single most impactful intervention is adding **temporal self-description** to two artifacts: bundles ("ledger as-of") and the dashboard ("snapshot at T0 vs. live state").
