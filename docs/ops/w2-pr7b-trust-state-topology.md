# W2-PR7B — Trust-State Topology

**Wave:** W2-PR7B — Trust-State Operational Cohesion
**Date:** 2026-05-08
**Status:** Review-only. No code changes, no merges.
**Risk class:** SAFE (read-only synthesis).
**Builds on:** [W2-PR4A runtime cohesion](w2-pr4a-runtime-cohesion.md), [W2-PR4D trust-state continuity](w2-pr4d-trust-state-continuity.md), [W2-PR6B trust-state explainability](w2-pr6b-trust-state-explainability.md), [VitalCV Knowledge Trust Graph](../architecture/vitalcv-knowledge-trust-graph.md).

---

## Why this doc

PR4A–PR6B documented each state surface in isolation. PR7B asks the operational question: do these surfaces form **one trust system** or **partially disconnected semantic systems**? This file pins the canonical topology so subsequent tracks (semantics, mental model, continuity) can refer to the same map.

## State families

VitalCV holds eight distinct state families. Each has a literal source-of-truth, a producer module, and a consumer surface.

| Family | Literal source | Producer | Surface |
|---|---|---|---|
| **Dossier** | `IssuerVerificationRequest` lifecycle, `EmployerAcceptance` rows | issuer-verification chain, employer-review service | `/passport/[id]`, `/issuer/{review,policy-review}/[requestId]` |
| **Confidence** | `proofTier: 'receipt_candidate' \| 'psv_receipt_candidate' \| 'psv_receipt'`, `decisionGrade: false \| true` | `receiptCandidate.ts`, `policyReview.ts`, `psvReceipt.ts` | issuer review surfaces (demo), passport (when wired) |
| **Readiness** | `ReadinessStatus` (`DECISION_GRADE \| CHECKING \| BLOCKED \| PARTIAL`) | `live-path/contracts.ts:46-58` | passport readiness card, status badge |
| **Replay** | `DecisionCapsule.metadata.runtimeTrust`, computed `replayMetadata` | `replayEngine.ts` (lines 250–263, 396–481) | (no UI surface yet — backend output only) |
| **Provenance** | `SourceHealthState` (`LIVE \| DEGRADED \| RATE_LIMITED \| UNAVAILABLE \| UNKNOWN`) | source-health snapshots | `LaneHealthMount` on passport + employer dashboard |
| **Mutation** | `RuntimeMutationAction` (8 values), `RuntimeMutationClassification` (9 values), `RuntimeReplayCategory` (R-CAT-1…6) | `runtimeTrustCohesion.ts:4-141` | audit rows, outbox, replay output |
| **Audit** | `IssuerAuditWriteStatus` (`pending_not_written \| demo_not_persisted \| simulated \| persisted \| failed \| unavailable`), `PSVReceiptAuditEventState` | `auditPersistence.ts`, `auditPersistenceAdapter.ts`, `auditEventTypes.ts` | (no UI yet — internal to writer/replay) |
| **Denial** | `EMPLOYER_REVIEW_MUTATION_DENIED` event + denial_reason (`already_accepted \| passport_unavailable \| acceptance_blocked`) | `employerReviewActions.ts:124-177`, `employerActions.ts:276-311` | (currently audit-only) |

## Canonical issuer-verification transitions (Confidence + Dossier)

```
IssuerResponse
   │
   ├── confirmed              ─→ ReceiptCandidate(reviewState=ready_for_policy_review)
   ├── partially_confirmed    ─→ ReceiptCandidate(reviewState=review_required)
   ├── corrected              ─→ ReceiptCandidate(reviewState=conflict_review_required)
   ├── legally_only           ─→ ReceiptCandidate(reviewState=review_required, requires limitation note)
   ├── requires_release       ─→ ReceiptCandidate(reviewState=release_required)
   ├── wrong_office           ─→ ReceiptCandidate(reviewState=reroute_required)
   └── unable_to_verify       ─→ ReceiptCandidate(reviewState=unable_to_verify)   [terminal]

ReceiptCandidate(decisionGrade=false, proofTier='receipt_candidate')
   │
   ├── action != accept_candidate                 ─→ refusal (gate 1)
   ├── responseStatus == wrong_office             ─→ refusal (gate 2)
   ├── responseStatus == unable_to_verify         ─→ refusal (gate 3)
   ├── reviewState == conflict_review_required    ─→ refusal (gate 4)
   ├── reviewState != ready_for_policy_review     ─→ refusal (gate 5)
   └── legally_only && missing limitation note    ─→ refusal (gate 6, defense in depth)
   │
   └── all gates pass ─→ PSVReceiptCandidate(decisionGrade=false, proofTier='psv_receipt_candidate')
                            │
                            └── promotion (separate gated wave) ─→ PSVReceipt(decisionGrade=true,
                                                                              proofTier='psv_receipt',
                                                                              globalCredentialTruth=false)
```

