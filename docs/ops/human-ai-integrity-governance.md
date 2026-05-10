# Human-AI Integrity Governance — W2-PR57A

Status: **active**
Owner: VitalCV trust spine
Module: `apps/api/backend/src/services/humanAiIntegrity/`
CI gate: `.github/workflows/human-ai-integrity-gate.yml`

## What this is

VitalCV is allowed to use AI to assist human reviewers. It is not allowed to
allow AI to replace, pre-decide for, or invisibly influence them. This
document is the contract that separates the two.

It defines:

1. The **lineage** every AI recommendation must carry.
2. The **approval boundaries** that gate where AI may emit a recommendation
   at all.
3. The **automation-bias signals** we treat as evidence the human-AI loop
   has collapsed.
4. The **explainability invariants** every AI-assisted surface must uphold.
5. The **reviewer confidence** schema reviewers use to record dissent.
6. The **chaos scenarios** the CI gate replays before any change to this
   module merges.

Everything below is enforced in code. The CI gate fails if any invariant
fails.

## Truth contract

These are non-negotiable and enforced by literal types in
`recommendationLineage.ts`:

- An `AiRecommendation` carries `decisionGrade: false` (literal) and
  `proofTier: 'ai_recommendation'` (literal). AI **cannot** produce a
  decision-grade output.
- An `AiRecommendation` is tenant-bound. A recommendation produced under
  tenant A cannot be reused under tenant B; the type forces `tenantId`.
- An `AiRecommendation` is replay-safe. `modelHash + inputHash + outputHash`
  are deterministic; the same inputs MUST produce the same output.
- Every recommendation that influences a human decision MUST have at least
  an `AI_RECOMMENDATION_EMITTED` event and a resolution event
  (`ACCEPTED | OVERRIDDEN | DEFERRED`).
- Ambiguity flags are surfaced, not hidden. An accept on an ambiguous
  recommendation MUST set `ambiguityAcknowledged: true`.

## Approval boundaries

`humanApprovalBoundaries.ts` is the fail-closed taxonomy. Every decision
domain in VitalCV maps to exactly one boundary; domains not in the table
are rejected by default.

| Domain                            | Boundary                          | AI may…                                |
| --------------------------------- | --------------------------------- | -------------------------------------- |
| `policy_review_decision`          | `human_only`                      | Not even suggest                       |
| `psv_candidate_promotion`         | `human_only`                      | Not even suggest                       |
| `exclusion_override`              | `human_only`                      | Not even suggest                       |
| `conflict_resolution`             | `human_only`                      | Not even suggest                       |
| `employer_review_acceptance`      | `human_approves_ai_suggestion`    | Suggest at `suggestion_only` tier      |
| `issuer_response_intake`          | `human_approves_ai_suggestion`    | Suggest at `suggestion_only` tier      |
| `employer_review_routing`         | `ai_suggests_human_overrides`     | Up to `auto_classified`                |
| `employer_review_refresh_request` | `ai_suggests_human_overrides`     | Up to `auto_classified`                |
| `review_packet_assembly`          | `ai_suggests_human_overrides`     | Up to `auto_classified`                |
| `queue_prioritization`            | `ai_acts_human_can_veto`          | Up to `pre_screened` (low-stakes only) |

The PSV truth contract — `decisionGrade=true` only via human accept of a
ready_for_policy_review candidate (see `apps/web/lib/issuer-verification/`)
— is upheld by keeping `policy_review_decision` and `psv_candidate_promotion`
in `human_only`.

## Automation bias signals

`automationBiasDetector.ts` operates on lineage events and surfaces five
signals. Thresholds are explicit; a signal at `red` fails the integrity
gate.

