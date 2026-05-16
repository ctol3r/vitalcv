# Constitutional Awareness Explainability — W2-PR15B Track A

**Wave:** W2-PR15B — Operator Psychology + Constitutional Trust Awareness
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [replay-warning-psychology](replay-warning-psychology.md), [dashboard-trust-psychology](dashboard-trust-psychology.md), [constitutional-trust-continuity](constitutional-trust-continuity.md).
**Builds on:** [constitutional-failure-explainability](constitutional-failure-explainability.md), [dashboard-runtime-honesty](dashboard-runtime-honesty.md), [governance-awareness-survivability](governance-awareness-survivability.md), [escalation-explainability](escalation-explainability.md), [containment-explainability](containment-explainability.md), [forensic-durability-understanding](forensic-durability-understanding.md), [forensic-explainability](forensic-explainability.md), [longitudinal-governance-survivability](longitudinal-governance-survivability.md).

---

## What this track answers

PR13B Track A introduced the CI-* state vocabulary and asked whether an operator could correctly *classify* constitutional state under stress at a single point in time. **This track asks the psychology question: does the platform's surface keep operators *aware* of the six degradation classes — constitutional, replay, export, forensic, containment, escalation — across repeated exposure, or does the surface progressively normalize them into the operator's mental "everything is fine" baseline?**

The risk vector is **awareness erosion**: an operator who reads a degraded state correctly on day 1 reads it as the normal cadence by day 90. Awareness is not a property of the contract; it is a property of how the contract's signals interact with operator habit over time. A surface can be technically honest (the literal is correct, the badge transitions, the row is written) and psychologically dishonest (the cadence trains the operator to ignore it).

This track grades each of the six degradation classes for whether operators today would remain aware of it across repeated exposure, and locates the surfaces where awareness is psychologically durable vs progressively desensitizing.

## Awareness-grade vocabulary

The four awareness states an operator's mental model can occupy for a given degradation class:

- **🟢 AWARE** — the surface produces a signal an operator notices, distinguishes from baseline, and does not desensitize to over a 6–12 month exposure window. Cadence is rare or always salient; the signal narrates direction; absence of signal is itself a defended assertion.
- **🟡 PARTIAL** — the surface produces a signal that is correct at first read but loses salience under repetition. The operator notices it on day 1, treats it as background by day 30, and explains it away by day 90. Awareness depends on a fresh operator reading.
- **🟠 DESENSITIZING** — the surface produces a signal whose visual or copy shape is identical for the degraded and the healthy state, or whose cadence is high enough that the operator habit is "this is always firing." The signal exists in the contract; the operator's eye no longer reads it.
- **🔴 NORMALIZED** — the degraded state has no signal an operator can read at all, or the signal is structurally identical to the healthy state so that a 12-month-tenure operator sincerely believes "this never happens here." The contract may hold; the awareness is gone.

These four grades stack with the CI-* state vocabulary from [constitutional-failure-explainability](constitutional-failure-explainability.md). An awareness grade is asked of a *class of degradation*; a CI-* class is asked of an *individual finding*. A platform with five 🔴 CI-VIOLATION findings can still be 🟢 AWARE of CI-VIOLATION as a class if the five findings each fire signals the operator notices.

## Six-class awareness scoreboard

For each degradation class, the question is: **across 6–12 months of operator exposure, does the operator remain aware that the class is occurring?** Not "does the contract record it" (PR8B+9B+10B+11B answered that). Not "can the operator classify a single state" (PR13B Track A answered that). The question is whether the operator's daily habit of looking at VitalCV preserves the awareness.

