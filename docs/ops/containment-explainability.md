# Containment Explainability — W2-PR14B Track A

**Wave:** W2-PR14B — Operator Constitutional Response Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [escalation-explainability](escalation-explainability.md), [constitutional-response-continuity](constitutional-response-continuity.md), [governance-response-survivability](governance-response-survivability.md).
**Builds on:** [constitutional-failure-explainability](constitutional-failure-explainability.md), [silent-fragmentation-awareness](silent-fragmentation-awareness.md), [stress-state-explainability](stress-state-explainability.md), [governance-collapse-survivability](governance-collapse-survivability.md), [integrity-state-explainability](integrity-state-explainability.md), [governance-awareness-survivability](governance-awareness-survivability.md), [dashboard-runtime-honesty](dashboard-runtime-honesty.md), [operator-governance-integrity](operator-governance-integrity.md).

---

## What this track answers

PR13B Track A asked whether operators could **classify** a constitutional state (CI-HEALTHY / CI-DEGRADED / CI-DRIFT / CI-FRAGMENTED / CI-VIOLATION) under stress. PR14B Track A asks the next question downstream: once an operator has classified a state, **can they correctly classify the platform's response — what is contained, what is escalating, what has crossed a containment boundary**, without panicking, over-trusting recovery, or assuming containment that was never asserted?

The risk vector here is **response-state misclassification**:

- An operator who reads an actively fragmenting state as contained ships a bundle into a regulator's hands during the fragmentation.
- An operator who reads a contained, recoverable degradation as a violation triggers an unnecessary incident response and re-routes traffic away from a healthy path.
- An operator who reads an escalation as a self-resolving flap fails to invoke the human gate that would have caught a real breach.
- An investigator who reads a violation row as a contained flap closes a regulator inquiry on inflated containment.

PR12B (integrity-state-explainability) showed that the CI-* labels do not exist in code. The same is true here for CT-*: a grep across `apps/`, `packages/`, and `docs/` for `CT-GREEN | CT-DEGRADED | CT-FRAGMENTING | CT-ESCALATING | CT-VIOLATION` returns zero matches. **This document treats the five labels as the abstract containment-state contract operators would need.** If the contract cannot be filled by today's surfaces, that is the finding.

## Definitions — CT-* state vocabulary

The five containment-response states an operator must distinguish during stress:

- **CT-GREEN:** every subsystem within tolerance; no degradation in flight; no escalation pending. The platform's response state is "no response required." Implicit baseline.
- **CT-DEGRADED:** at least one subsystem is degraded but the degradation is **bounded** (a named lane in `LIVE | DEGRADED | UNAVAILABLE | UNKNOWN | RATE_LIMITED`, a deferred capsule write in `pending_not_written`, a single-capsule replay drift). The contract knows the degradation is bounded; the surface may not say so.
- **CT-FRAGMENTING:** a single conceptual entity is *currently* being represented by multiple structurally-distinct shapes that the surface does not separate — e.g., a bundle export in flight that is silently dropping per-capsule replays ([replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts)); an authority chain being re-derived at replay time without a marker. Fragmentation is **active** rather than steady-state.
- **CT-ESCALATING:** a degradation is **compounding** — two stressors are interacting (PR13B governance-collapse-survivability Escalation 1: a CI-VIOLATION on T+0 hardens into operator habit by T+7d; PR12B governance-awareness-survivability D.1: lane outage produces a refusal whose `refusalGate` is internal). Escalation is the rate-of-change vector, not the state itself.
- **CT-VIOLATION:** containment has been crossed — a structural property the platform asserted is now produced incorrectly. `bundleHash` reading as completeness when the bundle silently dropped capsules; `bundle.issuer: 'VitalCV'` reading as cryptographic provenance when it is a string literal; `verificationInstructions.how` reading as offline re-verification when it is hash-only. PR13B's CI-VIOLATION mapped to a structural inflation; CT-VIOLATION here is the *response-state* projection of that — the moment an operator's interpretation of containment has admitted a property the contract never earned.

CT-DEGRADED is the safe state to be in: bounded, named, recoverable. CT-FRAGMENTING and CT-ESCALATING are the *transition* states that, if not surfaced, decay into CT-VIOLATION. CT-VIOLATION is recoverable only by removing the inflated structural field, adding a defending field, or rewriting copy — not by waiting for the next probe.

