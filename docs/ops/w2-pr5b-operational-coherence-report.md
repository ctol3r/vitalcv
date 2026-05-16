# W2-PR5B - Operational Coherence Report

**Wave:** W2-PR5B - Operational Trust Experience Certification
**Date:** 2026-05-08
**Status:** Docs-only synthesis. No product code changed. No merge.
**Risk class:** SAFE. `docs/ops/**` only.
**Predecessors:** PR3C (semantics), PR3D (workflow maps), PR4A (replay/audit normalization), PR4C (confidence display contract), PR4D (operator understanding).

## Mission

Final synthesis. Roll up the certification matrix, confidence audit, workflow review, and persona ratings into a single coherence verdict and a quantified completion board.

## Roll-up of the four sibling artifacts

| Artifact | Headline finding |
|---|---|
| `w2-pr5b-operator-trust-certification.md` | 🟠 CONFUSING — truth-contract fidelity is 🟢 at the type/persistence layer; UI explainability and workflow continuity remain 🟠/🔴 in three of five personas. |
| `w2-pr5b-confidence-certification.md` | 🔴 UNSAFE — every reusable confidence component ships as bare percent; PR4C contract not applied; no-history uplift remains in `confidenceEngine.ts`. **21% display compliance**. |
| `w2-pr5b-workflow-understanding-review.md` | 6 of 8 workflows are 🟠 or 🔴; 1 is 🟡; 1 (lane-health) is 🟢 and is the template for retrofitting. |
| `w2-pr5b-trust-experience-matrix.md` | 63 surfaces inspected: 🟢 13% / 🟡 14% / 🟠 25% / 🔴 48%. Axis breakdown: understandable but operationally incoherent. |

## The five questions, answered

### 1. Strongest operator trust surface

