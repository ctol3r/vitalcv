# Professional Trust Computing architecture map

Status: PTC-WAVE-00 architecture proposal only. No production logic, schema, route, or UI is implemented by this document.

Baseline: `origin/main` at `cf64cdae4a40522defa88b3d81d4546c17787e41` on 2026-08-14.

## Decision

Build Demo 1 as an additive, deterministic layer inside `@vitalcv/domain-evidence`. Extend `@vitalcv/career-graph` only when a versioned policy or proof has canonical provenance. Keep source execution, authorization, audit, and persistence in the backend. Do not create a new package, graph, packet type, acceptance table, readiness engine, or agent runtime.

The architectural boundary is:

```text
human-reviewed institutional policy
  -> TrustSpec (declarative, versioned)
  -> TrustIR (normalized, hash-bound)
  -> compiler (evidence state, not institutional judgment)
  -> dependency index and exact bounded optimizer
  -> synthetic runtime for Demo 1
  -> immutable ProfessionalStateProof
  -> explicit employer decision through the canonical decision transaction
```

`SATISFIED` means the deterministic policy evaluator found sufficient evidence under exact inputs. It never means credentialed, privileged, approved, employed, or accepted by an employer.

## Repository evidence examined

- Product and truth doctrine: `AGENTS.md`, `DOCTRINE.md`, and `docs/architecture/vitalcv-knowledge-trust-graph.{md,json}`.
- Pure evidence/readiness logic: `packages/domain-evidence/src/types.ts`, `collection.ts`, `projectors/graph.ts`, `trust/propagate.ts`, `mobility/mobility.ts`, and `career/career.ts`.
- Ontology contract: `packages/career-graph/src/types.ts`, `projection.ts`, and `gaps.ts`.
- Canonical source truth: `packages/trust-state/sourceCoverage.ts` and `packages/source-adapters/src/{types,registry}.ts`.
- Backend trust/readiness candidates: `apps/api/backend/src/services/trust-state/*`, `services/trust/trustRulesEngine.ts`, `services/decision/{capsuleEngine,acceptanceGraph}.ts`, and `services/orgPolicyEngine.ts`.
- Application truth: `apps/api/backend/src/services/opportunities/applicationPacket{Service,ReadService}.ts`, `applicationService.ts`, and application routes.
- Persistence: `ApplicationPacket`, `DecisionCapsule`, `EmployerAcceptance`, `Acceptance`, `Recognition`, `Start`, `StartActivation`, `StartAttestation`, and `ActivationRequirement` in `apps/api/backend/prisma/schema.prisma`.
- Existing execution/planning semantics: `apps/web/lib/agent/*` (StartAgent), activation services, and credential-operations draft PR #1382.
- Active PR coordination: #1378, #1380, #1381, #1382, and #1384. No open or merged PR implements TrustSpec, TrustIR, or the Trust Compiler.

## Primitive classification

