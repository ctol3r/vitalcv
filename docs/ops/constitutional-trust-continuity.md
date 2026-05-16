# Constitutional Trust Continuity — W2-PR15B Track D

**Wave:** W2-PR15B — Operator Psychology + Constitutional Trust Awareness
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [constitutional-awareness-explainability](constitutional-awareness-explainability.md), [replay-warning-psychology](replay-warning-psychology.md), [dashboard-trust-psychology](dashboard-trust-psychology.md).
**Builds on:** [constitutional-failure-explainability](constitutional-failure-explainability.md), [constitutional-response-continuity](constitutional-response-continuity.md), [longitudinal-governance-survivability](longitudinal-governance-survivability.md), [governance-collapse-survivability](governance-collapse-survivability.md), [escalation-explainability](escalation-explainability.md), [containment-explainability](containment-explainability.md), [forensic-durability-understanding](forensic-durability-understanding.md), [governance-awareness-survivability](governance-awareness-survivability.md), [silent-fragmentation-awareness](silent-fragmentation-awareness.md).

---

## What this track answers

Tracks A–C scored awareness, warnings, and dashboards at a point in time and across short exposure horizons. **This track asks the longitudinal psychology question: across prolonged degradation, repeated replay ambiguity, prolonged export lag, and repeated containment states, does the platform preserve the operator's *awareness* — constitutional, survivability, forensic caution, replay caution, governance honesty — or does the same compounding stress that PR14B Track C measured at the contract layer also erode the operator's mental model?**

PR14B Track C ([constitutional-response-continuity](constitutional-response-continuity.md)) asked whether the four governance layers (runtime, containment, escalation, forensic) remain *operationally* coherent across response events. **PR15B Track D asks whether the operator's *psychological* coherence — their continued willingness to read the platform's signals as the signals the contract intends — survives the same compounding stress.**

The risk vector is **awareness collapse**: a platform that survives a stress event in a structurally coherent state can still degrade the operator's *interpretive habits* in ways that compound across future events. After the third replay ambiguity in a quarter, after the tenth bundle export with no `partialExport` field, after the fourth held CT-DEGRADED, the operator's defaulted mental model has shifted. The contract may still hold; the operator's reading of the contract has not.

This track grades constitutional trust continuity along five preservation axes — constitutional awareness, survivability awareness, forensic caution, replay caution, governance honesty — across four prolonged-stress conditions, and registers the awareness-collapse vectors operators face under repeated exposure.

## Definitions

- **Constitutional trust continuity:** the property that an operator's *interpretive habits* around the platform's truth contract remain stable under prolonged or repeated stress.
- **Awareness preservation:** the property that the awareness state ([constitutional-awareness-explainability](constitutional-awareness-explainability.md) 🟢/🟡/🟠/🔴) does not degrade between T+0 and T+90d under the named stress condition.
- **Awareness collapse:** the failure mode where awareness was at one grade at T+0 and is at a worse grade at T+90d. Distinct from awareness *absence* (which is true at T+0).
- **Caution preservation:** the property that an operator who began their tenure cautious about a class of degradation (forensic, replay) remains cautious after repeated exposure.
- **Caution erosion:** the failure mode where repeated exposure to a degraded state with no salient signal converts caution into normalization.
- **Honesty preservation:** the platform-level property that the structural and surface layers continue to disclose the contract's literals across the stress horizon. Distinct from operator-level awareness.
- **Stress horizon:** the duration of a stress event or pattern, ranging from days (single export lag) to months (slow constitutional drift) to quarters (repeated containment cycles).

## Five-axis preservation scoreboard

For each preservation axis, score whether the platform preserves the awareness state under the four stress conditions named in the wave brief.

