# Operator Governance Integrity — W2-PR11B Track A

**Wave:** W2-PR11B — Operator Governance + Runtime Honesty Enforcement
**Date:** 2026-05-08
**Status:** Review-only synthesis. No code changes, no merges.
**Risk class:** SAFE (read-only inventory).
**Companion to:** [dashboard-runtime-honesty](dashboard-runtime-honesty.md), [runtime-honesty-continuity](runtime-honesty-continuity.md), [longitudinal-governance-survivability](longitudinal-governance-survivability.md).
**Builds on:** [survivability-explainability](survivability-explainability.md), [forensic-durability-understanding](forensic-durability-understanding.md), [runtime-durability-continuity](runtime-durability-continuity.md), [trust-fabric-durability-cohesion](trust-fabric-durability-cohesion.md).

---

## What this track answers

PR10B Track A asked whether an operator would *correctly classify* a state. **This track asks whether the operator-facing governance frame — the language, taxonomy, dashboards, runbooks, and review surfaces — would *prevent the misclassification* over time, or would let it normalize.**

The risk vector here is not first-time confusion. The risk vector is **drift-by-repetition**: an operator who reads the same shape ten times forms a habit. If the shape implies a stronger property than the contract holds, the habit hardens before the next contributor arrives to question it. Governance integrity is the question of whether the platform makes the habit congruent with the contract, or whether the platform leaves the habit free to drift.

## Definitions

- **Governance integrity:** the property that an operator's repeated mental model of a state stays congruent with the contract layer that produced it.
- **Drift-prone surface:** a surface whose shape, copy, or default rendering admits an interpretation stronger than the contract holds, with no operator-facing correction.
- **Trust-class misuse:** an operator routing a candidate through a workflow inappropriate for its proof tier or decision grade — typically by reading a `'receipt_candidate'` as a `'psv_receipt'` or treating a `decisionGrade: false` row as decisional.
- **Replay over-trust:** an operator treating a replay envelope as a comprehensive forensic record when it is per-capsule and projection-fragile.
- **Export durability misunderstanding:** an operator treating the exported audit bundle as a complete snapshot when the export is best-effort.
- **Forensic continuity overestimation:** an operator believing the audit table answers questions it does not have rows for (issuer-side refusals, replay invocations, `eventState` transitions).
- **C-1 vs T0 semantic confusion:** an operator collapsing the durable-checkpoint chain (C-1) and the originating-mutation chain (T0) into a single "lineage."

## Operator governance scoreboard

Each cell is a governance question, paired with the failure mode it admits today.

| Governance question | Where it's framed | Failure mode admitted | Score |
|---|---|---|---|
| Would an operator misuse a `proofTier: 'receipt_candidate'`? | trust contract types + [CLAUDE.md](../../CLAUDE.md) banned-strings | demo paths render `recordedBy: 'demo'`; literal `decisionGrade: false` enforced; doctrine layer holds | 🟢 CONTROLLED |
| Would an operator misuse `proofTier: 'psv_receipt_candidate'` (output of `accept_candidate`)? | [policyReview.ts](../../apps/web/lib/issuer-verification/policyReview.ts) five-gate sequence | the candidate type is distinct from a real `PSVReceipt`; promotion is gated; `decisionGrade: false` literal stays | 🟢 CONTROLLED |
| Would an operator over-trust the replay envelope as "the system's record"? | replay envelope shape | recorded fields and replay-time computed fields share one envelope without a marker; outer R-CAT-6 masks inner action | 🟠 DRIFT-PRONE |
| Would an operator over-trust a per-capsule replay as a window-wide forensic record? | bundle export schema | bundle reads as comprehensive; pending audit rows + non-capsule events are absent | 🟠 DRIFT-PRONE |
| Would an operator misunderstand export durability? | `buildAuditBundle` ([replayEngine.ts:550-607](../../apps/api/backend/src/services/audit/replayEngine.ts)) | best-effort silent drop; `capsuleCount` is survived not requested; no `partialExport` flag | 🔴 MISLEADING |
| Would an operator overestimate forensic continuity for issuer-side refusals? | `policyReview.ts` `refusalGate` return value | no `REFUSAL_RECORDED` event type; zero forensic floor on refusals | 🔴 MISLEADING |
| Would an operator overestimate forensic continuity for replay invocations? | absence of replay-event row | no audit row says "a replay happened"; observable in HTTP logs only | 🟠 DRIFT-PRONE |
| Would an operator confuse C-1 (durable checkpoint) and T0 (originating mutation)? | runtime trust block in capsule metadata | both chains carry into the same envelope unmarked; "lineage" is a single word for two chains | 🟡 PARTIAL |
| Would an operator misread `'unknown'` as a real actor identity? | `RuntimeTrustActor.actorId` literal | `'unknown'` is a fallback recorded faithfully; no surface distinguishes from anonymous or system | 🟠 DRIFT-PRONE |
| Would an operator misread `'UNKNOWN'` trust band as a decision-time fact? | `evidenceSnapshot.trustStateAtDecision` | dual-cause (recorded vs replay-time fallback); `capturedAt: null` discriminates but is not visually distinct | 🟠 DRIFT-PRONE |
| Would an operator misread a `pending_not_written` audit row as durable? | `eventState` literal exists; no surface | code-side flag only; surface mirrors happy path | 🟠 DRIFT-PRONE |
| Would an operator misread `EMPLOYER_REVIEW_MUTATION_DENIED` as one kind of denial? | event-type taxonomy ([auditEventTypes.ts:31](../../apps/api/backend/src/types/auditEventTypes.ts)) | three reasons collapsed under one type; reason lives in payload | 🟠 DRIFT-PRONE |
| Would an operator misread retries as distinct events? | `mutationFingerprint` exists; no surface group-bys it | fingerprint detects retries; surface treats correlation-keyed events as distinct | 🟠 DRIFT-PRONE |
| Would an operator misread `bundle.issuer: 'VitalCV'` as cryptographic provenance? | bundle field | string literal; no signature; transport-trusted only | 🔴 MISLEADING |
| Would an operator misread `verificationInstructions.how` as offline re-verification? | bundle field | hash-only; no third-party verifier client; instructions imply more | 🔴 MISLEADING |

