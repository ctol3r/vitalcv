# Escalation Explainability — W2-PR14B Track B

**Wave:** W2-PR14B — Operator Constitutional Response Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [containment-explainability](containment-explainability.md), [constitutional-response-continuity](constitutional-response-continuity.md), [governance-response-survivability](governance-response-survivability.md).
**Builds on:** [silent-fragmentation-awareness](silent-fragmentation-awareness.md), [stress-state-explainability](stress-state-explainability.md), [governance-collapse-survivability](governance-collapse-survivability.md), [governance-awareness-survivability](governance-awareness-survivability.md), [dashboard-runtime-honesty](dashboard-runtime-honesty.md), [forensic-explainability](forensic-explainability.md), [forensic-durability-understanding](forensic-durability-understanding.md).

---

## What this track answers

Track A scored whether operators can correctly classify a single containment state. **This track scores whether operators can correctly read the *direction* — whether a state is escalating, holding, or recovering — across the five named escalation vectors in the wave brief: replay, export, lineage, forensic, and dashboard/runtime divergence.**

The risk vector here is not state misclassification. The risk vector is **direction blindness**: an operator who sees a state but cannot read whether it is *getting worse*. Escalation explainability is the operator's ability to read the rate of change of containment, not just its current value.

Five direction-blindness failure modes:
- **Escalation confusion:** the operator can read the current state but not the trajectory.
- **Containment ambiguity:** two reasonable readers disagree on whether the state is bounded or compounding.
- **Hidden operator assumptions:** an operator infers stability from absence-of-signal where the absence does not assert stability.
- **False safety assumptions:** an operator infers a contained state from a control they think is wired up that is not, or from an artifact they think will retain after process restart that does not.
- **Direction inversion:** an operator reads an escalating state as recovering (e.g., a green badge after a flap that masked a deferred row that has not landed).

## Definitions

- **Escalation:** the compounding of two or more stressors over time, where the second stressor amplifies the explainability or response cost of the first.
- **Vector:** one of the five named subsystems whose escalation an operator must read separately (replay, export, lineage, forensic, dashboard/runtime divergence).
- **Direction signal:** any operator-visible cue (rate-of-change badge, time-since-last-success, count of pending rows, retry-attempt counter) that a state is escalating or recovering.
- **Containment boundary:** the structural property the platform asserts that, if held, the escalation does not cross into a CT-VIOLATION (see [containment-explainability](containment-explainability.md)).
- **Hidden operator assumption:** a default inference an operator makes that the surface neither confirms nor refutes.

## Per-vector escalation scoreboard

For each vector, score whether operators can correctly read direction.

### Vector 1 — Replay escalation

**What can escalate:** a single capsule's replay drift (recorded vs replay-time computed fields share envelope; outer R-CAT-6 masks inner action) compounds across multiple capsules during a forensic investigation. The investigator runs replay on capsule A, capsule B, capsule C in sequence; each envelope re-derives part of itself from the *current* state of artifact rows. As trust-state artifacts age out, replay drift compounds invisibly across the investigation's window ([silent-fragmentation-awareness](silent-fragmentation-awareness.md) Surface 1).

**Direction signal today:** none. The envelope's shape is identical regardless of how much of it is replay-derived. `replayedAt` is rendered, but it does not function as a provenance discriminator; an operator reads it as "this is when we re-played" rather than as "fields after this timestamp are computed-now, not recorded-then."

**Hidden operator assumption:** the envelope is a snapshot of the decision moment.

**False safety assumption:** running replay on three capsules in sequence does not amplify drift. (It does — every replay re-derives from the *current* state.)

**Direction-inversion risk:** an investigator reading three replay envelopes that all return clean `tamperEvidence: null` ([replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts)) infers cross-capsule continuity. The contract holds within each replay, not across replays.

**Replay escalation score: 🟠 CONFUSING.** The current state of one replay is readable; the trajectory across replays is invisible. Compounds with PR12B's [governance-awareness-survivability](governance-awareness-survivability.md) D.2 partial-recompute finding.