| Degradation class | Surfaces operator sees | Daily-cadence signal | Awareness grade | Why |
|---|---|---|---|---|
| Constitutional degradation | bundle JSON, status page, replay envelope | none — `bundleHash` always present, status page always green-shaped, replay envelope always returns | 🔴 NORMALIZED | the contract degradations (`pending_not_written` rows, refusal-row absence, capsule drops) are invisible by construction; surface is happy-path-shaped regardless |
| Replay degradation | replay envelope `tamperEvidence`, `R-CAT`, `evidenceSnapshot.trustStateAtDecision`, `replayedAt` | `tamperEvidence: null` on every healthy replay | 🟠 DESENSITIZING | 99% of replays return `null`; on the 1% non-null day the operator reads "tamperEvidence fired again, probably routine" |
| Export degradation | bundle JSON, no separate surface | none — bundle export looks identical at 48 capsules vs 50 | 🔴 NORMALIZED | `capsuleCount: 48` reads as the requested count, no `requestedCount`, no `partialExport`, no `droppedIds`; recipient cannot detect; sender cannot see drop-rate |
| Forensic degradation | audit table query, audit timeline | the queries that operators write don't return rows that don't exist | 🔴 NORMALIZED | issuer-side refusals, replay invocations, emergency declarations write zero or one log line; the query says "no events" because no rows were written; the absence reads as absence-of-event |
| Containment degradation | lane-health badge, employer dashboard lane section, passport readiness pill | lane-health badge transitions LIVE → DEGRADED → UNAVAILABLE with `lastSuccessAt` | 🟢 AWARE | lane health is the only class with a rendered direction signal (`lastSuccessAt: 5m ago`); cadence stays salient because lane state genuinely changes |
| Escalation degradation | EmergencySwitch button, "EMERGENCY ACTIVE" label | rare — most operators never see an emergency declared | 🟡 PARTIAL | the control is visually arresting on day 1; the label survives only the in-process toggle ([emergencyMode.ts:8](../../apps/api/backend/src/services/compliance/emergencyMode.ts) `let emergencyModeActive = false`); a process restart erases declared state, so the operator's awareness is unanchored to a durable record |

**Tally: 1 🟢, 1 🟡, 1 🟠, 3 🔴.**

**Pattern:** lane health is the one class where the platform's psychology of awareness holds — not because the contract is stronger but because the surface renders direction (`lastSuccessAt`) and the cadence is genuinely variable. Three classes (constitutional, export, forensic) are 🔴 NORMALIZED by construction: there is no signal an operator's eye can land on. One class (replay) is 🟠 DESENSITIZING because the cadence of the one signal that exists (`tamperEvidence`) is overwhelmingly null.

## Per-class awareness analysis

### Class 1 — Constitutional degradation awareness

**What "aware" means here:** the operator notices when the contract layer is producing literals the structural or surface layer is silently widening — `pending_not_written` rows accumulating, `actorId: 'unknown'` proportion rising, demo-flag literals propagating to a surface that softens the disclaimer copy.

**Surfaces today:**
- bundle JSON — no field surfaces `eventState`, `pending_not_written` count, or `'unknown'` proportion.
- status page ([status/page.tsx](../../apps/web/app/status/page.tsx)) — the page is honestly framed ("Foundation status preview. No uptime guarantee is implied.") and renders `uptimeGuaranteeImplied: false` as a literal. It does not render any constitutional-degradation signal because no constitutional-degradation literal is wired to it.
- replay envelope — surfaces the contract correctly (`evidenceSnapshot.anomaliesDetected` is plumbed from `meta.anomalies`/`meta.gaps`), but `anomaliesDetected: []` on a healthy capsule and `anomaliesDetected: []` on a constitutionally-degraded capsule are visually identical.

**Awareness mechanism:** none. The operator's daily-use surfaces produce no signal for the constitutional-degradation class.

**Desensitization mechanism:** absence of signal trains "this never happens." After 12 months of zero constitutional-degradation signals, the operator's mental model is "VitalCV's constitutional state is monolithic; degradation would be visible if it occurred."

**Grade: 🔴 NORMALIZED.** The contract is congruent ([CLAUDE.md](../../CLAUDE.md) banned strings, literal `decisionGrade: false`, demo-flag literal); the surface produces zero awareness signal; the operator's habit naturalizes the absence.

**Awareness floor:** zero. The platform's constitutional-degradation surface area is, from an operator psychology standpoint, indistinguishable from a platform that has none.

### Class 2 — Replay degradation awareness

**What "aware" means here:** the operator notices when a replay's `tamperEvidence` is non-null, when `evidenceSnapshot.trustStateAtDecision: 'UNKNOWN'` is a replay-time fallback (vs recorded), when authority chain has been re-derived at replay time, when outer R-CAT-6 masks an inner R-CAT-1…5.

**Surfaces today:**
- `tamperEvidence` is null on every clean replay ([replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts)). The literal exists; the cadence trains "null is the answer."
- `evidenceSnapshot.trustStateAtDecision.capturedAt` is structurally present and visually irrelevant ([HO-4](dashboard-runtime-honesty.md)). The operator does not look at `capturedAt: null` and read "this is a replay-time fallback."
- outer `replayCategory: 'R-CAT-6'` is unconditional ([GF-12](operator-governance-integrity.md), [IG-6](dashboard-runtime-honesty.md)). The operator who sees "R-CAT-6" on every replay habituates "all replays are dossier replays."
- `authorityChain` is re-derived at replay time when `issuerIds` is empty ([replayEngine.ts:441-456](../../apps/api/backend/src/services/audit/replayEngine.ts)) without a provenance marker. The operator reads the chain as decision-time.

