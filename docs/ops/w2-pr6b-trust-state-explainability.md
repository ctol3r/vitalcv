# W2-PR6B - Trust-State Runtime Explainability

**Wave:** W2-PR6B - Trust-State Runtime Explainability
**Date:** 2026-05-08
**Status:** Docs-only review of trust-state operational explainability. No product code changed. No merge.
**Risk class:** SAFE.
**Purpose:** Determine whether VitalCV trust states are operationally understandable, runtime-aligned, explainable, non-misleading, and survivable under uncertainty.

## Scope

This document audits the explainability of every trust state surface a clinician, verifier, employer, or operator can read in the runtime product. It evaluates eight state machines plus four cross-cutting visibility planes (provenance, replay, audit, mutation).

It does **not** propose new state machines, redesign trust contracts, alter readiness derivation, or modify any runtime code. It defines what is currently explainable, what is partial, what is ambiguous, and what is misleading — and identifies the smallest follow-up changes that would close the gaps.

Anchors:
- `packages/trust-state/contracts.ts`, `TrustStateResolver.ts`, `sourceCoverage.ts`
- `apps/web/lib/issuer-verification/{receiptCandidate,policyReview,types}.ts`
- `apps/api/backend/src/services/{audit/replayEngine,runtimeTrustCohesion}.ts`
- `apps/api/backend/src/types/auditEventTypes.ts`
- `apps/web/components/{trust,passport,trust-state}/`
- W2-PR4C `confidence-explainability`, `readiness-truthfulness`, `dossier-provenance`
- W2-PR4D `trust-state-continuity`, `operator-understanding`
- W2-PR5B `confidence-certification`, `operator-trust-certification`

## Core rule

A trust state is operationally explainable if and only if **all four** are true at the surface where a non-engineer reads it:

1. **Named** — the literal state value (or its label) is rendered, not just inferred from color or score.
2. **Grounded** — the surface explains *what runtime input* produced the state.
3. **Bounded** — the surface explains *what the state does not prove* (no approval / no acceptance / freshness window).
4. **Recoverable** — the operator can either advance the state in-product or be told who advances it.

Failing any of the four downgrades the state. Two failures = ambiguous. Three or more = misleading.

## Rating ladder

- 🟢 **CLEAR** — explainable, observable, runtime-grounded, bounded, recoverable.
- 🟡 **PARTIAL** — explainable but missing one of: bound, recovery path, or grounding text.
- 🟠 **AMBIGUOUS** — operator cannot tell which machine the value belongs to, or two state machines collide on the same label, or the basis is silent.
- 🔴 **MISLEADING** — the surface implies a guarantee, certification, or prevention the runtime does not deliver.

## Trust state inventory

### 1. `CanonicalSourceCoverageState` — 🟢 CLEAR

**States** (9): `checked | stale | pending | gated | unavailable | accessRequired | reviewRequired | notDecisionGrade | previewOnly`

| Criterion | Verdict |
|---|---|
| Named | ✅ Rendered via `sourceCoverageStateLabel()` and `TrustUiStatus` map (`packages/trust-state/sourceCoverage.ts:581-585, 621-656`). |
| Grounded | ✅ Each lane row in `SourceCoverageRow.tsx:50-77` shows source ID + reason + checked timestamp. |
| Bounded | ✅ "Decision grade" badge gates positive wording; non-`checked` states explicitly disqualify decision-grade reliance. |
| Recoverable | 🟡 5 of 9 states require out-of-band action (board contact, source escalation). Intentional, but no in-product "what can I do?" link. |

**Verdict:** 🟢 CLEAR with one minor gap (recovery affordance). The lane-level state surface is the strongest in the codebase.

### 2. `ReadinessState` — 🟠 AMBIGUOUS

**States** (4): `CHECKING | PARTIAL | DECISION_GRADE | BLOCKED`

