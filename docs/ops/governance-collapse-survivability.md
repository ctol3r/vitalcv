# Governance Collapse Survivability — W2-PR13B Track D

**Wave:** W2-PR13B — Operator Constitutional Failure Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [constitutional-failure-explainability](constitutional-failure-explainability.md), [silent-fragmentation-awareness](silent-fragmentation-awareness.md), [stress-state-explainability](stress-state-explainability.md).
**Builds on:** [operator-governance-integrity](operator-governance-integrity.md), [dashboard-runtime-honesty](dashboard-runtime-honesty.md), [forensic-durability-understanding](forensic-durability-understanding.md), [forensic-explainability](forensic-explainability.md), [survivability-explainability](survivability-explainability.md).

---

## What this track answers

Tracks A–C asked whether operators can classify, detect, and describe stress states. **This track asks whether — under escalation — the platform's governance, integrity, forensic awareness, and survivability honesty *survive*. Whether the properties that hold under steady state continue to hold when the platform is mid-breach, mid-fragmentation, or mid-degraded-runtime, or whether they collapse precisely when operators need them most.**

The risk vector here is **collapse-at-scale**: a property that is robust under one stressor but fails when two stressors compound. A doctrine layer that holds against a single trust-class misuse but not against a constitutional-breach escalation. A surface that signals a single source-coverage flap but not a cascading degradation. A forensic floor that suffices for a single audit but not for a cross-window investigation.

Governance collapse survivability has four sub-properties, each scored under three escalation modes:

- **Governance visibility:** the operator can see what governance properties the platform is currently honoring.
- **Integrity awareness:** the operator can see what integrity properties the platform is currently degrading.
- **Forensic awareness:** the operator can reconstruct what happened during the escalation.
- **Survivability honesty:** the platform represents what survived the escalation accurately.

## Definitions

- **Constitutional breach escalation:** a sequence in which a single CI-VIOLATION compounds into multiple CI-VIOLATIONs, or a CI-DRIFT hardens into a CI-VIOLATION over time.
- **Fragmentation escalation:** a sequence in which a single fragmentation surface (replay drift, export drift) compounds with another (lineage drift, survivability drift).
- **Degraded-runtime escalation:** a sequence in which the platform's runtime conditions (source coverage, issuer availability, capsule write throughput) degrade in tandem with operator pressure (incident response, regulatory inquiry, audit window).
- **Doctrine layer:** banned strings, literal types, demo gates, the truth contract.
- **Structural layer:** schemas, event types, envelope shapes, artifact formats.
- **Surface layer:** dashboards, badges, timeline rows, status pages, bundle JSON.
- **Operator-runbook layer:** the docs an operator reads to act on a state.

## Escalation 1 — Constitutional breach escalation

**Sequence:**
- T+0: a single CI-VIOLATION fires (operator hands a bundle to compliance; bundle dropped two capsules silently).
- T+7d: the same operator triggers another bundle for a different window (drops three capsules silently). The habit "bundles are complete" hardens.
- T+30d: a contributor introduces a banned-strings copy change in a marketing surface ([CLAUDE.md](../../CLAUDE.md) ban triggered).
- T+45d: a regulator opens an inquiry on the first bundle.
- T+60d: an investigator runs `replayDecision` on a capsule from the first bundle's window; trust-state artifact has aged out (HO-4 fires).

**Survivability scoring:**

| Sub-property | Score | Rationale |
|---|---|---|
| Governance visibility | 🟢 | Doctrine layer holds; banned-strings catch the marketing copy change at the wave; literal `decisionGrade: false` cannot widen |
| Integrity awareness | 🔴 | Operator has no visibility into the bundle drops at T+0 or T+7d; contract layer is honest, surface is silent |
| Forensic awareness | 🔴 | Investigation at T+60d reconstructs from logs (if retained) and code-read; trust-band cause is structurally indistinguishable post-aging |
| Survivability honesty | 🟠 | The platform records honestly; the artifact does not represent what survived; the inquiry proceeds on inflated artifact |

**Doctrine survives. Structure does not. Surface does not. Operator runbook does not exist.**

**Escalation 1 score: 🟠 PARTIAL SURVIVABILITY.** The doctrine layer is the wave's strongest survival surface — it holds against arbitrary contributor turnover and arbitrary copy regressions because the literal types and banned-strings are load-bearing. The structural and surface layers do not survive even one CI-VIOLATION; the second compounds the operator habit before any defending signal fires.

## Escalation 2 — Fragmentation escalation