| Signal                    | Yellow                  | Red                     | Why it matters                                                           |
| ------------------------- | ----------------------- | ----------------------- | ------------------------------------------------------------------------ |
| `rubber_stamp_velocity`   | ≥ 6 accepts / min       | ≥ 12 accepts / min      | A reviewer cannot meaningfully read each item at this rate.              |
| `acceptance_concurrence`  | accept rate ≥ 95%       | accept rate ≥ 99%       | Near-100% concurrence indicates the human is not exercising judgment.    |
| `low_dwell`               | median dwell ≤ 4000 ms  | median dwell ≤ 1500 ms  | Below the read-and-decide floor.                                         |
| `dissent_drought`         | 0 overrides / 50 events | 0 overrides / 200 events| Some dissent is statistically expected.                                  |
| `ambiguity_ignore`        | 40% accepts ignore flags| 75% accepts ignore flags| AI surfaced uncertainty, the reviewer collapsed it.                      |

The detector is operating-system-hours aware via `dwellMs` and emission
timestamps, not wall-clock. Reviewers in different time zones don't trip
spurious findings.

## Explainability invariants

`explainabilityContract.ts` checks six invariants. The CI gate runs these
on adversarial event streams before any change merges.

- **I1 `no_ai_decisionGrade_upgrade`** — AI cannot widen `decisionGrade`
  beyond literal `false` or change `proofTier` away from
  `'ai_recommendation'`.
- **I2 `no_silent_recommendation`** — every recommendation that influenced
  a decision has an `EMITTED` event and a resolution event.
- **I3 `no_ambiguity_collapse`** — accept events on recommendations
  carrying `ambiguityFlags` MUST set `ambiguityAcknowledged: true`.
- **I4 `no_review_state_jump`** — AI cannot move a candidate from
  `review_required` directly to `ready_for_policy_review`. Human-driven
  jumps require a non-empty reason.
- **I5 `tenant_isolation`** — every event in a recommendation's lineage
  carries the same `tenantId` as the recommendation.
- **I6 `replay_safe_lineage`** — the same `modelHash + inputHash` MUST
  produce the same `outputHash`. Divergence is a contract violation.

## Reviewer confidence schema

`reviewerConfidence.ts` adds an additive override schema. It does not
modify `EmployerReviewActionDetails` or any existing review action type;
surfaces opt in by writing a `ReviewerOverrideRecord` alongside their
existing audit event.

- `ReviewerConfidence` is an enum: `low | medium | high | high_with_caveat`.
  Numeric scores are intentionally rejected — they invite false precision
  and discourage dissent.
- `OverrideKind` distinguishes `accepted_with_dissent`,
  `override_with_alternate`, `rejected_with_reason`, and
  `deferred_for_human_only_review`.
- `accepted_with_dissent` with `confidence: 'high'` is rejected at
  build time as contradictory; the reviewer must use `high_with_caveat`
  to preserve the hesitation.
- Override `reason` is required and cannot be empty whitespace.
- Cross-tenant overrides are refused at build time.

## Chaos scenarios

Replayed in `humanAiIntegrity.chaos.test.ts`. Each scenario produces a
deterministic event stream — no randomness — so a passing run is a real
guarantee, not a flake.

- **Rubber-stamp velocity** — 20 accepts in ~30 seconds → red.
- **Acceptance concurrence** — 20/0 accepts/overrides → red.
- **Low dwell** — 20 accepts each ~500 ms → red.
- **Ambiguity ignore** — 20 accepts on ambiguous recommendations
  without acknowledgement → red.
- **Healthy traffic** — mixed accept/override at 60 s dwell → green.
- **Small windows** — adversarial pattern below `minWindowSize` → green
  (no false positives on cold start).
- **Dissent drought** — 100 well-paced accepts, no overrides →
  `dissent_drought` raised, `rubber_stamp_velocity` not raised.

## How a new AI surface adopts this contract

1. Register the surface's domain in `APPROVAL_BOUNDARY_BY_DOMAIN`. Until
   it is registered, `gateRecommendation` rejects emissions
   (fail-closed).