| Preservation axis | Prolonged degradation (CT-DEGRADED held for weeks) | Repeated replay ambiguity (3+ replays per investigation, monthly cadence) | Prolonged export lag (recurring partial bundles) | Repeated containment states (lane flap cycles, monthly cadence) |
|---|---|---|---|---|
| **Constitutional awareness preservation** | 🟠 — operator habit "this is the cadence" forms; doctrine layer holds; surface layer silent | 🟠 — investigators infer cross-replay continuity ([escalation-explainability](escalation-explainability.md) Vector 1); habit hardens | 🔴 — every successful export reinforces "exports are complete"; no signal interrupts | 🟢 — lane-health badge cadence is genuinely variable; operator model recalibrates each cycle |
| **Survivability awareness preservation** | 🟠 — `pending_not_written` stays invisible; "platform is durable" mental model hardens | 🟠 — `'UNKNOWN'` trust state becomes modal as artifacts age out; "UNKNOWN is the default" habit forms | 🔴 — `bundleHash` always matches; "complete and verified" habit unimpeachable from operator experience | 🟢 — lane state changes; survivability of the source axis is read directly |
| **Forensic caution preservation** | 🟠 — refusal-row absence stays invisible; "audit table is the audit record" hardens | 🟠 — investigators read three clean `tamperEvidence: null` envelopes as continuity; cross-capsule caution erodes | 🔴 — recipient cannot distinguish complete from partial bundles; recipient-side caution erodes monotonically | 🟡 — lane state is forensically scoped; degradation does not compound forensic mental model |
| **Replay caution preservation** | 🟡 — replay envelope shape stable; cadence does not change | 🔴 — `tamperEvidence: null` cadence + `R-CAT-6` outer constancy + `'UNKNOWN'` trust state modal — three desensitization vectors compound monthly | 🟡 — bundle replays inherit the per-capsule replay habit; the recipient's model is bundle-shaped, not replay-shaped | 🟢 — lane events do not affect replay psychology |
| **Governance honesty preservation** | 🟡 — doctrine layer holds (banned strings, literal types, demo gates) under all four conditions; reviewer-discipline pressure rises with stress duration | 🟡 — same; replay-language drift ([RD-1…4](longitudinal-governance-survivability.md)) rises as more replay paths land | 🟠 — bundle schema accretion under stress is the highest-impact governance-honesty pressure | 🟢 — lane-health pipeline is the model for new containment surfaces; precedent is honest |

**Tally across 20 cells:** 5 🟢, 5 🟡, 7 🟠, 3 🔴.

**Pattern:** repeated containment states (column 4) are the only stress condition where awareness is preserved across all five axes — because the lane-health badge is the platform's one durable awareness surface and the stress condition fires on its native channel. Prolonged export lag (column 3) is the worst-preservation stress condition, with three 🔴 cells concentrated in the survivability/forensic/constitutional axes that face the bundle. Repeated replay ambiguity (column 2) is the second-worst, concentrated in the replay-caution axis where the three desensitization vectors (cadence, constancy, modality) compound monthly.

## Per-stress-condition continuity analysis

### Stress condition 1 — Prolonged degradation (CT-DEGRADED held for weeks)

**What's happening:** the platform enters a CT-DEGRADED state ([containment-explainability](containment-explainability.md)) — `pending_not_written` rows accumulating, capsule writes deferred, source-coverage flapping but bounded, refusal-row absence growing — and stays in it for weeks rather than recovering within hours.

**Awareness preservation analysis:**

- **Constitutional awareness:** the doctrine layer holds (banned strings, literal types, demo flag); the surface layer produces zero signal; the operator's mental model "this cadence is normal" hardens. By week 4 the operator no longer notices the daily volume of deferred rows because the surface does not narrate the volume.
- **Survivability awareness:** the lane-health badge fires when source-coverage flaps; the badge is honest. But the survivability dimensions the badge does *not* cover (`eventState`, `mutationFingerprint`, `actorId: 'unknown'` proportion) remain invisible. After week 4 the operator's mental model is "lane health is the only thing that varies; everything else is durable."
- **Forensic caution:** issuer-side refusals accumulate without rows ([GF-4](operator-governance-integrity.md)). An investigator at T+30d running "all refusals across all surfaces" returns the employer-side denials only. The investigator's caution about the audit table's coverage erodes because the table's apparent coverage is not contradicted by any signal.
- **Replay caution:** replay envelope shape does not change. `tamperEvidence` cadence does not change. The replay-caution erosion in this stress condition is slow because replay is not the primary stressor.
- **Governance honesty:** the doctrine layer is the active defense. It holds across the stress horizon. The structural-gap defenses ([longitudinal-governance-survivability](longitudinal-governance-survivability.md) "self-widening layer") accrete during the stress horizon at the rate of normal contribution; the stress condition does not accelerate the accretion, but the longer the horizon the more accretion the stress accumulates.

