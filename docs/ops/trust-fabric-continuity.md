# Trust Fabric Continuity — W2-PR8B Track C

**Wave:** W2-PR8B — Operational Trust Fabric Explainability
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [operator-query-understanding](operator-query-understanding.md), [forensic-explainability](forensic-explainability.md), [runtime-query-explainability](runtime-query-explainability.md).
**Builds on:** [w2-pr7b-trust-state-topology](w2-pr7b-trust-state-topology.md), [w2-pr7b-operator-model-integrity](w2-pr7b-operator-model-integrity.md).

---

## What this track answers

Treat trust state, lineage, replay, and audit as four named systems. Do they form **one operational trust fabric** — a single coherent semantic surface — or **four partially disconnected systems** that happen to share a database?

The question is operational, not architectural. Architecture is a design intent. Continuity is whether the running system reads as one fabric to a user, an operator, an auditor, or a future engineer.

## Definitions

- **Trust-state semantics:** the runtime answer to "what is the system's current trust posture for this subject?" — readiness, lane health, source coverage, proof tier.
- **Lineage semantics:** the recorded chain of artifacts and decisions linking a current state to its causes — receipt candidate → policy review → decision capsule → audit row.
- **Replay semantics:** the deterministic reconstruction of a past trust state from recorded inputs.
- **Audit semantics:** the durable record of every state-changing action, with actor, timestamp, classification, and integrity.
- **Continuity:** the degree to which a state observed in any one of the four channels matches the state observed in the others, *without reconciliation work by the operator.*

## Continuity scoreboard

| Pair | Continuous? | What ties them | What divides them |
|---|---|---|---|
| **Trust-state ↔ Lineage** | ✅ | `proofTier` literal flows from issuer-verification helpers into trust-state contracts unchanged | Source-coverage state is computed at trust-state read time; lineage of that computation is not in the audit row |
| **Trust-state ↔ Replay** | ⚠️ | Replay records `trustStateAtDecision` snapshot ([replayEngine.ts:49-55](../../apps/api/backend/src/services/audit/replayEngine.ts)) | Live trust state is computed; replayed trust state is recorded; the two don't co-render |
| **Trust-state ↔ Audit** | ⚠️ | `TRUST_STATE_CHECK` and `TRUST_STATE_DECAY` audit event types exist | Lane health (`MONITORING_STATUS_CHANGE`) is intentionally information-only; not a trust-state input — defensible, but means audit rows do not capture a complete trust-state derivation |
| **Lineage ↔ Replay** | ✅ | Lineage chain is the input to replay; literal types (`proofTier`, `decisionGrade`) are preserved verbatim | Replay envelope mixes recorded with computed; lineage reader must know which fields are which |
| **Lineage ↔ Audit** | ⚠️ | Receipt-candidate / policy-review / decision-capsule lineage produces `EMPLOYER_REVIEW_*` audit rows for accept / refresh / route paths | Issuer-side `refusalGate` does not produce a paired audit row; lineage of the refusal lives in the candidate, not the audit |
| **Replay ↔ Audit** | ✅ | Replay is deterministic; recorded audit rows are the input to replay; runtimeTrust metadata flows through | Replay invocation does not write its own audit row (replay is a noun without an event row) |
| **Cross-channel ↔ UI** | ❌ | n/a | No surface today renders the four channels together; replay UI absent, audit-write status invisible, denial-reason granularity collapsed |

**Tally:** 3 hold, 3 partial, 1 fails. **The four channels are operationally cohered at the contract layer (literals, taxonomies, hashing) and operationally disconnected at the surface layer (no UI binds them, no query crosses them).**

## The fabric, when it holds

When all four channels speak the same word, the fabric is honest. Three places this holds today:

### 1. The proof-tier ladder

`receipt_candidate` → `psv_receipt_candidate` → `psv_receipt`. Literal types in [packages/domain-common](../../packages/domain-common/) are imported by [issuer-verification helpers](../../apps/web/lib/issuer-verification/), [trust-state contracts](../../packages/trust-state/contracts.ts), and [API backend](../../apps/api/backend/src/). Five gates fire in order on `accept_candidate`. `decisionGrade` is the literal `false` everywhere except on a real `PSVReceipt`. Banned-strings list ([CLAUDE.md](../../CLAUDE.md)) is enforced as doctrine, not aspiration. Per [w2-pr7b-runtime-semantics-cohesion.md](w2-pr7b-runtime-semantics-cohesion.md), there is no banned string in any current copy.

**Fabric verdict:** one trust contract, one ladder, one set of gates, one set of words. **Continuous.**

