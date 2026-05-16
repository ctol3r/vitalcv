# Trust-Fabric Durability Cohesion — W2-PR10B Track D

**Wave:** W2-PR10B — Operator Survivability Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [survivability-explainability](survivability-explainability.md), [forensic-durability-understanding](forensic-durability-understanding.md), [runtime-durability-continuity](runtime-durability-continuity.md).
**Builds on:** [trust-fabric-continuity](trust-fabric-continuity.md), [w2-pr9b-degraded-trust-state-continuity](w2-pr9b-degraded-trust-state-continuity.md).

---

## What this track answers

PR8B Track C asked whether trust-state, lineage, replay, and audit form **one fabric on the happy path** (yes at the contract, partial at the surface). PR9B Track B asked whether they **stay cohered under degradation** (yes at the contract, silent at the surface).

This track asks the synthesis question: **does the platform preserve four named honesties during degraded survivability states?**

- **Trust honesty:** the system claims no more about a credential's status than it can defend.
- **Survivability honesty:** the system claims no more about the durability of its own records than it can defend.
- **Operational clarity:** the operator can form a correct mental model from what the surface renders.
- **Forensic explainability:** an outside reader can reconstruct what happened without misreading the recorded shape.

A platform can hold trust honesty and lose survivability honesty. A platform can hold operational clarity on the happy path and lose it under degradation. The fabric question is whether all four hold *together*, *during* the degraded states the codebase already knows about.

## Definitions

- **Cohered honesty:** all four honesties hold simultaneously for a given state.
- **Honesty drift:** a state where one honesty is preserved at the cost of another.
- **Degraded survivability state:** any state where audit, replay, or export durability is in transition (`pending_not_written`, `'unknown'` actor, dropped bundle entry, missing artifact, retry storm, async lag).
- **Doctrine-level gate:** a banned-string or literal-type guarantee enforced by [CLAUDE.md](../../CLAUDE.md) and the trust contract package.
- **Structural-level gate:** a property of the recorded shape (schema, field presence, taxonomy) that defends honesty at the data-model layer rather than at the copy layer.

## Four-honesty scoreboard under degradation

| Honesty | Happy path | Async lag | Retry storm | Partial export | Attribution loss | Verdict |
|---|---|---|---|---|---|---|
| **Trust honesty** | ✅ doctrine-level gates | ✅ unaffected | ✅ unaffected | ✅ unaffected | ✅ unaffected | 🟢 cohered |
| **Survivability honesty** | ⚠️ `pending_not_written` invisible | 🟠 lag-period inflation | 🟠 retry-as-many-events | 🔴 best-effort export reads as complete | 🟠 `'unknown'` reads as identity | 🟠 drifts under degradation |
| **Operational clarity** | ⚠️ partial (per PR8B) | 🟠 surface mirrors happy path | 🟠 surface mirrors happy path | 🟠 surface mirrors happy path | 🟠 surface mirrors happy path | 🟠 silent under degradation |
| **Forensic explainability** | ⚠️ partial (per PR8B Track B) | ⚠️ unchanged | 🟠 retry granularity collapses at surface | 🔴 dropped capsules invisible | 🟠 `'unknown'` propagates through bundle | 🟠 inflates under degradation |

**Pattern:** trust honesty is robust across all five columns; the other three honesties are robust on the happy path and drift under degradation.

## How the four honesties interact

### Trust honesty stays robust because it is doctrine-protected

[CLAUDE.md](../../CLAUDE.md) bans inflation copy. The trust contract package literalizes `decisionGrade: false`, `proofTier: 'receipt_candidate'`, `decisionGrade: true` only on real `PSVReceipt`. Five gates fire in order on `accept_candidate`. `'recordedBy: 'demo'` and `demo_not_persisted` are explicit literals that no surface can paint over. Per [trust-fabric-continuity.md](trust-fabric-continuity.md): "no banned string in any current copy."

