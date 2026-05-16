# W2-PR7B — Operational Trust Continuity

**Wave:** W2-PR7B — Trust-State Operational Cohesion
**Date:** 2026-05-08
**Status:** Review-only. No code changes, no merges.
**Risk class:** SAFE (read-only synthesis).
**Companion to:** [topology](w2-pr7b-trust-state-topology.md), [runtime semantics](w2-pr7b-runtime-semantics-cohesion.md), [operator model](w2-pr7b-operator-model-integrity.md).

---

## What "operational trust continuity" means here

Continuity is the property that **no surface contradicts another, no transition quietly drops information, and no operator-visible state has a different meaning between two screens.** It is not the same as cohesion (one system) or coherence (consistent semantics). It is the moment-to-moment honesty of the running platform.

The platform passes continuity if, given any state observed at time T, the same state observed by another channel at time T tells the same story.

## Scoreboard

| Continuity dimension | Hold? | Notes |
|---|---|---|
| **Trust contract holds at literal boundaries** | ✅ | `decisionGrade: false` literal, `proofTier` literals, banned-strings list — all hold today |
| **Demo vs real is structural, not narrative** | ✅ | `recordedBy: 'demo'` everywhere; persistence default is `defer_until_contract_aligned` |
| **Runtime mutation taxonomy is one** | ✅ | W2-PR4A: one helper, one taxonomy, one replay-stable hash |
| **Replay preserves recorded fields without downgrade** | ✅ | tested invariants in `replayEngine.runtimeCohesion.test.ts:78-88` and `runtimeTrustCohesion.test.ts:9-42` |
| **Same trust state ⇒ same UI label across surfaces** | ✅ | `statusCopy.ts` is a single lookup table; no copy drift between surfaces using the same state |
| **Issuer-verification refusal ⇒ employer-review awareness** | ❌ | parallel workflows, no feedback loop |
| **Audit-write status ⇒ operator visibility** | ❌ | no UI today; durability invisible |
| **Replay output ⇒ recorded vs computed clarity** | ❌ | mixed in one envelope; no UI yet |
| **Denial reason granularity ⇒ event-type granularity** | ⚠️ | granularity in payload, not in event type — biases reporting |
| **Lane health ⇒ readiness rollup** | ⚠️ | two surfaces, no rollup signal between them |

5 holds, 3 fails, 2 partials. **Continuity holds at every literal/contract boundary; continuity fails at every workflow-seam and operator-surface boundary that has no UI yet.**

## Fragmentation hotspots

### 1. Issuer-verification ↔ employer-review seam (highest)

Two state machines. Two refusal vocabularies (`refusalGate` vs `denial_reason`). One shared physical object (the passport). No feedback loop in either direction. An employer-side acceptance gate uses `readiness === READY`, which is a derivation that may or may not reflect a recent issuer-side `unable_to_verify`.

**Why it's a continuity hotspot:** the same passport can read as "ready to accept" on the employer screen and "not verifiable" on the issuer screen at the same instant, and the system permits this by design.

**Why the design is defensible:** issuer verification is a primary-source opinion; employer acceptance is a relationship choice; coupling them tightly would over-constrain the workflows. Path forward is **explicit dual-display** (show both signals on the operator surface) rather than collapsing them.

### 2. Replay envelope mixes recorded with computed

`DecisionReplay` is one object containing fields recorded at decision time and fields reconstructed at replay time. There is no marker on the envelope distinguishing them. When a replay UI surface lands, it must visually separate the two — otherwise an operator will read all fields as historical fact.

**Why it's a hotspot:** replay is the core honesty mechanism for VitalCV. If the surface doesn't make recorded-vs-reconstructed legible, the honesty of replay is rhetorical.

**Why it's not yet a violation:** there is no replay UI today. The fragmentation is latent.

### 3. Audit-write status invisibility

Default state is `pending_not_written`. Reference writer never claims `persisted`. Today, no UI tells an operator the difference between an event with durable storage and an event in memory only.

**Why it's a hotspot:** TRUST-PERSIST-1 (per memory snapshot) is the largest single board blocker. When a real writer lands, the surface must update; if it doesn't, an operator will not be able to tell that durability changed.