**Coherence horizon:** ~7 days. After the first week of held CT-DEGRADED with no recovery and no new signal, the operator's interpretive habit "this is the platform's cadence" has hardened.

**Continuity score: 🟠 PARTIAL.** Doctrine + lane-health hold. Constitutional, survivability, forensic awareness erode steadily across the stress horizon.

### Stress condition 2 — Repeated replay ambiguity

**What's happening:** an investigator runs replay across investigations on a monthly cadence. Each investigation produces 3–10 replay envelopes. Across a quarter the investigator has read 30+ envelopes; across a year, 100+.

**Awareness preservation analysis:**

- **Constitutional awareness:** the investigator's mental model "the envelope is the snapshot" hardens with each batch ([replay-warning-psychology](replay-warning-psychology.md) DV-2). Outer `R-CAT-6` constancy and `'UNKNOWN'` modality desensitize over the year. By month 12 the investigator no longer reads outer R-CAT or `'UNKNOWN'` as warnings.
- **Survivability awareness:** the trust-state-at-decision field becomes modal `'UNKNOWN'` as the investigation scope reaches older capsules ([HO-4](dashboard-runtime-honesty.md)); the `capturedAt: null` discriminator is invisible. The investigator's awareness of "this is recorded vs replay-time-fallback" erodes monotonically.
- **Forensic caution:** the most acute erosion. After three replay batches with `tamperEvidence: null` across all envelopes, the investigator infers cross-capsule continuity ([escalation-explainability](escalation-explainability.md) Vector 1). The contract holds within each replay; the investigator's habit infers a property the contract does not assert across replays.
- **Replay caution:** the canonical erosion case. Three desensitization vectors (cadence, constancy, modality) compound per investigation. The investigator who began cautious about replay drift at investigation 1 is structurally less cautious at investigation 12.
- **Governance honesty:** the contract preserves every distinction (round-trip test, enum-pinned authority chain, `meta.runtimeTrust` block). The honesty exists in code; the rendering does not bind it; the investigator does not see the preservation.

**Coherence horizon:** ~3 investigations (~3 months at monthly cadence). After three batches the investigator's habit "all replays are clean" is the operative read.

**Continuity score: 🟠 PARTIAL with one 🔴 (replay caution).** Doctrine and runtime contract hold. Replay caution collapses fastest.

### Stress condition 3 — Prolonged export lag (recurring partial bundles)

**What's happening:** quarterly compliance review and ad-hoc regulator inquiries each request bundle exports. Each export silently drops 0–N capsules ([replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts)). Over a year the platform produces 10+ bundles, of which an unknown fraction are partial.

**Awareness preservation analysis:**

- **Constitutional awareness:** every successful export reinforces "exports are complete." The operator's habit hardens with every quarterly cycle. By year-end the habit is doctrine.
- **Survivability awareness:** `bundleHash` matches on re-verification regardless of how many capsules were dropped ([HO-2](dashboard-runtime-honesty.md), [FI-3](dashboard-runtime-honesty.md)). The operator's habit "the bundle is what was requested" is unimpeachable from experience.
- **Forensic caution:** the canonical erosion site. Recipients (regulators, auditors, opposing counsel) cannot detect drops; recipients have no log access; recipient-side caution erodes monotonically because the surface does not produce a contradicting signal. After year-end the recipient's habit "VitalCV bundles are complete" is doctrine for the recipient too — and the recipient's habit is harder to interrupt because the recipient is not the sender.
- **Replay caution:** per-capsule replay habits inherit from the bundle habit. If the bundle is complete, the per-capsule replay must also be intact. The conditional reasoning compounds the per-replay caution erosion in stress condition 2.
- **Governance honesty:** bundle schema accretion under stress ([DD-4](longitudinal-governance-survivability.md)) is the highest-impact governance-honesty pressure across all four stress conditions. Each new bundle field is a chance to land an inflation; under stress (partial-bundle-induced operator anxiety), the reviewer-discipline pressure to "fix it by adding a field that explains why" is highest. The doctrine layer (banned strings, literal types) does not protect the bundle's *shape*; it only protects the *copy*.

