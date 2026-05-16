# W2-PR6B - Runtime Explainability Matrix

**Wave:** W2-PR6B - Trust-State Runtime Explainability
**Date:** 2026-05-08
**Status:** Docs-only consolidated explainability matrix and runtime board. No product code changed. No merge.
**Risk class:** SAFE.
**Purpose:** Single-page consolidated matrix of every trust-state surface in VitalCV, rated against the four-criterion explainability ladder, plus a board-ready runtime explainability scorecard with deltas and verdict.

## Reading this document

This is the **rollup**. The four sibling docs (`trust-state-explainability`, `confidence-runtime-alignment`, `readiness-runtime-alignment`, `provenance-visibility`) carry the file/line evidence; this matrix consolidates the verdicts so an operator, board reader, or wave reviewer can scan in under five minutes.

Rating ladder:
- 🟢 **CLEAR** — explainable, observable, runtime-grounded, bounded, recoverable.
- 🟡 **PARTIAL** — explainable but missing one of: bound, recovery path, or grounding text.
- 🟠 **AMBIGUOUS** — operator cannot tell which machine/basis the value belongs to.
- 🔴 **MISLEADING** — surface implies a guarantee, certification, or prevention the runtime does not deliver.

## Master matrix — state machines

| # | State machine | States | Rendered by name? | Grounded? | Bounded? | Recoverable? | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | `CanonicalSourceCoverageState` | 9 | 🟢 (all 9) | 🟢 (lane row + timestamp) | 🟢 (decision-grade gate) | 🟡 (no help link) | 🟢 |
| 2 | `ReadinessState` | 4 | 🔴 (none) | 🟡 (lane rows only) | 🟢 (passport disclaimer) | 🟡 (system-derivative) | 🟠 |
| 3 | `ReceiptCandidateReviewState` | 8 | 🟢 (rendered) | 🟢 (mapping deterministic) | 🟢 (truth contract literal) | 🔴 (4 of 8 terminal-by-omission) | 🟠 |
| 4a | `PolicyReviewDecisionStatus` | 7+ | 🟢 | 🟢 (5-gate sequence) | 🟢 (`decisionGrade: false`) | 🟡 | 🟢 |
| 4b | `refusalGate` | 6 | 🔴 (none rendered) | 🟢 (computed) | n/a | 🔴 | 🔴 |
| 5 | `CalibratedDecisionState` + modulators | 5 / 4 | 🟢 / 🟠 (1 of 4) | 🟠 (3 of 4 silent) | 🟡 | n/a | 🟡 |
| 6 | `TrustBand` | 3 | 🟡 (color/copy not literal) | 🟢 (`blocking_reasons`) | 🟢 | n/a | 🟢 |
| 7 | `TrustUiStatus` | 9 | 🟢 | 🟢 | 🟠 (`verified` collision; `review_required` collision) | n/a | 🟠 |
| 8 | `RuntimeMutationClassification` / `R-CAT-*` | 8 / 6 | 🟡 (telemetry only) | 🟢 (deterministic) | 🔴 (module name overstates) | n/a | 🟠 |

## Master matrix — UI surfaces