Under every degradation mode in the inventory, the trust contract literal is what it always was. A capsule under async lag still reads `decisionGrade: false` if it would have on the happy path. A `recordedBy: 'demo'` row stays a demo row through every retry, every export, every replay.

**Trust honesty's defense is the doctrine-level gate.** The doctrine layer is robust; the structural layer below it is where the other three honesties live.

### Survivability honesty drifts because it lives at the structural layer

Survivability claims are not in copy. They are in shape: the bundle's `bundleHash + verificationInstructions` shape implies completeness; `eventState` silence implies persistence; `'unknown'` recorded-without-highlight implies identity; outer R-CAT-6 implies replay-as-original-action. None of these are banned strings. None of these have a doctrine gate.

Per [forensic-durability-understanding.md](forensic-durability-understanding.md) trust inflation vector register:
- TIV-1 — bundle hash + instructions imply completeness
- TIV-2 — `eventState` silence implies persistence
- TIV-3 — `'unknown'` reads as identity
- TIV-4 — outer R-CAT-6 implies dossier-replay
- TIV-5 — `verifierIdentity.type: 'SYSTEM'` reads as fully attributed
- TIV-6 — bundle issuer label implies cryptographic provenance

Six structural inflation vectors, none of which are copy-side violations. The doctrine layer does not catch them. Survivability honesty falls through the doctrine net and lands in the structural layer, which has six known gaps.

**Survivability honesty's defense is structural — and structural defenses today have six gaps.**

### Operational clarity drifts because the surface is happy-path-shaped

Per [w2-pr9b-operator-failure-understanding.md](w2-pr9b-operator-failure-understanding.md): "the surface assumes the system is in its happy path, and reports as if it were even when it is not." The surface renders happy-path values for degraded states because the literals that distinguish them (`pending_not_written`, `'unknown'`, fingerprint) have no rendering binding.

This is a **surface absence**, not a contract failure. The contract layer holds. The surface mirrors the happy path because no surface has been built to render the off-happy-path literals. Per [trust-fabric-continuity.md](trust-fabric-continuity.md), this is the unfinished edge of the wave.

**Operational clarity's defense is surface-binding — and almost no degradation-aware surface binding exists today.**

### Forensic explainability inflates because the recorded shape leans optimistic

Per [forensic-durability-understanding.md](forensic-durability-understanding.md): "the system records honestly and the recorded shape reads optimistically." The recorded literal is what it claims; the **shape** of the artifact reads as a stronger property than the contract holds.

Under degradation, the gap widens. A bundle from a degraded window reads as a bundle from a healthy window — same schema, same hash, same instructions. The surface that distinguishes "this bundle was complete" from "this bundle was best-effort" does not exist.

**Forensic explainability's defense is artifact-shape — and the artifact shape today implies more than the contract holds at six structural points.**

## Honesty-drift register

Each entry below is a state where one honesty is preserved at the cost of another.

### HD-1 — Trust honesty preserved, survivability honesty drifts

**Where:** `pending_not_written` audit row for a real mutation.
**Trust honesty hold:** the mutation's eventual recorded literals (proofTier, decisionGrade) are correct.
**Survivability honesty drift:** the surface reads as if the audit row landed transactionally; it did not.

### HD-2 — Trust honesty preserved, operational clarity drifts

**Where:** `actorId: 'unknown'` mutation accepted.
**Trust honesty hold:** the mutation literals are correct; nothing claims more authority than the action had.
**Operational clarity drift:** the operator surface does not visually distinguish unattributed actions; the timeline reads as if a real "user named unknown" acted.

### HD-3 — Trust honesty preserved, forensic explainability drifts

