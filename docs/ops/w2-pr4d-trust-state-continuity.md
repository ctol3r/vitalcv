# W2-PR4D - Trust-State Continuity

**Wave:** W2-PR4D - Workflow Continuity + Operator Coherence
**Date:** 2026-05-08
**Status:** Docs-only state-machine continuity audit. No product code changed.
**Risk class:** SAFE.

## Mission

PR3D listed the state names and called out collisions (`review_required`, `verified`, `ready`, `pending`). PR4D audits each state machine's **transitions** — which states can move to which, who triggers the move, and which moves are silent (not surfaced to the operator). The goal is to identify states that are **terminal-by-omission** — i.e., the state has a legal outgoing transition in code but no UI surface advances it.

## State machines under audit

1. `CanonicalSourceCoverageState` — `packages/trust-state/sourceCoverage.ts`
2. `ReadinessState` — `packages/trust-state/sourceCoverage.ts:682-717`
3. `ReceiptCandidateReviewState` — `apps/web/lib/issuer-verification/types.ts:127`
4. `IssuerResponseStatus` → `ReceiptCandidate` — `apps/web/lib/issuer-verification/receiptCandidate.ts:32-48`
5. `PolicyReviewDecisionStatus` and `refusalGate` — `apps/web/lib/issuer-verification/policyReview.ts:67-122`
6. `CalibratedDecisionState` — `apps/api/backend/src/services/decision/confidenceEngine.ts:23-90`
7. `TrustBand` (`GREEN|YELLOW|RED`) — `packages/trust-state/contracts.ts:4`
8. `TrustUiStatus` — `packages/trust-state/sourceCoverage.ts:621-656`

## 1. `CanonicalSourceCoverageState`

**States** (9): `checked | stale | pending | gated | unavailable | accessRequired | reviewRequired | notDecisionGrade | previewOnly`

**Transition model:** **derivative**. State is computed from a freshness/coverage payload via `resolveCanonicalSourceCoverageState` (lines 302-343). It is not a state machine the operator advances; the system recomputes on each load.

**Priority order** (first match wins):

```
previewOnly  ← if mock/previewOnly flag set     [SILENT — demo only, no operator action]
reviewRequired
unavailable
accessRequired
notDecisionGrade
gated
pending | partial
stale
checked   ← default positive
```

**Operator-visible:** YES, via `TrustUiStatus` (`sourceCoverageStateLabel()` line 581-585; mapped to user-facing labels at 621-656). Operator sees the state name plus a label.

**Terminal-by-omission:** any state other than `checked | stale | pending` requires an out-of-band action (board contact, source escalation, demo flag flip). The UI does not advance these states; the user is told to contact someone external. This is *intentional* — the system does not pretend to fix source-side issues — but it means 5 of 9 states have no in-product progress path. Recommended: add a "What can I do about this?" link beside the state badge that leads to a help / contact surface.

## 2. `ReadinessState`

**States** (4): `CHECKING | PARTIAL | DECISION_GRADE | BLOCKED`

**Derivation** (lines 682-717): only **launch-spine sources** (NPPES_API, OIG_LEIE, PECOS_PUBLIC, STATE_BOARD) contribute.

```
BLOCKED          ← any spine source = reviewRequired OR unavailable
DECISION_GRADE   ← all spine sources = checked
PARTIAL          ← ≥1 spine source = checked
CHECKING         ← otherwise
```