| Criterion | Verdict |
|---|---|
| Named | ❌ The enum value is **never rendered by name** to the operator. Computed in `packages/trust-state/sourceCoverage.ts:682-717`, consumed internally to gate accept/start flows. |
| Grounded | 🟡 Indirectly visible via per-lane SourceCoverageRow detail; never aggregated as `Readiness: PARTIAL — 2 of 4 spine sources checked`. |
| Bounded | 🟢 `PassportTrustPosture.tsx:107` carries the disclaimer: *"Trust posture reflects source-backed readiness only. It does not represent a hiring, privileging, or employment decision."* |
| Recoverable | 🟡 No state advances in product; user must wait on source. |

**Verdict:** 🟠 AMBIGUOUS. The boundary copy is strong, but the enum value the system actually computes is invisible. An operator who sees a TrustBand and a percentage cannot tell whether the system is in `PARTIAL` (workable) or `BLOCKED` (hard stop) without reading lane rows individually. **Highest-leverage repair:** render the active `ReadinessState` literal beneath the readiness score.

### 3. `ReceiptCandidateReviewState` — 🟠 AMBIGUOUS

**States** (8): `review_required | ready_for_policy_review | conflict_review_required | release_required | reroute_required | unable_to_verify | expired | canceled`

| Criterion | Verdict |
|---|---|
| Named | ✅ Rendered as a context field on `apps/web/app/issuer/review/[requestId]/page.tsx`. |
| Grounded | 🟢 Mapping from `IssuerResponseStatus` is explicit in `receiptCandidate.ts:32-48`. |
| Bounded | 🟢 Truth contract (`decisionGrade: false`, `proofTier: 'receipt_candidate'`) is literal-typed — UI cannot promote a candidate without policy review gates. |
| Recoverable | ❌ 4 of 8 states (`review_required`, `unable_to_verify`, `release_required`, `reroute_required`) have **no UI button** that advances them. |

**Verdict:** 🟠 AMBIGUOUS. The state is named and grounded, but the most common landing state (`review_required`) is silently terminal-by-omission. The clinician sees "pending" on the passport while the candidate sits in `review_required` without an escalation surface. Worsened by the **name collision** with `CanonicalSourceCoverageState.reviewRequired` — same label, different machine, different remediation.

### 4. `PolicyReviewDecisionStatus` and `refusalGate` — 🔴 MISLEADING (gate) / 🟢 CLEAR (status)

**Decision actions** (6): `accept_candidate | reject | request_more_info | request_release | reroute | mark_conflict_review`
**Decision statuses** (7+): `accepted_as_psv_candidate | rejected | request_more_info | requires_release | reroute_required | conflict_review_required | canceled | pending_review`
**Refusal gates** (6, in `policyReview.ts:67-122`).

| Criterion | Verdict (status) | Verdict (refusalGate) |
|---|---|---|
| Named | 🟢 `decisionStatus` rendered on `/issuer/psv-receipt/[requestId]/page.tsx`. | ❌ `refusalGate` is computed, returned, tested — **never bound to any UI**. |
| Grounded | 🟢 Five-gate sequence is deterministic. | ❌ Operator sees "refused" with no reason. |
| Bounded | 🟢 Promotion writes `PSVReceiptCandidate` with `decisionGrade: false` literal. | n/a |
| Recoverable | 🟡 Only `accept_candidate` has a happy-path action surface. | ❌ Operator cannot self-correct without engineering help. |

**Verdict:** 🔴 MISLEADING for `refusalGate` — the largest single operator-readability gap in the codebase, per W2-PR4D §4. A verifier denied promotion gets no machine-readable reason. **Highest-leverage repair:** render `refusalGate` inline on `/issuer/policy-review/[requestId]/page.tsx`.

### 5. `CalibratedDecisionState` — 🟡 PARTIAL