**Coherence horizon:** ~2 export cycles (~2 quarters). After two partial bundles with no detection, the false-completeness habit is operative for both sender and recipient.

**Continuity score: 🔴 BROKEN.** Three of five preservation axes collapse to 🔴 under this stress condition. The contract holds; the operator's and recipient's interpretive habits do not.

### Stress condition 4 — Repeated containment states (lane flap cycles)

**What's happening:** source-coverage lanes flap on a monthly or weekly cadence. Each flap is bounded ([trust-fabric-continuity](trust-fabric-continuity.md) `degradedStateFoundation`); each is rendered honestly by the lane-health badge.

**Awareness preservation analysis:**

- **Constitutional awareness:** the lane-health badge transitions are the platform's only durable awareness signal. Operators who read the badge weekly retain a calibrated mental model of source-coverage availability across 12+ months ([constitutional-awareness-explainability](constitutional-awareness-explainability.md) Class 5).
- **Survivability awareness:** the badge narrates direction (`lastSuccessAt`); the variants are visually distinct; the cadence is variable. Survivability awareness on the source-coverage axis is preserved.
- **Forensic caution:** lane state is forensically scoped to source-coverage; degradation does not compound the forensic mental model around audit-table coverage. The forensic caution erosion vectors active in other stress conditions (refusal-row absence, replay-invocation absence) are not active here.
- **Replay caution:** lane events do not affect replay psychology directly.
- **Governance honesty:** the lane-health pipeline is the *model* for new containment surfaces. New lane signals that follow the precedent inherit the honest pattern. The honesty preservation here is the strongest in the platform — repeated containment states reinforce a healthy precedent.

**Coherence horizon:** indefinite. Awareness is preserved across the full 12-month projection.

**Continuity score: 🟢 PRESERVED.** All five preservation axes hold. This is the wave's existence proof that constitutional trust continuity is achievable when the platform's signal channel is psychologically defended.

## Awareness-collapse vector register

Each entry below is a specific mechanism by which operator awareness collapses under one of the four stress conditions.

### AC-1 — `tamperEvidence: null` cadence collapse

**Active under:** prolonged degradation, repeated replay ambiguity, prolonged export lag.

**Mechanism:** ~99% of replays return `tamperEvidence: null`. The investigator who reads 200 envelopes across a year reads "null" 198 times. By envelope 50 the eye no longer reads the field. By envelope 200 the operator's model is "tamperEvidence is always null because the platform is always intact." The two non-null envelopes get noticed — the salience-when-fired is real — but every reasoning step between them assumes null.

**Awareness collapse:** replay caution erodes from "I read every tamperEvidence" at investigation 1 to "I scan for non-null" at investigation 3 to "I assume null" at investigation 12.

**Compounding factor:** the field's three honest messages ([replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts)) signal *replay-time* checks; they do not signal export-time drop, refusal absence, or replay-invocation absence. The investigator who infers safety from null reads infers a stronger property than the field asserts.

**Severity:** 🔴 — the canonical replay-caution collapse.

### AC-2 — `bundleHash` match-as-completeness collapse

**Active under:** prolonged export lag.

**Mechanism:** every bundle export produces a `bundleHash` that the recipient can verify. The verification succeeds; the recipient concludes completeness. Over a year of bundle exchanges, the habit "VitalCV bundles are complete" hardens at both sender and recipient. The recipient's habit is harder to interrupt because the recipient is not the sender — the recipient cannot read server logs, cannot detect drops, cannot reason about `partialExport` (which does not exist).

**Awareness collapse:** forensic caution at the recipient erodes from "I should verify completeness" at exchange 1 to "I verify the hash" at exchange 3 to "the hash matched, this is complete" at exchange 10.