**Awareness mechanism:** `tamperEvidence` strings are the one surfaced signal. They distinguish hash-mismatch / spine-mismatch / generic ([replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts)).

**Desensitization mechanism:** the signal cadence is null-dominant. An operator who has read 200 replay envelopes with `tamperEvidence: null` reads the 201st without checking. The cumulative habit makes the signal valuable on day 1 and invisible by day 90 (see [replay-warning-psychology](replay-warning-psychology.md) for the full per-warning analysis).

**Grade: 🟠 DESENSITIZING.** The signal exists; the cadence kills it.

### Class 3 — Export degradation awareness

**What "aware" means here:** the operator notices when a bundle export drops capsules ([replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts)), is best-effort, is not signed, has `capsuleCount` as survived rather than requested, has no `partialExport` field.

**Surfaces today:**
- bundle JSON — `capsuleCount` is the only count rendered ([replayEngine.ts:592](../../apps/api/backend/src/services/audit/replayEngine.ts)). No `requestedCount`. No `partialExport`. No `droppedIds`. Identical shape for 48-of-50 and 50-of-50 ([HO-2](dashboard-runtime-honesty.md), [FI-2](dashboard-runtime-honesty.md)).
- `bundleHash` over what survived reads as completeness ([HO-2](dashboard-runtime-honesty.md)).
- `bundle.issuer: 'VitalCV'` is a string literal ([GF-10](operator-governance-integrity.md)), not a cryptographic signature; the operator reads it as provenance.
- `verificationInstructions.how` says "verify integrity.hashMatch === true" — defines completeness as per-capsule hash match, not as drop-detection.

**Awareness mechanism:** none. The bundle does not declare its limits. Server logs name dropped IDs; no operator routinely reads server logs after a bundle export.

**Desensitization mechanism:** every successful "complete" bundle export reinforces "bundles are complete." Each silent drop is invisible to the recipient and untraceable by the sender. After 12 months of bundle exports, the habit "the bundle is what was requested" is unimpeachable from operator experience.

**Grade: 🔴 NORMALIZED.** Awareness is zero by construction.

### Class 4 — Forensic degradation awareness

**What "aware" means here:** the operator (or investigator) notices that the audit table's coverage is narrower than the platform's behavior — issuer-side refusals are not rowed ([GF-4](operator-governance-integrity.md), [IG-4](dashboard-runtime-honesty.md)), replay invocations are not rowed ([IG-3](dashboard-runtime-honesty.md)), emergency declarations write a `log('warn', ...)` line and not an audit row ([emergencyMode.ts:27](../../apps/api/backend/src/services/compliance/emergencyMode.ts)), three retries with the same `mutationFingerprint` render as three rows ([GF-5](operator-governance-integrity.md), [IG-5](dashboard-runtime-honesty.md)).

**Surfaces today:**
- audit table query — returns the rows that exist. The operator reads "no rows for refusals" as "no refusals fired."
- audit timeline — same property: absence of row reads as absence of event.
- bundle JSON — does not declare which event types are rowable.

**Awareness mechanism:** none structural. The convention "if you can't query it, it didn't happen" is operator-built and load-bearing.

**Desensitization mechanism:** as new event types land without audit-row plumbing (every PR has the option to follow the [`EMPLOYER_REVIEW_MUTATION_DENIED`](../../apps/api/backend/src/types/auditEventTypes.ts) precedent — one type, many reasons — or the [refusalGate](../../apps/web/lib/issuer-verification/policyReview.ts) precedent — no row at all), the gap between query coverage and actual behavior widens silently. The operator's confidence in the audit table grows during the same period the gap grows ([escalation-explainability](escalation-explainability.md) Vector 4 direction-inversion).

**Grade: 🔴 NORMALIZED.** This is the single most consequential awareness gap in the platform because it is the one whose recovery requires schema change *and* reviewer-discipline change — the audit-event taxonomy will accrete rows that obscure as fast as it accretes rows that disclose unless a structural lift binds the two.

### Class 5 — Containment degradation awareness

**What "aware" means here:** the operator notices when source-coverage lane is degraded, when retry policy is exhausted, when `userFacingMessage` describes a bounded state.