**States** (5): `READY_CONFIDENT | READY_UNCERTAIN | BLOCKED_CONFIDENT | BLOCKED_UNCERTAIN | PENDING`
**Modulators** (4): `evidenceStrength`, `freshnessScore`, `issuerTrustLevel`, `outcomeHistoryStrength`.

| Criterion | Verdict |
|---|---|
| Named | 🟢 Final enum rendered. |
| Grounded | 🟠 Only 1 of 4 modulators (`issuerTrustLevel`, in `AcceptancePanel.tsx`) is surfaced. The other three are computed and silently discarded. |
| Bounded | 🟡 Surface honors `decisionGrade: false` boundary, but the operator cannot tell *why* a state was downgraded. |
| Recoverable | n/a — derivative. |

Compounding: `confidenceEngine.ts` defaults `outcomeHistoryStrength` to `1.0` when no history exists, so absence of history reads as positive support. This is a **silent uplift** — the operator sees `READY_CONFIDENT` partly because no negative signal has accumulated yet.

**Verdict:** 🟡 PARTIAL with a 🔴 sub-risk (no-history uplift). **Recommended repair:** render the four modulator chips beneath `ConfidenceMeter`; replace no-history default with explicit `No outcome history yet` band.

### 6. `TrustBand` — 🟢 CLEAR (as a derivative)

**States** (3): `GREEN | YELLOW | RED`.
Computed from `score` + `blocking_reasons` in `TrustStateResolver.ts:469-479`.

| Criterion | Verdict |
|---|---|
| Named | 🟡 Indirectly: shown as color and copy, not as the literal `band` token. |
| Grounded | 🟢 `blocking_reasons` enumerate every cause; sort order is deterministic. |
| Bounded | 🟢 Resolver downgrades to `RED` on any decay/conflict/missing-PSV; cannot mask risk. |
| Recoverable | n/a — derivative. |

**Verdict:** 🟢 CLEAR. `TrustBand` is the most honest aggregate the runtime produces. Its only weakness is that `blocking_reasons` is a TypeScript array — a UI consumer must enumerate each reason and translate to remediation copy; today that translation is patchy.

### 7. `TrustUiStatus` — 🟠 AMBIGUOUS (name collision)

**States** (9): `verified | clear | checked | pending | stale | unavailable | access_required | review_required | demo`

| Criterion | Verdict |
|---|---|
| Named | 🟢 Rendered. |
| Grounded | 🟢 Maps 1:1 from `CanonicalSourceCoverageState`. |
| Bounded | 🟠 `verified` collides with `KnowledgeInboxVerificationStatus.source_verified` (different layer, different proof grade). |
| Recoverable | n/a — derivative. |

**Worst collision:** `review_required` exists in *both* `TrustUiStatus` (passport-lane meaning: source check failed) and `ReceiptCandidateReviewState` (issuer-chain meaning: response incomplete). Same string; different trigger; different remediation; different owner. Per W2-PR4D §7, this is the highest-severity name issue in the codebase.

**Verdict:** 🟠 AMBIGUOUS until rename. **Recommended repair:** rename `ReceiptCandidateReviewState.review_required` → `issuer_response_incomplete`.

### 8. `RuntimeMutationClassification` / `RuntimeReplayCategory` — 🟠 AMBIGUOUS

**Classifications** (8): `TRUST_ACCEPTANCE | TRUST_REFRESH_REQUEST | TRUST_REVIEW_ROUTING | TRUST_PACKET_EXPORT | TRUST_PACKET_SHARE | TRUST_START_ATTESTATION | DENIED_MUTATION | DOSSIER_REPLAY`
**Replay categories** (6): `R-CAT-1 ... R-CAT-6`.

Defined in `apps/api/backend/src/services/runtimeTrustCohesion.ts`. The service:

- builds `mutationFingerprint` and `payloadHash` (SHA-256, sensitive keys redacted: `npi`, `notes`, `shareToken`, etc.);
- emits a normalized classification + replay category per mutation;
- tags outcome as `'allowed' | 'denied' | 'replayed'`.