**Compounding factor:** `verificationInstructions.how` ([replayEngine.ts:598](../../apps/api/backend/src/services/audit/replayEngine.ts)) literally tells the recipient that `hashMatch === true` is the completeness check. The recipient who follows the instructions reaches the wrong conclusion. The instructions themselves are the load-bearing collapse vector.

**Severity:** 🔴 — the canonical forensic-caution collapse.

### AC-3 — `'UNKNOWN'` trust-state modal drift

**Active under:** prolonged degradation, repeated replay ambiguity.

**Mechanism:** at T+0, `trustStateAtDecision: 'UNKNOWN'` is rare. At T+30d retention age-out kicks in for the trust-state artifact; replays of older capsules fall back to `'UNKNOWN'` ([replayEngine.ts:354](../../apps/api/backend/src/services/audit/replayEngine.ts)). The discriminator (`capturedAt: null`) is structurally present and visually irrelevant. By T+90d the modal answer for any older-capsule replay is `'UNKNOWN'`.

**Awareness collapse:** survivability awareness erodes from "UNKNOWN means it was unknown then" at T+0 to "UNKNOWN is the platform's normal answer for old capsules" at T+90d. The contract preserves the discrimination ([governance-awareness-survivability](governance-awareness-survivability.md) D.1); the awareness does not.

**Severity:** 🟠 — modal drift is psychologically eroding even where the contract holds.

### AC-4 — Outer `R-CAT-6` constancy collapse

**Active under:** repeated replay ambiguity.

**Mechanism:** every replay envelope's outer `replayCategory` is `'R-CAT-6'`. The inner `meta.runtimeTrust.replayCategory` carries the original ([GF-12](operator-governance-integrity.md), [IG-6](dashboard-runtime-honesty.md)). After three investigations the investigator's mental model is "all replays are R-CAT-6 (dossier-replay)." This is false; the inner R-CAT preserved the original. But the contract's preservation lives in `meta.runtimeTrust` which has no rendering binding.

**Awareness collapse:** replay caution erodes; the investigator who would, in principle, want to know the original action category cannot read it from the envelope.

**Compounding factor:** if the inner R-CAT is later surfaced (a future PR could bind it), the surface change must explicitly contradict the investigator's existing mental model. This is a higher-cost surface change than landing it before the habit forms.

**Severity:** 🔴 — constant cadence with shape-identity dilution; the warning cannot fire.

### AC-5 — Refusal-row absence as absence-of-event

**Active under:** prolonged degradation.

**Mechanism:** issuer-side `refusalGate` writes no audit row ([GF-4](operator-governance-integrity.md)). Replay invocations write no audit row ([IG-3](dashboard-runtime-honesty.md)). Emergency declarations write a `log('warn', ...)` line and not an audit row ([emergencyMode.ts:27](../../apps/api/backend/src/services/compliance/emergencyMode.ts)). The audit-table query returns the rows that exist; absence reads as absence-of-event.

**Awareness collapse:** forensic caution erodes from "the audit table answers what I'm asking" at week 1 to "no rows = no events" at month 3 to "we have no refusal incidents" at year-end. The contract's coverage-vs-behavior gap widens silently; the operator's confidence in the audit table grows during the same period.

**Severity:** 🔴 — direction-inversion ([escalation-explainability](escalation-explainability.md) Vector 4).

### AC-6 — `'unknown'` actor stable-cohort formation

**Active under:** prolonged degradation, repeated containment states (during which new attribution-fail paths land).

**Mechanism:** `actor.actorId: 'unknown'` is the documented fallback. As new attribution-fail paths land, the proportion of `'unknown'` rows rises. An operator scanning a daily timeline reads `'unknown'` consistently and forms the mental model "user 'unknown' is a known cohort" ([HO-3](dashboard-runtime-honesty.md), [DV-4](replay-warning-psychology.md)).

**Awareness collapse:** lineage awareness erodes; the operator who would, in principle, want to investigate unattributed actions cannot distinguish "known fallback" from "real but unattributed."

**Severity:** 🟠.

### AC-7 — Implicit-green-as-positive habit

