# PTC research register

Status: PTC-WAVE-00 evidence and decision register. Items marked OPEN block or constrain later implementation; they are not permission to broaden Demo 1.

## Repository and coordination record

| ID | Finding | Evidence | Decision / next check | State |
| --- | --- | --- | --- | --- |
| R-001 | No TrustSpec, TrustIR, or Trust Compiler implementation is open or merged. | GitHub open/merged PR claim-check on 2026-08-14; repository search. | Proceed with architecture only. Re-run claim check before every bundle. | CONFIRMED |
| R-002 | Draft PR #1382 adds versioned, human-reviewed credential-operations templates, requirements, hashes, and frozen case tasks. | `codex/credential-ops-core`, head `9f48eac5`, currently DIRTY. | Resolve before any TrustSpec persistence. Prefer an explicit reviewed adapter if it lands. | OPEN / IN FLIGHT |
| R-003 | PRs #1378/#1380/#1381/#1384 are converging employer acceptance, read model, integration, and start lifecycle. | GitHub PR metadata and diffs. | Do not bind Demo 1 acceptance until the canonical stack is settled on main. | OPEN / IN FLIGHT |
| R-004 | Root working tree contains unrelated dirty work and newer untracked ops documents; origin/main's checked-in `AGENTS.md` is older. | Read-only root status and comparison to clean worktree. | Preserve root. Use isolated worktree. Treat founder-supplied instructions as authority and record governance drift separately. | CONFIRMED |
| R-005 | `CODEX_HANDOFF_LEDGER.md` can lag GitHub merge truth. | Ledger top still described a work order now merged as #1383. | GitHub/current main outrank ledger status; update only within owned work. | CONFIRMED |

## Current primitive map

| ID | Primitive | Current truth | Classification | Consequence |
| --- | --- | --- | --- | --- |
| P-001 | Evidence object/collection | Pure, active, widely consumed in web product paths. | EXISTS | Compiler accepts this contract; no duplicate evidence model. |
| P-002 | Evidence graph | Pure evidence/source/subject projection exists. | EXISTS | Do not rename/fork as Professional Trust Graph. |
| P-003 | Career graph | Canonical contract package, projection/gap registry, no second storage. | EXISTS / EXTEND | Reuse existing requirement and satisfaction vocabulary. |
| P-004 | Opportunity requirement | Three typed variants feed current mobility readiness. | ADAPT | Add strict `toTrustSpec()`; retain original callers. |
| P-005 | Requirement persistence | `career-graph/gaps.ts` says scalar-only, but main now also has application-linked `ActivationRequirement`; #1382 proposes template requirements. | PARTIAL / IN FLIGHT | Gap text needs re-audit before graph work. Neither current model automatically owns TrustSpec. |
| P-006 | Gap detector | Pure deterministic evaluator with four lossy outcomes. | EXTEND | Extract predicates; retain compatibility API. |
| P-007 | Readiness projection | Pure product roll-up used through career composition. | EXISTS | Do not make compiler summary silently replace it. |
| P-008 | Canonical source states | `@vitalcv/trust-state` defines checked/stale/pending/gated/unavailable/accessRequired/reviewRequired/notDecisionGrade/notFound/previewOnly; only checked is decision-grade. | EXISTS | Compiler status mapping must be fail-closed and preserve unavailable/unknown distinctions. |
| P-009 | Source adapter registry | Live federal lanes and gated state-board capability metadata exist. | EXISTS / ADAPT | Feed source capability context only after source-ID reconciliation. |
| P-010 | Backend trust-state snapshots | Feature-gated artifact/readiness snapshot engine exists. | EXISTS / DO_NOT_DUPLICATE | Possible input/characterization donor; not compiler policy. |
| P-011 | Trust Rules Engine | Registered global rule evaluator handles negative/conflict/freshness. | EXISTS / ADAPT SEMANTICS | Reuse reason taxonomy after tests; not institution-specific compiler. |
| P-012 | ApplicationPacket | Immutable, hash-verified, authorized, exact application disclosure. | EXISTS | Reuse integrity patterns; never relabel as ProfessionalStateProof. |
| P-013 | DecisionCapsule | Replayable decision payload with trust-state/evidence digests. | EXISTS | Potential proof reference consumer; not compiler proof. |
| P-014 | Employer acceptance | Multiple records/services exist and active PRs are converging ownership. | EXISTS / NEEDS RECONCILIATION | No new acceptance table in Demo 1. |
| P-015 | Recognition/start | Recognition, Acceptance, Start, StartActivation, and StartAttestation coexist. | EXISTS / NEEDS RECONCILIATION | Follow canonical decision transaction; avoid direct writes. |
| P-016 | StartAgent | Deterministic plan/runtime, permissions, receipts, diffs, and START-Bench exist. | ADAPT | Reuse patterns, not ranked heuristic or app-layer imports. |
| P-017 | Activation requirement ledger | Application-linked post-decision tasks with transitions/audit. | EXISTS / ADAPT LATER | Potential execution output, never policy or satisfaction truth. |
| P-018 | Credential-operations core | Reviewed workflow template and frozen operational case proposed in #1382. | IN FLIGHT / ADAPT LATER | Direct collision with durable policy workflow; resolve before persistence. |
| P-019 | Hash/canonicalization | Multiple implementations exist across backend and packages; FNV cache hash also exists. | EXISTS / FRAGMENTED | Establish golden canonical vectors and one crypto boundary before integrity claims. |
| P-020 | Exact optimizer | No exact minimum-action set/state planner found. | NEW | Implement bounded BFS after actions/dependency index. |