**Tally:** 2 🟢, 1 🟡, 8 🟠, 4 🔴.

## Governance failure register

Each entry below is a specific operator behavior that today's surfaces would let normalize over months of repeated use. Severity is graded by both impact and reversibility — drift in copy is recoverable; drift in operator habit is harder to pull back.

### GF-1 — Trust-class misuse via candidate-vs-receipt collapse 🟢

**Behavior:** an operator treats a `PSVReceiptCandidate` output of `accept_candidate` as a real `PSVReceipt` and exports/cites it as a decisional artifact.

**Why governance prevents it:** the truth contract literalizes the discriminator. `ReceiptCandidate.decisionGrade` is the literal `false`. `PSVReceiptCandidate` carries a distinct `proofTier: 'psv_receipt_candidate'`. Promotion to `PSVReceipt` is a separate gated wave. [CLAUDE.md](../../CLAUDE.md) bans all the inflation strings that would let this collapse render. The doctrine-level gate is robust under every degradation mode in the inventory.

**Residual risk:** if a future contributor relaxes the literal to `boolean`, the doctrine gate softens. Type-system enforcement (`isolatedModules` + literal types in `packages/domain-common`) is the load-bearing defense; that defense holds today.

**Score:** 🟢 CONTROLLED.

### GF-2 — Replay over-trust as system-of-record 🟠

**Behavior:** an operator reads a replay envelope as "this is what the system actually has on this decision," includes it in a regulator response, and forms confidence that decision-time and replay-time fields are interchangeable.