Source: [policyReview.ts:63-128](../../apps/api/backend/src/services/entity/policyReview.ts), [psvReceipt.ts:140-154](../../apps/api/backend/src/services/entity/psvReceipt.ts), [receiptCandidate.ts:32-43](../../apps/api/backend/src/services/entity/receiptCandidate.ts).

## Replay-state visibility

Replay is layered: some state is **recorded at decision time**, some is **reconstructed at replay time**. There is no UI today that distinguishes the two; both flow into one `DecisionReplay` payload.

| Field | Recorded or computed? | Source |
|---|---|---|
| `capsuleId`, `status`, `decisionTimestamp` | recorded | DecisionCapsule row |
| `runtimeTrust.{correlationId, payloadHash, mutationFingerprint}` | recorded | `capsule.metadata.runtimeTrust` |
| `evidenceRecords`, `sourcesConsulted` | **computed at replay** | VerificationArtifact query filtered to `createdAt ≤ decisionTime` |
| `trustStateAtDecision` | **computed at replay** | TRUST_STATE_ENGINE artifact lookup with fallback chain |
| `authorityChain` | **computed at replay** | deterministic reconstruction CLINICIAN→CREDENTIAL→ISSUER→VERIFIER→DECISION |
| `integrityCheck.tamperEvidence` | **computed at replay** | `capsuleEngine.verifyDecisionCapsuleReplay()` |
| `replayMetadata` | recorded fields preserved, replay category re-derived | `buildRuntimeReplayMetadata()` always emits R-CAT-6 + `DOSSIER_REPLAY` |

Source: [replayEngine.ts:267-546](../../apps/api/backend/src/services/audit/replayEngine.ts), test invariant in [replayEngine.runtimeCohesion.test.ts:78-88](../../apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts).

## Audit-state visibility

The audit-write status is a separate state machine from the trust state itself; it tracks **whether the audit row reached durable storage**, not whether the trust decision was correct.

```
pending_not_written  (default — no writer attempted)
       │
       ├── demo_not_persisted  (demo writer ran, by design did not persist)
       ├── simulated           (test/dev writer, persistence simulated)
       ├── persisted           (repository writer confirmed durable write)
       ├── failed              (writer attempted, durable write failed)
       └── unavailable         (no writer configured)
```

This is `IssuerAuditWriteStatus` in [auditPersistence.ts:61-67](../../apps/api/backend/src/services/entity/auditPersistence.ts). Per the [knowledge graph](../architecture/vitalcv-knowledge-trust-graph.md) (nodes 72–75, 82–84), default decision today is `defer_until_contract_aligned`; only `persisted` represents durable truth, and the reference writer never claims it.

The mutation-track for employer-review uses a different but parallel taxonomy: `RuntimeMutationOutcome` is `allowed | denied | replayed`, plus `RuntimeReadonlyIndicator` for blocked attempts. See [runtimeTrustCohesion.ts:43-54](../../apps/api/backend/src/services/runtimeTrustCohesion.ts).

## Denial-state visibility

Denial today is a single audit-event type with three reasons, all on the employer-review path:

| Trigger | Reason | Audit type |
|---|---|---|
| Acceptance row already exists for entity/clinician | `already_accepted` | `EMPLOYER_REVIEW_MUTATION_DENIED` |
| Passport state null/undefined | `passport_unavailable` | `EMPLOYER_REVIEW_MUTATION_DENIED` |
| `PassportState.readiness !== READY` | `acceptance_blocked` | `EMPLOYER_REVIEW_MUTATION_DENIED` |

