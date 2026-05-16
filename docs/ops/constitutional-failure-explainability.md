# Constitutional Failure Explainability — W2-PR13B Track A

**Wave:** W2-PR13B — Operator Constitutional Failure Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [silent-fragmentation-awareness](silent-fragmentation-awareness.md), [stress-state-explainability](stress-state-explainability.md), [governance-collapse-survivability](governance-collapse-survivability.md).
**Builds on:** [operator-governance-integrity](operator-governance-integrity.md), [dashboard-runtime-honesty](dashboard-runtime-honesty.md), [forensic-durability-understanding](forensic-durability-understanding.md), [forensic-explainability](forensic-explainability.md), [survivability-explainability](survivability-explainability.md).

---

## What this track answers

PR11B Track A asked whether the operator's repeated mental model of a state stays congruent with the contract. **This track asks whether — under named constitutional stress conditions — operators, investigators, and reviewers can correctly classify what is happening to the platform's truth contract itself.**

The risk vector here is misclassification of constitutional state. An operator who reads a degraded constitution as healthy ships a bundle to a regulator. An operator who reads a healthy constitution as degraded escalates an incident that does not exist. An investigator who reads a fragmented lineage as a single chain reports false continuity. The doctrine exists ([CLAUDE.md](../../CLAUDE.md) banned strings, literal `decisionGrade: false`, distinct `proofTier` literals), but doctrine alone does not survive stress unless the surface that exposes it under stress is itself honest.

This track introduces a four-state vocabulary for constitutional integrity (CI-*) and grades whether each state is currently understandable from the surfaces an operator actually has.

## Definitions — CI-* state vocabulary

The four constitutional-integrity states an operator must distinguish during stress:

- **CI-HEALTHY** (implicit baseline): the truth contract holds, the structural layer holds, the surface layer renders the contract's literals without inflation. No CI-* label is emitted.
- **CI-DEGRADED:** the contract layer holds (literals are still correct in code), but a structural or surface property the operator depends on has weakened — e.g., audit rows are landing in `pending_not_written` state, capsule writes are deferred, source-coverage lane is flapping. *The contract is honest about the degradation; the surface may not be.*
- **CI-DRIFT:** the contract layer's literal is unchanged, but the *meaning* an operator infers from the surface has drifted away from the contract — e.g., `actorId: 'unknown'` rendered as a stable cohort, `trustStateAtDecision: 'UNKNOWN'` read as a decision-time fact when it is a replay-time fallback, `pending_not_written` invisible. *Contract is congruent; operator habit is not.*
- **CI-FRAGMENTED:** a single conceptual entity (lineage, replay, audit window, bundle) is represented by multiple structurally-distinct shapes that the surface does not separate — e.g., outer `R-CAT-6` envelope masking inner `R-CAT-1…5`, recorded vs replay-computed fields sharing one envelope, C-1 (durable checkpoint) and T0 (originating mutation) collapsed under one word "lineage." *Contract preserves the distinction; surface elides it.*
- **CI-VIOLATION:** the surface or schema produces a stronger property than the contract holds — e.g., `bundleHash` reading as completeness when it is internal consistency over what survived; `bundle.issuer: 'VitalCV'` reading as cryptographic provenance when it is a string literal; `verificationInstructions.how` reading as offline re-verification when it is hash-only. *The structural layer asserts something the contract did not earn.*

CI-DEGRADED is recoverable by a contributor reading code; the contract still tells the truth. CI-DRIFT is recoverable only by changing the surface or the operator's training; the literal cannot. CI-FRAGMENTED is recoverable by binding the missing distinction in a renderer. CI-VIOLATION is recoverable only by removing the schema field, adding a defending field (e.g., `partialExport`, `requestedCount`, detached signature), or rewriting the copy.

These four states are not new failure modes — they are a four-way classifier over the inventory PR11B already enumerated (GF-1…12, FA-1…10, HO-1…7, IG-1…7, FI-1…6).

## CI-state ↔ existing-finding map

Each finding from PR11B mapped to its CI-* class. Severity is inherited from the source doc.

