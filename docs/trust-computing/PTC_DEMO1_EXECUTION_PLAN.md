# PTC Demo 1 execution plan

Status: proposed sequence and acceptance gates for review after PTC-WAVE-00. No implementation is authorized by this document.

## Demonstration contract

Demo 1 proves one bounded claim:

> Given the same persistent professional evidence state and two different, versioned institutional policies, VitalCV deterministically computes what is already usable, the minimum additional actions, the affected delta after a change, and two integrity-bound proofs without conflating computation with employer acceptance.

The demo contains exactly:

- one synthetic clinician (`synthetic:clinician:sarah-chen`);
- one private persistent evidence snapshot hydrated into `EvidenceCollection`;
- two checked-in, human-authored TrustSpecs;
- one pure compiler and one exact bounded optimizer;
- one synthetic state-board refresh;
- incremental recompilation with full-recompile equivalence;
- two immutable ProfessionalStateProof values;
- one explicit employer acceptance recorded through the canonical decision path.

All names, organizations, source responses, costs, durations, and outcomes are synthetic and visibly labeled. No source adapter is called and no production customer data is used.

## Exact Demo 1 fixture

### Evaluation context

```text
contextId: demo1-context-2026-08-14
asOf: 2026-08-14T19:00:00.000Z
compilerVersion: ptc-compiler-0.1
plannerVersion: ptc-optimizer-0.1
```

Time is injected. No core function calls `Date.now()`.

### Initial evidence snapshot

| Evidence ID | Class | State | Source | Material facts |
| --- | --- | --- | --- | --- |
| `ev-npi` | identity | checked | `NPPES_API` | NPI present |
| `ev-oig` | exclusion | checked | `OIG_LEIE` | no exclusion result observed in synthetic response |
| `ev-ca-license-v1` | licensure | stale | `STATE_BOARD` | jurisdiction CA, restriction NONE, observed 2025-07-01 |
| `ev-board` | board_cert | checked | `SYNTHETIC_BOARD_REGISTRY` | board certification present |
| `ev-training` | training | checked | `SYNTHETIC_TRAINING_REGISTRY` | one completed program |
| `ev-employment` | employment | checked | `SYNTHETIC_EMPLOYMENT_RECEIPT` | employment evidence present; institution review still required |

No registration or WA license evidence exists initially. “Synthetic” source IDs cannot be rendered as live integrations.

### Employer A TrustSpec (`demo-employer-a`, version 1)

| Requirement | Normalized condition | Initial result |
| --- | --- | --- |
| `a-npi` | identity exists, checked, source NPPES_API | SATISFIED |
| `a-oig` | exclusion exists, checked, source OIG_LEIE | SATISFIED |
| `a-ca-license-current` | CA licensure checked and fresh within 30 days | STALE |
| `a-ca-license-unrestricted` | same CA license has restriction NONE and is fresh | STALE |
| `a-board` | board_cert exists and checked | SATISFIED |
| `a-training` | training count at least 1 | SATISFIED |
| `a-registration` | registration exists and checked | MISSING |
| `a-employment-review` | manual institutional review of employment receipt | REVIEW_REQUIRED |

Initial summary is exactly: 4 SATISFIED, 2 STALE, 1 MISSING, 1 REVIEW_REQUIRED.

Available actions:

1. `act-refresh-ca-license` replaces `ev-ca-license-v1` with fresh `ev-ca-license-v2` and affects both CA license requirements.
2. `act-request-registration` adds checked synthetic `ev-registration`.
3. `act-review-employment-a` adds an institution-scoped review receipt for `a-employment-review`.

The exact optimizer must return those three actions. A plan with fewer than three cannot cover the three independent unsatisfied effect groups. After execution, incremental compilation evaluates four affected requirement nodes (`a-ca-license-current`, `a-ca-license-unrestricted`, `a-registration`, `a-employment-review`), reuses four, equals a clean full compile, and issues Proof A.

### Employer B TrustSpec (`demo-employer-b`, version 1)

Employer B is compiled from the post-A evidence snapshot.

| Requirement | Normalized condition | Post-A result |
| --- | --- | --- |
| `b-npi` | identity exists, checked, source NPPES_API | SATISFIED |
| `b-oig` | exclusion exists, checked, source OIG_LEIE | SATISFIED |
| `b-ca-license` | CA licensure checked and fresh within 60 days | SATISFIED |
| `b-board` | board_cert exists and checked | SATISFIED |
| `b-training` | training count at least 1 | SATISFIED |
| `b-registration` | registration exists and checked | SATISFIED |
| `b-employment-evidence` | employment evidence exists and checked | SATISFIED |
| `b-wa-license` | WA licensure exists, checked, unrestricted, fresh within 30 days | MISSING |
| `b-institution-review` | Employer B manual review | REVIEW_REQUIRED |