Issuer-verification has no parallel "denied" event; refusals there are surfaced as `refusalGate` on `PolicyReviewOutcome` and as `reviewState` values on the candidate. **The two systems do not share denial vocabulary.**

## Disconnected states

Five disconnects are visible after this map:

1. **Issuer-verification chain ↔ employer-review acceptance.** Both touch the same passport, but neither flows back into the other. Acceptance-denied does not surface as a flag in the issuer chain; an `unable_to_verify` issuer response does not block acceptance attempts (acceptance gates only on `readiness === READY`, which is computed elsewhere).
2. **Audit-write status ↔ trust-state.** A persisted record and an unwritten record can carry identical trust state; the operator has no surface that distinguishes them today.
3. **Recorded replay state ↔ computed replay state.** `DecisionReplay` is a single object that mixes them.
4. **Lane health ↔ readiness.** Lane health is per-source operational health; readiness is per-credential decisional readiness. They share no field; a credential can be `DECISION_GRADE` while one of its lanes is `RATE_LIMITED`, with no rollup signal.
5. **Mutation classification ↔ issuer-verification refusal gate.** A `DENIED_MUTATION` (R-CAT-5, employer side) and a `refusalGate` (issuer side, e.g., `wrong_office_cannot_create_candidate`) are both refusals, but live in distinct namespaces.

## Ambiguous transitions

Three names carry more than one meaning. Each is documented in code; none is a bug, but each costs the operator a beat.

1. **`conflict_review_required`** appears in both `ReceiptCandidateReviewState` (set automatically when issuer responds `corrected`) and `PolicyReviewDecisionStatus` (set deliberately by a reviewer's `mark_conflict_review` action). Same string, two provenance paths.
2. **`ready_for_policy_review`** is a *candidate* review-state, set on a ReceiptCandidate immutably; **`accepted_as_psv_candidate`** is a *decision* status set on a separate `PolicyReviewDecision` object. Both mean "the green light fired" but for different lifetime objects.
3. **"review"** as a verb: employer "route to review" sends a request to a HITL queue; issuer "review_required" is a candidate-state demanding policy review. Distinct workflows, shared word.

## Hidden state downgrades

None observed in this audit. Two checks pin this:

- `runtimeTrustCohesion.test.ts:9-42` asserts `payloadHash` and `mutationFingerprint` are deterministic across `correlationId` reuse — no quiet rewrite during normalization.
- `replayEngine.runtimeCohesion.test.ts:78-88` asserts replay preserves upstream `correlationId / payloadHash / mutationFingerprint` and emits `R-CAT-6` without truncation.

`unable_to_verify` is sometimes confused with a downgrade because it terminates the chain, but it is the literal issuer response, not a quiet rewrite — and it cannot be promoted past gate 3.

## Operator-confusing transitions

Three transitions land cleanly in code but read confusingly to a human operator:

1. **Acceptance succeeds with `unable_to_verify` upstream.** The two surfaces don't talk; an employer can accept a passport whose latest issuer response was `unable_to_verify`. Code is correct (acceptance gates on `readiness`, which is computed from coverage, not from raw issuer response). Operator may not realize this.
2. **Denial reason granularity collapses in audit.** `already_accepted | passport_unavailable | acceptance_blocked` all emit `EMPLOYER_REVIEW_MUTATION_DENIED`. The reason is in the row payload, but a denial-count metric without payload-grouping reads as one bucket.
3. **`R-CAT-6 / DOSSIER_REPLAY`** is emitted unconditionally on replay, regardless of the original recorded mutation. Operator viewing replay metadata may interpret category as "this was originally a dossier-replay action" when it actually means "this is a replay of any kind of action, normalized."

---

## Topology summary

The state topology is **dense and well-named at the literal level**, **layered correctly between recorded and computed**, and **honest about audit persistence** (no system claims `persisted` falsely). It is **fragmented at the workflow seam between issuer-verification and employer-review**, and provides **no UI surface yet** for replay-state, audit-write-status, or denial granularity.

This map underlies the runtime semantics, mental-model, and continuity assessments in the companion docs.