### 2. The runtime mutation taxonomy

8 actions → 8 classifications → 6 R-CAT codes → one helper ([runtimeTrustCohesion.ts](../../apps/api/backend/src/services/runtimeTrustCohesion.ts)). One payload-redaction list. One fingerprint algorithm. One correlation ID. Every employer-review mutation, every replay invocation, every denial flows through the same builder. The metadata is identical-shaped across audit, replay, and runtime channels.

**Fabric verdict:** one taxonomy, one helper, one shape. **Continuous.**

### 3. Hash-and-tamper detection

`bundleHash`, `payloadHash`, `mutationFingerprint`, `IntegrityCheck.storedHash` vs `recomputedHash`. SHA-256 throughout. `tamperEvidence` field is a first-class output. Determinism is an explicit design constraint of the replay engine ([replayEngine.ts:14-15](../../apps/api/backend/src/services/audit/replayEngine.ts)).

**Fabric verdict:** one hash methodology, one tamper signal, one determinism contract. **Continuous.**

## The fabric, where it thins

### Seam 1: Issuer-verification ↔ Employer-review

Two state machines. Two refusal vocabularies (6-value `refusalGate` vs 3-value `denial_reason`). The shared physical object is the passport. The acceptance gate uses `readiness === READY`, derived from source coverage at request time.

Per [w2-pr7b-operational-trust-continuity.md](w2-pr7b-operational-trust-continuity.md): "The same passport can read as 'ready to accept' on the employer screen and 'not verifiable' on the issuer screen at the same instant, and the system permits this by design."

This is a **continuity thinning at a seam, not a break inside a system.** The defense is sound: issuer verification is a primary-source opinion; employer acceptance is a relationship choice. The path forward is explicit dual-display, not collapsing the two state machines. Until that surface lands, the fabric reads as two cloths sewn at the passport.

### Seam 2: Trust-state derivation ↔ Audit row

`TrustBand`, `ReadinessStatus`, `BlockingReason` (8 values), and lane health are computed at trust-state read time from underlying source coverage and policy state. The audit row records the *result* (via `TRUST_STATE_CHECK`) but not the *derivation*. A replay can reconstruct the result; a forensic reader cannot reconstruct *why* the result was what it was without re-running the source-coverage logic against the recorded source-snapshot data.

This is an **explainability thinning, not a continuity break.** The trust state is honest; the explanation of the trust state is implicit in code, not durable in the row.

### Seam 3: Replay envelope's recorded-vs-computed boundary

The `DecisionReplay` envelope mixes recorded fields (decision, evidence, authority chain) with computed fields (`integrity.recomputedHash`, `replayedAt`, replay metadata) under the same outer schema. There is no marker on the envelope distinguishing them.

Per [w2-pr7b-operational-trust-continuity.md](w2-pr7b-operational-trust-continuity.md) hotspot #2: "Replay is the core honesty mechanism for VitalCV. If the surface doesn't make recorded-vs-reconstructed legible, the honesty of replay is rhetorical."

This is **latent fragmentation** — not yet a violation because no replay UI exists, but it will be a violation the moment one lands without explicit visual separation.

### Seam 4: Audit-write durability ↔ Operator surface

`pending_not_written` is the default `eventState`. The reference writer never claims `persisted`. `defer_until_contract_aligned` is the audit-persistence default. Today, no operator surface tells the difference between an event in memory and an event in durable storage.

Per [w2-pr7b-operational-trust-continuity.md](w2-pr7b-operational-trust-continuity.md): "When a real writer lands, the surface must update; if it doesn't, an operator will not be able to tell that durability changed."

This is **invisible-by-design pending the persistence wave (TRUST-PERSIST-1).** The fabric is honest about the gap; the gap remains an explanation surface that doesn't exist yet.

## Channels that are intentionally decoupled

Some apparent fragmentations are right calls, not gaps to close:

### Lane health is not a trust-state input

`SourceHealthState` flows to `LaneHealthBadge` 1:1; it does not become a `TrustBand` modifier. Per [w2-pr7b-runtime-semantics-cohesion.md](w2-pr7b-runtime-semantics-cohesion.md): "Lane health is intentionally not a trust-state input; this is the right call (operational health is not provenance). The decoupling is honest, not a fragmentation."

A lane being slow does not make a verified credential less real. Coupling them would conflate availability with truth. Continuity is preserved by **not** unifying.

### Replay is a verb without a noun

A replay invocation does not write its own audit row. Replay is computed-on-demand from recorded inputs. There is no `REPLAY_PERFORMED` audit event type.