### Vector 2 — Export escalation

**What can escalate:** `buildAuditBundle` is best-effort. Per-capsule replay errors are caught, logged, dropped ([replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts)). Each successful "complete" bundle export reinforces the operator habit "bundles are complete." Each silent drop is invisible to the recipient. As bundles compound (one per quarterly review, three per regulator inquiry), the inflated habit hardens before any defending signal fires.

**Direction signal today:** none in the bundle. Server logs record dropped IDs; recipient has no log access; operator does not routinely read logs after a bundle export. `capsuleCount` is rendered as the slice that survived, never as a delta against `requestedCount` (which is not in the schema).

**Hidden operator assumption:** the bundle's hash, custodyLog, and verificationInstructions imply completeness ([HO-2](dashboard-runtime-honesty.md), [HO-5](dashboard-runtime-honesty.md), [GF-15](operator-governance-integrity.md)).

**False safety assumption:** a `bundleHash` matching on re-verification means the bundle is what was requested. (It means the bundle is internally consistent over what survived the loop. PR13B [forensic-explainability](forensic-explainability.md) #1 registered this as a forensic ambiguity.)

**Direction-inversion risk:** a bundle that drops two capsules looks identical to a bundle that drops zero. An operator who handed out three bundles in a quarter cannot read whether the drop rate is rising.

**Export escalation score: 🔴 MISLEADING.** The structural shape inflates; no direction signal exists; recipient cannot verify; PR11B's #1 🔴 inflation is unchanged. This is the densest false-safety vector in the platform.

### Vector 3 — Lineage escalation

**What can escalate:** the relationship between recorded actor / authority chain at decision time and the actor / authority chain re-derived at replay time. As `actorId: 'unknown'` rows accumulate in the audit table (silent fallback when attribution is missing), the operator's habit "actorId stable across rows" hardens ([HO-3](dashboard-runtime-honesty.md), [GF-6](operator-governance-integrity.md)). As authority-chain artifacts move between decision and replay, replays of older capsules compound drift ([FI-5](dashboard-runtime-honesty.md)).

**Direction signal today:** partial. PR12B [governance-awareness-survivability](governance-awareness-survivability.md) D.1 noted that authorityChain is pinned to enums (NPPES, STATE_BOARD) so renames do not break lineage; but human-readable labels in `SOURCE_LABELS` are live, so a relabel retroactively re-labels old chains. Two operators reading the same chain at T+0 and T+30d see different labels for the same enum.

**Hidden operator assumption:** lineage labels are decision-time facts.

**False safety assumption:** "we can attribute every action because every row has an `actorId`." The literal `'unknown'` fallback satisfies the schema without satisfying the assumption.

**Direction-inversion risk:** an investigator reading a row with `actorId: 'unknown'` may infer "this is a known-system action" if the surface renders `'unknown'` consistently across system rows. (The fallback is silent; the rendering does not distinguish.)

**Lineage escalation score: 🟠 CONFUSING.** Enum pinning is a real defense; label drift compounds it. The escalating direction is invisible because the surface re-labels retroactively.

### Vector 4 — Forensic escalation

**What can escalate:** the gap between the audit table's actual coverage and an investigator's assumed coverage. Issuer-side `refusalGate` writes no audit row ([GF-4](operator-governance-integrity.md)); replay invocations write no audit row ([IG-3](dashboard-runtime-honesty.md)); the `EmergencySwitch` declaration writes no audit row ([emergencyMode.ts:23-35](../../apps/api/backend/src/services/compliance/emergencyMode.ts)) — only a `log('warn', ...)` line. As more refusal/replay/declaration events fire, the gap widens silently. An investigator at T+60d running a forensic-grade query "all refusals across all surfaces" returns the employer-side denials only; the issuer-side refusals are not in the result set, and the absence is indistinguishable from "no refusals fired."

**Direction signal today:** none. The audit table's *absence* is the gap; absence does not have a rendered direction.

**Hidden operator assumption:** "the audit table answers the question I am asking." This is the single most consequential assumption in the platform's forensic posture and the one with the lowest defending signal.

**False safety assumption:** a clean replay across the audit window means no refusals fired. (No — it means none of the refusals that are rowed fired.)

**Direction-inversion risk:** as new event-emitting paths land without audit-row plumbing (a future refusal type, a new replay path, a new escalation control), the forensic gap *grows* during the same period the operator's confidence in the audit table *grows*. The two trajectories invert.

**Forensic escalation score: 🔴 MISLEADING.** The gap is structural, the signal is absent, the trajectory is inverted, and the recovery is gated on adding event types and rows that do not exist today. The cluster compounds with [forensic-durability-understanding](forensic-durability-understanding.md) FBS-1 (refusal floor) and [forensic-explainability](forensic-explainability.md) #2 (two refusal vocabularies, no bridge).

### Vector 5 — Dashboard / runtime divergence escalation

**What can escalate:** the gap between what the dashboard renders and what the runtime contract holds. The lane-health badge and section render the source-coverage state honestly; nothing else on the dashboard reads `eventState`, `mutationFingerprint`, `correlationId`, the readonly flag, or the runtimeTrust block ([runtime-honesty-continuity](runtime-honesty-continuity.md) Track C row "Runtime honesty / Dashboards"). As operators repeat the read pattern "if no red badge, the state is fine," the dashboard-vs-runtime gap compounds — operator behavior anchors on the surface, not the contract.

**Direction signal today:** the lane-health badge is the one direction signal that fires. `lastSuccessAt` is rendered as a relative timestamp ([LaneHealthBadge.tsx:43-56](../../apps/web/components/source-health/LaneHealthBadge.tsx)). An operator reading "5m ago" can infer freshness. Outside the lane-health pipeline, no surface renders direction.

**Hidden operator assumption:** the dashboard is the contract.

**False safety assumption:** a green status page certifies replay reproduces, bundles round-trip, audit matches dashboard. (It does not — `/status` exposes per-surface foundation state, not these properties; [integrity-state-explainability](integrity-state-explainability.md) CI-GREEN row.)

**Direction-inversion risk:** during a cascade (lane flap + capsule defer + replay age-out) the surface returns to green when the lane recovers, but the deferred capsule may still be `pending_not_written` and the replay drift has compounded. The dashboard reads as recovering; the runtime is permanently degraded against the affected window.

**Dashboard/runtime divergence escalation score: 🟠 CONFUSING (with one 🟢 island).** The lane-health pipeline is the only direction signal; the rest of the dashboard is unwired. The cascade scenario produces direction inversion at the moment of recovery.

## Cross-vector escalation matrix

How direction-blindness across the five vectors compounds. Each cell scores whether two vectors compounding produce a state operators can read.

|  | Replay | Export | Lineage | Forensic | Dashboard/runtime |
|---|---|---|---|---|---|
| **Replay** | — | 🔴 (replay drift fed into bundle inherits drift) | 🟠 (replay re-derives lineage; label drift compounds) | 🔴 (replay invocations absent from audit) | 🟠 (replay envelope rendered as JSON, no surface separation) |
| **Export** | 🔴 | — | 🟠 (bundle's audit-row coverage inherits lineage gap) | 🔴 (bundle rendered as authoritative; refusal floor zero) | 🔴 (bundle output is a rendered surface that inflates; no dashboard distinguishes) |
| **Lineage** | 🟠 | 🟠 | — | 🟠 (audit row uses lineage labels live-rendered) | 🟠 (dashboard inherits label drift) |
| **Forensic** | 🔴 | 🔴 | 🟠 | — | 🔴 (no surface reads `eventState`; non-capsule events absent from bundle and dashboard) |
| **Dashboard/runtime** | 🟠 | 🔴 | 🟠 | 🔴 | — |

**Pattern:** export and forensic are the two vectors whose escalation interacts most damagingly with every other vector. Replay-into-export is the single most operationally consequential pair (a drifted replay embedded in an inflated bundle handed to a regulator). Lineage is the one vector where compounding is uniformly 🟠 — drift-prone but never inverting.

## Hidden operator assumptions register

The seven default inferences operators are most likely to make that the platform does not confirm:

| # | Assumption | Why operators make it | What contradicts it |
|---|---|---|---|
| HOA-1 | "If the dashboard is green, the platform is green." | absence-of-warning reads as positive | [integrity-state-explainability](integrity-state-explainability.md) CI-GREEN; PR14B Track A CT-GREEN |
| HOA-2 | "A bundle export with `bundleHash` is complete." | structural fields imply completeness | [GF-3](operator-governance-integrity.md), [HO-2](dashboard-runtime-honesty.md), [forensic-durability-understanding](forensic-durability-understanding.md) "Was the bundle complete?" row |
| HOA-3 | "A replay envelope is a snapshot of the decision moment." | shape is identical regardless of provenance | [silent-fragmentation-awareness](silent-fragmentation-awareness.md) Surface 1 |
| HOA-4 | "Every action has an audit row." | schema's existence implies coverage | [GF-4](operator-governance-integrity.md), [forensic-explainability](forensic-explainability.md) refusal floor; PR14B Track A CT-ESCALATING row on emergency declaration |
| HOA-5 | "If `actorId` is present, attribution is real." | literal value present satisfies schema; `'unknown'` fallback is silent | [GF-6](operator-governance-integrity.md), [HO-3](dashboard-runtime-honesty.md) |
| HOA-6 | "Process restart preserves declared escalation state." | `EmergencySwitch` is a guarded, confirmation-gated control | [emergencyMode.ts:7-9](../../apps/api/backend/src/services/compliance/emergencyMode.ts) — in-process global toggle, not persisted |
| HOA-7 | "A green lane after a flap means the affected window recovered." | lane health is the most defended surface | deferred capsule writes may still be `pending_not_written`; replay drift compounds during the flap window |

HOA-1, HOA-2, HOA-4, HOA-6 are the four highest-impact hidden assumptions because they each underwrite an operator action that crosses a perimeter (regulator handoff, escalation declaration, audit response). HOA-2 and HOA-4 each compound with three or more vectors above.

## False-safety register

The five places an operator most likely concludes "we are safe" from a signal that does not assert safety:

| # | Surface | Read | What it does not assert |
|---|---|---|---|
| FS-1 | `bundleHash` matches on re-verification | "the bundle is what was requested" | the bundle is internally consistent over what survived |
| FS-2 | `tamperEvidence: null` across three replays | "cross-capsule lineage is continuous" | each replay is internally consistent; cross-replay continuity is not asserted |
| FS-3 | "no red lanes" on `/status` | "every subsystem is contained" | absence-of-warning, not positive evidence of cohesion |
| FS-4 | `emergencyModeActive: true` after declaration | "escalation state is durable across processes" | in-process boolean; not persisted |
| FS-5 | A clean audit replay across a window | "no refusals or replays fired" | only the rowed events are visible; refusal and replay floors are zero |

## Risks and what is not in scope here

- This track does not propose direction signals. PR15B and forward will be the implementation lanes.
- The 🟢 island in Vector 5 (lane-health badge `lastSuccessAt`) is the model for what a direction signal looks like; the rest of the platform does not yet inherit the pattern.
- The cross-vector matrix's 🔴 cluster on (Export, Forensic) reflects unchanged structural gaps from PR11B. PR14B locates them in escalation-direction space; it does not soften them.
- The HOA register and the FS register are normative inventories; they will be exercised in PR14B Track C (continuity under cascade) and Track D (survivability of awareness during the cascade).

---

*See also: [containment-explainability](containment-explainability.md) for the per-state classification analysis. [constitutional-response-continuity](constitutional-response-continuity.md) for whether escalation visibility holds across cascades. [governance-response-survivability](governance-response-survivability.md) for whether the visibility itself survives degradation.*
