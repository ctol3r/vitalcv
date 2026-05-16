# Silent Fragmentation Awareness — W2-PR13B Track B

**Wave:** W2-PR13B — Operator Constitutional Failure Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [constitutional-failure-explainability](constitutional-failure-explainability.md), [stress-state-explainability](stress-state-explainability.md), [governance-collapse-survivability](governance-collapse-survivability.md).
**Builds on:** [dashboard-runtime-honesty](dashboard-runtime-honesty.md), [operator-governance-integrity](operator-governance-integrity.md), [forensic-durability-understanding](forensic-durability-understanding.md).

---

## What this track answers

Track A asked whether operators can correctly classify constitutional state under named stress conditions. **This track asks whether operators could detect that the platform is fragmenting at all — replay drift, export drift, lineage drift, survivability drift, dashboard optimism — before the fragmentation has compounded into operator habit.**

The risk vector here is not misclassification. The risk vector is **silence**: a fragmentation event for which the platform emits no operator-visible signal. Silent fragmentation does not cause an alert; it builds an unrecorded gap that surfaces only when an investigator goes looking. The investigation usually arrives months after the gap began.

Awareness has three failure modes. (1) **Hidden optimism**: the surface renders as if nothing changed when something did. (2) **False confidence**: an operator-visible signal that affirms a property the contract did not earn. (3) **Delayed detection**: the gap is detectable but only after a forensic-grade investigation that the operator has no reason to launch. This track inventories all three across the five fragmentation surfaces in the wave brief.

## Definitions

- **Silent fragmentation:** a structural divergence between two or more representations of the same conceptual entity that produces no operator-visible signal at the moment of divergence.
- **Hidden optimism vector:** a rendered shape that is correct on the happy path and silently mirrors that shape for states the contract knows are degraded. (Inherits the PR11B definition; the difference here is the focus on detectability.)
- **False confidence vector:** a rendered signal that an operator reads as a positive claim when the underlying contract did not assert that claim.
- **Delayed-detection risk:** a gap that is detectable by query or code-read but not by routine operator behavior; usually surfaces only during incident response or audit.
- **Forensic blind spot:** a gap for which no surface, no query, and no log entry exists; detectable only by reading source code or by direct observation of the absence.
- **Drift signal:** any operator-visible cue (timeline icon, badge state, schema field, log line, alert) that fragmentation is occurring.

## The five fragmentation surfaces

For each surface, score whether the platform emits a drift signal today.

### Surface 1 — Replay drift

**What can fragment:** the relationship between recorded fields (decision, evidence references, authority chain at decision time) and replay-time computed fields (`integrity.recomputedHash`, `replayedAt`, `evidenceSnapshot.sourcesConsulted`, `replayMetadata`).

**How drift accumulates:** each call to `replayDecision` re-derives a portion of the envelope from the *current* state of artifact rows. If a `TRUST_STATE_ENGINE` row has been re-computed since the original decision, the replay envelope contains the new chain in the same shape it would contain the original. There is no per-field provenance marker.

**Drift signals today:** none. The envelope's shape is identical regardless of how much of it is replay-derived.

**Hidden optimism:** the envelope reads as a snapshot of the decision moment.

**False confidence:** the literal `replayedAt` timestamp is present, which an operator may misread as "this is when we re-played" rather than as the discriminator for which fields are computed-now vs recorded-then.

**Delayed-detection risk:** detectable by a forensic reader who knows to compare per-field timestamps against the original decision timestamp; not detectable by a routine bundle export consumer.

**Forensic blind spot:** the authority chain when an artifact row has moved between decision time and replay time ([FI-5](dashboard-runtime-honesty.md)).

**Severity:** 🟠 DRIFT-PRONE — paired with [GF-2](operator-governance-integrity.md), [FI-4](dashboard-runtime-honesty.md).

### Surface 2 — Export drift

**What can fragment:** `requestedCount` (the operator-asked-for window) vs `capsuleCount` (the operator-received slice). The two are separate quantities; the bundle reports only the second.

**How drift accumulates:** `buildAuditBundle` is best-effort. Per-capsule replay errors are caught + logged + dropped at [replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts). `capsuleCount` reflects what survived the loop, not what the loop started with. Each successful "complete" bundle export reinforces "bundles are complete," and each silent drop is invisible to the recipient.

**Drift signals today:** none in the bundle. Server logs record dropped IDs (operator must read logs to detect); recipient has no log access.

**Hidden optimism:** the bundle's shape — `bundleHash`, `verificationInstructions`, `custodyLog` — implies completeness ([HO-2](dashboard-runtime-honesty.md), [HO-5](dashboard-runtime-honesty.md)).

**False confidence:** `verificationInstructions.how` says "verify integrity.hashMatch === true." A reader who follows the instruction and gets `true` concludes the bundle is verified, which it is — over what survived.