**Surfaces today:**
- [LaneHealthBadge.tsx](../../apps/web/components/source-health/LaneHealthBadge.tsx) — renders `LIVE / DEGRADED / UNAVAILABLE / RATE_LIMITED / UNKNOWN` with variants `trust-green / trust-yellow / trust-red / outline`, source label, and `lastSuccessAt` as a relative timestamp ("5m ago"). Cadence is genuinely variable (lane state changes), so the signal does not desensitize.
- `LaneHealthMount` — propagated to [employer/dashboard/page.tsx](../../apps/web/app/employer/dashboard/page.tsx), [passport/[id]/PassportEntityClient.tsx](../../apps/web/app/passport/%5Bid%5D/PassportEntityClient.tsx), [passport/page.tsx](../../apps/web/app/passport/page.tsx). The same honest signal three times.
- `degradedStateFoundation` notices ([trust-fabric-continuity](trust-fabric-continuity.md)) — bounded, named, rate-limited.

**Awareness mechanism:** lane-health badge transitions are a real direction signal; `lastSuccessAt` narrates freshness; variants are visually distinct; tooltip carries `reason` and `observedAt` ([LaneHealthBadge.tsx:74-80](../../apps/web/components/source-health/LaneHealthBadge.tsx)).

**Desensitization mechanism:** the only meaningful one is *over-attribution* — the operator who sees lane-health degraded may incorrectly infer that trust is degraded (the platform deliberately decouples them). PR12B [governance-awareness-survivability](governance-awareness-survivability.md) D.4 noted this risk.

**Grade: 🟢 AWARE.** This is the platform's only psychologically durable awareness signal, and the wave's clearest counter-example to the desensitization pattern. The decoupling is the active defense.

### Class 6 — Escalation degradation awareness

**What "aware" means here:** the operator notices when the `EmergencySwitch` is active, when escalation declarations are accumulating, when the platform is in a stress-response posture.

**Surfaces today:**
- [EmergencySwitch.tsx](../../apps/web/components/employer/EmergencySwitch.tsx) — a visually arresting button with copy "DECLARE EMERGENCY" / "EMERGENCY ACTIVE" and a confirmation dialog ("This action overrides standard trust parameters domain-wide. It escalates specific L2 credentials to L3 (72h TTL) and flags all transactions for mandatory post-event reconciliation."). The control is striking on day 1.
- backing service [emergencyMode.ts:8-35](../../apps/api/backend/src/services/compliance/emergencyMode.ts) — `let emergencyModeActive = false`; toggled in process; `log('warn', ...)` emitted on declaration; **no audit row written for the declaration itself**. Process restart resets to `false`. (Compare: `evaluateEmergencyOverride` *does* write an `EMERGENCY_ESCALATION` audit row when the override fires per-credential — declaration is unrowed, override consequence is rowed.)
- "EMERGENCY ACTIVE" label survives only the in-process toggle. A separate operator on a separate process sees `emergencyModeActive: false` simultaneously.

**Awareness mechanism:** the UI control is salient. The visual treatment ("⚠️ DECLARE EMERGENCY" with a confirmation modal) is appropriately weighty.

**Desensitization mechanism:** the inverse of replay — *too rare* to desensitize via cadence, *too soft* to anchor durably. The operator who declares emergency and watches the label survive a session, then comes back the next day after a deploy and sees `false`, reads "the platform reset itself" or "someone cleared it" or "I misremembered." The awareness has no durable anchor.

The label "Action permanently logged to Audit Scrapbook" in [EmergencySwitch.tsx:91](../../apps/web/components/employer/EmergencySwitch.tsx) is itself a CI-VIOLATION-class copy: the declaration writes no audit row, only a log line.

**Grade: 🟡 PARTIAL.** The control is psychologically real on day 1; the durability of the declared state is unanchored.

## Operator-psychology cross-cuts

The same degradation classes scored against the four operator-psychology vectors named in the wave brief.

### PV-1 — Operators normalize degradation

**Mechanism:** repeated exposure to a degraded state with no salient signal turns the degraded state into baseline.

**Vulnerable classes:** constitutional (no signal at all), export (silent drop), forensic (absent rows), replay (`tamperEvidence: null` cadence).

**Defended classes:** containment (lane-health badge has variable cadence + direction signal).

**Tally:** 4 of 6 classes admit normalization.

### PV-2 — Operators ignore replay ambiguity

**Mechanism:** replay envelopes have a uniform shape regardless of whether their fields are recorded or computed. Operators who read 200 envelopes lose discrimination.

