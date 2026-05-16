# Degraded Trust-State Continuity — W2-PR9B Track B

**Wave:** W2-PR9B — Degraded Runtime Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [w2-pr9b-operator-failure-understanding](w2-pr9b-operator-failure-understanding.md), [w2-pr9b-forensic-survivability](w2-pr9b-forensic-survivability.md), [w2-pr9b-operational-trust-resilience](w2-pr9b-operational-trust-resilience.md).
**Builds on:** [trust-fabric-continuity](trust-fabric-continuity.md), [w2-pr7b-trust-state-topology](w2-pr7b-trust-state-topology.md), [w2-pr7b-runtime-semantics-cohesion](w2-pr7b-runtime-semantics-cohesion.md).

---

## What this track answers

PR8B Track C asked whether trust-state, lineage, replay, and audit form a **single fabric on the happy path**. Answer: yes at the contract layer, partially at the surface. **This track asks whether the same four channels remain coherent during degraded states** — when async lag delays a write, when an export stalls mid-bundle, when a retry creates a parallel row, when attribution silently drops to `'unknown'`.

The interesting finding is not whether they fail, but where they go silent without breaking — the *latent* fragmentation that does not surface as an error.

## Definitions

- **Async lag:** the gap between a runtime event happening and any of the four channels reflecting it.
- **Export lag:** the gap between requesting an export and the export finishing.
- **Retry continuity:** whether two retries of the same logical mutation read as one logical event across the four channels.
- **Attribution continuity:** whether actor identity is preserved across all four channels for a single mutation.
- **Cohered transition:** a state transition that is reflected in every channel that holds that state.
- **Fragmented transition:** a state transition that is reflected in some channels and silent in others.

## Continuity scoreboard under degradation

| Transition | On happy path | Under async lag | Under retry storm | Under partial export | Under unknown actor |
|---|---|---|---|---|---|
| **Trust state** (`TrustBand`, `ReadinessStatus`) | ✅ cohered | 🟡 source-coverage read time absorbs lag | 🟢 deterministic (no actor in derivation) | 🟢 trust state is not in the bundle as such | 🟢 actor not in derivation |
| **Replay state** (`replayCategory`, `mutationClassification`) | ✅ cohered | 🟢 invocation-on-demand; lag does not change replay | 🟠 N retries → N replay envelopes, all R-CAT-6 outer | 🟠 partial bundle drops some replays silently | 🟢 actor recorded in inner mutation, not in replay envelope |
| **Audit state** (`eventState`: `pending_not_written`/`demo_not_persisted`) | ⚠️ invisible | 🟠 lag is exactly the period `pending_not_written` is true | 🟠 N retries → N rows, no idempotency contract | 🟠 export does not include `eventState` field | ⚠️ actor `'unknown'` recorded faithfully |
| **Readiness state** (`DECISION_GRADE`/`CHECKING`/`BLOCKED`/`PARTIAL`) | ✅ cohered | 🟡 derivation lag = source-artifact write lag | 🟢 readiness is not actor-keyed | 🟢 readiness is recorded snapshot | 🟢 actor not in derivation |
| **Lineage** (receipt-candidate → policy-review → capsule → audit) | ⚠️ partial | 🟡 issuer-side delay = candidate stuck in intermediate state | 🟠 retries do not create lineage forks; correlation diverges | 🟠 partial bundle = partial lineage; no marker | 🟠 attribution gap propagates into every linked row |
| **Attribution** (`actor.actorId` / `actorType` / `attributionSource`) | ⚠️ partial | 🟢 lag does not change attribution | 🟢 retries preserve attribution | 🟢 attribution is in the row | 🟠 silent fallback to `'unknown'` |

**Tally under degradation:** 0 of 24 cells fail outright; 14 of 24 hold; 10 are partial-or-silent. **The fabric does not tear under degradation. It thins, in patterns that are predictable from the happy-path scoreboard.**

## State machines under async lag

### Receipt-candidate lifecycle ⚠️ partial under lag

The candidate moves through `not_yet_evaluated` → `pending_office_match` → `pending_unable_to_verify_review` → `pending_conflict_review` → `ready_for_policy_review` (per `apps/web/lib/issuer-verification/policyReview.ts`). When the issuer is slow:

- The candidate sits in an intermediate state.
- The state literal is honest (it says "pending").
- The acceptance gate cannot fire until `ready_for_policy_review`.
- The trust state on the passport may render `CHECKING` or `BLOCKED` depending on derivation.

**Holds:** the literal vocabulary is preserved across lag.
**Thins:** the operator surface does not show *why* the candidate is in its current state — the audit row for issuer-side intermediate transitions does not exist (PR8B Track A: `refusalGate` returns 6 values, none of which produce an audit row).

### Replay-state lifecycle ✅ deterministic under lag

Replay is invocation-on-demand. There is no replay state machine. The same capsule replayed at T0, T1, T2 produces the same envelope (modulo `replayedAt`).

**Holds:** lag does not affect determinism.
**Thins:** the very lack of state means lag is invisible. An operator cannot ask "is replay healthy?" — there is no "replay healthy" state to read.

### Audit-state lifecycle ⚠️ partial under lag

The `eventState` field exists in code with values `pending_not_written` (default), `demo_not_persisted`, `defer_until_contract_aligned`. The state transition from `pending_not_written` → `persisted` is exactly the period where audit lag is observable in code.

**Holds:** the state literal is honest.
**Thins:** no operator surface reads `eventState`. The lag period is the period the audit row says one thing in memory and another in durable storage; today, the difference is invisible to anyone outside the engine.

### Readiness-state lifecycle ✅ cohered under lag

Readiness is computed at trust-state read time from underlying source coverage. When source-artifact writes lag, the readiness derivation reads pre-lag inputs and produces a pre-lag readiness. The next read after the lag closes produces the post-lag readiness. The transition is observable in the next read.

**Holds:** readiness reflects what the system knew at read time.
**Thins:** no operator surface today renders the *delta* between two reads — readiness regression is observable as a re-render of the passport, not as a tracked transition with a marker.

## Retry continuity

A retry is the most operationally common degradation. Three operators click "request refresh" because the issuer is slow. The single most material question for trust continuity: **does the system read this as one logical event or as three?**

| Channel | Reading after three retries |
|---|---|
| **Audit rows** | 3 rows, type `EMPLOYER_REVIEW_REFRESH_REQUESTED` |
| **Correlation IDs** | 3 distinct UUIDs (random per call when caller omits) |
| **Mutation fingerprints** | 1 fingerprint (deterministic over action + actor + entity + payloadHash) |
| **Replay envelopes** | 3 envelopes if all three are replayed (each replays as one) |
| **Trust state** | Unchanged by retry; reflects whatever the issuer eventually returns |
| **Readiness** | Unchanged by retry; reflects current source coverage |
| **Outcome** | Last `outcome: 'allowed'` wins; prior two are not "denied," they are just earlier completions of the same logical refresh |

**The fingerprint is the only channel that reads three retries as one logical event.** No surface today queries by fingerprint. No metric pre-aggregates by fingerprint. From the operator's view, three retries are three events.

**Continuity verdict:** the system records enough to detect retries; it does not surface retries as retries. **🟠 partial continuity under retry storm.**

## Export lag continuity

Bundle export ([replayEngine.ts:550-607](../../apps/api/backend/src/services/audit/replayEngine.ts)):
- Synchronous loop over up to 50 capsules.
- Per-capsule replay throws are caught, logged, dropped from output.
- `bundleHash` is computed over what was actually included.
- `capsuleCount` reflects what was included, not what was requested.
- `exportedAt` is the timestamp at the start of bundle assembly.