**Delayed-detection risk:** detectable by cross-referencing the bundle's capsule IDs against the operator's audit-query for the same window. Almost no operator does this.

**Forensic blind spot:** the gap between requested and received, when the request log is not preserved alongside the bundle.

**Severity:** 🔴 MISLEADING — paired with [GF-3](operator-governance-integrity.md), [FI-2](dashboard-runtime-honesty.md). **The canonical highest-impact silent-fragmentation surface.**

### Surface 3 — Lineage drift

**What can fragment:** C-1 (durable checkpoint) vs T0 (originating mutation) vs replay-time chain. Each is a structurally distinct lineage class. Operator copy uses the single word "lineage" for all three.

**How drift accumulates:** `buildRuntimeMutationMetadata` ([runtimeTrustCohesion.ts:143-190](../../apps/api/backend/src/services/runtimeTrustCohesion.ts)) stamps `correlationId`, `payloadHash`, `mutationFingerprint` deterministically. The runtime cohesion test ([replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts)) verifies these flow verbatim through capsule metadata into `replayDecision`. The contract preserves the distinction; the operator surface does not.

**Drift signals today:** none. The word "lineage" appears in copy without C-1/T0 disambiguation. Three retries (same `mutationFingerprint`) render as three rows.

**Hidden optimism:** every lineage rendering reads as "the chain back to the originating event," when it could be the C-1 chain, the T0 chain, or a replay-time re-derivation.

**False confidence:** the deterministic `correlationId` makes a lineage trace feel reproducible — and it is, *for the chain it computed*. Operators infer "this is the only chain."

**Delayed-detection risk:** detectable by reading `meta.runtimeTrust.mutationClassification` and `meta.runtimeTrust.replayCategory` directly. No surface exposes these.

**Forensic blind spot:** the originating action's `R-CAT` for any replay envelope (every replay envelope is `R-CAT-6` outer; inner R-CAT lives in `meta.runtimeTrust`).

**Severity:** 🟡 PARTIAL — paired with [GF-11](operator-governance-integrity.md), [GF-12](operator-governance-integrity.md), [IG-6](dashboard-runtime-honesty.md).

### Surface 4 — Survivability drift

**What can fragment:** the survivability class (`observable` / `durable` / `transactional`) of any audit row. The literal `eventState` (`pending_not_written` / `persisted` / `failed`) discriminates them in code; no surface exposes the discriminator.

**How drift accumulates:** every audit-table row renders identically regardless of `eventState`. A `pending_not_written` row that never lands looks identical to a `persisted` row in the timeline. Operators reading the timeline ten times in a row form the habit "rows in the timeline are durable." When a row that never landed is queried for an incident response, the gap surfaces — usually weeks after the row was written.

**Drift signals today:** none at the row level. Bundle export does not declare survivability of source rows.

**Hidden optimism:** every row reads as durable ([HO-1](dashboard-runtime-honesty.md)).

**False confidence:** timestamp presence reads as "the row landed at this time" rather than "the row was emitted at this time."

**Delayed-detection risk:** detectable only by direct query against the audit store with `eventState` filter. The operator does not know to add the filter because the field is invisible at the surface.

**Forensic blind spot:** any row that emitted but never landed (`pending_not_written` indefinite). The row exists in the operator's mental timeline; it does not exist in storage.

**Severity:** 🟠 DRIFT-PRONE — paired with [GF-8](operator-governance-integrity.md), [HO-1](dashboard-runtime-honesty.md), [IG-2](dashboard-runtime-honesty.md). **The single highest-leverage gap for survivability honesty** ([trust-fabric-durability-cohesion.md](trust-fabric-durability-cohesion.md) Gap 1).

### Surface 5 — Dashboard optimism

**What can fragment:** the relationship between dashboard rendering (lane health, `/status` page, employer dashboard, passport pages) and underlying constitutional state. Most dashboard surfaces today render based on the happy-path shape with no off-happy-path branch.

**How drift accumulates:** the implicit-guarantee pattern. A dashboard that emits a green badge by default reads as a positive health claim. The absence of a warning reads as "no warning was needed." Repeated viewing forms the habit "green = healthy."

**Drift signals today:** lane-health badge transitions to `CHECKING` / `BLOCKED` honestly. No other dashboard surface has a degraded-state transition.

**Hidden optimism:** the `/status` page reads as comprehensive uptime by category convention, even when the audit ↔ export seam has known structural inflations ([HO-7](dashboard-runtime-honesty.md)).

**False confidence:** the `/status` page now wires compliance evidence shape (DOCS-STATUS-1, commit 5d530f13). A green compliance badge reads as "compliance is intact" — true at the literal layer, prospectively risky if green can render over a degraded survivability layer.

**Delayed-detection risk:** detectable by cross-referencing `/status` against runtime cohesion data. No operator does this routinely.