| Proposed concept | Classification | Repository-specific decision |
| --- | --- | --- |
| Persistent professional evidence | EXISTS | Retain canonical database records and the Passport-to-`EvidenceCollection` adapter. Do not add a demo-only evidence database. |
| Evidence collection | EXISTS | Retain `EvidenceObject`, `EvidenceCollection`, and `buildEvidenceCollection()` unchanged. |
| Evidence graph | EXISTS | Retain the pure evidence graph and the separate career-graph ontology; do not create a Professional Trust Graph package. |
| Institutional requirement input | ADAPT | Adapt `OpportunityRequirement`; later adapt human-reviewed credential-operations templates if #1382 lands. Neither is itself canonical TrustSpec. |
| TrustSpec | NEW | Add a pure, strict, versioned contract in domain-evidence. No persistence in the first bundle. |
| TrustIR | NEW | Add normalized operator nodes and canonical ordering in domain-evidence. |
| Trust Compiler | EXTEND | Extract reusable semantics from `detectGaps()` behind new evaluator contracts; do not rewrite or remove legacy readiness. |
| Requirement node | EXTEND | `career-graph` already names `requirement`; project only from an immutable TrustSpec version with explicit provenance. |
| Satisfaction edge | EXTEND | `career-graph` already names `satisfies` and `partially_satisfies`; enrich the derived edge contract rather than add synonyms. |
| Dependency index | NEW | Add a pure reverse index from evidence selectors to requirement IDs and compilation/proof identities. |
| Incremental compiler | NEW | Re-evaluate affected requirements, merge unchanged immutable evaluations, and prove equality with a full compile. |
| Trust action model | ADAPT | Adapt legacy `GapRemediation` and StartAgent permission/ownership patterns into compiler-owned action candidates. |
| Exact optimizer | NEW | Add bounded set-cover/state-search planning under `MINIMUM_ACTION_COUNT`; no AI scoring. |
| Trust runtime | ADAPT | Reuse StartAgent's separation of planning, execution, permissions, receipts, and injected time. Demo 1 uses synthetic adapters only. |
| Evidence snapshot | ADAPT | Reuse packet/capsule canonicalization, version binding, and replay concepts without treating a packet as a professional-state proof. |
| ProfessionalStateProof | NEW | Add a separate, content-bound result artifact; proof is computational evidence, not acceptance. |
| Employer acceptance | EXISTS | Use the canonical employer decision transaction and existing persistence after its current PR stack settles. Do not create another table. |
| Acceptance graph | EXTEND | Project existing decisions and eventual requirement-level outcomes; do not reuse the unregistered `acceptanceGraph.ts` as canonical. |
| Trust Execution Graph | DEFER | Standardize events only after compiler, actions, proofs, and acceptance ownership are settled. |
| TrustBench | ADAPT | Make every golden fixture benchmark-shaped now; reuse test-harness patterns, not StartAgent scoring semantics. |
| TrustGym | DEFER | Demo 1 synthetic adapters are not a general agent gym. |
| LLM policy ingestion | DO_NOT_BUILD | Human-reviewed typed fixtures are the only Demo 1 input. AI may draft policy later but cannot decide or activate it. |
| Blockchain, ZK, VC issuance | DO_NOT_BUILD | Not required to prove the compiler invention and must not broaden proof claims. |

## Existing components: retain, extract, adapt, extend

### Retain unchanged

- `EvidenceObject`, canonical source-coverage states, `buildEvidenceCollection()`, evidence graph projection, and trust projection.
- Public API and behavior of `detectGaps()`, `projectReadiness()`, `defaultReadinessTemplate()`, and `composeCareerModel()`.
- `ApplicationPacket` sealing/reading invariants and application consent semantics.
- Canonical employer application decision service ownership, authorization, anti-enumeration, audit, outbox, Recognition, and Start consequences.
- Existing `CareerGraphNodeType`/`CareerGraphEdgeType` members `requirement`, `requires`, `satisfies`, `partially_satisfies`, and `accepted_as_head_start`.

### Extract as pure semantics

From `packages/domain-evidence/src/mobility/mobility.ts`:

- jurisdiction extraction from evidence values;
- decision-grade enforcement for mandatory evidence;
- status matching rules;
- evidence-class, jurisdiction, trust-dimension, and decision-grade-count predicates;
- deterministic requirement ordering;
- the distinction between requirement evaluation and the product readiness roll-up.

Extraction must not copy legacy lossiness. `candidates[0]`, the four-value `GapKind`, and prose reasons are compatibility behavior, not the new evaluator contract. The compiler must preserve `SOURCE_UNAVAILABLE`, `CONFLICTED`, `UNKNOWN`, and `REVIEW_REQUIRED` rather than flatten them into `insufficient`.

### Adapt