## Duplicate candidates rejected

| Candidate | Why it looks reusable | Why it is not the canonical PTC primitive |
| --- | --- | --- |
| `services/decision/acceptanceGraph.ts` | Rules return approve/review/reject-like results. | Hard-coded claim rules, legacy Omega use, no institution decision authority, and satisfaction/acceptance conflation. |
| `services/orgPolicyEngine.ts` | Contains policy requirements and decisions. | Stub/default fetching and auto-approval concepts; not reviewed institutional policy. |
| `services/trust-state/policyMatrix.ts` | Converts organization requirement labels into artifacts. | Loose substring matching and default entries, including source concepts that must not be claimed without real capability. |
| `services/trust/trustRulesEngine.ts` | Pure-ish deterministic trust evaluation. | Global workflow class evaluation, no TrustSpec version, no per-institution dependency graph. |
| `packages/domain-evidence/src/reasoning/engine.ts` | Has planning/simulation names. | Knowledge-graph traversal and hypothetical confidence simulation, not exact action planning. |
| StartAgent ranking | Produces a next plan and deltas. | Ranks actions heuristically; does not prove a minimum covering action set. |
| `manifest-engine.ts` | Produces a proof manifest. | Uses random UUID/current time and a different evidence claim scope; not canonical compile replay. |
| `ApplicationPacket` | Has immutable snapshot + hash. | Binds clinician-selected disclosure, recipient, purpose, and consent for one application. |
| `DecisionCapsule` | Has hashes/methodology/replay. | Records an institution decision; compiler truth must precede and remain independent of it. |
| `ActivationRequirement` | Holds requirements, dependencies, owners, and states. | Operational roll-up instantiated after a qualified decision; not immutable employer policy or evaluation. |
| #1382 template requirement | Versioned reviewed requirement definitions. | Operational workflow semantics may not equal evidence-satisfaction policy; requires a reviewed adapter and ownership decision. |

## Open research questions

### RQ-01 — Canonical representation and SHA-256 boundary

Question: Can the backend `canonicalizeJson`/`sha256ForPayload` contract be reused safely by a package also consumed in browser builds?

Known facts:

- backend canonicalization converts `undefined` to `null` and serializes Date values;
- packet hashing uses its own recursive canonicalization and omits undefined object entries;
- #1382 proposes another local canonicalizer;
- `composeCareerModel()` explicitly uses FNV-1a only as a cache/content hash;
- `@noble/hashes` is transitive in the lockfile but not a declared domain-evidence dependency.