**Why drift forms:** the `DecisionReplay` envelope mixes recorded fields (decision, evidence references, authority chain) with replay-time computed fields (`integrity.recomputedHash`, `replayedAt`, `replayMetadata`, `evidenceSnapshot.sourcesConsulted` re-derived from current artifact rows). No marker on the envelope distinguishes them ([survivability-explainability.md](survivability-explainability.md) replay-fragile path #3, [forensic-durability-understanding.md](forensic-durability-understanding.md) FA-4). After ten reads, the operator stops checking which field came from where.

**What would prevent it:** an envelope-level `recordedAt` / `replayedAt` separation, or a `provenance: 'recorded' | 'replay-computed'` tag on each field. None of those exist today.

**Score:** 🟠 DRIFT-PRONE.

### GF-3 — Bundle as window-wide forensic record 🔴

**Behavior:** an operator hands a bundle to opposing counsel or a regulator and represents it as the complete audit record for the window.

**Why drift forms:** `buildAuditBundle` ([replayEngine.ts:550-607](../../apps/api/backend/src/services/audit/replayEngine.ts)) is synchronous, serial, best-effort. Per-capsule replay errors are caught + logged + dropped silently at [replayEngine.ts:568-573](../../apps/api/backend/src/services/audit/replayEngine.ts). `capsuleCount` reflects survived count ([replayEngine.ts:592](../../apps/api/backend/src/services/audit/replayEngine.ts)), not requested. `bundleHash` is internally consistent over what survived. `verificationInstructions.how` reads as offline re-verification. The schema has no `requestedCount`, no `droppedIds`, no `partialExport` flag. There is no field whose presence would let the recipient detect the gap.

**What would prevent it:** any one of `requestedCount`, `droppedIds`, `partialExport: true`, or a `manifest` block in the bundle schema would reduce this from confidently-wrong to read-the-flag. None exist today.

**Score:** 🔴 MISLEADING — this is the canonical highest-impact governance failure in the inventory because the artifact most likely to leave VitalCV is the artifact that most strongly implies completeness.

### GF-4 — Forensic continuity overestimate via absent rows 🔴

**Behavior:** an operator runs a query against the audit table for a window, finds zero `refusalGate` rows or zero `REPLAY_INVOKED` rows, and concludes "no refusals happened" or "no replays happened" during the window.

**Why drift forms:** issuer-side `refusalGate` is a return value of [`policyReview.ts`](../../apps/web/lib/issuer-verification/policyReview.ts) helpers and does not produce an audit row at all ([forensic-durability-understanding.md](forensic-durability-understanding.md) FA-3). Replay is computed-on-demand and writes no audit row. The operator's query is correct; the table's coverage is not what they assume.

**What would prevent it:** a `REFUSAL_RECORDED` event type in the `AuditEventType` union and a `REPLAY_INVOKED` event type would each close one of the dark zones. Both are absent.

**Score:** 🔴 MISLEADING — "no row" reads as "no event," and the absence is invisible.

### GF-5 — Retry-as-many-events 🟠

**Behavior:** an operator counts three retry rows as three distinct mutations, reports incident throughput as 3× actual, or escalates "user is hammering the endpoint" when the underlying behavior is one logical refresh.

**Why drift forms:** `buildRuntimeMutationMetadata` ([runtimeTrustCohesion.ts:143-190](../../apps/api/backend/src/services/runtimeTrustCohesion.ts)) emits a deterministic `mutationFingerprint` that detects retries; no surface group-bys the fingerprint ([survivability-explainability.md](survivability-explainability.md) T0 explainability). Operators see correlation IDs, not fingerprints.

**What would prevent it:** any timeline surface that reduces by `mutationFingerprint` rather than `correlationId` would resolve this. The literal exists; the rendering does not.

**Score:** 🟠 DRIFT-PRONE.

### GF-6 — `'unknown'` actor as identity 🟠

**Behavior:** an operator treats a stream of `actorId: 'unknown'` rows as a single "user named unknown" performing actions, or aggregates by `actorId` and reads a stable cohort.

**Why drift forms:** `'unknown'` is recorded faithfully but is a fallback, not an identity. The recorded shape does not distinguish unattributed from anonymous from system-with-no-header ([forensic-durability-understanding.md](forensic-durability-understanding.md) FA-2, TIV-3).

**What would prevent it:** rendering `'unknown'` rows in a visually distinct lane (a banner, a column callout, a separate timeline track) would resolve this. Today no surface paints the distinction.

**Score:** 🟠 DRIFT-PRONE.

### GF-7 — `'UNKNOWN'` trust band as decision-time fact 🟠

**Behavior:** an operator reads `trustStateAtDecision: 'UNKNOWN'` as "the trust band was unknown at the time of the decision."

**Why drift forms:** the same literal is reachable from two structurally distinct causes — recorded fact (the trust state was genuinely unknown) or replay-time fallback (the `TRUST_STATE_ENGINE` artifact aged out before replay). The discriminator is `evidenceSnapshot.trustStateAtDecision.capturedAt: null`, which is not visually distinct ([forensic-durability-understanding.md](forensic-durability-understanding.md) FA-7, HA-1).

**What would prevent it:** an explicit `trustStateAtDecision.cause: 'recorded' | 'replay_fallback'` field. Today the discriminator is present but inattentive readers do not see it.

**Score:** 🟠 DRIFT-PRONE — and worsening with retention age.

### GF-8 — `pending_not_written` invisibility 🟠

**Behavior:** an operator reads any audit-table row and assumes it is durable.

**Why drift forms:** `eventState: 'pending_not_written'` is the default literal in code; no surface, schema, or API field surfaces it. The literal exists for inspectors with source-code access only.

**What would prevent it:** any timeline column or API field that exposes `eventState` would resolve this. The single highest-leverage gap for survivability honesty ([trust-fabric-durability-cohesion.md](trust-fabric-durability-cohesion.md) Gap 1).

**Score:** 🟠 DRIFT-PRONE.

### GF-9 — Denial event-type collapse 🟠

**Behavior:** an operator group-bys `event.type = EMPLOYER_REVIEW_MUTATION_DENIED` and treats the count as one kind of denial.

**Why drift forms:** three reasons (`already_accepted`, `passport_unavailable`, `acceptance_blocked`, plus NPI variants) collapse to one event type. Reason lives in payload, not type ([forensic-durability-understanding.md](forensic-durability-understanding.md) FA-6).

**What would prevent it:** denial-reason-typed event subtypes (e.g., `EMPLOYER_REVIEW_DENIED_ALREADY_ACCEPTED`), or a `denial.reason` field promoted into a query-friendly column. Today neither exists.

**Score:** 🟠 DRIFT-PRONE.

### GF-10 — `bundle.issuer: 'VitalCV'` as cryptographic provenance 🔴

**Behavior:** an operator (or external recipient) treats the bundle's `issuer: 'VitalCV'` field as a binding cryptographic claim.

**Why drift forms:** the field is a literal string. `bundleHash` detects in-transit tampering only ([forensic-durability-understanding.md](forensic-durability-understanding.md) FA-10, TIV-6). Trust depends on transport (TLS to api.vitalcv.com), not on artifact-level signature. A motivated attacker could generate a bundle with the same hash methodology and the same literal.

**What would prevent it:** a detached signature over the bundle hash, signed by a VitalCV-controlled key, with public-key disclosure on the verification endpoint. None of that exists today.

**Score:** 🔴 MISLEADING.

### GF-11 — C-1 vs T0 semantic confusion 🟡

**Behavior:** an operator collapses "the durable checkpoint" and "the originating mutation" into a single "lineage" and conflates the two when describing the platform to auditors or contributors.

**Why governance partially prevents it:** the runtime cohesion contract is tested. [replayEngine.runtimeCohesion.test.ts](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts) verifies that `correlationId / payloadHash / mutationFingerprint` flow `buildRuntimeMutationMetadata` → capsule metadata → `replayDecision` verbatim. The two chains do reconcile.

**Why some drift remains:** the *language* "lineage" elides the distinction in operator-facing copy. There is no docs convention that uses "C-1" and "T0" as named concepts. They appear in this and prior PR10B docs but not in code, comments, or operator-facing surfaces.

**What would prevent it:** explicit C-1/T0 naming in the code's metadata-block comments and in operator runbooks. Today the distinction is contract-honest and nameless at the surface.

**Score:** 🟡 PARTIAL.

### GF-12 — Outer R-CAT-6 over inner R-CAT-1…5 🟠

**Behavior:** an operator (or any flat-projection consumer) reads 100% of replays as `replayCategory: 'R-CAT-6' / 'DOSSIER_REPLAY'`.

**Why drift forms:** every replay envelope's outer category is unconditionally `R-CAT-6`. The original action's R-CAT-1…5 lives inside `meta.runtimeTrust` ([forensic-durability-understanding.md](forensic-durability-understanding.md) FA-5, [survivability-explainability.md](survivability-explainability.md) replay-fragile path #1).

**What would prevent it:** rendering inner R-CAT alongside outer R-CAT in any operator surface. Today no surface separates them.

**Score:** 🟠 DRIFT-PRONE.

## Governance integrity matrix

The five governance questions the wave brief prescribed, scored against today's surfaces and contract layer.

| Governance question | Doctrine layer | Structural layer | Surface layer | Operator habit risk |
|---|---|---|---|---|
| Misuse trust classes | 🟢 banned-strings + literal types | 🟢 type system | 🟢 demo gates render | 🟢 LOW |
| Over-trust replay visibility | n/a (not a copy gate) | 🟠 envelope mixes provenance | 🟠 no marker | 🟠 MEDIUM-HIGH |
| Misunderstand export durability | n/a | 🔴 schema implies completeness | 🔴 no `partialExport` field | 🔴 HIGH |
| Overestimate forensic continuity | n/a | 🔴 no event type for refusals/replays | 🔴 absent rows | 🔴 HIGH |
| Confuse C-1 vs T0 | n/a | 🟢 round-trip tested | 🟡 nameless | 🟡 LOW-MEDIUM |

**Pattern:** doctrine-layer integrity is high (banned-strings, literal types, demo gates do their job). Structural-layer integrity has three serious gaps (replay envelope provenance, bundle export shape, missing event types). Surface-layer integrity is largely absent — almost no operator surface renders the off-happy-path literals.

## Where governance integrity holds best

**Trust-class governance is the strongest surface.** The truth contract is doctrine-protected, type-enforced, demo-gated, and has a five-gate sequence on `accept_candidate` ([policyReview.ts](../../apps/web/lib/issuer-verification/policyReview.ts)). The combination of [CLAUDE.md](../../CLAUDE.md) banned-strings, literal types in `packages/domain-common`, and `recordedBy: 'demo'` end-to-end propagation makes trust-class misuse the lowest-drift behavior in the inventory. An operator who tries to round-trip a `'receipt_candidate'` as a `'psv_receipt'` is contradicted at three layers simultaneously.

This is the governance integrity success of the wave: a layered defense that no single contributor can erode.

## Where governance integrity holds worst

**Export-durability governance is the weakest surface.** The bundle schema admits the most consequential operator habit drift in the inventory because the artifact most likely to leave the perimeter is the artifact that most strongly implies completeness. There is no doctrine-level gate (it is not a copy violation), no structural-level gate (the schema does not require `requestedCount`), and no surface-level gate (no operator-facing UI declares the gap).

A regulator reading the bundle alone forms FA-1 (false forensic assumption #1) and is *correct to* form it given the artifact's shape. The platform does not give them a way to detect the gap. This is the governance failure that compounds fastest with operator repetition: every successful bundle export reinforces "bundles are complete," and the next contributor inherits the habit.

## Operator runbook coverage

A separate slice of governance integrity: do the docs that operators read describe the platform as it is, or as the happy path implies? Surveying the relevant ops-docs corpus:

| Doc | Describes off-happy-path? | Names the survivability literals? |
|---|---|---|
| [forensic-explainability.md](forensic-explainability.md) | ✅ | ✅ |
| [survivability-explainability.md](survivability-explainability.md) | ✅ | ✅ |
| [forensic-durability-understanding.md](forensic-durability-understanding.md) | ✅ | ✅ |
| [runtime-durability-continuity.md](runtime-durability-continuity.md) | ✅ | ✅ |
| [trust-fabric-durability-cohesion.md](trust-fabric-durability-cohesion.md) | ✅ | ✅ |
| [vitalcv-public-claims-matrix.md](vitalcv-public-claims-matrix.md) | partial (claims-side) | partial |
| [launch-blockers.md](launch-blockers.md) | partial (blocker-side) | n/a |
| Operator-facing runbook for incident response | (absent) | (absent) |
| Operator-facing runbook for bundle export to regulator | (absent) | (absent) |
| Operator-facing runbook for `'unknown'` triage | (absent) | (absent) |

**Pattern:** the *internal* docs corpus describes the platform's off-happy-path behavior in detail. The *operator-facing* runbook layer is largely absent. New contributors and operators inheriting the platform read code or read these review docs; they do not read a runbook because none exists.

## Verdict

**Operator governance integrity is robust at the doctrine layer, partial at the structural layer, drift-prone at the surface layer, and undocumented at the operator-runbook layer.**

Trust-class misuse is structurally prevented by literal types + banned strings + demo gates. Export-durability misunderstanding is structurally invited by a schema that implies completeness without declaring best-effort. The seven middle-band governance failures (replay over-trust, retry collapse, `'unknown'` as identity, `'UNKNOWN'` band as fact, `pending_not_written` invisibility, denial collapse, outer R-CAT-6) are each a habit that hardens with repeat use because no operator surface contradicts them.

The cross-cutting pattern: **governance integrity tracks the wave's deliberate ordering. The contract is robust, the structure is partially robust, the surface is silent, the runbook is absent.** Operators today rely on source-code awareness or on the internal docs corpus; both are unstable foundations for governance because both are accessed by a small subset of the people who will read the artifacts the platform produces.

**Strongest runtime-honesty surface:** the truth contract — doctrine-protected literal `decisionGrade: false`, distinct `proofTier` literals, five-gate `accept_candidate` sequence, `recordedBy: 'demo'` end-to-end propagation. Operator misuse is contradicted at three layers.

**Biggest operator-overtrust risk:** export durability misunderstanding (GF-3) compounded by forensic continuity overestimate (GF-4). The bundle that leaves VitalCV does not declare what it is; the audit table does not have rows for what it does not record. Both compound with operator repetition.

**Track A score: 🟠 DRIFT-PRONE.** Two 🟢, one 🟡, eight 🟠, four 🔴. **Operator governance integrity is doctrine-protected at the trust-class layer, structurally inflated at the export-bundle and event-type layers, and surface-silent at the survivability-literal layer — operators preserve trust honesty by default and erode survivability honesty by repetition.**