**Vulnerable classes:** replay (the canonical case), forensic (cross-replay drift compounds invisibly).

**Defended classes:** none — every replay envelope has the same shape ([escalation-explainability](escalation-explainability.md) Vector 1).

**Tally:** 2 of 2 replay-touching classes admit replay-ambiguity blindness.

### PV-3 — Operators overtrust dashboards

**Mechanism:** a dashboard's *absence of red* reads as a positive claim. The implicit guarantees in [dashboard-runtime-honesty](dashboard-runtime-honesty.md) IG-1…7 are all of this shape.

**Vulnerable classes:** all six. Every dashboard read is a candidate for over-trust because the platform's daily-use surfaces are 95%+ "all green" in normal operation.

**Defended classes:** the lane-health badge is the only one that *can* go red on a healthy day (because lane-health is decoupled from trust). The dashboard's other green states are not falsifiable from the surface alone.

**Tally:** the over-trust risk is platform-wide, not class-specific. See [dashboard-trust-psychology](dashboard-trust-psychology.md) for the per-surface analysis.

### PV-4 — Operators underestimate fragmentation

**Mechanism:** the surface elides distinctions the contract preserves (outer vs inner R-CAT, recorded vs computed, C-1 vs T0, three retries vs one fingerprint). After 12 months the operator's mental model has fewer categories than the contract has.

**Vulnerable classes:** replay (R-CAT collapse), forensic (retry collapse), constitutional (lineage class collapse).

**Defended classes:** the runtime-cohesion round-trip test ([replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts)) preserves the C-1 ↔ T0 chain at the contract layer. The operator's awareness of the chain is not preserved at the surface.

**Tally:** 3 of 6 classes admit fragmentation underestimation.

### PV-5 — Operators desensitize to constitutional warnings

**Mechanism:** a warning that fires too often loses meaning; a warning that fires too rarely cannot anchor recall; a warning that has the same shape as a healthy state cannot fire at all.

**Vulnerable classes:** replay (cadence dilution — `tamperEvidence: null` is the modal answer), escalation (recall failure — `EmergencySwitch` is too rare to anchor), constitutional/export/forensic (shape-identity — degraded state has no distinct shape).

**Defended classes:** containment (lane-health rendering distinguishes variants visually).

**Tally:** 5 of 6 classes admit desensitization.

### PV-6 — Operators accept degraded lineage as "normal"

**Mechanism:** an operator who sees `actorId: 'unknown'` consistently develops a "stable cohort" mental model ([HO-3](dashboard-runtime-honesty.md)). The degraded literal becomes a category.

**Vulnerable classes:** forensic (unattributed actor), constitutional (label drift in `SOURCE_LABELS`), replay (`'UNKNOWN'` trust band as a fact).

**Defended classes:** the enum-pinning of `authorityChain` ([governance-awareness-survivability](governance-awareness-survivability.md) D.1) preserves the contract; the rendering does not preserve the awareness.

**Tally:** 3 of 6 classes admit lineage normalization.

## Awareness-by-cadence map

A second cut: for each surface an operator interacts with, what is the *cadence-shape* of its signal?

| Surface | Signal cadence | Awareness implication |
|---|---|---|
| Lane-health badge | variable (LIVE / DEGRADED / UNAVAILABLE transitions; `lastSuccessAt` narrates time) | 🟢 sustained — variability keeps salience |
| Replay envelope `tamperEvidence` | null-dominant (~99% null) | 🟠 desensitizing — null is the modal answer |
| Replay envelope `R-CAT-6` outer | always `R-CAT-6` | 🔴 normalized — cadence is constant, signal is invisible |
| Replay envelope `evidenceSnapshot.trustStateAtDecision` | frequently `'UNKNOWN'` post-retention age-out | 🟠 desensitizing — habit "UNKNOWN is normal" forms |
| Bundle JSON `capsuleCount` | always present | 🔴 normalized — no signal that count was reduced |
| Bundle JSON `bundleHash` | always present | 🔴 normalized — hash equality reads as completeness |
| Status page `uptimeGuaranteeImplied` | always `false` (literal) | 🟢 sustained — a constant disclaimer that is psychologically defended by the page header copy |
| Status page surfaces array | currently small + honest | 🟡 partial — the page is honest today; future expansion under "polish" pressure could soften |
| Issuer review surface `recordedBy: 'demo'` | always `'demo'` on demo paths | 🟢 sustained — three-layer defense (literal + propagation + copy disclaimer) |
| Audit timeline rows | every row visually identical regardless of `eventState` | 🔴 normalized — `pending_not_written` invisible |
| Audit query result | rows that exist; absence reads as absence-of-event | 🔴 normalized — refusal-row absence, replay-row absence, declaration-row absence all read identically to "no event" |
| EmergencySwitch label | rare ("EMERGENCY ACTIVE" only when declared) | 🟡 partial — salient on day 1; non-durable across deploys |