| Criterion | Verdict |
|---|---|
| Named | 🟡 Tags are persisted in audit events but never rendered to operators. |
| Grounded | 🟢 Deterministic mapping in `resolveReplayCategory()` and `normalizeMutationClassification()`. |
| Bounded | 🔴 Service name implies *runtime trust cohesion validation*; behavior is **fingerprint generation + categorization**, not cohesion enforcement. No state-machine consistency check, no cross-mutation validation. |
| Recoverable | n/a — telemetry. |

**Verdict:** 🟠 AMBIGUOUS. The category set is clean and useful for audit replay; the module name oversells. A reader of the code might assume "runtime trust cohesion" enforces something the resolver does not enforce.

## Cross-cutting planes

### Provenance plane — 🟢 CLEAR (mostly)

Source label, checked timestamp (relative + absolute tooltip), decision-grade badge, freshness window, artifact id, receipt id are all rendered at lane level. Single gap: `SourceCoverageRow.tsx` "Not yet checked" does not distinguish *pending*, *failed*, *not scheduled*, or *never attempted*. Detail in `w2-pr6b-provenance-visibility.md`.

### Replay plane — 🔴 MISLEADING

Two contradictions in active code:

1. `replayEngine.ts:2-15` describes "Deterministic replay of events" — the engine reconstructs evidence and verifies hash match. There is **no nonce / jti / idempotency-token enforcement anywhere in the audit service** (grep: 0 hits). The engine does not prevent replay attacks; it audits replay-safe reconstruction.
2. UX copy mixes both readings: an `IntakeContent` title (archive) reads *"All decisions are timestamped and replayable"* (implies protection); `apps/web/lib/issuer-verification/statusCopy.ts` correctly disclaims *"Replay-safe does not mean legal proof and does not change any claim truth tier."*

Verifiers reading the active surface may overestimate replay-attack protection.

### Audit plane — 🟡 PARTIAL

- `TRUST_STATE_CHECK` is in the canonical `AuditEventType` union (`auditEventTypes.ts:49`). ✅
- `TRUST_STATE_DECAY` exists only as a **string literal in tests** — it is appended by the resolver (`TrustStateResolver.ts:481-494`) and tested in `silentPilot.e2e.test.ts`, but it is not in the type union. The compiler does not enforce the schema for decay events. 🔴
- `audit_packet_id` is returned in API responses but UI-side `AuditTimeline.tsx` and `AuditTrailTimeline.tsx` use **local enum types** decoupled from backend event types. End-to-end traceability from clinician → audit row → resolver event is not wired. 🟠

### Mutation plane — 🟠 AMBIGUOUS

`runtimeTrustCohesion.ts` produces fingerprints and replay categories, redacts sensitive payload keys, tags allowed/denied/replayed. Good telemetry; **not a state-machine validator**. Operators have no surface that says *"this clinician's trust band changed from GREEN to RED on date X because receipt Y expired"*. Decay is logged internally; no clinician- or verifier-readable mutation history exists.

## Critical questions — answers

| # | Question | Answer |
|---|---|---|
| 1 | Would a clinician misunderstand readiness? | 🟡 PARTIAL risk. `PassportTrustPosture.tsx:107` correctly disclaims hiring/privileging. `TrustStateCard` renders "Clear to Start" without an equivalent disclaimer; "Safe to rely on now" copy is context-sensitive. ReadinessState enum is invisible by name. |
| 2 | Would a verifier overestimate audit guarantees? | 🟠 AMBIGUOUS. `audit_packet_id` is real. UI timelines render mock data with local enums. End-to-end audit lookup from a UI surface is not wired. |
| 3 | Would replay telemetry imply replay prevention? | 🔴 YES. "replayable" copy and the `replayEngine.ts` module name imply protection. The engine performs deterministic reconstruction, not nonce/jti enforcement. |
| 4 | Would trust-state transitions confuse operators? | 🟠 YES. `review_required` collides between two machines. `refusalGate` has six values, none rendered. `ReadinessState` literals are invisible. |
| 5 | Would provenance semantics imply certification? | 🟢 NO. Source-coverage rows + decision-grade badge + freshness make it clear the lane is a *check*, not a *certification*. Banned-string scan over `apps/web/components` and `apps/web/app` returned **zero** hits for `certified compliant`, `HIPAA compliant`, `SOC2 certified`, etc. |
| 6 | Would confidence semantics imply deterministic certainty? | 🔴 YES. Three confidence components show bare `% confidence` with no basis label. `confidenceEngine.ts` defaults missing outcome history to `1.0`, turning absence into uplift. |