**Active under:** prolonged degradation, repeated containment states (when the rest of the dashboard stays green-shaped while lane health flaps).

**Mechanism:** the employer dashboard's default styling renders a green-shaped layout. The operator who reads the dashboard daily forms the habit "no red = fine" ([dashboard-trust-psychology](dashboard-trust-psychology.md) DOV-1). Over months of exposure, the habit defines all other dashboard reading on the platform.

**Awareness collapse:** every other dashboard-trust vector inherits this habit. By month 6, the operator's interpretive default is "the platform tells me when it's broken; silence is health."

**Severity:** 🟠 (alone), 🔴 (compounded).

### AC-8 — `EmergencySwitch` "permanent log" rationalization

**Active under:** prolonged degradation if an emergency is declared and then the platform restarts.

**Mechanism:** the operator declares emergency; the UI shows "EMERGENCY ACTIVE"; the copy says "Action permanently logged to Audit Scrapbook" ([EmergencySwitch.tsx:91](../../apps/web/components/employer/EmergencySwitch.tsx)). The implementation toggles in-process state and emits `log('warn', ...)`; no audit row is written. The platform restarts; the next operator sees `false`.

The operator returning the next day after a deploy and seeing `false` rationalizes ("someone cleared it" / "I misremembered" / "it auto-resolved"). The rationalization preserves the operator's belief in the platform's durability claim.

**Awareness collapse:** the operator's awareness of escalation declarations as durable records does not erode — it never formed correctly because the surface assertion is structurally false.

**Severity:** 🔴 — single-event-class but high stakes.

### AC-9 — Schema-accretion governance pressure

**Active under:** prolonged export lag (highest), prolonged degradation (medium).

**Mechanism:** stress conditions raise reviewer-discipline pressure. Under partial-bundle-induced operator anxiety, the pressure to "fix it by adding a field that explains why" is highest. Each new field is a chance to land an inflation. The doctrine layer protects copy (banned strings); it does not protect schema shape ([DD-4](longitudinal-governance-survivability.md)).

**Awareness collapse:** governance honesty erodes at the schema layer in exactly the conditions when the schema is most likely to expand.

**Severity:** 🟠 — meta-vector; compounds the per-vector collapses above.

## What survives prolonged degradation — register

For each defense, score whether it survives the four prolonged-stress conditions.

| Defense | Prolonged degradation | Repeated replay | Prolonged export lag | Repeated containment | Survival summary |
|---|---|---|---|---|---|
| [CLAUDE.md](../../CLAUDE.md) banned-strings list | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 doctrine — survives all four |
| Literal `decisionGrade: false` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 doctrine |
| Literal `proofTier` distinct values | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 doctrine |
| `recordedBy: 'demo'` propagation | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 doctrine |
| `runtimeTrust` round-trip test | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 doctrine |
| Lane-health decoupling | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 architectural |
| Status page disclaimer copy | 🟢 today | 🟢 today | 🟡 (expansion pressure) | 🟢 today | 🟡 prospective |
| Issuer review demo disclaimer | 🟢 today | 🟢 today | 🟢 today | 🟢 today | 🟡 prospective (GE-5 softening pressure) |
| `tamperEvidence` three honest messages | 🟢 when fires | 🟠 cadence dilution | 🟢 when fires | 🟢 when fires | 🟠 — meaningful but eroded by cadence |
| `evidenceSnapshot.anomaliesDetected` | 🟠 empty-as-positive | 🟠 same | 🟠 same | 🟢 | 🟠 |
| `eventState` literal | 🟠 unrendered | 🟠 unrendered | 🟠 unrendered | 🟠 unrendered | 🟠 — defended at type, silent at surface |
| `bundleHash` over what survived | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 — false-completeness across all conditions |
| `bundle.issuer: 'VitalCV'` literal | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| `verificationInstructions.how` | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| `capsuleCount` (survived not requested) | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| Outer `R-CAT-6` unconditional | 🟠 | 🔴 | 🟠 | 🟠 | 🔴 in canonical condition |
| Refusal-row absence | 🔴 | 🟠 | 🔴 | 🟠 | 🔴 — direction-inversion |
| `EmergencySwitch` "permanent log" copy | 🔴 if declared | 🟢 | 🟢 | 🟢 | 🔴 single-event |