**Operator-visible:** **NO by name**. The enum value is computed and consumed internally (e.g., to gate accept/start flows). It is never rendered as a user-facing label. The operator sees `TrustBand` (indirectly), the readiness score, and (post-#220) per-lane health badges, but not the four-value enum.

**Terminal-by-omission:** all four. The state is system-computed; user has no advance UI for any value.

**Recommendation:** under the readiness score, render the active `ReadinessState` literal (e.g., "Posture: PARTIAL — 2 of 4 spine sources checked"). One-line UI; closes FR-S-5.

## 3. `ReceiptCandidateReviewState`

**States** (8): `review_required | ready_for_policy_review | conflict_review_required | release_required | reroute_required | unable_to_verify | expired | canceled`

**Source of truth for assignment:** `apps/web/lib/issuer-verification/receiptCandidate.ts:32-48`. Mapping from `IssuerResponseStatus` to `ReceiptCandidateReviewState`:

| IssuerResponseStatus | → ReceiptCandidateReviewState | Outgoing path |
|---|---|---|
| `confirmed` | `ready_for_policy_review` | → eligible for `accept_candidate` (gate 5 input) |
| `partially_confirmed` | `review_required` | → blocked (no UI advance) |
| `corrected` | `conflict_review_required` | → blocked (no UI advance) |
| `legally_only` | `review_required` | → blocked unless `limitationNote` provided |
| `requires_release` | `release_required` | → loops back to issuer (out-of-band) |
| `wrong_office` | `reroute_required` | → reroute (candidate discarded) |
| `unable_to_verify` | `unable_to_verify` | → terminal (no proof) |

**Operator-visible:** YES, rendered as a context field on the receipt-candidate view (`apps/web/app/issuer/review/[requestId]/page.tsx`).

**Terminal-by-omission:** four — `review_required`, `unable_to_verify`, `release_required`, `reroute_required`. None have a UI button that advances them. `review_required` is the worst because it is the most common landing state for a non-clean issuer reply, and it has no "request follow-up" or "escalate" button. The clinician sees "pending" on the passport while the candidate is silently in `review_required`.

**Recommendation:** on the receipt-candidate review surface, when `reviewState ∈ {review_required, conflict_review_required, release_required, reroute_required}`, render an explicit "request follow-up from issuer" / "reroute to correct office" / "supply release form" / "mark unverifiable and document" set of actions. In demo, these can be stubbed with disclaimers.

## 4. `PolicyReviewDecisionStatus` and `refusalGate`

**Decision actions** (6): `accept_candidate | reject | request_more_info | request_release | reroute | mark_conflict_review`

**Decision statuses** (output, 7+): `accepted_as_psv_candidate | rejected | request_more_info | requires_release | reroute_required | conflict_review_required | canceled | pending_review`

**Five-gate sequence** (`policyReview.ts:67-122`, in literal code order):

1. action `!== 'accept_candidate'` → `refusalGate: 'action_does_not_create_candidate'`
2. responseStatus `=== 'wrong_office'` → `refusalGate: 'wrong_office_cannot_create_candidate'`
3. responseStatus `=== 'unable_to_verify'` → `refusalGate: 'unable_to_verify_cannot_create_candidate'`
4. reviewState `=== 'conflict_review_required'` → `refusalGate: 'conflict_review_unresolved'`
5. reviewState `!== 'ready_for_policy_review'` → `refusalGate: 'review_state_not_ready'`
6. responseStatus `=== 'legally_only' && !limitationNote` → `refusalGate: 'legally_only_requires_limitation_note'`

**Promotion path:** all six gates must pass AND `action === 'accept_candidate'` AND `responseStatus === 'confirmed'` (or `partially_confirmed` with limitationNote) → `PSVReceiptCandidate` with `decisionGrade: false`, `proofTier: 'psv_receipt_candidate'`. (Truth contract preserved.)

**Operator-visible:**
- `decisionStatus`: YES, rendered on `/issuer/psv-receipt/[requestId]/page.tsx`.
- `refusalGate`: **NO**. Computed, returned, tested. Never bound to UI. This is the largest single operator-readability gap in the entire codebase.

**Terminal-by-omission:** `request_more_info`, `requires_release`, `reroute_required`, `conflict_review_required` — all have no UI surface that captures the next step (more info, release form upload, reroute to correct office, conflict resolution). All are demo-only.

**Recommendation (P0):** render `refusalGate` inline on `/issuer/policy-review/[requestId]/page.tsx` when the dry-run shows refusal. One-line UI; closes the largest operator ambiguity.

## 5. `CalibratedDecisionState`

**States** (5): `READY_CONFIDENT | READY_UNCERTAIN | BLOCKED_CONFIDENT | BLOCKED_UNCERTAIN | PENDING`

**Modulators** (`confidenceEngine.ts:23`):
- `evidenceStrength` (% of required coverage lanes checked)
- `freshnessScore` (% of max TTL remaining)
- `issuerTrustLevel` (blended authority score)
- `outcomeHistoryStrength` (historical success rate)

**Transition rules** (lines 73-82):

```
ReadinessPosture.DECISION_GRADE | PARTIAL → READY_CONFIDENT (confidence=HIGH) | READY_UNCERTAIN (else)
ReadinessPosture.BLOCKED                  → BLOCKED_CONFIDENT (confidence=HIGH|MEDIUM) | BLOCKED_UNCERTAIN (else)
otherwise                                  → PENDING
```

**Operator-visible:**
- `calibratedState`: YES, rendered as the final enum.
- `confidence` (number): YES, via `ConfidenceMeter`.
- modulators: 1 of 4. Only `issuerTrustLevel` is rendered (in `AcceptancePanel.tsx`). `evidenceStrength`, `freshnessScore`, `outcomeHistoryStrength` are computed but not surfaced.

**Silent transitions:** confidence blending (lines 58-62) and critical-flaw overrides (lines 69-71). Operator only sees the final enum.

**Recommendation:** render the four modulator scores as small inline chips beneath the `ConfidenceMeter`. The operator sees BLOCKED_CONFIDENT *because freshnessScore=0.2 and outcomeHistoryStrength=0.3*, not just BLOCKED_CONFIDENT.

## 6. `TrustBand`

**States** (3): `GREEN | YELLOW | RED`

**Computed from:** `TrustState.score` (range [0,1]) and `TrustState.blocking_reasons` (`packages/trust-state/contracts.ts:4-21`).

**Operator-visible:** indirectly. `TrustBand` is exposed as a field but not always labelled `band` in UI; it influences color choice and copy. By design, `TrustBand` is a backend-internal classification with no clinician-facing label.

**Terminal-by-omission:** n/a — `TrustBand` is purely derivative and does not have user-actionable transitions.

## 7. `TrustUiStatus`

**States** (mapped from `CanonicalSourceCoverageState`): `verified | clear | checked | pending | stale | unavailable | access_required | review_required | demo`

**Operator-visible:** YES (rendered).

**Collision risk:**
- `verified` collides with `KnowledgeInboxVerificationStatus.source_verified` (different layer, never rendered).
- `review_required` collides with `ReceiptCandidateReviewState.review_required` (same label, different remediation).

**Recommendation (FR-S-1):** rename `ReceiptCandidateReviewState.review_required` → `issuer_response_incomplete`. The two state machines should not share a label.

## Cross-machine continuity

A passport lane in `TrustUiStatus.review_required` and a receipt candidate in `ReceiptCandidateReviewState.review_required` are **two different things**:

| Field | Passport-lane `review_required` | Receipt-candidate `review_required` |
|---|---|---|
| Source machine | `CanonicalSourceCoverageState` | `ReceiptCandidateReviewState` |
| Trigger | Source check failed (e.g., NPPES timeout, board response unclear) | Issuer responded `partially_confirmed` |
| Correct remediation | Clinician contacts source / waits for source to respond | Reviewer requests follow-up from issuer |
| Owner | Clinician / system | Verifier reviewer |

The collision is the single highest-severity name issue. The remediation differs by cause; the UI does not differentiate.

## Cross-machine flow chain (verifier path)

End-to-end intended flow:

```
[Source coverage]
  CanonicalSourceCoverageState=reviewRequired (passport lane)
    │
    │ (clinician initiates issuer-verification request from lane)  ← MISSING UI
    ▼
[Issuer chain]
  IssuerRequest sent
    │
    │ (issuer responds in /issuer/verify/[requestId])
    ▼
  IssuerResponseStatus → ReceiptCandidateReviewState (per receiptCandidate.ts:32-48)
    │
    │ (reviewer evaluates on /issuer/review/[requestId])
    ▼
[Policy review]
  Six gates fire (policyReview.ts:67-122)
    ├── refused → refusalGate (NOT RENDERED)
    └── passed → PSVReceiptCandidate
                     │
                     │ (out of scope — global PSVReceipt promotion is gated wave)
                     ▼
                 [PSVReceipt]
                     │
                     │ (passport lane status updates to reflect receipt)  ← MISSING DATA FLOW
                     ▼
                 CanonicalSourceCoverageState=checked (passport lane)
```

**Two breaks** in the chain:

- **Entry break:** the clinician cannot initiate the request from the passport lane. `KnowledgeInboxPanel` is mounted; its buttons are unwired.
- **Return break:** even if a `PSVReceiptCandidate` is created (in demo), no mechanism propagates the lane-status update back to `/passport/[id]`. The data flow is one-way.

Once both are wired, every state machine in the chain has at least one user-actionable transition surface and at least one operator-readable terminal field. Today, neither end of the loop is closed.

## Continuity scoring summary

| Machine | States | States rendered by name | Transitions w/ user UI advance | Continuity % |
|---|---|---|---|---|
| `CanonicalSourceCoverageState` | 9 | 9 | 0 (system-derivative; intentional) | 100% read / 0% advance |
| `ReadinessState` | 4 | 0 | 0 | **0%** |
| `ReceiptCandidateReviewState` | 8 | 8 | 1 (only `ready_for_policy_review` advances via `accept_candidate`) | 13% advance |
| `PolicyReviewDecisionStatus` | 7 | 7 | 1 (only `accepted_as_psv_candidate`; demo-only) | 14% advance |
| `refusalGate` | 6 | **0** | n/a (output, not input) | **0% read** |
| `CalibratedDecisionState` | 5 | 5 | 0 (system-derivative) | 100% read / 0% advance |
| `CalibratedDecisionState` modulators | 4 | 1 | 0 | 25% read |
| `TrustBand` | 3 | 3 | 0 (system-derivative; intentional) | 100% read / 0% advance |
| `TrustUiStatus` | 9 | 9 | 0 (system-derivative; intentional) | 100% read / 0% advance |

**Trust-state continuity rollup:** 53% of states render their name; 19% of transitions have a user-actionable UI advance.

## Highest-leverage repairs

In rank order:

1. **Render `refusalGate` on policy-review surface.** Closes the largest operator ambiguity in the codebase. One-line UI.
2. **Render `ReadinessState` literal beneath the readiness score.** Closes FR-S-5. One-line UI.
3. **Surface 3 of 4 `CalibratedDecisionState` modulators.** Closes the confidence attribution gap.
4. **Rename `ReceiptCandidateReviewState.review_required` → `issuer_response_incomplete`.** Closes FR-S-1.
5. **Wire passport-lane → issuer-request entry seam.** Closes the verifier-chain entry break.

Each is single-PR scoped. None requires backend persistence.

## Out of scope

- No new state machines.
- No truth-contract changes (literal `decisionGrade: false`, `proofTier` literals preserved).
- No backend persistence (TRUST-PERSIST-1 covers schema; this PR4D does not depend on it).

## See also

- `w2-pr4d-workflow-coherence.md`
- `w2-pr4d-operator-understanding.md`
- `w2-pr4d-workflow-friction-register.md`
- `docs/architecture/vitalcv-knowledge-trust-graph.md` (boundaries 1-28)