**Sequence:**
- T+0: replay drift fires on a single capsule (recorded vs replay-computed fields share envelope; investigator misreads).
- T+1d: the same investigator pulls a second replay envelope for a related capsule. Outer R-CAT-6 envelope masks inner R-CAT-1 (lineage drift compounds with replay drift).
- T+2d: the investigator runs an audit query for the window. Three retries collapse under one event type; one denial type carries three distinct reasons in payload.
- T+5d: the investigator triggers a bundle export for the window. Two capsules drop silently.
- T+7d: the investigator's report describes a coherent narrative drawn from incoherent sources.

**Survivability scoring:**

| Sub-property | Score | Rationale |
|---|---|---|
| Governance visibility | 🟢 | Doctrine layer holds; trust classes preserve their distinctness throughout |
| Integrity awareness | 🔴 | Investigator cannot detect any of the four fragmentation surfaces from the artifacts; report inherits the inflation |
| Forensic awareness | 🔴 | The investigator's narrative is internally coherent and externally divergent from the contract |
| Survivability honesty | 🔴 | Every artifact (replay envelope, audit query, bundle) implies a stronger property than the contract holds |

**Escalation 2 score: 🔴 COLLAPSE.** This is the canonical worst-case governance-survivability scenario. The doctrine layer holds — but doctrine alone does not give the investigator the discriminators they need. Each of the four fragmentation surfaces produces an inflated artifact, and the investigator's report compounds the inflation into a confident-and-wrong narrative. Governance does not survive a four-surface fragmentation escalation because the platform has no aggregator that links the four together.

## Escalation 3 — Degraded-runtime escalation

**Sequence:**
- T+0: source-coverage lane begins flapping. Lane-health badge transitions to `CHECKING`.
- T+10m: issuer endpoint slows. Two issuer-side refusals fire (no rows; FBS-1).
- T+20m: capsule writes defer. Three rows enter `pending_not_written` (no surface signal).
- T+30m: an oncall is paged. Oncall reads the lane-health badge (the only honest signal) and reports "source coverage degraded; no other observable issue."
- T+45m: oncall runs `replayDecision` to verify a recent capsule. Trust-state fallback fires; oncall does not notice the `capturedAt: null` discriminator.
- T+60m: oncall declares the incident resolved when the lane-health badge returns to green.
- T+24h: a stakeholder asks "did anything else happen during the incident?" Oncall queries the audit table. Zero refusal rows. Zero replay rows. Three audit rows that may or may not have landed. Oncall replies "no other events."

**Survivability scoring:**

| Sub-property | Score | Rationale |
|---|---|---|
| Governance visibility | 🟡 | Lane-health badge holds; nothing else degrades visibly; oncall reads partial truth as full truth |
| Integrity awareness | 🔴 | Capsule deferral, issuer refusal, replay invocation — all invisible during and after the incident |
| Forensic awareness | 🔴 | Post-incident retrospective inherits the gap; the platform's record of the incident is the lane-health timeline only |
| Survivability honesty | 🟠 | Lane-health honestly survives; the rest of the platform's runtime state honestly survives in *contract*; the artifact does not |

**Escalation 3 score: 🟠 PARTIAL SURVIVABILITY.** The lane-health pipe is the only rendered surface that survives a degraded-runtime escalation honestly. The platform exits the incident with a clean badge and a contradicted contract — the contract knows three pending rows, two refusals, one fallback replay; no operator surface knows. The post-incident retrospective is structurally underrepresentative.

## Cross-escalation governance-survival scoreboard

| Escalation | Governance visibility | Integrity awareness | Forensic awareness | Survivability honesty | Score |
|---|---|---|---|---|---|
| Constitutional breach escalation | 🟢 | 🔴 | 🔴 | 🟠 | 🟠 |
| Fragmentation escalation | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 |
| Degraded-runtime escalation | 🟡 | 🔴 | 🔴 | 🟠 | 🟠 |

**Pattern:** governance visibility holds (doctrine layer is robust). Integrity awareness collapses under every escalation (no surface signals the gaps). Forensic awareness collapses under every escalation (the gaps are invisible at query time). Survivability honesty is partial under two escalations (artifact-inflation problem) and collapses under the third (full fragmentation cascade).

## Layer-by-layer survivability matrix

The four governance layers from [operator-governance-integrity](operator-governance-integrity.md), scored under each escalation.