**Where:** bundle export drops one capsule of fifty.
**Trust honesty hold:** every replayed capsule's trust literals are correct.
**Forensic explainability drift:** the bundle reads as the complete record; investigator forms FA-1 (false forensic assumption #1).

### HD-4 — Survivability honesty preserved at the cost of operational clarity

**Where:** `eventState: 'pending_not_written'` is honest at the literal layer.
**Survivability honesty hold:** the literal exists in code; an inspector with source-code access can detect.
**Operational clarity drift:** no surface reads it; the operator cannot.

### HD-5 — Operational clarity preserved at the cost of survivability honesty (apparent only)

**Where:** the passport surface renders normally during a 90-second issuer-slow window.
**Operational clarity hold:** the user sees a coherent passport.
**Survivability honesty drift (apparent only):** the user could read the page as "fully verified now" when underlying mutations are mid-write.
**Mitigation:** lane health flips visibly; `CHECKING` / `BLOCKED` readiness states render the in-flight nature; the doctrine-level gate `decisionGrade: false` prevents copy-level inflation.

This is the honesty-drift the wave most actively defends against; the trust-state surface and the lane-health badge together absorb most of the operational-clarity-vs-survivability tension.

### HD-6 — Forensic explainability preserved at the cost of survivability honesty (apparent only)

**Where:** the per-capsule replay envelope is forensically deterministic and tamper-detectable.
**Forensic explainability hold:** an investigator can reconstruct decision time.
**Survivability honesty drift (apparent only):** the same envelope mixes recorded with computed; an inattentive reader assumes more durability than the recorded fields support.
**Mitigation:** `tamperEvidence` literal, three distinct messages, deterministic test coverage.

## Cohesion under named degradation modes

The five degradation modes inventoried by PR9B and how the four honesties hold for each.

### Mode 1 — Async issuer lag (issuer slow, candidate stuck)

| Honesty | Holds? |
|---|---|
| Trust | ✅ — candidate-state literals (`pending_office_match`, `ready_for_policy_review`) are honest |
| Survivability | ⚠️ — issuer-side `refusalGate` does not produce an audit row (zero forensic floor) |
| Operational clarity | ⚠️ — issuer-side state visible only on issuer review console; employer surface reads "checking" |
| Forensic explainability | ❌ — no row for refusals during the window |

### Mode 2 — Retry storm (one logical refresh, three rows)

| Honesty | Holds? |
|---|---|
| Trust | ✅ — each row's literals are correct |
| Survivability | 🟠 — fingerprint detects retries; surface reads three events |
| Operational clarity | 🟠 — timeline shows three refreshes; correct number is one |
| Forensic explainability | 🟠 — investigator can reach either reading without explicit signal |

### Mode 3 — Partial bundle export (49 of 50 capsules survived)

| Honesty | Holds? |
|---|---|
| Trust | ✅ — each included capsule's literals are correct |
| Survivability | 🔴 — bundle reads as complete; one was dropped |
| Operational clarity | 🔴 — no field signals the gap |
| Forensic explainability | 🔴 — investigator forms FA-1 |

### Mode 4 — Attribution loss (`actorId: 'unknown'`)

| Honesty | Holds? |
|---|---|
| Trust | ✅ — action's trust literals are correct |
| Survivability | 🟠 — `'unknown'` recorded faithfully; surface treats as identity |
| Operational clarity | 🟠 — no visual distinction from attributed action |
| Forensic explainability | 🟠 — `'unknown'` rate is reader-derived; bundle does not flag |

### Mode 5 — Replay during incident (no audit row written)

| Honesty | Holds? |
|---|---|
| Trust | ✅ — replay output is deterministic |
| Survivability | 🔴 — replay-as-verb-without-noun, no durable record of replay |
| Operational clarity | 🔴 — operator cannot ask "who replayed?" |
| Forensic explainability | 🔴 — no row, no answer |

**Cross-mode pattern:** trust honesty holds 5 of 5; the other three honesties drift on at least one of the modes, and the same three modes (partial export, replay during incident, issuer-side refusal) concentrate the most degradation across all three drift-prone honesties.

## Defenses that hold

These are the structures in the codebase that preserve cohesion across all four honesties simultaneously, even under degradation. They are the wave's load-bearing defenses.

### Defense 1 — `recordedBy: 'demo'` / `demo_not_persisted`

The strongest single anti-inflation lever. Demo paths render demo literals end-to-end through every degradation mode. No degradation can inflate a demo row into a real one.

### Defense 2 — Literal `decisionGrade: false`

Doctrine-protected. Banned-string list keeps copy from blurring. Type system keeps fields from widening. Promotion to `decisionGrade: true` requires a separate gated wave (real `PSVReceipt`).

### Defense 3 — `tamperEvidence` literal with three distinct messages

Honest under hash drift, evidence-spine mismatch, and generic replay failure. An investigator reading the literal sees the cause of the failure, not just the fact of failure.

### Defense 4 — `runtimeTrust` round-trip determinism

Verified by [replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts). `correlationId / payloadHash / mutationFingerprint` survive `buildRuntimeMutationMetadata` → capsule metadata → `replayDecision` verbatim. The seam through which all four honesties pass is contract-tested.

### Defense 5 — Lane health decoupled from trust state

Operational availability does not become provenance. Lane red does not reduce `proofTier`. Honest decoupling. Holds across all five degradation modes.

## Defenses that should hold and do not yet

These are degradation surfaces where a defense exists in code but does not bind to an operator-facing surface, and which would close the dominant honesty-drifts.

### Gap 1 — `eventState` has no surface

The literal exists; no UI, API, or schema field reads it. The single highest-leverage gap for survivability honesty.

### Gap 2 — Bundle does not declare "best-effort"

Schema does not include `requestedCount`, `droppedIds`, or `partialExport: true`. Any one of those would reduce FA-1 from confidently-wrong to read-the-flag.

### Gap 3 — `mutationFingerprint` is never grouped on

A surface that group-bys fingerprint would resolve retry-storm honesty drift. Today no surface speaks fingerprint.

### Gap 4 — Outer-vs-inner R-CAT-6 is not visually separated

A SIEM or dashboard rendering the inner R-CAT-1…5 alongside the outer R-CAT-6 would resolve FA-5. Today no surface separates them.

### Gap 5 — `actorId: 'unknown'` is not visually distinguished

A surface that paints unattributed actions as visually distinct from attributed ones would resolve FA-2. Today no surface does.

### Gap 6 — Issuer-side `refusalGate` does not produce a row

The single largest forensic dark spot. Until a `REFUSAL_RECORDED` event type joins the audit-event union and writes from `policyReview.ts`, issuer-side refusals have a zero forensic floor.

## Cross-honesty cohesion verdict

**Trust honesty holds across all five degradation modes; the other three honesties drift under at least one.**

The fabric's cross-honesty pattern is consistent with the wave's deliberate ordering. Doctrine-level defenses (banned-strings, literal types, demo gates) hold. Structural-level defenses (schema fields, surface bindings, taxonomy bridges) have six known gaps. The operator-mental-model layer mirrors the happy path under all degradations.

The platform preserves trust honesty under every degradation mode it knows about. The platform preserves survivability honesty, operational clarity, and forensic explainability under the *contract* layer of every degradation mode and not under the *surface* layer of any.

This is the right ordering for the wave: the contract is load-bearing for trust; the surface is load-bearing for operator experience. W2 closed the contract. The next wave needs to bind the contract literals to surfaces. Until then, the fabric is honest in code and silent at the screen.

**Strongest durability-cohesion gain in the wave:** the `runtimeTrust` round-trip — `buildRuntimeMutationMetadata` → capsule metadata → `replayDecision` — verified deterministically by [replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts). Every mutation's correlation, fingerprint, and payload hash survive the C-1 ↔ T0 reconciliation path verbatim. This is the load-bearing defense across all four honesties simultaneously.

**Track D score: 🟡 PARTIAL — cohered at trust honesty, drifting at the other three under degradation.** The fabric is honest about its own seams; the seams are wider under degradation than on the happy path; the operator-facing layer renders neither dimension. **Trust-fabric durability cohesion is robust at the doctrine layer, partial at the structural layer, and absent at the surface layer — the same ordering the wave was scoped to leave it.**