## Final output

1. **Strongest explainable trust state.** `CanonicalSourceCoverageState` rendered through `SourceCoverageRow.tsx` + `SourceCoverageTag.tsx`: every value is named, grounded by source label and timestamp, bounded by the decision-grade badge, and the operator knows what off-product action is required. This is the model the rest of the surfaces should converge to.

2. **Weakest explainability surface.** The `refusalGate` field on policy review (`apps/web/lib/issuer-verification/policyReview.ts:67-122`). Six deterministic gates fire, the field is computed, returned, tested — and never rendered. A verifier sees refusal with no machine-readable reason.

3. **Largest ambiguity risk.** The `review_required` name collision between `CanonicalSourceCoverageState` and `ReceiptCandidateReviewState`. Same label, different machines, different owners, different remediation. Compound risk: clinician contacting a source while the actual blocker is an issuer follow-up.

4. **Strongest runtime-alignment gain.** Three single-PR changes, none requiring backend persistence:
   - render `refusalGate` literal on `/issuer/policy-review/[requestId]`;
   - render the active `ReadinessState` literal beneath the readiness score on the passport;
   - require a `basis` prop on every confidence component and disclose `No outcome history yet` when sample size is zero.
   Together these close the three highest-severity transparency gaps without changing any contract.

5. **Operational explainability verdict — PARTIAL / SAFE.**
   - **Truth contract layer (TypeScript-enforced literals):** SAFE. `decisionGrade: false`, `proofTier: 'receipt_candidate' | 'psv_receipt_candidate'`, the five-gate refusal sequence, the resolver's `RED-on-decay` rule, and the banned-string scan all hold.
   - **UX layer (what an operator reads):** PARTIAL. Strong on provenance and source coverage; weak on readiness naming, confidence basis, refusalGate visibility, and replay copy.
   - The system does not currently *overstate* what it proves at the truth-contract boundary, but it *under-reveals* the runtime decisions it makes — and three surfaces (replay copy, confidence percentages, runtimeTrustCohesion module name) actively risk implying guarantees the runtime does not deliver.

## Honesty assessment

**Artifact alignment:** SAFE. This document does not change any contract, copy, or runtime behavior. It only describes what is currently visible vs. what the runtime computes.

**Runtime alignment:** PARTIAL. Five of the eight state machines have at least one explainability gap; three of the four cross-cutting planes (replay, audit, mutation) have at least one ambiguous or misleading surface. The proposed repairs are all small, single-PR scoped, and do not depend on TRUST-PERSIST-1.

## See also

- `w2-pr6b-confidence-runtime-alignment.md`
- `w2-pr6b-readiness-runtime-alignment.md`
- `w2-pr6b-provenance-visibility.md`
- `w2-pr6b-runtime-explainability-matrix.md`
- `w2-pr4c-confidence-explainability.md`, `w2-pr4c-readiness-truthfulness.md`, `w2-pr4c-dossier-provenance.md`
- `w2-pr4d-trust-state-continuity.md`, `w2-pr4d-operator-understanding.md`
- `w2-pr5b-confidence-certification.md`, `w2-pr5b-operator-trust-certification.md`