| Layer | Constitutional breach | Fragmentation | Degraded runtime | Cross-escalation |
|---|---|---|---|---|
| Doctrine (banned strings, literal types, demo gates) | 🟢 | 🟢 | 🟢 | 🟢 |
| Structural (schemas, event types, envelope shapes) | 🔴 | 🔴 | 🟠 | 🔴 |
| Surface (dashboards, badges, timelines, status, bundle JSON) | 🔴 | 🔴 | 🟠 (lane-health holds) | 🔴 |
| Operator runbook (incident response, bundle export, `'unknown'` triage) | 🔴 (absent) | 🔴 (absent) | 🔴 (absent) | 🔴 |

**Pattern:** doctrine survives every escalation at full strength. Structure survives only the partial-degradation escalation. Surface survives only via the lane-health pipe. Operator runbook does not exist for any escalation.

## Governance-collapse failure modes (consolidated)

### GC-1 — Doctrine survives by literal-type enforcement

**What survives:** banned strings, literal `decisionGrade: false`, distinct `proofTier` literals, five-gate `accept_candidate` sequence, `recordedBy: 'demo'` end-to-end propagation.

**What does not need to:** doctrine is structurally enforced by the type system; it does not depend on operator habit, surface rendering, or runtime conditions.

**Severity:** 🟢 SURVIVES — paired with [GF-1](operator-governance-integrity.md), [trust-fabric-durability-cohesion.md](trust-fabric-durability-cohesion.md) Doctrine layer.

### GC-2 — Structural integrity collapses under inflation

**What does not survive:** bundle schema (no `requestedCount`, no `partialExport`, no `droppedIds`, no detached signature), event-type taxonomy (no `REFUSAL_RECORDED`, no `REPLAY_INVOKED`, no denial-reason subtypes), replay envelope provenance (no per-field `recordedAt` / `replayedAt` separator).

**Why:** structural fields are added at design time and changing them requires schema migration, not behavior change. The structural layer is the longest-lever defense — and it has the most missing fields.

**Severity:** 🔴 COLLAPSES — paired with [GF-3](operator-governance-integrity.md), [GF-4](operator-governance-integrity.md), [GF-2](operator-governance-integrity.md), [GF-9](operator-governance-integrity.md), [GF-10](operator-governance-integrity.md), [GF-15](operator-governance-integrity.md).

### GC-3 — Surface integrity survives only via lane-health pipe

**What survives:** [LaneHealthBadge.tsx](../../apps/web/components/source-health/LaneHealthBadge.tsx) + [LaneHealthMount.tsx](../../apps/web/components/source-health/LaneHealthMount.tsx) propagated to employer dashboard, passport (entity), passport (root). Honest under degradation. Decoupled from trust state.

**What does not survive:** every other rendered surface. Bundle JSON, replay envelope, audit timeline, `/status` page, employer dashboard non-lane fields, passport non-lane fields, issuer review (demo-flagged today, prospectively at risk).

**Severity:** 🟠 PARTIAL — one surface holds, the rest are silent.

### GC-4 — Operator runbook does not exist

**What does not survive:** there is no operator-facing runbook for incident response, bundle export to a regulator, `'unknown'` actor triage, `'UNKNOWN'` trust-band investigation, `pending_not_written` reconciliation, replay-envelope provenance separation, or denial-reason disambiguation.

**Why:** the *internal* docs corpus (forensic-explainability, survivability-explainability, forensic-durability-understanding, runtime-durability-continuity, trust-fabric-durability-cohesion, this PR13B set) describes the platform's off-happy-path behavior in detail. The *operator-facing* runbook layer is structurally absent. New operators inheriting the platform have no path to the off-happy-path knowledge except code-read.

**Severity:** 🔴 ABSENT — the largest single survivability gap by leverage. Adding even one runbook (incident response) would carry the most value of any single change in this wave.

### GC-5 — Cross-layer aggregation does not exist

**What does not survive:** the platform has no surface that links lane-health degradation to issuer refusals to capsule deferrals to bundle drops to replay invocations. Each subsystem signals independently (or does not signal at all). Operators cannot read a single surface that aggregates "everything degraded during the window."

**Why:** the lane-health pipe is the only signaled surface. Other degradations either do not signal or signal only in code/log. No aggregator binds them.

**Severity:** 🟠 ABSENT — paired with stress-state-explainability EX-5.

### GC-6 — Forensic floor admits structural gaps

**What does not survive:** issuer-side refusals (FBS-1) and replay invocations (FBS-2) write no audit rows. The forensic floor is "what was rowed," and the platform's policy is to row most decisional events but not refusals or replays. Investigators querying the table for "what happened" infer coverage from existence.