### 4. Denial granularity collapse

Three structural reasons (`already_accepted / passport_unavailable / acceptance_blocked`) → one audit event type (`EMPLOYER_REVIEW_MUTATION_DENIED`). The reason is in the payload; group-by-type metrics flatten it.

**Why it's a hotspot:** denial trends are a leading indicator of workflow friction. Aggregators that bucket by event type read all denials as one signal; aggregators that bucket by reason field tell a real story. The system biases toward the first.

### 5. Composed readiness badge

Color is driven by status when present, by score when absent. Edge case: `BLOCKED` status with high score yields yellow. Engineering-correct; operator-misleading on the edge.

**Why it's a hotspot:** readiness is the most-glanced state in the product. Anything that biases the most-glanced surface toward over-confidence on edges is a continuity hotspot, even if the rest of the system is honest.

## Continuity breaks

A "break" is a place where an operator can see two contradictory facts about the same trust state, with no error or warning surface. None observed at the literal contract level (`decisionGrade` etc.). Two near-breaks observed:

- **Acceptance-eligible passport with stale issuer response.** Acceptance can succeed against a passport whose latest issuer response was `unable_to_verify`, if `readiness` was computed from source coverage at a moment that did not include the failed issuer call. This is a continuity *thinning*, not a break — the system is consistent within each workflow — but at the seam it can read as a contradiction.
- **Replay metadata vs original mutation classification.** The replay envelope's outer `replayCategory` is always R-CAT-6, while the recorded action inside carries its true R-CAT-1…5. A consumer that conflates the two will get the wrong answer about original action class.

## Hidden ambiguity

Three ambiguities are in code today and have not yet caused harm because the affected surfaces don't exist as UI:

1. `conflict_review_required` reaches the same string from two provenance paths (issuer responded `corrected`, vs reviewer chose `mark_conflict_review`). Provenance is in the audit row but not in the candidate object itself.
2. `pending_not_written` and `demo_not_persisted` both read as "not durable" without distinguishing copy.
3. `unable_to_verify` is both an issuer response status and a candidate review state. Code distinguishes; copy will need to once both are surfaced together.

## State-transition drift

Drift = a place where the state transition's post-condition does not match what the operator-visible artifact says. None observed in this audit. The five-gate enforcement on `accept_candidate` is tight; the literal-types contract on `decisionGrade` is tight; the runtime cohesion helper is invoked uniformly.

## Strengths

The platform's trust-continuity floor is **unusually high** for a product this size:

- Banned strings are doctrine, not aspiration.
- Demo-vs-real is structural (`recordedBy: 'demo'`).
- Runtime mutation taxonomy is one helper, one shape, one replay-stable hash.
- Pure transforms (issuer-verification helpers) do not write, do not fetch — boundary is documented and held.
- Audit persistence default is `defer_until_contract_aligned` — the system does not lie about durability.

These are not surface polish; they are the load-bearing parts of "trust continuity." On these, W2 ends in a strong place.

## Operational verdict

**Operationally cohesive at the core. Operationally incomplete at the surface.**

The contract layer (literals, gates, taxonomies, banned strings, audit defaults) holds without exception. The synthesis layer (runtime trust cohesion, replay preservation) is unified and tested. The surface layer (replay UI, audit-write UI, denial-reason UI, readiness composition, employer ↔ issuer seam display) is the unfinished edge.

No continuity break observed at the contract layer. Two near-breaks at the seam (acceptance vs issuer state, replay envelope class). Three latent ambiguities awaiting their UI surface.

The platform is **safe to demo and safe to enter pilot** on this dimension; the four 🟠 items in [operator-model-integrity](w2-pr7b-operator-model-integrity.md) are the next-wave backlog for getting the surface to match the floor.

## What this verdict does not say

This audit does not address: persistence (TRUST-PERSIST-1 is the blocker tracked elsewhere), auth/RBAC (separate threat model), source-coverage accuracy (not a continuity question, an evidence question), or any GTM dimension. Those are scored in their own waves.