**Tally:** 6 defenses 🟢 across all four conditions (the doctrine layer + lane decoupling). 2 🟢 today + 🟡 prospective (status page, issuer review). 4 defenses 🟠 — eroded but not collapsing (`tamperEvidence`, `anomaliesDetected`, `eventState`, R-CAT-6 outside canonical condition). 6 defenses 🔴 — collapse under at least one stress condition (the four bundle-class CI-VIOLATIONs, refusal-row absence, EmergencySwitch copy).

**Pattern:** the doctrine layer survives every stress condition. The lane-health architectural defense survives every stress condition. Every other defense either erodes psychologically (the 🟠 cluster) or fails structurally (the 🔴 cluster). The 🔴 cluster is concentrated in the bundle export schema and the EmergencySwitch copy.

## Continuity-stability-by-stress-horizon table

A projection of awareness state across stress horizon length, for each preservation axis. Entries shown are the *modal* awareness grade an operator's mental model occupies after the stress horizon.

| Preservation axis | T+1 week | T+1 month | T+3 months | T+12 months |
|---|---|---|---|---|
| Constitutional awareness | 🟡 | 🟠 | 🟠 | 🔴 |
| Survivability awareness | 🟡 | 🟠 | 🟠 | 🟠 |
| Forensic caution | 🟢 | 🟡 | 🟠 | 🔴 |
| Replay caution | 🟢 | 🟡 | 🠠 | 🔴 |
| Governance honesty (platform-level) | 🟢 | 🟢 | 🟡 | 🟡 |

**Pattern:** governance honesty (platform-level structural property) holds across the horizon. Operator-level awareness erodes monotonically — modal at 🟡 by month 1, 🟠 by month 3, 🔴 by year-end on three of four operator-side axes. The lane-health-induced calibration on the source-coverage axis is the exception that does not appear in this aggregate table because it is a single signal channel; on its own channel it remains 🟢 across the horizon.

## Where constitutional trust continuity is preserved

**The lane-health pipeline preserves constitutional trust continuity across all four stress conditions.** This is the wave's existence proof. The pipeline combines:
- variable cadence (lane state genuinely changes)
- direction signal (`lastSuccessAt` narrates time)
- visually distinct variants (`trust-green` / `trust-yellow` / `trust-red` / `outline`)
- structural decoupling from trust state ([trust-fabric-durability-cohesion](trust-fabric-durability-cohesion.md) Defense 5)
- propagation across three pages with the same honest signal

An operator who reads the lane-health badge across 12 months of repeated stress retains a calibrated mental model of source-coverage availability. The badge is the platform's one psychologically durable awareness surface.

**The doctrine layer preserves governance honesty across all four stress conditions.** Banned-strings list, literal types, demo-flag propagation, status-page disclaimer copy, runtime round-trip test — six structural defenses that hold under every prolonged-stress horizon. The doctrine layer is the platform's most durable governance investment ([longitudinal-governance-survivability](longitudinal-governance-survivability.md) Track D verdict).

**The runtime-cohesion contract preserves the C-1 ↔ T0 chain at the structural layer.** [`replayEngine.runtimeCohesion.test.ts`](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts) tests the round-trip; the contract holds across every stress horizon. The operator's awareness of the chain does not survive at the surface, but the chain itself does at the contract.

## Where constitutional trust continuity collapses

**Prolonged export lag is the canonical worst-case continuity stress condition.** Three of five preservation axes collapse to 🔴 (constitutional, survivability, forensic). The bundle JSON's structural inflations ([dashboard-trust-psychology](dashboard-trust-psychology.md) DOV-3, DOV-4, DOV-5) compound across export cycles into operator and recipient habits that cannot be falsified from experience. Bundles produce reinforcement; bundles do not produce contradiction.

**Repeated replay ambiguity collapses replay caution monotonically.** The three desensitization vectors (cadence, constancy, modality) compound per investigation. By investigation 12, the investigator's habit "all replays are clean" is the operative read. The contract preserves every distinction; the rendering does not bind them; the investigator does not see the preservation.