**Severity:** 🔴 STRUCTURAL — paired with [GF-4](operator-governance-integrity.md), FBS-1, FBS-2.

## Where governance-collapse survivability holds

**The doctrine layer is the platform's strongest governance survival surface.** Banned strings, literal types, demo gates, and the five-gate `accept_candidate` sequence survive every escalation in the inventory at full strength. A contributor who tries to relax the literal `decisionGrade: false` to `boolean` is contradicted by the type system before the change reaches review. A contributor who tries to introduce a banned string is contradicted by [CLAUDE.md](../../CLAUDE.md) before the change reaches merge. A demo render that softens its disclaimer is contradicted by `recordedBy: 'demo'` propagation through every downstream artifact.

The doctrine layer is the wave's clearest example of multi-layered defense: type system + banned strings + propagated demo flags + gated promotion = a property that does not depend on operator habit, surface rendering, or runtime conditions.

**The runtime-cohesion contract is the platform's second-strongest governance survival surface.** [replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts) verifies that under any stress condition, `correlationId / payloadHash / mutationFingerprint` survive `buildRuntimeMutationMetadata` → capsule metadata → `replayDecision` verbatim. C-1 ↔ T0 ↔ replay coherence is contract-tested. A contributor cannot break it without breaking the test.

**The lane-health pipe is the platform's only stress-coherent rendered surface.** Source-coverage degradation produces a real-time `CHECKING` / `BLOCKED` signal. The signal does not silently mirror the happy-path styling under stress. Two operators agree. Recovery is honest. The pipe is the existence proof that surface-layer governance survival is achievable when the platform invests.

## Where governance-collapse survivability holds worst

**The operator-runbook layer does not exist** for any escalation in the inventory. This is the largest single survivability gap because it cannot be patched by a contract change, a schema change, or a surface change — it requires writing the runbooks. Until the runbooks exist, every new operator reads code or reads the internal docs corpus to act on a state, both of which are unstable foundations for governance because both are accessed by a small subset of the people who will read the artifacts the platform produces.

**The structural layer collapses under fragmentation escalation.** The bundle schema, event-type taxonomy, and replay envelope provenance all admit confident-and-wrong artifacts under a four-surface fragmentation cascade. The 🔴 collapse score on Escalation 2 is the canonical worst-case governance-survivability outcome.

**The forensic floor admits structural gaps that compound with retention age.** Issuer-side refusals and replay invocations are not rowed. At 30 days, log-level recovery is plausible. At 90 days, log retention may have ended. At 1 year, the only path is code-read. Governance over a 1-year-old incident is structurally underrepresentative.

## Verdict

**Governance-collapse survivability is robust at the doctrine layer, robust at the runtime-cohesion contract, partial at the surface layer (one rendered defense), and absent at the operator-runbook layer.**

The three escalation modes yield one 🔴 (fragmentation escalation) and two 🟠 (constitutional breach, degraded runtime). The 🔴 outcome is structurally driven: when four fragmentation surfaces compound, the platform's artifacts each inflate independently and the investigator's report inherits the compounded inflation. The 🟠 outcomes are partially recoverable: doctrine holds, lane-health holds, the rest is silent.

The cross-cutting pattern: **governance survives where the platform invested in multi-layer defense (doctrine), survives where the platform tested the contract (runtime cohesion), and survives where the platform built a rendered surface (lane health). Governance does not survive anywhere the platform left the literal in code, omitted the defending field from the schema, or did not write the operator runbook.**

**Strongest governance-survivability gain:** writing the operator-facing incident-response runbook. Single highest-leverage change because it carries every off-happy-path literal (`eventState`, `mutationFingerprint`, dual-cause `'UNKNOWN'`, outer-vs-inner R-CAT, refusal-row absence) into the document operators actually read during a stress event. Every other gap requires a schema or surface change; the runbook gap requires a docs change. Lowest cost, highest survival impact.

**Strongest existing governance-survivability surface:** the doctrine layer. Banned strings + literal types + demo gates + propagated flags survive every escalation in the inventory at full strength.

**Weakest existing governance-survivability surface:** the operator-runbook layer. Structurally absent across every escalation.

**Track D score: 🟠 PARTIAL SURVIVABILITY.** One 🔴 escalation (fragmentation), two 🟠 escalations (breach, runtime). Doctrine 🟢, structure 🔴, surface 🟠 (lane-health holds), runbook 🔴 (absent). **Governance survives at the layers the platform built defenses for and collapses at the layers the platform left to operator habit — adding the operator runbook is the single highest-leverage survivability gain available without a schema change.**