Under export lag (e.g., one capsule's replay takes 30 seconds because the artifact set is large):
- The full bundle is held until that capsule resolves or throws.
- No streaming.
- No progress signal.
- No partial bundle exposed if one capsule hangs the export.

Under partial-export failure:
- The dropped capsule is invisible in the output.
- The bundleHash is internally consistent over what survived.
- A consumer who got "49 replays" cannot know one was supposed to be there.

**Continuity verdict:** the export channel preserves *internal* continuity (hashed over what's included) at the cost of *requested-vs-delivered* continuity (no manifest of what was asked for). **🟠 partial continuity under export lag.**

## Attribution continuity under loss

When the Clerk header is missing on a mutation request:
- `actorId` = `'unknown'`
- `actorType` = `'unknown'`
- `attributionSource` = `'unknown'`

This is an *intentional* fallback — better to record an unknown actor than to refuse the mutation. The continuity question is: **does the rest of the fabric flag the unknown attribution, or does it propagate silently?**

| Channel | Reading on `actorId === 'unknown'` |
|---|---|
| **Audit row** | `actor.actorId: 'unknown'` faithfully recorded |
| **Replay envelope** | inner mutation row carries the unknown; `verifierIdentity.userId` reads `null` if not present in metadata |
| **Trust state** | unaffected (actor is not a derivation input) |
| **Readiness** | unaffected (actor is not a derivation input) |
| **Bundle export** | unknown actor included verbatim in the bundle |
| **Operator surface** | no surface visually distinguishes unknown attribution |

**The fallback propagates honestly through every channel and surfaces nowhere.** This is the precise definition of latent fragmentation: every channel agrees, no channel highlights.

**Continuity verdict:** **🟠 silent under attribution loss.**

## Channels intentionally decoupled from degradation

Some apparent fragmentations under degradation are right calls, not gaps to close.

### Lane health is not a trust-state input

A red lane is operational health, not provenance. PR8B Track C: "lane health is intentionally not a trust-state input; this is the right call." Under degradation (lane goes red), trust state is unaffected. **This is honest decoupling.**

### Replay is computed-on-demand

Replay does not write a "replay happened" event. PR8B Track C: "replay is computed-on-demand from recorded inputs… recording every replay would create a feedback loop." Under degradation (heavy replay traffic), no audit pollution. **Correct decoupling for the audit table.**

The cost is the inverse of the gain: an operator cannot ask "how many replays happened during the incident?" because no row was written.

### Demo paths produce demo audit literals

`recordedBy: 'demo'`, `demo_not_persisted`. Under any degradation in a demo environment, the literal is preserved end-to-end. **The strongest single anti-trust-inflation lever in the codebase remains effective under degradation.**

## Cross-channel reading under degradation

Imagine a user, an operator, and an auditor reading the system during a 90-second issuer-slow incident.

| Reader | What they see |
|---|---|
| **Clinician** | Passport renders normally. Lane health renders the slow lane. Trust band may regress to `YELLOW`. Readiness may regress to `CHECKING` or `PARTIAL`. **Continuity: cohered.** |
| **Employer** | Acceptance gate blocked because `readiness !== 'READY'`. The denial is `acceptance_blocked`. **Continuity: cohered, with the known PR8B ambiguity that `acceptance_blocked` reads as restatement-of-denial rather than cause.** |
| **Operator** | Audit timeline shows refresh requests; nothing tells them three are one logical retry. No surface tells them issuer-side `refusalGate` events fired (because no rows). **Continuity: thinned.** |
| **Auditor (post-incident)** | Audit bundle is internally consistent. Some refreshes have unknown actors. The bundle is silent about issuer-side refusals during the window. **Continuity: cohered inside the bundle, fragmented across the surface they did not see.** |

## Verdict

**The four channels stay cohered under degradation. The surface stays silent.**

The contract-layer cohesion that PR8B Track C identified — proof-tier ladder, runtime mutation taxonomy, hash-and-tamper detection — is robust under async lag, retry storms, partial exports, and attribution loss. None of the four state machines tear. No literal becomes inconsistent. Every degradation produces an honest recorded state.

The cost is consistent with the wave's deliberate ordering: where PR8B left the surface layer for next wave, PR9B confirms that **the surface layer is exactly the layer that goes silent under degradation**, while the contract layer holds.

The two surfaces with the highest concentrated continuity risk under degradation are:

1. **Retry-as-multiple-events**: every channel records three retries as three rows; only `mutationFingerprint` lets a reader detect them as one logical event; no surface reads the fingerprint.
2. **Export-as-best-effort silently presented as complete**: `buildAuditBundle` drops failed capsules, reports the survived count as `capsuleCount`, and produces a hash over the survived set. A consumer reads "complete bundle"; the bundle was best-effort.

Neither is a contract failure. Each is a degraded-state surface gap.

**Track B score: 🟡 PARTIAL.** Strongest continuity surface under degradation: trust-state derivation (correctly decoupled from retries, lag, attribution loss). Weakest continuity surface under degradation: audit-state durability lag (`pending_not_written` invisible at every surface). **Degraded trust-state continuity is preserved at the contract layer and silent at the operator layer — the same ordering as the happy path, with the silent surfaces becoming more consequential.**