**`LaneHealthMount` on `/passport/[id]`** (PR #220, `fae54ea5`).

- Renders the lane state name without flattening.
- Shows a `userFacingMessage` per state.
- Includes a retry policy.
- Frames remediation without overclaim.

Adjacent strong surfaces: `/issuer/audit-boundary/[requestId]`, `/issuer/persistence-adapter/[requestId]`, `/issuer/backend-persistence/[requestId]`, `/status` (DOCS-STATUS-1). All share the pattern: render truth, disclaim gap, no promise beyond writer.

### 2. Weakest explainability surface

**`refusalGate` on `/issuer/policy-review/[requestId]`.**

- Six values: `action_does_not_create_candidate`, `wrong_office_cannot_create_candidate`, `unable_to_verify_cannot_create_candidate`, `conflict_review_unresolved`, `review_state_not_ready`, `legally_only_requires_limitation_note`.
- Computed by `policyReview.ts:67-122`.
- Returned in `PolicyReviewOutcome`.
- Asserted in tests (`apps/web/__tests__/issuer-policy-review.test.ts`).
- **Rendered: zero surfaces.**

A reviewer who attempts `accept_candidate` and gets refused sees the dry-run output but does not see which gate refused them. This is the single largest operator-readability gap in the codebase.

### 3. Highest confusion risk

**Shared `review_required` label across two state machines.**

| Field | Passport-lane `review_required` | Receipt-candidate `review_required` |
|---|---|---|
| Source machine | `CanonicalSourceCoverageState` | `ReceiptCandidateReviewState` |
| Trigger | Source check failed (NPPES timeout, board response unclear) | Issuer responded `partially_confirmed` |
| Correct remediation | Clinician contacts source / waits for source to respond | Reviewer requests follow-up from issuer |
| Owner | Clinician / system | Verifier reviewer |

Same label; different state machines; different remediation owners. (FR-S-1.) Recommended rename: `ReceiptCandidateReviewState.review_required` → `issuer_response_incomplete`.

Close-second confusion risks:

- `verified` (`TrustUiStatus.verified` rendered vs `KnowledgeInboxVerificationStatus.source_verified` not rendered).
- Bare-percent `confidence` (means classification, source-match, recommendation, or readiness depending on caller).
- "review" route name (`/review/[entityId]` public vs `/employer/review/[a]` internal employer vs `/issuer/review/[r]` verifier).

### 4. Strongest workflow coherence gain (since PR3D)

**PR #220 `LaneHealthMount` on `/passport/[id]`** + DOCS-STATUS-1 `/status` foundation.

- Lane health is the only post-PR3D component that closes a state-readability gap without introducing overclaim.
- `/status` adds an honest foundation-level compliance posture surface.
- Net delta: +2 strong surfaces, 0 regressions, +continuity on the clinician path (35% → 43%; W2 passport workflow 30% → 55%).

Two small new fragmentations introduced (FR-X-1, FR-X-2 — lane health and `/status` do not cross-link, `/status` not linked from operational surfaces). These are P2.

### 5. Operational trust verdict

**🟠 CONFUSING (PARTIAL).**

| Layer | Verdict |
|---|---|
| Truth-contract fidelity (literal `decisionGrade`/`proofTier`, demo disclaimers, `noop` writers, `pending_not_written`, runtime taxonomy) | 🟢 CLEAR — PR4A normalized; PR1/PR2B verified; `apps/web/lib/issuer-verification/types.ts` literal types intact. |
| Demo persistence disclosure | 🟢 CLEAR — every issuer page and every employer/decision page disclaims. |
| Component copy (proof viewer, bundle preview, trail timeline) | 🔴 MISLEADING — pre-PR3C copy still ships at the component level; surface-level demo disclaimers do not propagate to mounted components. |
| Confidence display | 🔴 UNSAFE — bare percent; PR4C contract not yet applied; no-history uplift remains. |
| Workflow continuity | 🟠 CONFUSING — verifier ~0%, employer ~0%, clinician 43%. |
| Refusal attribution | 🔴 — `refusalGate` not rendered. |
| Lane / readiness explainability | 🟡 — lane health visible; `ReadinessState` invisible; modulators 1 of 4. |
| Onboarding chain | 🔴 — advertised steps redirect home. |
| State-machine label collisions | 🟠 — `review_required` is the worst. |

**Pre-pilot:** SAFE for read-only demo; SAFE for the truth-contract layer.

**Pilot-blocking:** UNSAFE for any acceptance, decision, recommendation, dossier-export, or "verified" claim until (a) PR3C copy contract applied at component level, (b) PR4C basis labels applied at component level, (c) `refusalGate` rendered, (d) `ReadinessState` enum surfaced, (e) inbox/action `href` pattern adopted, (f) confidence no-history uplift fixed.

The runtime is more honest than the UI. The state machines, persistence boundaries, and replay engine are correct; the user-facing surfaces leak guarantees the runtime does not provide and hide attributions the runtime does compute.

## 📊 Operational Trust Experience Board

### Metrics

| Metric | Definition | Pre-PR4D baseline | Post-PR5B observed | Delta | Indicator |
|---|---|---|---|---|---|
| **Trust-State Explainability %** | (states rendered by name) / (total states) | 47% (PR3D) | **53%** (PR4D, unchanged in PR5B) | +6 pp | 🟡 |
| **Confidence Understandability %** | mean of 6 PR4C contract fields surfaced | ~10% | **21%** | +11 pp | 🟠 |
| **Replay Understanding %** | replay surfaces understood (route × axis) | ~25% | **35%** | +10 pp | 🟠 |
| **Workflow Continuity %** | (intended forward transitions that actually fire) / (advertised) | 25% (PR3D) | **38%** (PR4D + PR5B) | +13 pp | 🟠 |
| **Operational Trust Clarity %** | mean of (U + O + X + A + M + C) per surface, weighted by 🟢=1, 🟡=0.66, 🟠=0.33, 🔴=0 | n/a (PR5B is first) | **42%** | (baseline) | 🟠 |

### Persona-level deltas

| Persona | PR3D continuity | PR4D continuity | PR5B understanding |
|---|---|---|---|
| Clinician | 30% | 43% (+13 pp via #220) | 🟡 PARTIAL |
| Verifier | ~0% | ~0% (no change) | 🟠 CONFUSING |
| Employer | ~0% | ~0% (no change) | 🔴 MISLEADING |
| Support / Admin | partial | partial (+/status) | 🟡 PARTIAL |
| AI / System (truth contract) | 🟢 | 🟢 (PR4A normalization) | 🟢 CLEAR |

### Workflow-level deltas

| Workflow | PR4D continuity | PR5B understanding rating |
|---|---|---|
| W1 Onboarding | 50% | 🔴 |
| W2 Passport | 55% (was 30% pre-#220) | 🟡 |
| W3 Issuer chain | ~0% | 🟠 |
| W4 Employer review | ~10% | 🔴 |
| W5 Inbox / next-step | ~17% | 🔴 |
| W6 Readiness | ~40% (was ~15% pre-#220) | 🟠 |
| W7 Dossier / replay | ~0% (route-level) | 🔴 |
| W8 Receipt-candidate review | n/a | 🟠 |

### Critical-question summary

| # | Question | Verdict |
|---|---|---|
| 1 | Verifier misunderstands replay guarantees? | PARTIAL YES |
| 2 | Clinician overestimates readiness? | YES |
| 3 | Operator assumes audit immutability? | PARTIAL YES |
| 4 | Dossier semantics imply stronger proof than exists? | YES (legacy copy still in components) |
| 5 | Autopilot semantics imply autonomous trust decisions? | YES |
| 6 | Users distinguish heuristic / observational / authoritative / certified / anchored? | NO |

## SAFE / UNSAFE state

**SAFE for what the runtime promises.** The truth-contract layer (literal `decisionGrade: false`/`proofTier`, demo disclaimers, `noop` writers, `pending_not_written`, PR4A runtime taxonomy with `R-CAT-1..6` and replay-stable mutation fingerprints) is intact and verified.

**UNSAFE for what the UI implies.** Three independent failure surfaces:

1. **Audit-component copy** ("Immutable Audit Trail", "mathematical guarantees", "Zero-knowledge proof verified", "Cryptographically Verified", biometric signature payload) ships in components mounted across verifier and employer surfaces. The components carry overclaims independent of whether the surface page disclaims. Rated 🔴.

2. **Reusable confidence components** (`ConfidenceMeter`, `ConfidenceBadge`, `confidence-score`) render bare percent values across four caller types (classification, source-match, recommendation, readiness). The same bar means four different things. PR4C contract not applied. Rated 🔴.

3. **Decision affordance vs effect mismatch.** "Execute Recommendation", "Approve Candidate", "Reject Candidate", `WorklistPanel` rows, `KnowledgeInboxPanel` buttons, `/employer/review/[a]` accept/reject buttons — all suggest a decision; runtime captures none. Rated 🔴.

The board state below is **🟠 CONFUSING (PARTIAL SAFE)** — the runtime is sound; the UI is the gap.

## Highest-leverage repairs (single-PR scope each)

In rank order of trust-experience clarity gain per PR. Each is a single small PR; none requires backend persistence beyond what TRUST-PERSIST-1 ships.

| Rank | PR | Closes | Estimated clarity-% gain |
|---|---|---|---|
| 1 | Render `refusalGate` on `/issuer/policy-review/[requestId]` | FR-V-2 | +5 pp Trust-State Explainability |
| 2 | Adopt `Workspace/NextBestAction.tsx`'s `href` pattern in 6 inbox/action emitters | FR-N-1..N-4, FR-E-5, FR-E-6 | +10 pp Workflow Continuity |
| 3 | Apply PR3C dossier-truth copy contract to `AuditProofViewer`, `AuditTrailTimeline`, `AuditBundlePreview` | dossier-truth-review | +12 pp Replay Understanding |
| 4 | Apply PR4C confidence display contract — `basis`, `sourceLabel`, `freshnessLabel`, `limitation` props — and default callers to "Heuristic confidence" | PR4C contract | +30 pp Confidence Understandability |
| 5 | Fix `confidenceEngine.ts` no-history uplift — render "No outcome history yet" | PR4C | +5 pp Confidence Understandability |
| 6 | Wire passport-lane → issuer-request entry seam | FR-P-1 | +5 pp Workflow Continuity |
| 7 | Mount `ScoreExplainabilityBlock` on `/employer/review/[applicationId]` | FR-E-4 | +3 pp Replay/Explain |
| 8 | Surface `ReadinessState` literal beneath the readiness score + 3 of 4 modulators under `ConfidenceMeter` | FR-S-3, FR-S-4 | +6 pp Trust-State Explainability |
| 9 | Add forward links between adjacent issuer demo pages | FR-V-1 | +5 pp Workflow Continuity |
| 10 | Rename `ReceiptCandidateReviewState.review_required` → `issuer_response_incomplete` | FR-S-1 | +2 pp Trust-State Explainability |
| 11 | Apply PR3C autopilot copy contract to `careerAutopilot.ts`, `systemVoice.ts`, `EmployerNextBestAction`, `DecisionCard`, `DecisionQueue` | autopilot-language-review | +5 pp Operational Trust Clarity |
| 12 | Onboarding chain repair — replace `/onboarding/{...}` redirects or update `/onboarding/page.tsx` to point users to `/clinician/onboarding`; add onboarding → passport handoff | FR-O-1, FR-O-3 | +4 pp Workflow Continuity |

PRs 1, 2, 3, 4, 5 carry **+62 pp** of combined clarity gain in the smallest amount of code. None requires schema or runtime change beyond what is already shipped.

## Projected board after PR1–PR5 of repairs

| Metric | Now | After PR1–5 (projected) | Indicator after |
|---|---|---|---|
| Trust-State Explainability | 53% | **65%** (+refusalGate, +ReadinessState, +modulators) | 🟡 |
| Confidence Understandability | 21% | **56%** (+basis labels, +no-history fix) | 🟡 |
| Replay Understanding | 35% | **55%** (+PR3C component copy) | 🟡 |
| Workflow Continuity | 38% | **53%** (+href pattern, +chain links, +entry seam) | 🟡 |
| Operational Trust Clarity | 42% | **62%** | 🟡 |

**Net effect:** every dial moves from 🟠 to 🟡 with five single-PR repairs. None requires architectural change.

## Out of scope (and intentional)

- No backend persistence beyond TRUST-PERSIST-1 phases already shipped.
- No truth-contract changes (literal `decisionGrade: false`, `proofTier` literals preserved).
- No new state machines.
- No new routes (other than the dossier route in PR4D-FIX-10, which is queued separately).
- No mobile / device-security activation.
- No copy rewrites by PR5B itself — PR5B verifies, the named follow-up PRs implement.

## SAFE / UNSAFE — final

**SAFE.** This artifact set is `docs/ops/**` only; no product code changed; no merge.

The certification verdict is **🟠 PARTIAL** — pre-pilot SAFE for read-only demo and for the truth-contract layer; UNSAFE for any acceptance/decision/dossier-export claim until the named follow-up PRs land.

The runtime is sound. The UI is the work.

## See also

- `w2-pr5b-operator-trust-certification.md`
- `w2-pr5b-confidence-certification.md`
- `w2-pr5b-workflow-understanding-review.md`
- `w2-pr5b-trust-experience-matrix.md`
- `w2-pr3c-{confidence-semantics,autopilot-language-review,dossier-truth-review,ux-truth-alignment}.md`
- `w2-pr3d-{clinician,verifier}-workflow-map.md`, `w2-pr3d-{product-coherence-review,workflow-fragmentation-register}.md`
- `w2-pr4a-{audit,replay}-normalization.md`, `w2-pr4a-runtime-cohesion.md`, `w2-pr4a-denial-observability.md`
- `w2-pr4c-{confidence-explainability,dossier-provenance,readiness-truthfulness}.md`
- `w2-pr4d-{operator-understanding,trust-state-continuity,workflow-coherence,workflow-friction-register}.md`
- `docs/architecture/vitalcv-knowledge-trust-graph.md` (boundaries 1-28)