| CI class | Finding | Source | Severity |
|---|---|---|---|
| CI-DEGRADED | `pending_not_written` is the default; rows survive transition | [GF-8](operator-governance-integrity.md) / [HO-1](dashboard-runtime-honesty.md) | 🟠 |
| CI-DEGRADED | Lane-health flap during source-coverage degradation | [LaneHealthBadge.tsx](../../apps/web/components/source-health/LaneHealthBadge.tsx) | 🟢 (the one rendered defense) |
| CI-DEGRADED | Per-capsule replay error → silent drop ([replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts)) | [GF-3](operator-governance-integrity.md) / [FI-2](dashboard-runtime-honesty.md) | 🔴 |
| CI-DRIFT | `actorId: 'unknown'` rendered as stable cohort | [GF-6](operator-governance-integrity.md) / [HO-3](dashboard-runtime-honesty.md) | 🟠 |
| CI-DRIFT | `trustStateAtDecision: 'UNKNOWN'` read as decision-time fact | [GF-7](operator-governance-integrity.md) / [HO-4](dashboard-runtime-honesty.md) | 🟠 (worsening with retention age) |
| CI-DRIFT | `pending_not_written` invisible at surface | [GF-8](operator-governance-integrity.md) / [IG-2](dashboard-runtime-honesty.md) | 🟠 |
| CI-DRIFT | Retries rendered as distinct events | [GF-5](operator-governance-integrity.md) / [IG-5](dashboard-runtime-honesty.md) | 🟠 |
| CI-DRIFT | Denial reasons collapsed under one event type | [GF-9](operator-governance-integrity.md) | 🟠 |
| CI-FRAGMENTED | Outer R-CAT-6 over inner R-CAT-1…5 | [GF-12](operator-governance-integrity.md) / [IG-6](dashboard-runtime-honesty.md) | 🟠 |
| CI-FRAGMENTED | Recorded vs replay-time computed fields share envelope | [GF-2](operator-governance-integrity.md) / [FI-4](dashboard-runtime-honesty.md) | 🟠 |
| CI-FRAGMENTED | C-1 vs T0 collapsed in operator-facing copy | [GF-11](operator-governance-integrity.md) | 🟡 |
| CI-FRAGMENTED | Authority chain re-derived at replay time, no marker | [FI-5](dashboard-runtime-honesty.md) | 🟠 |
| CI-VIOLATION | `bundleHash` reads as completeness | [GF-3](operator-governance-integrity.md) / [HO-2](dashboard-runtime-honesty.md) / [FI-3](dashboard-runtime-honesty.md) | 🔴 |
| CI-VIOLATION | `verificationInstructions.how` reads as offline-verifiable | [GF-15](operator-governance-integrity.md) / inflation-register row 2 | 🔴 |
| CI-VIOLATION | `bundle.issuer: 'VitalCV'` reads as cryptographic provenance | [GF-10](operator-governance-integrity.md) | 🔴 |
| CI-VIOLATION | `capsuleCount` is survived, not requested; no `partialExport` | [GF-3](operator-governance-integrity.md) / [IG-1](dashboard-runtime-honesty.md) | 🔴 |
| CI-VIOLATION | Issuer-side refusalGate writes no audit row | [GF-4](operator-governance-integrity.md) / [IG-4](dashboard-runtime-honesty.md) | 🔴 |
| CI-VIOLATION | Replay invocations write no audit row | [GF-4](operator-governance-integrity.md) / [IG-3](dashboard-runtime-honesty.md) | 🟠 |
| CI-VIOLATION | `custodyLog` named as multi-actor chain | [HO-5](dashboard-runtime-honesty.md) | 🟡 |

**Tally:** 1 🟢, 2 🟡, 11 🟠, 7 🔴.

The 🔴 cluster is concentrated in CI-VIOLATION — the inflation-class failures where the structural layer asserts more than the contract earned. CI-DRIFT is the largest count (5 🟠), reflecting habit-based misclassification rather than acute violation. CI-FRAGMENTED is the most operationally consequential under stress because fragmentation is the failure mode that compounds across the four stress conditions below.

## Stress-condition ↔ CI-state matrix

For each of the four stress conditions in the wave brief, score whether operators can correctly classify the constitutional state.

### Stress condition 1 — Replay ambiguity

**What's happening:** an operator runs `replayDecision` on a capsule. The trust-state artifact has aged out. Source-coverage lane was degraded at decision time. The capsule's evidence-spine references an artifact row that has since been re-computed.

| Question an operator must answer | Answer source today | CI class | Score |
|---|---|---|---|
| Is `trustStateAtDecision: 'UNKNOWN'` recorded or replay-fallback? | `evidenceSnapshot.trustStateAtDecision.capturedAt: null` (visually irrelevant) | CI-DRIFT | 🟠 CONFUSING |
| Is `R-CAT-6` the action category or the envelope category? | inner `meta.runtimeTrust.replayCategory` (not surfaced) | CI-FRAGMENTED | 🟠 CONFUSING |
| Is the authority chain decision-time or replay-time? | inferred from `replayedAt` vs original timestamp (no marker) | CI-FRAGMENTED | 🟠 CONFUSING |
| Did the recomputedHash succeed because the chain is intact, or because the spine was re-derived? | `tamperEvidence` distinguishes three error modes only ([replayEngine.ts:376-383](../../apps/api/backend/src/services/audit/replayEngine.ts)) | CI-DEGRADED → CI-VIOLATION risk | 🟡 PARTIAL |