- `OpportunityRequirement -> TrustSpecRequirement` through an explicit adapter. Evidence, trust, and experience variants map to normalized constraints; unsupported semantics reject rather than guess.
- `GapRemediation -> TrustActionCandidate` only in the legacy adapter. New action effects must name exact requirement IDs and state transitions.
- `packages/source-adapters` registry entries into source capability context. Registry identity and `@vitalcv/trust-state` launch-spine IDs must be reconciled explicitly; string similarity is not identity.
- StartAgent's stable IDs, injected clock, owner/permission/consent gates, action receipts, and deterministic bench shape. Do not import app-layer StartAgent code into a domain package.
- Packet and Decision Capsule canonical payload/replay patterns into proof construction and verification.

### Extend later

- `career-graph` projections once TrustSpec/proof provenance is immutable.
- canonical employer acceptance with a structured outcome and proof/requirement references, after the current acceptance/start PR stack is reconciled.
- credential-operations templates as a reviewed policy source, not a second compiler and not an automatic equivalence to TrustSpec.

## Duplicate-risk analysis

| Existing area | Collision risk | Ruling |
| --- | --- | --- |
| `mobility.detectGaps()` | High | Semantic donor and compatibility oracle. Never fork it into a second readiness product path. |
| Backend `trust-state` readiness | High | Feature-gated snapshot engine with loose label mapping. It may supply characterization cases, but its default matrices and substring parsing cannot define TrustSpec semantics. |
| `trustRulesEngine.ts` | Medium | Useful fail-closed negative/conflict/freshness semantics. It evaluates global trust classes, not institution-specific requirements. |
| `decision/acceptanceGraph.ts` | High | Narrow hard-coded rule evaluator, used only by legacy Omega code. Its word “acceptance” conflates computation with institution action; do not promote it. |
| `orgPolicyEngine.ts` | High | Stub/default policy with auto-approval concepts. Do not use as TrustSpec storage or activation. |
| `ApplicationPacket` | High | Immutable disclosure artifact, not reusable professional-state proof. Reuse canonicalization principles only. |
| `DecisionCapsule` | High | Replayable institutional decision provenance, not compiler output. Proof may be referenced by a future capsule, never substituted for it. |
| `ActivationRequirement` | High | Post-decision operational work ledger, not policy definition or compiler evaluation. Adapt compiler actions to it only after semantic ownership is explicit. |
| PR #1382 credential-operations templates | Critical/in flight | Versioned, reviewed workflow persistence directly overlaps policy authoring. If it lands, write a reviewed adapter from an active template version; do not add a parallel TrustSpec table in Demo 1. |
| StartAgent | High | Existing deterministic planner/runtime. Reuse execution safety patterns, but its ranked next-action heuristic is not an exact minimum-action optimizer. |
| `manifest-engine.ts` / trust proofs | Medium | Several proof/manifest objects exist. Random IDs/current time and different claim scopes make them unsuitable as canonical compiler proofs. |
| career-graph | Critical | It already is the canonical ontology contract. Extend it; do not create another graph. |
| scattered canonical JSON/SHA-256 helpers | High | Choose one canonical representation and cross-runtime hashing boundary before implementation. Never use `composeCareerModel()`'s FNV cache hash for integrity. |

## Exact file-level proposal

No files below are created in Wave 00; this is the reviewed target layout.