Required experiment: create cross-implementation vectors covering object-key order, arrays, undefined, null, Date, numbers, Unicode, and commutative IR children. Pick one representation and declare any direct crypto dependency. Do not silently adopt a transitive package.

State: BLOCKS stable hashing implementation.

### RQ-02 — TrustSpec persistence owner

Question: Does a reviewed credential-operations template become a TrustSpec source, or are operational workflow and evidence policy distinct durable records?

Known facts: #1382 freezes reviewed templates with target authority, effective window, sources, requirement dependencies, evidence rules, reviewer, and SHA-256 hash. It is in flight and DIRTY. Its requirements include owners, due offsets, and restricted-data handling that are operational, while TrustSpec needs evidence predicates, accepted sources, freshness, and review policy.

Proposed experiment: after #1382 resolution, map one active template to TrustSpec and enumerate loss/ambiguity. If the mapping is not total and deterministic, retain separate contracts but link versions explicitly; do not duplicate authoring UI casually.

State: BLOCKS production persistence, not pure Demo 1 fixtures.

### RQ-03 — Canonical evidence hydration

Question: Which server-owned persisted records hydrate the compiler’s private `EvidenceCollection`?

Known facts: active web composition adapts PassportData to EvidenceCollection. Public graph routes deliberately filter disclosure. Backend has `VcvCredential`, `VerificationArtifact`, `ClaimRecord`, `PsvReceipt`, and source-specific records. A degraded/demo Passport must not be institutional truth.

Required experiment: trace one real source-backed launch-spine credential end to end and define a server adapter with no public filtering, no self-report promotion, explicit lifecycle/revocation, and exact source IDs.

State: BLOCKS production compilation; Demo 1 may use a private synthetic adapter.

### RQ-04 — Source identity and capability

Question: How do `NPPES`/`OIG`/`PECOS` registry keys map to `NPPES_API`/`OIG_LEIE`/`PECOS_PUBLIC` canonical coverage IDs?

Required experiment: define an explicit mapping table with source owner review and test every accepted-source predicate. State-board access remains gated/adapter-dependent.

State: BLOCKS authoritative accepted-source policy.

### RQ-05 — Conflict semantics

Question: Which combinations of competing evidence produce CONFLICTED versus UNSATISFIED, UNKNOWN, or REVIEW_REQUIRED?

Proposed initial rule: a conflict requires two in-scope, non-superseded facts making incompatible claims about the same addressable field under the same policy context. Stale or unavailable is not itself a conflict. Revoked evidence cannot satisfy but remains provenance.

Required experiment: truth table across lifecycle, observed time, source tier, field identity, and supersession; review against `trustRulesEngine` negative/conflict tests.

State: BLOCKS T005 implementation.

### RQ-06 — Exact optimizer state model

Question: Is set cover sufficient or do action preconditions require state-space search?

Decision for v0.1: implement breadth-first state search. Pure set cover is a valid fast path only when all actions have no ordered preconditions and monotonic effects. State search handles dependencies while retaining a proof of minimum action count for bounded fixtures.

Required experiment: compare BFS to exhaustive action subsets for generated graphs up to the agreed fixture bound; record expansion cap and deterministic no-plan result.

State: RESOLVED FOR DEMO 1, performance bound still OPEN.

### RQ-07 — Dependency index identity

Question: What change key is precise enough to invalidate requirements without missing conflicts?

Proposed selector tuple: subject key, evidence class, jurisdiction, source ID, field path, lifecycle family, and optional trust dimension. Conservative wildcard buckets are allowed; false reuse is not. A changed evidence object invalidates its old and new selector keys.

Required experiment: generated mutations prove incremental compilation byte-equals full compilation; report evaluated/reused counts.

State: OPEN.

### RQ-08 — Proof retention, privacy, and expiry

Question: Where and how long can immutable professional-state snapshots be stored?

Constraints: private/no-store; minimum necessary; no public/on-chain payload; explicit authorized readers; policy/evidence freshness may expire without rewriting history; revocation and supersession are append-only.