## CT-state ↔ existing-finding map

Each containment-response failure mode in the codebase, mapped to its CT-* class. Severity inherited from the source doc.

| CT class | Response failure | Source | Severity |
|---|---|---|---|
| CT-GREEN | No "system green" aggregator surface | [integrity-state-explainability](integrity-state-explainability.md) CI-GREEN row | 🟠 (false-confidence risk) |
| CT-DEGRADED | Lane-health badge: source state + reason + lastSuccessAt rendered ([LaneHealthBadge.tsx:68-110](../../apps/web/components/source-health/LaneHealthBadge.tsx)) | The one rendered defense | 🟢 |
| CT-DEGRADED | Per-lane `userFacingMessage` + retry policy ([LaneHealthSection.tsx:43-65](../../apps/web/components/source-health/LaneHealthSection.tsx)) | Bounded, named, decoupled from trust | 🟢 |
| CT-DEGRADED | Degraded-state notices (`offline` / `upstream_unavailable` / `source_probe_unknown` / `retry_required`) ([degradedStateFoundation.ts:52-95](../../apps/web/lib/degraded-state/degradedStateFoundation.ts)) | Named, retryable flag, remediation copy | 🟢 |
| CT-DEGRADED | `pending_not_written` row state defaults | [GF-8](operator-governance-integrity.md) / [HO-1](dashboard-runtime-honesty.md) | 🟠 (no surface signal) |
| CT-FRAGMENTING | Per-capsule replay error → silent drop in `buildAuditBundle` ([replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts)) | Active fragmentation; recipient cannot detect | 🔴 |
| CT-FRAGMENTING | Outer R-CAT-6 over inner R-CAT-1…5 ([runtimeTrustCohesion.ts:56-63](../../apps/api/backend/src/services/runtimeTrustCohesion.ts)) | Envelope masks inner action; no separation marker | 🟠 |
| CT-FRAGMENTING | Recorded vs replay-time computed fields share envelope | [GF-2](operator-governance-integrity.md) / [FI-4](dashboard-runtime-honesty.md) | 🟠 |
| CT-FRAGMENTING | Authority chain re-derived at replay time | [FI-5](dashboard-runtime-honesty.md) | 🟠 |
| CT-ESCALATING | Issuer-side `refusalGate` writes no audit row | [GF-4](operator-governance-integrity.md) / [IG-4](dashboard-runtime-honesty.md) | 🔴 |
| CT-ESCALATING | Replay invocations write no audit row | [GF-4](operator-governance-integrity.md) / [IG-3](dashboard-runtime-honesty.md) | 🟠 |
| CT-ESCALATING | Cascading degradation: lane flap + capsule defer + replay age-out without cross-tying surface | [stress-state-explainability](stress-state-explainability.md) Scenario 1 | 🟠 |
| CT-ESCALATING | `EmergencySwitch` ([EmergencySwitch.tsx:11-46](../../apps/web/components/employer/EmergencySwitch.tsx)) wired to in-process global toggle ([emergencyMode.ts:7-39](../../apps/api/backend/src/services/compliance/emergencyMode.ts)); no audit row written for declaration itself | Real escalation control, no forensic row at declaration | 🟠 |
| CT-VIOLATION | `bundleHash` reads as completeness | [GF-3](operator-governance-integrity.md) / [HO-2](dashboard-runtime-honesty.md) / [FI-3](dashboard-runtime-honesty.md) | 🔴 |
| CT-VIOLATION | `verificationInstructions.how` reads as offline-verifiable ([replayEngine.ts:596-601](../../apps/api/backend/src/services/audit/replayEngine.ts)) | [GF-15](operator-governance-integrity.md) | 🔴 |
| CT-VIOLATION | `bundle.issuer: 'VitalCV'` reads as cryptographic provenance | [GF-10](operator-governance-integrity.md) | 🔴 |
| CT-VIOLATION | `capsuleCount` is survived, not requested; no `partialExport` | [GF-3](operator-governance-integrity.md) / [IG-1](dashboard-runtime-honesty.md) | 🔴 |
| CT-VIOLATION | `custodyLog` named as multi-actor chain | [HO-5](dashboard-runtime-honesty.md) | 🟡 |