```text
packages/domain-evidence/src/trust-computing/
  status.ts                 # RequirementEvaluationStatus and reason codes
  trustSpec.ts              # TrustSpec 0.1 contract and constraints
  validateTrustSpec.ts      # IDs, operators, references, cycles, contradictions
  trustIr.ts                # normalized operator/node contract
  canonical.ts              # pure canonical representation and ordering
  legacyOpportunityAdapter.ts
  evaluator.ts              # evaluateRequirement()
  compiler.ts               # compileTrustSpecToIR(), compileProfessionalState()
  dependencyIndex.ts        # selectors -> requirement/compilation/proof dependencies
  actions.ts                # deterministic action candidates/effects
  optimizer.ts              # bounded exact MINIMUM_ACTION_COUNT planner
  snapshots.ts              # evidence snapshot payload contract
  proof.ts                  # ProfessionalStateProof payload + verification inputs
  fixtures/types.ts         # benchmark-shaped fixture contract
  fixtures/demo1.ts         # synthetic clinician and two employer policies
  fixtures/golden.ts        # T001-T013
  *.test.ts                 # colocated unit/equivalence/property tests

packages/domain-evidence/src/index.ts
packages/domain-evidence/package.json
pnpm-lock.yaml
  # exports and an explicitly reviewed cross-runtime SHA-256 dependency only if
  # backend injection is rejected; no transitive crypto dependency by accident

apps/api/backend/src/services/trust-computing/
  integrity.ts              # binds canonical bytes to existing SHA-256 utility
  evidenceSnapshotAdapter.ts# canonical persisted evidence -> EvidenceCollection
  syntheticRuntime.ts       # Demo-only adapters, injected clock, no real source claims
  demoService.ts            # compile/plan/execute/recompile/proof orchestration
  acceptanceAdapter.ts      # calls canonical employer decision service; no direct writes

apps/api/backend/src/routes/internalTrustComputingDemo.ts
apps/api/backend/src/routes/__tests__/internalTrustComputingDemo.test.ts
  # explicit admin/internal gate, private no-store, synthetic subject only

packages/career-graph/src/types.ts
packages/career-graph/src/gaps.ts
packages/career-graph/src/projection.ts
packages/career-graph/src/contract.test.ts
  # only when immutable TrustSpec/proof provenance exists; reuse existing terms

apps/web/app/internal/trust-computing-demo/page.tsx
apps/web/app/internal/trust-computing-demo/TrustComputingDemoClient.tsx
apps/web/__tests__/trust-computing-demo.test.tsx
apps/web/tests/e2e/trust-computing-demo.spec.ts
  # final internal demo surface, not public marketing or production capability copy
```

## Required answers

### Q1. Where should TrustSpec live?

