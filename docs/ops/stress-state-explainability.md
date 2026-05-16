# Stress-State Explainability — W2-PR13B Track C

**Wave:** W2-PR13B — Operator Constitutional Failure Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [constitutional-failure-explainability](constitutional-failure-explainability.md), [silent-fragmentation-awareness](silent-fragmentation-awareness.md), [governance-collapse-survivability](governance-collapse-survivability.md).
**Builds on:** [dashboard-runtime-honesty](dashboard-runtime-honesty.md), [operator-governance-integrity](operator-governance-integrity.md), [forensic-durability-understanding](forensic-durability-understanding.md), [forensic-explainability](forensic-explainability.md).

---

## What this track answers

Tracks A and B asked whether operators can classify and detect constitutional state. **This track asks whether — once the platform enters a degraded constitutional state — that state remains explainable, operationally coherent, survivable, and runtime-honest as the degradation cascades, replay collapses, exports fragment, or forensic evidence degrades.**

The risk vector here is not first-mile operator confusion. The risk vector is **last-mile coherence**: does a 30-minute degradation produce a state an operator can describe, narrate to a stakeholder, hand off to incident response, or write up in a post-incident retrospective? Or does the platform exit the stress event in a state where the description, the timeline, and the artifacts disagree?

Stress-state explainability has four sub-properties:

- **Explainable:** an operator can give a one-sentence description of the state without source-code knowledge.
- **Operationally coherent:** two operators reading the same state arrive at the same description.
- **Survivable:** the state is recoverable — the platform either returns to CI-HEALTHY or holds the degradation honestly without creating a new CI-VIOLATION.
- **Runtime-honest:** the rendered surface and the contract layer agree on what the state is. (The Track A property under Track B's no-silence pressure.)

This track scores each across four cascading stress scenarios.

## Definitions

- **Cascading degradation:** a stress event in which two or more independent subsystems degrade in sequence, each amplifying the explainability cost of the next.
- **Replay collapse:** a stress event in which the replay envelope cannot be reconstructed cleanly — recorded fields conflict with replay-time computed fields, or the inner action category cannot be recovered.
- **Export fragmentation:** a stress event in which a bundle export completes successfully but represents a strict subset of the requested window.
- **Forensic degradation:** a stress event in which the platform's forensic floor (audit table coverage, refusal rows, replay rows) admits a gap that an investigator would discover only after launching a forensic-grade query.
- **Coherence horizon:** the time window after a stress event during which two operators reading the state would describe it identically. Long horizon = high coherence; short horizon = description drifts as time passes.

## Scenario 1 — Cascading degradation

**Stress timeline (30 minutes):**
- T+00: source-coverage lane begins flapping. Lane-health badge transitions to `CHECKING`.
- T+05: issuer endpoint slows. Two issuer-side refusals fire (no audit rows; FBS-1).
- T+10: capsule writes begin deferring. Three rows enter `pending_not_written` (no surface signal; HO-1).
- T+15: an operator runs `replayDecision` on a recently-written capsule. The trust-state artifact has aged out; envelope returns `trustStateAtDecision: 'UNKNOWN'` with `capturedAt: null` (replay-time fallback; HO-4).
- T+20: an operator triggers `buildAuditBundle` for the last 24 hours. Two per-capsule replays drop silently ([replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts)). Bundle returns 48 of 50 capsules; `capsuleCount: 48`; no `partialExport` flag.
- T+25: the operator hands the bundle to compliance for a routine quarterly review.
- T+30: source-coverage recovers. Lane-health badge returns to green.

**Explainability scoring:**

| Sub-property | Score | Rationale |
|---|---|---|
| Explainable | 🟠 | The operator can describe lane-health degradation; cannot describe deferred capsules, dropped bundle entries, or absent refusal rows from any surface |
| Operationally coherent | 🟠 | Two operators reading the lane-health badge agree; two operators reading the bundle disagree on whether it is complete |
| Survivable | 🟡 | Source coverage recovers; deferred rows may or may not land; bundle has already been handed to compliance with a complete-shape claim |
| Runtime-honest | 🔴 | The rendered green status page shows comprehensive uptime; the bundle JSON shows complete capsule list; the contract knows three rows pending, two capsules dropped, two refusals not rowed |

**Coherence horizon:** ~24 hours. After the deferred rows transition or fail to transition, the operator description and the contract diverge permanently. After 30 days (typical retention age for trust-state artifacts), the trust-band cause becomes structurally indistinguishable.

**Cascading-degradation score: 🟠 CONFUSING.** The explainability cost of each new degradation compounds because no surface ties them together. An operator who notices lane health does not get a signal that issuer refusals fired; an operator who triggers the bundle does not get a signal that capsules dropped. The cascade is invisible at the surface even when it is visible at the contract.

## Scenario 2 — Replay collapse

**Stress timeline:**
- An investigator replays a capsule from 60 days ago for an external inquiry.
- The originating action was `TRUST_ACCEPTANCE` (`R-CAT-1`).
- Three retries fired at decision time (same `mutationFingerprint`, three correlation IDs).
- The trust-state artifact has aged out; replay-time fallback returns `'UNKNOWN'`.
- An artifact row was re-computed 14 days after the original decision; the authority chain in the replay envelope reflects the new chain.
- The replay envelope's outer category is unconditionally `R-CAT-6`.

**Explainability scoring:**

| Sub-property | Score | Rationale |
|---|---|---|
| Explainable | 🟠 | The investigator can describe the envelope; cannot distinguish recorded vs replay-computed fields, inner vs outer R-CAT, recorded vs fallback trust band, original vs re-derived chain |
| Operationally coherent | 🟠 | Two investigators reading the same envelope reach different conclusions about what the platform "had" at decision time |
| Survivable | 🟡 | The envelope contains all the information needed to disambiguate; the disambiguation is buried in `meta.runtimeTrust`, `capturedAt`, and `replayedAt` — present but not surfaced |
| Runtime-honest | 🟠 | Contract layer is honest; the envelope's flat shape inflates each ambiguity into a confident-looking field |

**Coherence horizon:** indefinite under stable artifact rows; days under any artifact mutation.

**Replay-collapse score: 🟠 CONFUSING.** The envelope contains every honest discriminator (`capturedAt: null`, `replayedAt`, inner `meta.runtimeTrust.replayCategory`, `mutationFingerprint`) and surfaces none of them. An investigator reading the envelope without source-code knowledge cannot reconstruct what was decision-time vs replay-time. The contract is non-collapsing; the surface presentation collapses every distinction.

The single defensive surface that holds: `tamperEvidence` distinguishes hash mismatch, evidence-spine mismatch, and generic replay failure ([replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts)). This is the one signal that survives replay collapse without inflation.

## Scenario 3 — Export fragmentation

**Stress timeline:**
- An operator requests `buildAuditBundle` for a 30-day regulatory window.
- The window contains 1,200 capsules.
- Five capsules error during per-capsule replay (silent drop).
- Twelve capsules are `pending_not_written` at the moment of bundle construction (eventState invisible; not included).
- Eight non-capsule events (issuer refusals, monitoring events) are in the window but excluded from the bundle (FA-3, FI-1).
- Bundle returns: `capsuleCount: 1195`, `bundleHash` consistent over what survived, `verificationInstructions.how` directing the recipient to verify hash.

**Explainability scoring:**

| Sub-property | Score | Rationale |
|---|---|---|
| Explainable | 🔴 | Operator cannot describe what the bundle includes vs excludes from any field in the bundle; explanation requires reading source-side logs and the audit table |
| Operationally coherent | 🔴 | Operator A says "1,200 capsules"; Operator B says "1,195 capsules"; recipient says "1,195 verified capsules"; all three are right at different scopes; none are reconcilable from the bundle alone |
| Survivable | 🟠 | The bundle is what it is; the operator cannot retract it once handed to the regulator |
| Runtime-honest | 🔴 | The bundle's shape implies a stronger property (1,200 = N requested, complete, signed) than the contract holds (1,195 = what survived, internally consistent, transport-trusted) |

**Coherence horizon:** zero. The fragmentation is invisible at T+0 and remains invisible forever.

**Export-fragmentation score: 🔴 MISLEADING.** This is the canonical worst-case stress-state explainability scenario. The bundle leaves VitalCV's perimeter immediately and represents itself as complete to a recipient who has no way to detect the gap. The operator who handed it over has no way to detect the gap either, except by cross-referencing against an audit query they have no reason to run.

## Scenario 4 — Forensic degradation

**Stress timeline:**
- An incident is declared 6 weeks after the originating events.
- An investigator queries the audit table for the window.
- Six issuer-side refusals occurred in the window; zero rows exist (FBS-1).
- Two replay invocations were performed by an oncall during the original incident; zero rows exist (FBS-2).
- Three audit rows from the window are `pending_not_written` (HO-1, IG-2); they appear in the timeline if rendered, do not appear if filtered.
- Eight retries (`EMPLOYER_REVIEW_MUTATION_DENIED`) collapsed under one event type with three distinct denial reasons in payload (GF-9).

**Explainability scoring:**

| Sub-property | Score | Rationale |
|---|---|---|
| Explainable | 🔴 | Investigator concludes from the table query "no refusals occurred, no replays occurred" — both are wrong, both are unrecoverable from the table |
| Operationally coherent | 🔴 | The investigator's narrative and the platform's actual behavior diverge; the divergence is not detectable without code-read |
| Survivable | 🔴 | The events have already aged past most recoverable signal sources (HTTP traces, server logs); the investigation has to proceed on incomplete evidence |
| Runtime-honest | 🔴 | The audit table is honest about what it contains; the audit table does not represent its own coverage; the investigator infers coverage from the table's existence |

**Coherence horizon:** decreases with retention age. At 30 days, log-level recovery is plausible. At 90 days, log retention may have ended. At 1 year, code-read is the only path.

**Forensic-degradation score: 🔴 MISLEADING.** The platform's forensic floor admits structural gaps that an investigator discovers only by reading source code. The forensic-degradation scenario is the existence proof that absence-of-row is the platform's most consequential silent failure mode.

## Cross-scenario stress scoreboard

| Scenario | Explainable | Operationally coherent | Survivable | Runtime-honest | Score |
|---|---|---|---|---|---|
| Cascading degradation | 🟠 | 🟠 | 🟡 | 🔴 | 🟠 |
| Replay collapse | 🟠 | 🟠 | 🟡 | 🟠 | 🟠 |
| Export fragmentation | 🔴 | 🔴 | 🟠 | 🔴 | 🔴 |
| Forensic degradation | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |

**Pattern:** the two 🔴 scenarios (export fragmentation, forensic degradation) are both characterized by the *artifact* of the stress event leaving the platform's perimeter (a bundle handed to a regulator, a forensic query handed to an investigator) without carrying the discriminators that would let the recipient detect the gap. The two 🟠 scenarios (cascading degradation, replay collapse) keep the artifact internal where source-code-grade contributors can reconstruct the truth.

## Stress-property failure modes (consolidated)

### Explainability failures

| ID | Failure | Where | Severity |
|---|---|---|---|
| EX-1 | Bundle shape does not declare what it includes vs excludes | bundle JSON | 🔴 |
| EX-2 | Audit table query "no rows" reads as "no events" | audit-table query path | 🔴 |
| EX-3 | Replay envelope flat shape collapses recorded vs computed | replay envelope JSON | 🟠 |
| EX-4 | Lane-health degradation does not link to other subsystem degradations | lane-health badge | 🟠 |
| EX-5 | Cascading degradation has no operator-facing aggregator | (no surface) | 🟠 |

### Coherence failures

| ID | Failure | Where | Severity |
|---|---|---|---|
| CO-1 | Two readers of bundle disagree on completeness | bundle JSON | 🔴 |
| CO-2 | Two readers of replay envelope disagree on decision-time vs replay-time | replay envelope | 🟠 |
| CO-3 | Two readers of `'UNKNOWN'` trust band disagree on cause | replay envelope | 🟠 |
| CO-4 | Two readers of `actorId: 'unknown'` disagree on whether it is a user | timeline | 🟠 |
| CO-5 | Two readers of `R-CAT-6` envelope disagree on action category | replay envelope | 🟠 |

### Survivability failures

| ID | Failure | Where | Severity |
|---|---|---|---|
| SU-1 | Forensic degradation past log retention is unrecoverable | audit table + logs | 🔴 |
| SU-2 | Bundle handed to regulator cannot be retracted | bundle export | 🟠 |
| SU-3 | `pending_not_written` rows may transition or may not | audit store | 🟠 |
| SU-4 | Trust-state artifact aging removes recorded-vs-fallback discriminator | replay envelope | 🟠 |

### Runtime-honesty failures

| ID | Failure | Where | Severity |
|---|---|---|---|
| RH-1 | Bundle implies completeness; contract holds best-effort | bundle JSON | 🔴 |
| RH-2 | `/status` page implies platform health; covers compliance evidence slice only | `/status` | 🟡 |
| RH-3 | Audit table implies event coverage; covers only rowed events | audit table | 🔴 |
| RH-4 | Replay envelope implies decision-time snapshot; mixes provenance | replay envelope | 🟠 |
| RH-5 | Dashboards imply happy path; do not transition under most degraded states | most dashboards | 🟠 |

**Cross-cutting:** explainability fails most at the bundle and audit-table layers. Coherence fails most at the replay-envelope layer. Survivability fails most under aging conditions. Runtime-honesty fails most where the structural shape implies more than the contract earned.

## Where stress-state explainability holds

**The lane-health pipe holds explainability under stress.** Source-coverage degradation produces a `CHECKING` or `BLOCKED` badge in real time. Two operators reading the badge agree. The badge's degraded state does not mirror the happy-path styling. Source coverage recovers, badge returns to green. The pipe is the wave's only stress-coherent surface.

**The runtime-cohesion contract holds explainability under stress.** [replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts) verifies that under mutation, retry, and replay, `correlationId / payloadHash / mutationFingerprint` flow verbatim. A contributor with source access can always reconstruct C-1 ↔ T0 ↔ replay coherence. Stress does not collapse the contract.

**The truth-contract layer holds explainability under stress.** Banned strings, literal types, demo gates do not weaken under any stress condition in the inventory. Doctrine is the only layer that survives every degradation mode at full strength.

**The `tamperEvidence` field holds explainability under replay stress.** The three-message specificity (hash mismatch / evidence-spine mismatch / generic failure) at [replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts) gives a degraded replay envelope a structured failure shape that an operator can describe.

## Where stress-state explainability holds worst

**Export fragmentation is the worst-case stress-state surface.** The bundle leaves the perimeter immediately, the recipient has no way to detect the gap, the operator has no way to detect the gap, and zero of four explainability sub-properties pass.

**Forensic degradation is the worst-case longitudinal stress surface.** The forensic floor admits gaps invisible to query-based investigation. The investigator's conclusions diverge from the platform's actual behavior, and the divergence widens with retention age.

## Verdict

**Stress-state explainability is sharp at the contract and one-rendered-defense layer, partial at the structural layer, and absent at the artifact layer.** The platform survives stress events at the contract — every distinction the operator needs to reconstruct the state is present in code. The platform does not survive stress events at the artifact — the bundle, the replay envelope, and the audit table query all flatten the contract's discriminators into a single confident-looking shape.

The four scenarios yield two 🔴 (export fragmentation, forensic degradation) and two 🟠 (cascading degradation, replay collapse). The 🔴 scenarios share a property: the artifact of the stress event leaves VitalCV's perimeter and the recipient has no defending field. The 🟠 scenarios share the inverse property: the artifact stays internal and a source-aware contributor can reconstruct the truth.

The cross-cutting pattern: **the contract is stress-coherent, the surface is stress-flat, the artifact is stress-inflated.** Operators describing a stress event from the artifact alone produce confident descriptions that diverge from what the contract knows.

**Strongest stress-coherent surface:** the lane-health pipe. The only rendered surface that produces a real-time degradation signal, holds two-reader agreement under stress, and recovers without leaving an inflated trail.

**Weakest stress-coherent surface:** export fragmentation. Zero of four explainability sub-properties pass. The bundle's shape inflates every dimension of the gap.

**Track C score: 🟠 CONFUSING.** Two 🔴 scenarios, two 🟠 scenarios, multiple stress-property failures concentrated in the bundle and audit-table layers. **Stress-state explainability is contract-coherent, surface-flat, and artifact-inflated — the operator's description of a stress event diverges from the contract's truth in proportion to how far the artifact has traveled from the platform.**