**Tally:** 3 🟢, 1 🟡, 7 🟠, 6 🔴.

The 🔴 cluster is concentrated where the operator's response read of the surface assumes containment that the contract never asserted — the export path is the densest CT-VIOLATION cluster, the same surface PR11B and PR13B identified as the survivability and constitutional-violation hotspot. The 🟢 cluster is concentrated in the lane-health pipeline — a single architectural decoupling carrying three separate response surfaces.

## Per-state operator readability

### CT-GREEN — 🟠 CONFUSING (false-confidence risk)

**What an operator sees today:** `/status` exposes per-surface foundation status and the post-DOCS-STATUS-1 compliance evidence shape ([dashboard-runtime-honesty.md](dashboard-runtime-honesty.md) Surface inventory, status row). No surface aggregates "every subsystem within tolerance, no degradation pending, no escalation in flight." The closest signal is the absence of a yellow or red badge.

**Why this is dangerous:** absence-of-warning reads as a positive containment claim. An operator looking at a status page with no red lanes will conclude CT-GREEN, but the same screen is consistent with: a bundle in flight currently dropping capsules silently (CT-FRAGMENTING), a refusal that fired with no audit row (CT-ESCALATING), or an aged-out trust-state artifact about to be replayed (CT-FRAGMENTING).

**Verdict:** 🟠 CONFUSING. The label can be right; the operator's confidence in it is structurally unjustified.

### CT-DEGRADED — 🟢 CLEAR

**What an operator sees today:** [LaneHealthBadge.tsx](../../apps/web/components/source-health/LaneHealthBadge.tsx) renders source state + reason + lastSuccessAt + observedAt. [LaneHealthSection.tsx](../../apps/web/components/source-health/LaneHealthSection.tsx) renders per-lane `userFacingMessage` and a retry policy. [degradedStateFoundation.ts](../../apps/web/lib/degraded-state/degradedStateFoundation.ts) ships six named notices (`offline`, `upstream_unavailable`, `upload_failed`, `source_probe_unknown`, `retry_required`, `local_draft_only`), each with a `retryable` flag and a body that disclaims clinician fault.

**Why this works:** the degradation is named, the lane is named, the consequence is inferable from the message, the retry policy is explicit, and the truth-vs-trust decoupling is enforced architecturally — a degraded lane never changes a credential decision on its own ([degradedStateFoundation.ts:6-15](../../apps/web/lib/degraded-state/degradedStateFoundation.ts) truth invariants).

**Verdict:** 🟢 CLEAR. The strongest containment-awareness surface VitalCV has today, and the only CT-* state operators can read confidently from a rendered surface.

### CT-FRAGMENTING — 🔴 MISLEADING

**What an operator sees today:** nothing. Active fragmentation events emit no operator-visible signal:

- A `buildAuditBundle` invocation losing per-capsule replays renders identically to a successful one. The recipient sees `capsuleCount: 48`, `bundleHash`, `custodyLog` — all the affordances of a complete bundle ([replayEngine.ts:585-606](../../apps/api/backend/src/services/audit/replayEngine.ts)).
- A replay envelope re-deriving authority chain, evidence references, and `trustStateAtDecision` from current artifact rows renders identically to one that recovered them from the original decision moment ([silent-fragmentation-awareness](silent-fragmentation-awareness.md) Surface 1).
- An outer `R-CAT-6` envelope masking inner R-CAT-1…5 reads as a dossier replay across every replayed action regardless of original action class.