This is a defensible choice: replay is read, not write; recording every replay would create a feedback loop in the audit table. But it does mean an operator cannot ask "who replayed capsule X yesterday?" and get an answer. Continuity is preserved at the cost of replay-event queryability.

### `recordedBy: 'demo'` is a structural distinction

Demo paths and real paths exist side by side. `recordedBy: 'demo'` and `demo_not_persisted` are explicit literals. The fabric does not pretend demo data is real; the fabric does not pretend real data is demo. This is the strongest single anti-trust-inflation lever in the codebase.

## Continuity by user perspective

### What a clinician operator sees ⚠️ partial

- Passport surface renders trust state, lane health, readiness — all from the trust-state channel.
- Audit timeline (`AuditTrailTimeline`) renders state-transition events ([w2-pr4d-operator-understanding.md](w2-pr4d-operator-understanding.md)).
- No replay surface; no forensic dossier route.
- Cross-channel reading: a clinician can see *what is* and *what was logged*, not *how it was derived* or *what would happen if replayed*.

### What an employer operator sees ⚠️ partial

- Employer review console renders acceptance state.
- `AuditTerminal` renders audit log entries.
- `EmployerNextBestAction` renders action + reason.
- No surface displays the issuer-side refusal vocabulary; the two state machines render as one workflow.
- Cross-channel reading: an employer can see *the relationship* with a clinician and *the audit log of that relationship*; they cannot see *the issuer's opinion* of the underlying credential beyond the proof-tier label.

### What a verifier operator sees ⚠️ partial

- Verifier dashboard renders aggregated metrics (totalCredentials, expiringSoon, psvWindowBreaches, avgDaysToVerification, revenueImpact).
- `AuditProofViewer` renders cryptographic proof chain.
- `AuditBundlePreview` renders bundle id and signature status.
- No replay viewer; no denial inspector; no actor-keyed query.
- Cross-channel reading: verifier sees *aggregate state* and *per-bundle integrity*; they cannot see *behavioral patterns of the runtime* (denial trends, refusal trends, replay history).

### What a forensic auditor sees ⚠️ partial

- Per-capsule replay bundle: high fidelity ([forensic-explainability.md](forensic-explainability.md) Track B).
- Cross-capsule reconstruction: requires manual reconciliation across two state machines.
- Continuity rests on the bundle, which is self-describing but not signed.

## Strongest continuity gain in the wave

**The runtime trust cohesion helper (`buildRuntimeMutationMetadata`).** One helper imported by every mutation route handler. One taxonomy (8 actions, 8 classifications, 6 R-CAT codes). One payload-redaction list. One determinism contract verified by [runtimeTrustCohesion.test.ts](../../apps/api/backend/src/services/__tests__/runtimeTrustCohesion.test.ts) and [replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts).

Before this helper, mutation classification was implicit and route-by-route. After this helper, every mutation in the system speaks the same metadata vocabulary. This is the load-bearing continuity gain of the wave.

## Weakest continuity surface

**The replay envelope's recorded-vs-computed boundary.** Forensically critical. UI absent. Latent until a replay surface lands. The moment one does, an operator reading mixed fields as historical fact will misread the system.

Honorable mention: **denial granularity collapse.** Three reasons under one event type biases group-by-event-type metrics toward "all denials are one signal."

## Verdict

**One coherent operational trust fabric at the contract layer. Multiple partially-disconnected systems at the surface layer.**

The four channels — trust state, lineage, replay, audit — speak the same literal vocabulary, share the same hashing methodology, share the same actor and runtime-trust taxonomy. Within a single capsule's lifecycle, they form one continuous fabric. Across the issuer ↔ employer seam, they thin into two cloths sewn at the passport. Across the operator surface, they are largely invisible: no replay UI, no denial inspector, no audit-write status display, no cross-system reconciliation surface.

This is **the right ordering**. The contract layer is the load-bearing one for trust honesty; the surface layer is the operator-experience one. W2 closed the contract layer. The next wave (and per the memory snapshot, TRUST-PERSIST-1 specifically) needs to close the surface layer.

The fabric, today, is honest about its own seams. That is the highest property a young trust system can hold.

**Track C score: 🟡 PARTIAL.** Strongest continuity gain: the runtime trust cohesion helper. Weakest continuity surface: replay-envelope recorded-vs-computed boundary. **Trust-fabric continuity is high at the contract, partial at the seam, and absent at the operator surface — exactly where the wave was scoped to leave it.**