In `packages/domain-evidence/src/trust-computing/trustSpec.ts`. It is a pure versioned policy contract, independent of Prisma, HTTP, React, and any one employer workflow. Demo 1 uses checked-in, human-authored fixtures. Persistence is deferred until the reviewed credential-operations template work (#1382) is resolved; an adapter is preferred over a second policy table.

### Q2. Where should TrustIR live?

In `packages/domain-evidence/src/trust-computing/trustIr.ts`, beside TrustSpec and the pure compiler. It is not a career-graph node store and not backend JSON. Canonical ordering/hashing belongs to the compiler boundary, with cryptographic hashing supplied by an explicitly reviewed cross-runtime implementation or backend integrity adapter.

### Q3. Can existing `OpportunityRequirement` be adapted rather than replaced?

Yes. Keep it unchanged and implement `toTrustSpec(opportunity)`. Evidence requirements map directly to evidence/jurisdiction/status predicates; trust and experience requirements map to threshold/count predicates. An unrepresentable or ambiguous field rejects with a typed adapter error. The adapter never mutates legacy evaluation.

### Q4. Which code from `detectGaps()` becomes compiler semantics?

Extract jurisdiction lookup, decision-grade mandatory enforcement, status predicate evaluation, trust-dimension lookup, decision-grade counts, and deterministic requirement ordering. Do not promote `GapKind`, prose reasons, first-candidate selection, or remediation wording to compiler semantics. Those remain legacy projection behavior.

### Q5. How will legacy readiness stay unchanged?

First add characterization tests. Then add the new files and adapter alongside the old functions. Existing callers continue to invoke `detectGaps()` and `projectReadiness()`. An equivalence suite runs the same representable scenarios through both paths and maps rich compiler results back to legacy `Gap`/`ReadinessProjection`; any intentional divergence requires an ADR before a caller switches.

### Q6. How should requirement nodes integrate with `career-graph`?

Reuse the existing `requirement`, `requires`, `satisfies`, and `partially_satisfies` ontology members. Before persistence, a requirement may be projected only from an immutable TrustSpec fixture/version and must carry synthetic/fixture provenance; it must not masquerade as a database record. Production projection waits for a canonical reviewed policy record and preserves spec version, compiler version, evaluation state, and evidence provenance. Computational satisfaction remains distinct from `accepted_as_head_start`.

### Q7. What existing persistence can represent acceptance?

The application decision path, `EmployerAcceptance`, `DecisionCapsule`, `Recognition`, and start records are the existing seam. The active #1378/#1380/#1381/#1384 stack is converging the exact packet decision and start lifecycle. Demo acceptance should call that canonical service after the stack settles; it must not write another acceptance table or treat free-text status as requirement-level acceptance. A later migration may add structured outcome/proof references, but Wave 1 does not assume them.

### Q8. Which proof parts can reuse packet hashing/snapshot concepts?

Reuse recursively canonical payloads, SHA-256 integrity, explicit methodology/version fields, immutable input snapshots, verify-on-read, replay comparison, supersession without mutation, and honest legacy behavior. Do not reuse `ApplicationPacket` itself: its scope is a consented disclosure to a recipient. Do not reuse `DecisionCapsule` itself: its scope is an institutional decision. A ProfessionalStateProof binds TrustSpec ID/version, TrustIR hash, evidence snapshot hash, compiler version, evaluations, issued-at context, and its own integrity hash.

### Q9. What is the smallest exact optimizer?

A deterministic breadth-first search over normalized action subsets for bounded fixtures. State is the sorted set of satisfied mandatory requirement IDs plus completed action IDs. Expand executable actions in stable `actionId` order, merge effects across requirements, deduplicate equivalent states, and stop at the first goal depth. The returned plan is minimal by action count; lexical action sequence is the tie-break. Exhaustive comparison against all subsets up to the chosen depth proves no shorter valid plan exists. No weights, probabilistic costs, or AI ranking enter v0.1.

### Q10. What is the smallest cross-employer demo?

One synthetic clinician evidence snapshot, Employer A policy with eight requirements, and Employer B policy with nine. Employer A initially compiles to four satisfied, two stale, one missing, and one review-required result; three synthetic actions make all mandatory requirements satisfied and issue Proof A. Employer B reuses all seven resulting evidence/review facts, adds a missing jurisdiction requirement and an institution-specific review requirement, computes only the affected delta, executes two actions, and issues Proof B. A separate authorized employer decision explicitly accepts Proof B as a head start. The UI displays requirements evaluated versus reused and verifies incremental output equals a clean full compile.

## Migration needs

Demo 1 compiler, optimizer, golden fixtures, synthetic runtime, and in-memory proof verification require no schema migration. Persisted production TrustSpecs, proofs, requirement evaluations, dependency edges, or requirement-level acceptance would require a later reviewed schema decision. Do not overload `ApplicationPacket`, `DecisionCapsule`, `ActivationRequirement`, or credential-operations case tasks to avoid that decision.

## Unresolved decisions before PTC-WAVE-01

1. Resolve #1382: land, reshape, or close the credential-operations template work before choosing TrustSpec persistence.
2. Resolve which current employer decision service is canonical after #1378/#1380/#1381/#1384; never wire the demo to a stacked implementation by assumption.
3. Choose a single cross-runtime canonical JSON + SHA-256 implementation. The repository has multiple subtly different serializers; equivalence vectors must precede reuse.
4. Define the canonical backend adapter from persisted evidence to `EvidenceCollection`. Current web composition is Passport-based; the compiler cannot accept public-filtered or demo-degraded data as institutional truth.
5. Decide whether Demo 1’s internal UI is needed for architecture approval or only after the headless proof is complete. Any visual work must follow the founder visual evidence gate.
6. Reconcile source registry IDs before `acceptedSources` can be authoritative.
7. Define retention and access policy for future proof snapshots; they may contain private professional evidence and must remain private/no-store.

## Stop condition

PTC-WAVE-00 ends with these documents. No production implementation begins until this architecture is reviewed.