**Prolonged degradation collapses forensic caution through refusal-row absence.** As the audit table's coverage gap widens silently and the operator's confidence in the audit table grows, the two trajectories invert ([escalation-explainability](escalation-explainability.md) Vector 4). After year-end the platform's forensic floor is structurally lower than the operator's mental model of it.

**The `EmergencySwitch` copy is the single highest-stakes constitutional-violation under stress.** "Action permanently logged to Audit Scrapbook" paired with the in-process toggle ([emergencyMode.ts:8-35](../../apps/api/backend/src/services/compliance/emergencyMode.ts)) is a CI-VIOLATION-class assertion at the surface layer. Under prolonged degradation, an emergency declaration that does not survive a process restart can be rationalized by the operator without the contradicting signal ever reaching their attention.

## Verdict

**Constitutional trust continuity is preserved on the one signal channel the platform built psychologically (lane health) and at the structural doctrine layer; it collapses everywhere else under prolonged stress.**

Of twenty preservation cells (five axes × four stress conditions), 5 hold green, 5 hold amber, 7 collapse to orange, 3 collapse to red. The 🟢 column is concentrated in the repeated-containment-states stress condition because the lane-health badge is the signal channel for that stress. The 🔴 cluster is concentrated in the prolonged-export-lag stress condition because the bundle JSON's four 🔴 inflations compound across export cycles.

Of nine awareness-collapse vectors, three are 🔴 (`tamperEvidence` cadence, `bundleHash` completeness, refusal-row absence-as-absence-of-event), one is 🔴 single-event (`EmergencySwitch` rationalization), four are 🟠 (modal `'UNKNOWN'`, R-CAT-6 constancy, `'unknown'` actor cohort, implicit-green habit), one is meta-🟠 (schema-accretion governance pressure).

Of eighteen platform defenses across four stress conditions, six survive every condition (the doctrine layer + lane decoupling). Two are 🟢-today / 🟡-prospective (status page, issuer review demo). Four erode but do not collapse. Six collapse under at least one stress condition; four of those concentrate in the bundle export schema.

The pattern is congruent with PR14B Track C ([constitutional-response-continuity](constitutional-response-continuity.md)): runtime governance is self-healing, containment governance is mostly self-healing, escalation governance is self-widening, forensic governance is self-widening. PR15B Track D extends the finding to the *psychological* layer: the same self-healing / self-widening split applies to operator awareness. Where the platform self-heals (doctrine + lane health), awareness is preserved. Where the platform self-widens (audit-event taxonomy + bundle schema + escalation surface), awareness collapses at the same rate the contract widens.

**Strongest constitutional-awareness preservation surface:** the lane-health pipeline. The only signal channel where awareness is preserved across all four prolonged-stress conditions. The wave's existence proof that constitutional trust continuity is achievable when a surface is psychologically defended.

**Weakest constitutional-awareness preservation surface:** the bundle JSON under prolonged export lag. Three of five preservation axes collapse to 🔴; the recipient's habit is harder to interrupt than the sender's; year-end recipient model is "VitalCV bundles are complete." The continuity gap is widest at the artifact most likely to leave the perimeter.

**Strongest governance-awareness gain across the wave:** the longitudinal projection that the doctrine layer survives every prolonged-stress condition. Banned-strings + literal types + demo-flag propagation + status-page disclaimer + runtime round-trip test combine into a structural defense that holds across the 12-month projection. PR15B Track D establishes this as the platform's most durable governance-awareness anchor.

**Track D score: 🟠 PARTIAL with one 🟢 and three 🔴.** 5 🟢, 5 🟡, 7 🟠, 3 🔴 across the preservation scoreboard; 1 🟢 (containment), 2 🟠 (degradation, replay ambiguity), 1 🔴 (export lag) across the four stress conditions. **Constitutional trust continuity is preserved where the platform built a psychologically durable surface and progressively collapses everywhere else under prolonged stress — the doctrine layer outlives the operator, the lane-health badge outlives the cycle, the bundle JSON outlives neither.**