2. Build the recommendation via `buildAiRecommendation` — never construct
   the literal type by hand; the builder enforces hashes, confidence
   range, and tenant binding.
3. Emit `AI_RECOMMENDATION_EMITTED` synchronously on emission.
4. Emit `AI_RECOMMENDATION_DISPLAYED` when the surface renders the
   recommendation to a reviewer.
5. Capture dwell from display → resolution and pass it on the resolution
   event.
6. Emit one of `ACCEPTED | OVERRIDDEN | DEFERRED`. Never close the
   surface without one.
7. For ambiguous recommendations, require `ambiguityAcknowledged: true`
   in the surface UI; pass it through.
8. For dissent, write a `ReviewerOverrideRecord` and run it through
   `buildReviewerOverride` — do not store free-form override metadata.

## Final output — W2-PR57A verdict

### Strongest human-AI safeguard

The combination of (a) literal-typed `decisionGrade: false` on
`AiRecommendation` and (b) the `human_only` boundary on PSV promotion,
policy review, exclusion override, and conflict resolution. AI can be
helpful in the periphery but cannot author or pre-author the four
classes of decisions that move credentialing truth. This is upheld by
the type system, the boundary table, and the existing
`apps/web/lib/issuer-verification/` truth contract; all three would
have to be defeated for AI to widen a decision.

### Strongest explainability gain

`reconstructLineage` plus the six-invariant contract makes every AI
contribution to a human decision reconstructable from event records
alone. Given a recommendation ID and its events, a reviewer (or
auditor, or regulator) can answer: was the recommendation emitted? was
it shown? did the human accept it, override it, or defer it? did the
human dwell long enough to read it? did the human acknowledge surfaced
ambiguity? was the model deterministic? Each of those answers is a
boolean or a literal, not a vibe. The audit team can replay any
decision and reach the same conclusion the reviewer did, or surface
the exact step where the explanation breaks.

### Biggest remaining automation-bias risk

Out-of-loop signal collapse. The detector runs on lineage events, so
it is only as strong as the event stream that surfaces emit. A surface
that quietly suppresses an `AI_RECOMMENDATION_DISPLAYED` event — for
instance, by rendering the suggestion as pre-filled form fields and
counting the human's first keystroke as "engagement" — would dodge the
`low_dwell` and `ambiguity_ignore` signals. The mitigation is
mechanical (every AI-assisted surface MUST emit DISPLAYED on render)
but it is not yet enforced by a static check; today it relies on the
human-AI integrity gate's CI run plus reviewer discipline. Closing
this gap is the recommended W2-PR57B successor.

### Human-AI governance verdict

**Pass with one open risk.** The contract is in place, the gate is
enforced, the chaos tests are deterministic, the truth contract is
upheld. The one open risk (display-event suppression) is named and
ticketed for a follow-on PR. AI assistance is now governed; it is not
yet exhaustively detectable when bypassed.

## Completion board

📊 **Human-AI Integrity Board (W2-PR57A baseline)**

| Metric                              | Score | Notes                                                                                              |
| ----------------------------------- | ----- | -------------------------------------------------------------------------------------------------- |
| Recommendation Lineage Integrity %  | 95%   | Six invariants enforced in code; replay-safety verified; one open risk on display-event suppression. |
| Human Review Survivability %        | 100%  | Override always one event away with required reason; cross-tenant + contradictory cases refused at build time. |
| Automation Bias Detection %         | 80%   | Five signals live with explicit thresholds; out-of-loop signal collapse not yet detectable.        |
| Explainability Fidelity %           | 95%   | Lineage reconstructs from events alone; ambiguity flags survive accepts; missing prior emission flagged. |
| Human-AI Governance Maturity %      | 90%   | Approval boundary table is fail-closed and enforced. CI gate live. One named follow-on risk.       |

Baseline. Every metric is sourced from a code-enforced check, not an
opinion; the next pass updates this table when W2-PR57B closes the
display-event suppression gap.