**Replay-ambiguity score: 🟠 CONFUSING.** Three of four operator questions admit drift. The contract preserves all four distinctions; the surface preserves none cleanly.

### Stress condition 2 — Export lag

**What's happening:** an operator requests `buildAuditBundle` over a 24-hour window. Three capsule writes are deferred (`pending_not_written`). Two per-capsule replays error during bundle construction. The bundle returns successfully.

| Question an operator must answer | Answer source today | CI class | Score |
|---|---|---|---|
| Did the bundle include every capsule in the window? | `capsuleCount` is survived, not requested ([replayEngine.ts:592](../../apps/api/backend/src/services/audit/replayEngine.ts)) | CI-VIOLATION | 🔴 MISLEADING |
| Did any capsule replays fail during bundle construction? | per-capsule errors caught + logged + dropped ([replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts)) | CI-VIOLATION | 🔴 MISLEADING |
| Is the `bundleHash` proof of completeness? | hash is internally consistent over what survived | CI-VIOLATION | 🔴 MISLEADING |
| Are `pending_not_written` rows in the window included? | `eventState` not surfaced in bundle | CI-DEGRADED → CI-VIOLATION | 🔴 MISLEADING |
| Is the bundle cryptographically signed by VitalCV? | `bundle.issuer: 'VitalCV'` is a string literal | CI-VIOLATION | 🔴 MISLEADING |

**Export-lag score: 🔴 MISLEADING.** Five of five operator questions admit confidently-wrong answers. **This is the canonical worst-case constitutional-failure explainability surface.** The operator cannot detect any of the five gaps from the artifact alone.

### Stress condition 3 — Lineage fragmentation

**What's happening:** an operator investigates a capsule's lineage. The originating mutation (T0) was a `TRUST_ACCEPTANCE` with `R-CAT-1`. Three retries fired (same `mutationFingerprint`). The capsule was checkpointed (C-1). Two replays were performed (each emitting `R-CAT-6` outer envelopes). One replay re-derived the authority chain because an artifact row had moved.

| Question an operator must answer | Answer source today | CI class | Score |
|---|---|---|---|
| Did the originating mutation produce one or three events? | three rows, three correlation IDs, one fingerprint (no group-by) | CI-FRAGMENTED | 🟠 CONFUSING |
| Was the originating action `TRUST_ACCEPTANCE`? | `meta.runtimeTrust.mutationClassification` (not surfaced) | CI-FRAGMENTED | 🟠 CONFUSING |
| Is the C-1 checkpoint the same chain as T0? | tested at runtime ([replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts)); not surfaced | CI-FRAGMENTED | 🟡 PARTIAL |
| Were the two replays dossier-replays or original-action replays? | every replay envelope is `R-CAT-6` regardless | CI-FRAGMENTED | 🟠 CONFUSING |
| Is the authority chain in replay #2 the decision-time chain or re-derived? | `replayedAt` timestamp present; provenance marker absent | CI-FRAGMENTED | 🟠 CONFUSING |

**Lineage-fragmentation score: 🟠 CONFUSING.** Four 🟠 + one 🟡. The contract enforces every distinction (round-trip tested in `replayEngine.runtimeCohesion.test.ts`); the surface erases every distinction. Lineage fragmentation is the stress condition where the gap between contract honesty and surface silence is widest.

### Stress condition 4 — Dashboard / runtime mismatch

**What's happening:** the operator's dashboard renders green. The lane-health badge is CHECKING. The `/status` page shows compliance evidence as healthy. Underneath: three audit rows are `pending_not_written`, two issuer-side refusals fired (no rows), one bundle export dropped two capsules silently.

| Question an operator must answer | Answer source today | CI class | Score |
|---|---|---|---|
| Is the dashboard's green a positive claim or a default? | implicit-guarantee via absence of warning | CI-DRIFT | 🟠 CONFUSING |
| Are `pending_not_written` rows behind the green? | no surface field | CI-DRIFT → CI-DEGRADED | 🟠 CONFUSING |
| Did issuer refusals occur in the window? | no audit rows for refusals | CI-VIOLATION | 🔴 MISLEADING |
| Does the `/status` page report dropped capsules? | bundle drops invisible to `/status` | CI-VIOLATION | 🔴 MISLEADING |
| Does lane-health green imply trust-state green? | decoupled by design ([LaneHealthBadge.tsx](../../apps/web/components/source-health/LaneHealthBadge.tsx)) | CI-HEALTHY | 🟢 UNDERSTANDABLE |

**Dashboard / runtime mismatch score: 🟠 CONFUSING.** One 🟢 (lane decoupling holds), three 🟠, two 🔴. The lane-health contract is the only honest dashboard signal; the rest of the dashboard surface admits inflation under stress.