Required review: security/privacy/data-retention decision before any Prisma model. Demo 1 proofs remain synthetic fixtures or controlled test artifacts.

State: BLOCKS production proof persistence.

### RQ-09 — Acceptance ownership and structure

Question: Which model/service is canonical after the current stacked PRs, and where should proof ID/hash and requirement-level outcomes live?

Known facts: `EmployerAcceptance` now has application/packet fields but free-text status; `Acceptance -> Recognition -> Start` is a separate FK path; DecisionCapsule carries decision provenance. The active stack is still changing these seams.

Required review: classify each persisted record as canonical, compatibility, or deprecated after stack settlement. Add no migration before then.

State: BLOCKS explicit production acceptance adapter.

### RQ-10 — Graph provenance for immutable fixture policy

Question: Can Demo 1 project requirement nodes without violating career-graph’s database provenance contract?

Decision: headless compiler does not need career-graph projection. If an internal visualization needs it before persistence, add an explicitly separate fixture-provenance adapter rather than inventing Prisma model/record IDs. Production graph projection waits for canonical persistence.

State: RESOLVED FOR HEADLESS DEMO.

## Optimizer research track

The initial optimizer is deliberately narrow:

- objective: `MINIMUM_ACTION_COUNT`;
- algorithm: deterministic breadth-first search over action-state transitions;
- actions: monotonic in Demo 1 unless an explicit failure result is simulated;
- goal: all satisfiable mandatory requirements SATISFIED and no mandatory UNKNOWN/CONFLICTED/SOURCE_UNAVAILABLE;
- tie-break: lexical sequence of stable action IDs;
- proof of minimality: first BFS goal depth plus exhaustive subset oracle for bounded fixtures;
- no invented time, cost, success probability, or combined score.

Connections to investigate after correctness:

| Area | Useful connection | Demo 1 boundary |
| --- | --- | --- |
| Set cover | One action covers multiple requirements. | Use as conceptual lower bound/fast path, not sole algorithm with dependencies. |
| Classical planning | Preconditions/effects and state transitions. | Bounded deterministic state only. |
| Constraint satisfaction | Policy predicates and goal feasibility. | No external solver dependency until native exact fixtures prove need. |
| Query optimization | Dependency indexing and incremental recomputation. | Measure evaluated/reused nodes; no heuristic cost model. |
| Multi-objective optimization | time/cost/disclosure/human effort Pareto fronts. | DEFER; never collapse unknowns into a fake score. |

## Migration register

| Scope | Migration? | Reason |
| --- | --- | --- |
| TrustSpec/IR pure contracts and golden fixtures | No | Checked-in typed values. |
| Compiler/dependency index/optimizer | No | Pure deterministic transforms. |
| Synthetic runtime | No | Test/internal fixture boundary. |
| Headless synthetic proofs | No | Controlled artifacts, not production records. |
| Production TrustSpec | Unknown | Depends on #1382 ownership and policy governance. |
| Production proof/snapshot | Yes, likely | Needs immutable access-controlled persistence and retention design. |
| Requirement-level acceptance | Yes, likely | Existing free-text/coarse models are insufficient; wait for acceptance stack. |
| Career-graph requirement/satisfaction projection | No separate graph store | Project from canonical policy/evaluation/proof records when they exist. |

## Architecture review checklist

- [ ] #1382 policy/workflow ownership resolved.
- [ ] #1378/#1380/#1381/#1384 acceptance/start ownership resolved on main.
- [ ] Canonical representation + SHA-256 vectors approved.
- [ ] Initial TrustSpec operators and fail-closed statuses approved.
- [ ] Evidence hydration boundary approved.
- [ ] Demo 1 exact fixture and synthetic-only claim language approved.
- [ ] BFS bounds/tie-break/minimality oracle approved.
- [ ] No schema migration approved for headless Demo 1.
- [ ] Proof privacy/retention review scheduled before persistence.
- [ ] PTC-WAVE-01 named as one independently testable bundle.

## Stop condition

Research continues as documentation only until architecture review. PTC-WAVE-01 must not start automatically.