Seven requirements reuse evidence produced or retained through Employer A. Available delta actions are:

1. `act-apply-wa-endorsement` adds synthetic checked `ev-wa-license-v1`.
2. `act-review-proof-b` records Employer B’s institution-scoped human review result.

The optimizer returns exactly two actions. Incremental compilation evaluates only the nodes affected by each evidence/review change, proves equality with a full compile, and issues Proof B. Employer B’s later acceptance is a distinct authorized decision referencing Proof B and the exact application packet where the canonical decision contract requires one.

## Benchmark-shaped fixture contract

Every fixture is a data value with:

```text
fixtureId
description
evaluationContext
inputTrustSpec
inputEvidenceSnapshot
availableActions
expectedTrustIR
expectedEvaluations
expectedPlan
expectedIncrementalImpact
expectedProofAssertions
```

Expected IR values use canonical sorted IDs and explicit operators; tests compare structure and hashes, not prose. Expected evaluations include status, evidence IDs, source IDs, reason code, and dependency IDs.

## Exact initial golden fixtures

| ID | Input delta | Expected evaluation | Expected plan/assertion |
| --- | --- | --- | --- |
| `T001_FULLY_SATISFIED` | checked NPI evidence; one mandatory `EVIDENCE_EXISTS + SOURCE_IN` requirement | SATISFIED using `ev-npi` | empty plan; proof verifies |
| `T002_STALE_LICENSE` | CA license checked but observed outside 30-day window | STALE, reason `FRESHNESS_EXCEEDED` | one `REFRESH_SOURCE` action |
| `T003_MISSING_LICENSE` | no NV licensure candidate | MISSING, reason `NO_MATCHING_EVIDENCE` | one `APPLY_ENDORSEMENT` action when supplied |
| `T004_SOURCE_UNAVAILABLE` | only matching source lane is unavailable | SOURCE_UNAVAILABLE, reason `SOURCE_UNAVAILABLE` | no executable plan unless an explicit alternate-source action is supplied; never SATISFIED |
| `T005_CONFLICTING_LICENSE` | two active CA license facts disagree on restriction/status | CONFLICTED, reason `CONFLICTING_EVIDENCE` | one `HUMAN_REVIEW` action; conflict never silently resolves by array order |
| `T006_MANUAL_REVIEW` | evidence exists but IR contains `MANUAL_REVIEW` | REVIEW_REQUIRED | one institution-scoped `HUMAN_REVIEW` action |
| `T007_POLICY_A_VS_POLICY_B` | same CA-only evidence; A requires CA, B requires NV | A SATISFIED; B MISSING | separate compilations and hashes; no evidence recollection for A |
| `T008_SINGLE_CHANGE_MULTIPLE_DEPENDENCIES` | CA license refresh affects current + unrestricted requirements | both move STALE -> SATISFIED | impact index returns exactly both IDs; unrelated IDs reused; incremental equals full |
| `T009_POLICY_VERSION_CHANGE` | v1 freshness 365 days; v2 freshness 30 days against 60-day-old evidence | v1 SATISFIED; v2 STALE | distinct spec/IR/proof hashes; v1 proof remains unchanged |
| `T010_REVOKED_EVIDENCE` | matching evidence lifecycle is revoked | UNSATISFIED, reason `EVIDENCE_REVOKED` | revoked ID remains provenance but cannot satisfy; remediation must add/refresh evidence |
| `T011_ONE_ACTION_SATISFIES_MULTIPLE_REQUIREMENTS` | same stale CA license feeds current + unrestricted requirements | both STALE | one refresh action covers both; optimizer proves minimum count 1 |
| `T012_TWO_VALID_PLANS_DIFFERENT_COST` | two supplied one-action paths have explicit synthetic cost vectors | both reach goal | v0.1 minimizes count then lexical action ID; it does not pretend to optimize cost. Cost-aware/Pareto assertion is deferred |
| `T013_UNKNOWN_MUST_NOT_PASS` | evidence state cannot establish true or false | UNKNOWN, reason `EVIDENCE_STATE_UNKNOWN` | no proof summary may count it as satisfied and no acceptance is inferred |

Additional mandatory tests:

- invalid TrustSpec: duplicate requirement IDs, unknown dependency, cycle, unsupported operator, invalid evidence class, contradictory equality predicates, non-positive version, and invalid freshness;
- canonicalization: reordered object keys and commutative `ALL_OF` children produce the same IR/hash; semantically different policies do not;
- deterministic compile: identical context and inputs yield byte-identical canonical output;
- action preconditions and effects: an action cannot claim an effect it does not produce;
- exact planning: brute-force subset oracle agrees with the optimizer for all bounded generated fixtures;
- historical immutability: new evidence and policy versions cannot alter old proof bytes/hash;
- acceptance separation: a satisfied compilation and valid proof create no employer decision by themselves;
- privacy: internal route is explicitly authorized, private/no-store, synthetic-only, and anti-enumerating;
- runtime termination: ready, blocked, review-required, no-plan, repeated no-op, and maximum-step exits.

## Build sequence and acceptance gates

### 0. Archaeology freeze

Deliver the four Wave 00 documents, reconcile #1382 and the acceptance/start stack, and approve one canonical hashing boundary.

Gate: no unresolved duplicate owner for policy persistence, decision persistence, or evidence hydration.

### 1. TrustSpec 0.1

Add pure types, validation, canonical representation, and typed validation errors.

Gate: invalid-spec suite passes; no Prisma/HTTP/React import; no persistence migration.

### 2. TrustIR 0.1

Add the initial operator union and `compileTrustSpecToIR()`. Normalize commutative nodes and generate integrity hashes using the approved SHA-256 boundary.

Gate: structural-equivalence vectors and semantic-difference vectors pass.

### 3. Legacy equivalence safety net

Expand characterization coverage around `detectGaps()` and `projectReadiness()`, then add `toTrustSpec()` and rich-to-legacy projections.

Gate: all existing callers/tests remain unchanged; representable scenario matrix agrees exactly.

### 4. Compiler 0.1

Implement typed per-requirement evaluation and compilation summaries. Keep reason codes authoritative and prose in product adapters.

Gate: T001-T007, T009, T010, and T013 pass; no unknown/gated/unavailable/conflicted input passes.

### 5. Satisfaction relationships and dependency index

Produce derived, version-bound satisfaction records and reverse dependencies. Do not persist or project them as employer facts.

Gate: T008 passes; every edge includes evidence, requirement, spec version, compiler version, state, and provenance.

### 6. Incremental compiler

Invalidate affected requirements, reuse immutable unaffected evaluations, merge canonically, and compare to a full compile.

Gate: equality holds for every golden mutation and generated bounded mutation; evaluated/reused counts are exact.

### 7. Actions and optimizer 0.1

Add typed actions and bounded breadth-first minimum-action planning.

Gate: T011/T012 pass plus brute-force minimality; one action can cover multiple requirements; tie-break is deterministic.

### 8. Synthetic runtime

Add only fixture-owned adapters for CA refresh, registration acquisition, WA endorsement, and human review. Reuse StartAgent permission/receipt/injected-time patterns through new domain-neutral interfaces.

Gate: no network calls, no production identifiers, no unrestricted execution, no infinite loop.

### 9. Snapshot and ProfessionalStateProof

Bind canonical evidence snapshot, policy/IR hashes, compiler version, evaluations, issued-at context, expiry context, and integrity hash.

Gate: verify/replay/tamper/version/revocation/freshness tests pass; old proof remains byte-stable after state changes.

### 10. Cross-employer headless demo

Execute Employer A, issue Proof A, compile Employer B from post-A state, execute only its delta, and issue Proof B.

Gate: exact counts above, optimizer minimality, incremental/full equality, and proof diff show reused vs changed facts.

### 11. Explicit acceptance adapter

After the active decision stack lands, call the canonical authorized decision service. Never write `EmployerAcceptance`, `Recognition`, or `DecisionCapsule` directly from the demo orchestrator.

Gate: real-PostgreSQL negative authorization, idempotency, exact packet/proof binding, transactional audit/outbox, Recognition boundary, and anti-enumeration tests pass.

### 12. Internal demo UI

Render policy, evaluations, minimal plan, executed synthetic actions, incremental counts, proof diff, and separate acceptance. Keep it internal, authenticated, private/no-store, and plainly synthetic.

Gate: desktop/mobile evidence, accessible semantics, reduced-motion behavior, no claim violations, no public route link, and founder visual-gate evidence where applicable.

## Migration plan

- Steps 1-10: no migration.
- Step 11: prefer existing canonical decision persistence. Any proof reference or structured requirement-level decision needs a separate schema ADR and real-PostgreSQL migration-chain test.
- Production TrustSpec/proof storage: deliberately outside Demo 1 until the credential-operations template and retention/access boundaries are reviewed.

## Stop/go rule

Do not begin Step 1 from this branch. Architecture review is the next action. A GO must name the first independently testable bundle and resolve the hashing boundary plus #1382 ownership.