**Pattern:** four cadence shapes preserve awareness, two shapes desensitize, six shapes normalize. The four 🟢 are: lane-health (variable), status-page disclaimer (always-on principled disclaimer), demo flag (always-on principled disclaimer), and — by extension — every other surface that combines a constant *honest disclaimer* with a constant rendered literal. The 🔴 cluster is concentrated where the surface has only one shape.

## Where constitutional awareness is psychologically durable

**The lane-health badge is the platform's one psychologically durable awareness surface.** Variable cadence + direction narration (`lastSuccessAt`) + visually distinct variants + decoupling from trust state combine into a signal an operator's eye keeps reading correctly across 12 months of daily exposure. This is the wave's existence proof that 🟢 AWARE is achievable when a surface is built for it.

**The doctrine layer (banned-strings list, literal `decisionGrade: false`, distinct `proofTier` literals, demo-flag propagation, status-page disclaimer copy) is psychologically durable through the inverse mechanism:** it produces no per-event signal, but it produces a *constant honest framing* that anchors operator and contributor expectation. The status page header — "Status surfaces are foundation previews. No uptime guarantee is implied." ([status/page.tsx:36-39](../../apps/web/app/status/page.tsx)) — is the canonical example. It is a disclaimer, not a warning, and its always-on cadence is precisely what makes it psychologically durable.

## Where constitutional awareness is psychologically silent

**The bundle JSON is the platform's worst awareness surface for two compounding reasons.** First, it is shape-identical for healthy and degraded states (no `partialExport`, no `requestedCount`, no `droppedIds`). Second, it is the artifact most likely to leave VitalCV's perimeter, so the awareness gap reaches the recipient (regulator, auditor, opposing counsel) at the moment the awareness is most consequential. Constitutional, export, and forensic awareness all collapse here simultaneously.

**The audit-table query path is the second-worst** because the operator's only tool for constitutional / forensic awareness is the query, and the query's correctness is inseparable from the table's coverage. The table's coverage is silently narrower than the platform's behavior for issuer refusals, replay invocations, and emergency declarations. The operator's awareness of "what the platform does" cannot exceed "what the audit table records."

## Verdict

**Constitutional awareness explainability is psychologically durable on one surface (lane health) and psychologically silent on five of six degradation classes.**

The platform's contract layer holds across every degradation class. The platform's surface layer holds across one degradation class. The platform's *operator psychology layer* — the property that an operator's mental model continues to track the contract under repeated exposure — holds where a surface combines variable cadence with direction narration (lane health) or where a surface combines constant cadence with honest disclaimer copy (status page header, demo flag).

Three classes (constitutional, export, forensic) are 🔴 NORMALIZED: zero signal, full desensitization-by-construction. Two classes (replay, escalation) are partially defended in shape but vulnerable in cadence (replay) or durability (escalation). One class (containment) is 🟢 AWARE.

**Strongest constitutional-awareness surface:** the [LaneHealthBadge](../../apps/web/components/source-health/LaneHealthBadge.tsx) + [LaneHealthMount](../../apps/web/components/source-health/LaneHealthMount.tsx) chain. The only surface where signal cadence is variable, direction is narrated, variants are visually distinct, and the decoupling from trust state is structural. Across 12 months of exposure, an operator reading the lane-health badge stays aware of source-coverage degradation.

**Weakest operator-awareness surface:** the [bundle JSON](../../apps/api/backend/src/services/audit/replayEngine.ts). Shape-identical across healthy and degraded states; no `partialExport`, no `requestedCount`, no `droppedIds`, no signature; the artifact most likely to leave the perimeter is the artifact most likely to invite normalized misreading. Three degradation classes (constitutional, export, forensic) all collapse here simultaneously.

**Track A score: 🟠 DESENSITIZING.** 1 🟢, 1 🟡, 1 🟠, 3 🔴 across six degradation classes; 4 of 6 classes admit normalization, 5 of 6 admit desensitization, 3 of 6 admit lineage normalization. **Constitutional awareness explainability is sharp where the platform built a surface and progressively silent everywhere else — operator psychology preserves the awareness lane health renders and erodes the awareness the contract layer alone holds.**