**Forensic blind spot:** any divergence between dashboard claim and runtime truth that does not flow through the lane-health pipe.

**Severity:** 🟠 DRIFT-PRONE — paired with [HO-7](dashboard-runtime-honesty.md), Track B verdict in [dashboard-runtime-honesty](dashboard-runtime-honesty.md).

## Hidden-optimism inventory (consolidated)

Each entry is a rendered shape that is correct on the happy path and silently mirrors that shape for degraded states.

| HO# | Shape | Surface | Severity |
|---|---|---|---|
| HO-A | Audit timeline row implies durable storage | timeline | 🟠 |
| HO-B | `bundleHash` + `verificationInstructions` imply completeness | bundle JSON | 🔴 |
| HO-C | `actorId: 'unknown'` rendered as a real actor | timeline | 🟠 |
| HO-D | `trustStateAtDecision: 'UNKNOWN'` reads as recorded fact | replay envelope | 🟠 (worsening with retention age) |
| HO-E | `custodyLog` named as a chain of custody | bundle JSON | 🟡 |
| HO-F | Issuer review surface reads as authoritative | issuer/review surfaces | 🟢 today, ⚠️ prospective |
| HO-G | `/status` page reads as comprehensive uptime | `/status` | 🟡 |
| HO-H | `R-CAT-6` envelope reads as dossier replay every time | replay envelope | 🟠 |
| HO-I | Replay envelope `verifierIdentity.type: 'SYSTEM'` reads as VitalCV's automated path | replay envelope | 🟠 |

**Tally:** 2 🔴/🟠 cluster + 4 🟠 + 2 🟡 + 1 🟢-prospective.

## False-confidence inventory

Each entry is an operator-visible signal that affirms a property the contract did not earn.

| FC# | Signal | What operator infers | What contract holds | Severity |
|---|---|---|---|---|
| FC-1 | `verificationInstructions.how === "verify integrity.hashMatch === true"` | bundle is offline-verifiable | hash-only, transport-trusted | 🔴 |
| FC-2 | `bundle.issuer: 'VitalCV'` | cryptographic provenance from VitalCV | string literal, no signature | 🔴 |
| FC-3 | Audit timeline row timestamp | row landed at this time | row was emitted at this time | 🟠 |
| FC-4 | `replayedAt` timestamp present | this is the only marker that distinguishes recorded from computed | not used as a per-field provenance | 🟠 |
| FC-5 | `correlationId` present and reproducible | this is the only chain back to T0 | one of three structurally distinct chains | 🟠 |
| FC-6 | `/status` page green | full platform health | one slice of platform health (compliance evidence) | 🟡 |
| FC-7 | `tamperEvidence` field absent | no tampering, no completeness gap | no in-transit tampering only; completeness is separate | 🟠 |

**Tally:** 2 🔴, 4 🟠, 1 🟡.

## Delayed-detection inventory

Each entry is a fragmentation that *is* detectable, but only by code-read, log-read, or forensic-grade query — not by routine operator behavior.

| DD# | Gap | Detection requires | Severity |
|---|---|---|---|
| DD-1 | Dropped capsules in bundle | server-log read of [replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts) drop messages | 🔴 |
| DD-2 | `pending_not_written` rows in window | direct DB query with `eventState` filter | 🟠 |
| DD-3 | Authority chain re-derived at replay time | per-field timestamp comparison against decision timestamp | 🟠 |
| DD-4 | Inner R-CAT-1…5 inside outer R-CAT-6 envelope | read `meta.runtimeTrust.replayCategory` directly | 🟠 |
| DD-5 | Trust-band cause (recorded vs replay-fallback) | check `evidenceSnapshot.trustStateAtDecision.capturedAt: null` | 🟠 |
| DD-6 | Retry collapse (3 retries, 1 fingerprint) | group-by `mutationFingerprint` (no surface does this) | 🟠 |
| DD-7 | Denial reason inside `EMPLOYER_REVIEW_MUTATION_DENIED` | read `event.payload.reason` (no type-level subtype) | 🟠 |

**Tally:** 1 🔴, 6 🟠.

## Forensic blind spot inventory

Each entry is a gap for which no surface, no query, and no log entry exists.

| FBS# | Gap | Why blind | Severity |
|---|---|---|---|
| FBS-1 | Issuer-side refusal events (six refusals can fire with zero rows) | `refusalGate` returns from [policyReview.ts](../../apps/web/lib/issuer-verification/policyReview.ts); no audit row | 🔴 |
| FBS-2 | Replay invocation events (replay is on-demand, no row) | no `REPLAY_INVOKED` event type | 🟠 |
| FBS-3 | Bundle export request log not preserved alongside bundle | request log lives in HTTP-level traces; bundle does not embed | 🔴 |
| FBS-4 | Capsule-write deferral events (transition pending → persisted) | `eventState` literal exists; no transition event | 🟠 |
| FBS-5 | Source-coverage flap → trust-band recompute (when uncoupled) | flap is in lane-health; trust-band recompute is a separate pipe | 🟡 |