## Cross-stress CI scoreboard

| Stress condition | CI-DEGRADED | CI-DRIFT | CI-FRAGMENTED | CI-VIOLATION | Score |
|---|---|---|---|---|---|
| Replay ambiguity | 🟡 | 🟠 | 🟠 🟠 | (latent) | 🟠 CONFUSING |
| Export lag | 🔴 | — | — | 🔴 🔴 🔴 🔴 | 🔴 MISLEADING |
| Lineage fragmentation | — | — | 🟠 🟠 🟡 🟠 🟠 | — | 🟠 CONFUSING |
| Dashboard / runtime mismatch | 🟠 | 🟠 🟠 | — | 🔴 🔴 | 🟠 CONFUSING |

**Pattern:** export lag is the only stress condition that scores 🔴 across the board. The other three score 🟠 because the contract preserves the distinctions and the surface fragments them — recoverable by binding renderers, not by re-architecting contracts.

## Where constitutional-failure explainability holds

**The lane-health badge under stress is the platform's only fully UNDERSTANDABLE constitutional surface.** When the source-coverage lane degrades, the badge transitions to `CHECKING` or `BLOCKED` honestly ([LaneHealthBadge.tsx](../../apps/web/components/source-health/LaneHealthBadge.tsx)). Lane red does not become trust red; trust red does not become lane red. The decoupling is the wave's clearest counter-example to CI-VIOLATION: a rendered surface that takes a contract literal and presents it without inflation, and that does not silently mirror happy-path styling under degradation.

The truth-contract layer (literal `decisionGrade: false`, distinct `proofTier` literals, [CLAUDE.md](../../CLAUDE.md) banned-strings) holds under every stress condition. No stress condition in the inventory degrades the doctrine layer. CI-VIOLATION is a structural and surface phenomenon, not a contract phenomenon.

The runtime-cohesion contract (`buildRuntimeMutationMetadata` → capsule metadata → `replayDecision` round-trip, tested in [replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts)) preserves correlationId, payloadHash, and mutationFingerprint verbatim across the chain. CI-FRAGMENTED in the surface is not CI-FRAGMENTED in the contract.

## Where constitutional-failure explainability holds worst

**Export lag is the canonical worst-case CI-explainability surface.** Five of five operator questions in the export-lag stress matrix admit confidently-wrong answers. The artifact most likely to leave VitalCV's perimeter is the artifact most likely to invite CI-VIOLATION misclassification. No structural defense (no `requestedCount`, no `droppedIds`, no `partialExport`, no detached signature) exists in the bundle JSON to let the recipient detect the gap.

Forensic continuity overestimate via absent rows (issuer-side refusals, replay invocations) is the second worst because it is invisible by construction: the operator's audit-table query is correct, the table's coverage is not what they assume, and there is no field whose absence would signal the gap.

## Verdict

**Constitutional failure explainability is sharp at the contract layer, sharp at the one rendered defense (lane health), and silent everywhere else.**

Of the four CI-* states, three (CI-DEGRADED, CI-DRIFT, CI-FRAGMENTED) are recoverable by binding existing contract literals to rendered surfaces. CI-VIOLATION is recoverable only by adding defending fields to the schema or by rewriting the copy. The 🔴 cluster (seven findings) concentrates in CI-VIOLATION, and the highest-impact 🔴 is concentrated in the bundle-export schema.

The four stress conditions yield: one 🔴 (export lag), three 🟠 (replay ambiguity, lineage fragmentation, dashboard/runtime mismatch). No stress condition is 🟢 across the board because no rendered surface today binds more than one survivability literal cleanly. Lane health is the existence proof that 🟢 is achievable when the platform invests.

**Strongest constitutional-failure awareness surface:** the [LaneHealthBadge](../../apps/web/components/source-health/LaneHealthBadge.tsx) + [LaneHealthMount](../../apps/web/components/source-health/LaneHealthMount.tsx) chain, propagated to employer dashboard, passport (entity), and passport (root). The only rendered surface that takes a contract literal and presents it without inflation under stress.

**Weakest operator-awareness surface under constitutional stress:** the [bundle JSON exported by `buildAuditBundle`](../../apps/api/backend/src/services/audit/replayEngine.ts). Concentrates four 🔴 CI-VIOLATION inflation vectors and is rendered without any partialExport / requestedCount / signature defense. Fails 5/5 operator questions under the export-lag stress condition.

**Track A score: 🟠 CONFUSING.** 1 🟢, 2 🟡, 11 🟠, 7 🔴 across the CI-state inventory; 1 🔴 + 3 🟠 across the four stress conditions. **Constitutional failure explainability is contract-honest, surface-silent, and inflation-prone in exactly the artifact most likely to leave the platform.**