**Why this is dangerous:** fragmenting is the *active* failure mode. Once it lands as a steady-state CT-VIOLATION (an inflated bundle in a regulator's hands), recovery is no longer available. The operator's last opportunity to interrupt the bundle is during the moment the loop is silently dropping; the surface emits no signal during that moment.

**Verdict:** 🔴 MISLEADING. The state is invisible; the inferred response state is "contained" because no warning fires.

### CT-ESCALATING — 🟠 CONFUSING

**What an operator sees today:** mixed.

- The `EmergencySwitch` ([EmergencySwitch.tsx:11-46](../../apps/web/components/employer/EmergencySwitch.tsx)) is a real, guarded, confirmation-gated escalation control — copy explicitly names that "this action overrides standard trust parameters domain-wide." The control side of escalation is well-rendered.
- But the *backing* state is an in-process global toggle ([emergencyMode.ts:7-9](../../apps/api/backend/src/services/compliance/emergencyMode.ts)) with a `log('warn', ...)` line and no audit row. The declaration itself does not produce a `EMERGENCY_DECLARED` event type; restart of the API process resets `emergencyModeActive` to `false` silently.
- Issuer-side `refusalGate` firing produces no audit row at all ([GF-4](operator-governance-integrity.md)). Replay invocations produce no audit row. Cascading degradations (lane flap → capsule defer → replay age-out) produce no cross-surface tie ([stress-state-explainability](stress-state-explainability.md) Scenario 1).

**Why this is dangerous:** escalation is the rate-of-change signal. Two stressors compounding produce a higher-severity state than either alone, but the absence of a forensic row at declaration time means an investigator at T+30d cannot reconstruct *when* the escalation began, *who* declared it, *what* changed under it. The control says "emergency"; the record is silent.

**Verdict:** 🟠 CONFUSING. The control is real; the record floor is zero. Two operators reading the same escalation arrive at the same description in the moment but diverge after process restart or replay window.

### CT-VIOLATION — 🔴 MISLEADING

**What an operator sees today:** the inflated structural fields render as if the contract had asserted them. `bundleHash` reads as completeness ([GF-3](operator-governance-integrity.md), [FI-3](dashboard-runtime-honesty.md)); `bundle.issuer: 'VitalCV'` reads as cryptographic provenance ([GF-10](operator-governance-integrity.md)); `verificationInstructions.how` reads as offline re-verification ([GF-15](operator-governance-integrity.md)); `capsuleCount` reads as window-completeness, not survived-loop-count ([IG-1](dashboard-runtime-honesty.md)).

**Why this is dangerous:** CT-VIOLATION is the response state where the bundle has already left the perimeter with the inflation embedded. The contract layer is honest (the literal types still hold, the banned-strings still ban); the structural layer asserted more than the contract earned. Recovery requires removing or defending the field — not waiting for a probe.

**Verdict:** 🔴 MISLEADING. The five 🔴 inflations from PR11B/PR13B are unchanged at PR14B. The CT-VIOLATION surface set is identical to the CI-VIOLATION surface set, projected onto operator-response.

## Containment-state operator-readability roll-up

| State | Readability | Where it holds | Where it fails |
|---|---|---|---|
| CT-GREEN | 🟠 CONFUSING | n/a | no aggregator surface; absence-of-warning reads as positive claim |
| CT-DEGRADED | 🟢 CLEAR | lane-health badge + section + degraded-state notices | `pending_not_written` invisible at surface |
| CT-FRAGMENTING | 🔴 MISLEADING | n/a | bundle silent drop; replay provenance unmarked; outer R-CAT-6 unconditional |
| CT-ESCALATING | 🟠 CONFUSING | EmergencySwitch control rendering | declaration writes no audit row; refusal floor zero; cascading degradation has no cross-tie |
| CT-VIOLATION | 🔴 MISLEADING | n/a | five 🔴 inflations in bundle / replay envelope render as contract claims |

**One state CLEAR, one state CONFUSING (false-confidence), one state CONFUSING (escalation), two states MISLEADING.** The operator can reliably read CT-DEGRADED and only CT-DEGRADED.

## Risks and what is not in scope here

- This track does not propose new surfaces. PR15B and forward will be the implementation lanes.
- The CT-DEGRADED 🟢 score depends on the operator looking at the lane-health surface. Operators looking only at `/status` or only at `/passport/[id]` will not see the same signal density.
- The CT-VIOLATION cluster is unchanged from PR11B. PR14B does not soften that finding; it locates it in operator-response space.
- The CT-ESCALATING gap on emergency-declaration audit is new. PR8B-PR13B did not analyze the `EmergencySwitch` ↔ `emergencyMode.ts` seam specifically.

---

*See also: [escalation-explainability](escalation-explainability.md) for the per-vector escalation analysis. [constitutional-response-continuity](constitutional-response-continuity.md) for whether these states remain operationally coherent under cascading stress. [governance-response-survivability](governance-response-survivability.md) for whether the CT-* visibility itself survives cascading degradation.*