**Tally:** 2 🔴, 2 🟠, 1 🟡.

## Cross-surface fragmentation scoreboard

| Fragmentation surface | Hidden optimism | False confidence | Delayed detection | Forensic blind spot | Score |
|---|---|---|---|---|---|
| Replay drift | HO-D, HO-H, HO-I | FC-4 | DD-3, DD-4, DD-5 | — | 🟠 |
| Export drift | HO-B, HO-E | FC-1, FC-2 | DD-1 | FBS-3 | 🔴 |
| Lineage drift | — | FC-5 | DD-4, DD-6 | — | 🟡 |
| Survivability drift | HO-A | FC-3 | DD-2 | FBS-4 | 🟠 |
| Dashboard optimism | HO-F (prospective), HO-G | FC-6 | — | — | 🟠 |
| Refusal-row absence | (no shape — pure absence) | (none) | (impossible without row) | FBS-1 | 🔴 |
| Replay-row absence | (none) | (none) | (impossible without row) | FBS-2 | 🟠 |

**Pattern:** the two 🔴 rows are export drift and refusal-row absence. Both are CI-VIOLATION class (Track A). Both are characterized by the absence of a defending field or row, not by a present-and-incorrect rendering.

## Where silent fragmentation awareness holds

**The lane-health pipe is the platform's only fully-instrumented fragmentation signal.** Source-coverage drift transitions the badge to `CHECKING` / `BLOCKED`. The drift produces a signal at the moment it begins. No other fragmentation surface has this property.

**The truth-contract layer holds against silent fragmentation by literal type enforcement.** A `ReceiptCandidate` cannot silently become a `PSVReceipt` because the type system contradicts the assignment. The literal `decisionGrade: false` cannot silently widen because [CLAUDE.md](../../CLAUDE.md) bans the inflation strings that would render it. Doctrine-layer fragmentation is structurally prevented.

**The runtime-cohesion contract holds against silent fragmentation by round-trip test.** [replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts) verifies `correlationId / payloadHash / mutationFingerprint` survive `buildRuntimeMutationMetadata` → capsule metadata → `replayDecision` verbatim. C-1 and T0 reconcile. Lineage drift in the surface is not lineage drift in the contract.

## Where silent fragmentation awareness holds worst

**Refusal-row absence (FBS-1) is the platform's deepest silent-fragmentation surface** because it is invisible *by construction*. Six issuer-side refusals can fire and the audit table contains zero rows. Operator querying the table is correct; the table's coverage is not what they assume; no log entry exists to retrieve. Detectable only by reading [policyReview.ts](../../apps/web/lib/issuer-verification/policyReview.ts) and noting the `refusalGate` path does not write.

**Export drift is the platform's highest-volume silent-fragmentation surface** because it produces an artifact whose shape strongly implies the gap does not exist. The bundle leaves the perimeter, the recipient has no surface to detect the gap, and the gap is reinforced by every successful "complete" export.

## Verdict

**Silent fragmentation awareness is structurally absent across four of five fragmentation surfaces.** The lane-health pipe is the existence proof that fragmentation can be signaled at the moment it begins; no other surface inherits the pattern.

The 🔴 cluster is two surfaces (export drift, refusal-row absence) and falls into the CI-VIOLATION class. The 🟠 cluster is three surfaces (replay drift, survivability drift, dashboard optimism) and falls into CI-DRIFT and CI-FRAGMENTED. The 🟡 cluster is one surface (lineage drift) where the contract is robust, the round-trip is tested, and the surface is silent.

The cross-cutting pattern: **the platform records honestly and signals nothing.** Drift, fragmentation, and degradation produce no operator-visible cue at the moment they occur. Detection requires forensic-grade investigation that is launched after a downstream consequence has surfaced — typically months after the gap began.

**Strongest fragmentation-awareness surface:** the lane-health pipe. Honest at the moment of degradation, decoupled from trust state, propagated to three primary user-facing pages.

**Weakest fragmentation-awareness surface:** refusal-row absence (FBS-1). No surface, no query, no log entry. The platform's deepest forensic blind spot.

**Biggest silent-fragmentation risk:** export drift compounded by refusal-row absence. The artifact most likely to leave the platform implies completeness; the events that would contradict that completeness are not rowed.

**Track B score: 🟠 DRIFT-PRONE.** Two 🔴 surfaces, three 🟠 surfaces, one 🟡 surface, one 🟢 surface (lane health). **Silent fragmentation awareness is sharp at the one rendered defense and absent everywhere else — drift accumulates into operator habit before any signal fires.**