| Surface | File | Verdict | One-line note |
|---|---|---|---|
| `PassportTrustPosture` | `apps/web/components/passport/PassportTrustPosture.tsx` | 🟢 | Disclaimer L107 is the model the codebase should converge to. |
| `TrustStateCard` | `apps/web/components/trust/TrustStateCard.tsx` | 🟠 | "Clear to Start" without a matching disclaimer. |
| `TimeToStartEstimateSummary` | `apps/web/components/trust/TimeToStartEstimateSummary.tsx` | 🟡 | Range is qualified; no "not a hire commitment" line. |
| `LaneHealthBadge` (post-#220) | `apps/web/components/trust/LaneHealth*` | 🟢 | Live/Degraded/Unavailable/Unknown explicit; never "verified". |
| `SourceCoverageRow` | `apps/web/components/trust/SourceCoverageRow.tsx` | 🟢 | Single sub-gap: `Not yet checked` ambiguous. |
| `SourceCoverageTag` | `apps/web/components/trust/SourceCoverageTag.tsx` | 🟢 | Source label + relative + absolute timestamp. |
| `ConfidenceBadge` | `apps/web/design-system/components/ConfidenceBadge.tsx` | 🔴 | Bare `{pct}% confidence`; no basis. |
| `ConfidenceMeter` | `apps/web/components/ui/ConfidenceMeter.tsx` | 🟠 | 40/70 thresholds; no basis. |
| `confidence-score` | `apps/web/components/ui/confidence-score.tsx` | 🟠 | 80/95 thresholds; conflicts with `ConfidenceMeter`. |
| `KnowledgeInboxPanel` | `apps/web/components/knowledge-inbox/KnowledgeInboxPanel.tsx` | 🔴 | Bare `{item.confidence} confidence` on classification context. |
| `EvidenceDisclosureCard` | `apps/web/components/trust/EvidenceDisclosureCard.tsx` | 🟢 | Structural; content-agnostic. |
| `AuditTimeline` | `apps/web/components/AuditTimeline.tsx` | 🟠 | Local enums decoupled from backend event types; mock data. |
| `AuditTrailTimeline` | `apps/web/components/trust-state/AuditTrailTimeline.tsx` | 🟠 | Same decoupling. |
| `/issuer/review/[requestId]` | `apps/web/app/issuer/review/[requestId]/page.tsx` | 🟡 | Renders `reviewState`; no advance UI for terminal-by-omission states. |
| `/issuer/policy-review/[requestId]` | `apps/web/app/issuer/policy-review/[requestId]/page.tsx` | 🔴 | Does not render `refusalGate`. |
| `/issuer/psv-receipt/[requestId]` | `apps/web/app/issuer/psv-receipt/[requestId]/page.tsx` | 🟢 | Renders `decisionStatus`; truth contract honored. |
| `/status` | `apps/web/app/status/page.tsx` | 🟢 | "Foundation preview" hedging explicit. |

## Master matrix — backend surfaces

| Surface | File | Verdict | Note |
|---|---|---|---|
| `TrustStateResolver` | `packages/trust-state/TrustStateResolver.ts` | 🟢 | Conservative, fail-closed, decay-honest. |
| `confidenceEngine` | `apps/api/backend/src/services/decision/confidenceEngine.ts` | 🔴 | No-history default = 1.0 silently uplifts. |
| `replayEngine` | `apps/api/backend/src/services/audit/replayEngine.ts` | 🔴 | Name implies prevention; performs reconstruction. No nonce/jti. |
| `runtimeTrustCohesion` | `apps/api/backend/src/services/runtimeTrustCohesion.ts` | 🟠 | Fingerprint + classification, not cohesion validation. |
| `auditLedger` | `apps/api/backend/src/services/audit/auditLedger.ts` | 🟢 | Honest categories; `audit_packet_id` returned. |
| `auditEventTypes` | `apps/api/backend/src/types/auditEventTypes.ts` | 🟡 | `TRUST_STATE_DECAY` missing from union. |
| `receiptCandidate` | `apps/web/lib/issuer-verification/receiptCandidate.ts` | 🟢 | Literal-typed truth contract. |
| `policyReview` | `apps/web/lib/issuer-verification/policyReview.ts` | 🟢 | Five-gate sequence; truth contract enforced. |
| `issuerSurfaceFactory` | `apps/web/lib/issuer-verification/issuerSurfaceFactory.ts` | 🟢 | Demo isolation honored. |

## Cross-cutting plane verdicts

| Plane | Producer | Surface | Verdict |
|---|---|---|---|
| Provenance | `sourceCoverage.ts` | `SourceCoverageRow` + `SourceCoverageTag` | 🟢 |
| Replay | `replayEngine.ts` | `statusCopy.ts` (good) + archive copy (drift) | 🔴 |
| Audit | `auditLedger.ts` | `AuditTimeline` (mock) | 🟡 |
| Mutation | `runtimeTrustCohesion.ts` | (none) | 🟠 |

## Critical questions — consolidated answers

| # | Question | Verdict | Driver |
|---|---|---|---|
| 1 | Would a clinician misunderstand readiness? | 🟡 PARTIAL | `TrustStateCard` lacks PassportTrustPosture's disclaimer; `ReadinessState` enum invisible. |
| 2 | Would a verifier overestimate audit guarantees? | 🟠 AMBIGUOUS | `audit_packet_id` returned; UI shows mock timelines. |
| 3 | Would replay telemetry imply replay prevention? | 🔴 YES | `replayEngine` + "replayable" copy + no nonce/jti. |
| 4 | Would trust-state transitions confuse operators? | 🟠 YES | `review_required` collision; `refusalGate` not rendered. |
| 5 | Would provenance semantics imply certification? | 🟢 NO | Banned-string scan clean; decision-grade gate clear. |
| 6 | Would confidence semantics imply deterministic certainty? | 🔴 YES | Bare percent + 1.0 no-history default + threshold drift. |

## Highest-leverage repairs (rank-ordered, single-PR scoped)

1. **Render `refusalGate` literal** on `/issuer/policy-review/[requestId]`. Closes the largest operator ambiguity in the codebase. One-line UI.
2. **Render the active `ReadinessState` literal** beneath the readiness score on the passport. Closes FR-S-5 from W2-PR4D.
3. **Require `basis` prop** on `ConfidenceBadge`, `ConfidenceMeter`, `confidence-score`; default unlabeled callers to `Heuristic confidence`. Replace `KnowledgeInboxPanel` bare label with `classification confidence`.
4. **Replace `outcomeHistoryStrength = 1.0` no-history default** in `confidenceEngine.ts` with explicit `No outcome history yet` band; downgrade calibrated state by one step when sample size is zero.
5. **Mirror the `PassportTrustPosture.tsx:107` disclaimer** onto `TrustStateCard` and any other surface that renders a band label.
6. **Add `TRUST_STATE_DECAY` to the canonical `OperationalEventType` union** and replace the string literal in `TrustStateResolver.ts:481-494`.
7. **Rename `runtimeTrustCohesion` module** or add a one-line docstring clarifying it generates fingerprints, not cohesion validation.
8. **Rename `ReceiptCandidateReviewState.review_required` → `issuer_response_incomplete`** to remove the cross-machine label collision.
9. **Disambiguate `Not yet checked`** in `SourceCoverageRow` (`Pending` / `Not scheduled` / `Last attempt failed`).
10. **Replace local `'DECAYED'` enums** in `AuditTimeline.tsx` and `AuditTrailTimeline.tsx` with imports from canonical backend event types.

None of these requires backend persistence beyond what the ledger already records. None alters the truth contract or any band threshold.

---

## 📊 Runtime Explainability Board

> Baselines come from the W2-PR4C/PR4D/PR5B reviews of the same surfaces. "Now" reflects the current state on `wave-10a/docs-status` (post #220, post DOCS-STATUS-1). Deltas are positive when surfacing improved, neutral when only documented.

| Dimension | Before (W2-PR4D rollup) | Now (W2-PR6B) | Δ | Indicator | State |
|---|---|---|---|---|---|
| Trust-State Explainability | 53% | 56% | +3 | 🟡 | SAFE |
| Confidence Runtime Alignment | 35% | 35% | 0 | 🟠 | UNSAFE on producer (no-history uplift), SAFE on copy |
| Readiness Runtime Alignment | 70% | 75% | +5 | 🟢 | SAFE (post-LaneHealthMount #220) |
| Provenance Visibility | 85% | 87% | +2 | 🟢 | SAFE |
| Operational Explainability (rollup) | 55% | 60% | +5 | 🟡 | SAFE on truth contract; PARTIAL on UX surfacing |

**Component-level board:**

| Component / surface | Before | Now | Δ | Indicator |
|---|---|---|---|---|
| `PassportTrustPosture` disclaimer | 🟢 | 🟢 | = | 🟢 |
| `TrustStateCard` "Clear to Start" framing | 🟠 | 🟠 | = | 🟠 |
| `LaneHealthMount` (#220) | absent | rendered | +new | 🟢 |
| `/status` foundation framing | absent | rendered | +new | 🟢 |
| `refusalGate` rendering | 🔴 | 🔴 | = | 🔴 |
| `ReadinessState` literal rendering | 🔴 | 🔴 | = | 🔴 |
| Confidence basis labels | 🔴 | 🔴 | = | 🔴 |
| `confidenceEngine` no-history uplift | 🔴 | 🔴 | = | 🔴 |
| Audit `TRUST_STATE_DECAY` schema | 🔴 | 🔴 | = | 🔴 |
| `replayEngine` name vs behavior | 🔴 | 🔴 | = | 🔴 |
| Banned-string scan | 🟢 | 🟢 | = | 🟢 |
| Issuer truth contract literals | 🟢 | 🟢 | = | 🟢 |

**Plane-level board:**

| Plane | Before | Now | Δ | Indicator | State |
|---|---|---|---|---|---|
| Provenance | 🟢 | 🟢 | = | 🟢 | SAFE |
| Replay | 🔴 | 🔴 | = | 🔴 | UNSAFE on naming/copy |
| Audit | 🟡 | 🟡 | = | 🟡 | PARTIAL |
| Mutation | 🟠 | 🟠 | = | 🟠 | AMBIGUOUS |

## Final output

1. **Strongest explainable trust state.** `CanonicalSourceCoverageState` rendered through `SourceCoverageRow` and `SourceCoverageTag`. Every value named, grounded by source label and timestamp, bounded by the decision-grade badge.

2. **Weakest explainability surface.** `refusalGate` on `/issuer/policy-review/[requestId]`. Six deterministic gates fire; the field is computed, returned, tested — never bound to UI.

3. **Largest ambiguity risk.** The `review_required` cross-machine label collision between `CanonicalSourceCoverageState` (passport-lane: source check failed) and `ReceiptCandidateReviewState` (issuer-chain: response incomplete). Same string; different machines; different remediation; different owners.

4. **Strongest runtime-alignment gain.** Three single-PR changes — render `refusalGate`, render `ReadinessState` literal, require `basis` on confidence components and remove the no-history uplift — close the three highest-severity transparency gaps without changing any contract.

5. **Operational explainability verdict — PARTIAL / SAFE.**
   - **Truth contract layer:** SAFE. TypeScript-enforced literals, deterministic gate sequences, fail-closed resolver, conservative decay handling, principled redaction.
   - **UX layer:** PARTIAL. Strong on provenance and source coverage; weak on readiness naming, confidence basis, refusalGate visibility, replay copy. The runtime computes more truth than it reveals.
   - **Banned-string layer:** CLEAN. No high-risk strings in live surfaces.
   - **No surface currently overstates what it proves at the truth-contract boundary**, but three surfaces (replay copy, confidence percentages, runtimeTrustCohesion module name) actively risk implying guarantees the runtime does not deliver.

## Honesty assessment

**Artifact alignment:** SAFE. This document does not change any contract, copy, or runtime behavior. It only consolidates verdicts from the four sibling docs and prior W2 reviews.

**Runtime alignment:** PARTIAL.
- 🟢 across provenance, source coverage, issuer truth contract, decay arithmetic, and banned-string hygiene.
- 🟡 on readiness UX (single-line repair would close).
- 🟠 on audit/mutation surfacing and trust-state continuity.
- 🔴 on confidence basis disclosure, no-history uplift, refusalGate rendering, replay copy.

The gap between "what the runtime knows" and "what the operator reads" is the dominant story. None of the gaps are scaling-blocking; all are explainability-blocking, and each has a single-PR repair scoped in the master matrix above.

## See also

- `w2-pr6b-trust-state-explainability.md`
- `w2-pr6b-confidence-runtime-alignment.md`
- `w2-pr6b-readiness-runtime-alignment.md`
- `w2-pr6b-provenance-visibility.md`
- W2-PR4 series (`pr4a-runtime-cohesion`, `pr4a-replay-normalization`, `pr4a-audit-normalization`, `pr4c-confidence-explainability`, `pr4c-readiness-truthfulness`, `pr4c-dossier-provenance`, `pr4d-trust-state-continuity`, `pr4d-operator-understanding`)
- W2-PR5 series (`pr5b-confidence-certification`, `pr5b-operator-trust-certification`, `pr5b-workflow-understanding-review`)
- `docs/architecture/vitalcv-knowledge-trust-graph.md` (boundaries 1-28)
