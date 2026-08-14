# VitalCV Trust Compiler Execution Plan

**Program:** Trust Compiler

**Plan version:** 0.1

**Observed baseline:** `cf64cdae4a40522defa88b3d81d4546c17787e41`

**Last updated:** 2026-08-14

**Current wave:** Wave 00 complete; Wave 01 proposed, not started

## 1. Program control

This is the canonical execution tracker for the Trust Compiler program. Update
it after every completed bundle. A status change must be backed by repository,
test, pull-request, migration, or production evidence as appropriate.

Allowed statuses:

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `COMPLETE`
- `DEFERRED`

Completion is wave-specific. Documentation approval can complete an architecture
wave; it cannot be presented as compiler, database, deployment, or production
completion.

## 2. Program objective

Build a deterministic, versioned, explainable compiler that evaluates an
explicit TrustSpec against an immutable Clinician Trust Graph snapshot and
produces a requirement-level Policy Satisfaction Proof without weakening
VitalCV's consent, authorization, provenance, packet integrity, audit, or
institutional-authority boundaries.

The compiler is one component in the existing transaction:

```text
authoritative observations
  -> normalized Clinician Trust Graph snapshot
  -> versioned TrustSpec
  -> deterministic Policy Satisfaction Proof
  -> clinician-selected ApplicationPacket
  -> employer decision on that exact packet
  -> activation requirements and Start Attestation
  -> audit and replay
```

This model is grounded in the founder-provided *VitalCV Trust Compiler Canonical
Technology Thesis*. The thesis also defines later targets: proof-carrying
clinicians, incremental reverification, Trust Cache, Acceptance Receipts,
Acceptance and Trust Execution Graphs, Employment Executability, selective
disclosure, and narrowly scoped integrity anchoring. It labels the overall
thesis a technology hypothesis rather than a proven patent claim; this plan does
the same.

The compiler does not fetch sources, infer authority, mutate evidence, seal packets, match
opportunities, accept applications, issue Recognition, attest starts, or deliver
external messages.

## 3. Non-negotiable invariants

1. Same TrustSpec, evidence snapshot, semantic version, and evaluation time
   produce the same ordered result.
2. Missing, stale, unavailable, access-gated, or contradictory evidence never
   silently becomes satisfied.
3. Current evidence and submitted evidence remain separate.
4. Compiler satisfaction is not employer acceptance, Recognition, credentialing
   completion, privileges, employment, or actual start.
5. Every result identifies the exact spec version, evidence snapshot, compiler
   semantic version, evaluation time, and integrity reference.
6. The pure compiler performs no I/O and no mutation.
7. Authorization occurs before input construction and before result retrieval.
8. Persisting, attaching, superseding, or comparing results is audited as a
   transactional consequence.
9. Unsupported source capability remains explicit.
10. Existing packet sealing and hash verification are reused, not rebuilt.

## 4. Baseline findings

The detailed evidence is in
[`docs/architecture/CURRENT_SYSTEM_MAP.md`](../docs/architecture/CURRENT_SYSTEM_MAP.md).

| Area | Current state | Program consequence |
|---|---|---|
| Canonical evidence | Durable source run/record, claim, receipt, and artifact models exist | Build one immutable projection rather than a new evidence store |
| Evidence facade | `@vitalcv/domain-evidence` is active and pure | Reuse/migrate explicitly; do not silently widen statuses |
| Trust/readiness | Multiple vocabularies and readiness engines exist | Glossary and ADRs precede code |
| Packets | Immutable versioned sealing and authorized hash-verifying reads exist | Attach by exact version; never recompute submitted history |
| Source runtime | Canonical registry and fail-closed liveness exist | Compiler input comes from persisted runtime truth |
| Source cadence | At least three configurations disagree | Resolve ownership before freshness schema |
| Employer transaction | Current main has overlapping paths; active PR stack is converging | Re-audit after stack lands; do not add another decision service |
| Credential operations | Open PR #1382 overlaps future workflow/spec persistence | Resolve boundary before database design |
| Audit | Durable event/outbox patterns exist; coverage gate is a ratchet | Add transaction-level proof, not only static gate entries |
| Database clients | Backend canonical schema plus web subset mirror | Backend owns migrations; minimize direct web model exposure |

## 5. Wave status registry

The attachment defines Waves 00–40. The registry below preserves that sequence
while preventing later waves from starting before their dependency gates.

| Wave | Canonical outcome | Status | Entry gate |
|---:|---|---|---|
| 00 | Repository archaeology | `COMPLETE` | Current main and duplicate intent reconciled |
| 01 | Canonical trust domain | `NOT_STARTED` | Wave 00 review |
| 02 | TrustSpec 0.1 | `NOT_STARTED` | Wave 01 decisions approved; #1382 boundary resolved |
| 03 | Clinician Evidence Graph | `NOT_STARTED` | TrustSpec vocabulary and evidence-state ownership approved |
| 04 | Trust Compiler kernel | `NOT_STARTED` | Waves 02–03 contracts and fixtures frozen |
| 05 | Compilation artifact | `NOT_STARTED` | Kernel determinism tests green |
| 06 | Dependency engine | `NOT_STARTED` | Compilation artifact identity stable |
| 07 | Freshness and revocation | `NOT_STARTED` | Canonical cadence/freshness owner established |
| 08 | Trust Cache | `NOT_STARTED` | Dependency invalidation and evidence reuse semantics green |
| 09 | Proof-Carrying Clinician | `NOT_STARTED` | Proof artifact and consent/presentation boundaries stable |
| 10 | Acceptance Receipts | `NOT_STARTED` | Canonical acceptance transaction settled |
| 11 | Acceptance Graph | `NOT_STARTED` | Acceptance receipt semantics and privacy review approved |
| 12 | Trust execution events | `NOT_STARTED` | Canonical event taxonomy approved |
| 13 | Trust Execution Graph | `NOT_STARTED` | Event lineage, retention, and authorization stable |
| 14 | AI policy ingestion | `NOT_STARTED` | Human approval and deterministic authority boundaries approved |
| 15 | Source connectors | `NOT_STARTED` | Canonical adapter/cadence consolidation plan approved |
| 16 | Employer trust workspace | `NOT_STARTED` | Organization governance and employer authorization green |
| 17 | Clinician trust wallet | `NOT_STARTED` | Clinician ownership, consent, and evidence-state UX approved |
| 18 | Apply with VitalCV | `NOT_STARTED` | ApplicationPacket attachment preserves immutable history |
| 19 | Employment Executability | `NOT_STARTED` | Compiler, matching, acceptance, and start terms remain distinct |
| 20 | MATCHA x Trust Compiler | `NOT_STARTED` | Matcher/compiler responsibility boundary approved |
| 21 | Selective disclosure architecture | `NOT_STARTED` | Data-minimization and recipient-purpose contracts approved |
| 22 | Cryptographic integrity | `NOT_STARTED` | Threat model and primitive selection reviewed |
| 23 | Audit ledger / blockchain decision | `NOT_STARTED` | Demonstrated value, zero-PHI boundary, and off-chain authority approved |
| 24 | Security threat model | `NOT_STARTED` | Full data/control flow available for review |
| 25 | Trust Compiler fuzzing | `NOT_STARTED` | Parser/operator surface complete |
| 26 | Golden clinician scenarios | `NOT_STARTED` | Cross-domain fixtures and expected results approved |
| 27 | Performance | `NOT_STARTED` | Functional and security suites green |
| 28 | Observability | `NOT_STARTED` | Safe event/metric taxonomy and privacy review complete |
| 29 | Admin / TrustSpec Studio | `NOT_STARTED` | Governance, versioning, and audit controls stable |
| 30 | Trust simulator | `NOT_STARTED` | Studio inputs cannot mutate authoritative state |
| 31 | Cross-employer compilation | `NOT_STARTED` | Independent institutional authority is preserved |
| 32 | Trust portability metrics | `NOT_STARTED` | Cohort, baseline, lineage, and event definitions approved |
| 33 | Employer policy intelligence | `NOT_STARTED` | Acceptance data governance and statistical limitations approved |
| 34 | Remediation engine | `NOT_STARTED` | Suggestions cannot silently mutate or certify readiness |
| 35 | Compile-to-ready | `NOT_STARTED` | Human-review and institutional-action boundaries remain explicit |
| 36 | Compiler SDK / internal API | `NOT_STARTED` | Compiler/result contracts stable |
| 37 | External Trust API | `NOT_STARTED` | External authz, rate, consent, and anti-enumeration review green |
| 38 | Trust network effects | `NOT_STARTED` | Privacy, fairness, portability, and institutional-authority review green |
| 39 | Prior-art / IP technical dossier | `NOT_STARTED` | Novelty-disproof research completed without unsupported claims |
| 40 | VitalCV Trust Compiler demo | `NOT_STARTED` | Real canonical transaction exercised; fixtures and production are clearly distinguished |

Waves 02–40 are intentionally not expanded into implementation promises here.
Each must be re-planned against then-current `main`, production truth, active
PRs, and the decisions that precede it.

## 6. Wave 00 bundle record

### Bundle 00A — Reconciliation and claim check

**Status:** `COMPLETE`

Evidence:

- fetched `origin/main` and anchored the worktree to
  `cf64cdae4a40522defa88b3d81d4546c17787e41`;
- searched open and merged PRs and remote branches for Trust Compiler,
  TrustSpec, current-system-map, and equivalent intent;
- confirmed no competing Wave 00 PR or matching document on current main;
- preserved the dirty root checkout and used
  `codex/trust-compiler-wave00` in an isolated worktree;
- inspected current repository instructions before acting.

### Bundle 00B — Repository archaeology

**Status:** `COMPLETE`

Inspected:

- workspace topology, manifests, package imports, route registration, and
  deployment scripts;
- trust/evidence/readiness/MATCHA/source packages and active consumers;
- backend and web Prisma schemas plus migrations and data ownership notes;
- source ingestion, runtime-liveness, packet, employer workflow, activation,
  audit, outbox, authentication, and tenant boundaries;
- relevant test suites and GitHub Actions workflows;
- open PRs #1378, #1380, #1381, #1382, and #1384 as sequencing constraints.

### Bundle 00C — Documentation and plan

**Status:** `COMPLETE`

Artifacts:

- `docs/architecture/CURRENT_SYSTEM_MAP.md`
- `plans/TRUST_COMPILER_EXECUTION_PLAN.md`

Runtime impact:

- no business-logic changes;
- one sitemap freshness metadata correction (`/employers`, 2026-08-09 to
  2026-08-14) required by the existing measured-date test after the baseline
  employer page changed on 2026-08-14;
- no schema or migration changes;
- no route or API changes;
- no TrustSpec or compiler implementation;
- no production access or deployment.

## 7. Wave 01 proposed execution

Wave 01 is one documentation-only PR unless review shows a bounded reason to
split it. No production type, route, database, or UI change is authorized by
this plan.

### Bundle 01A — Domain glossary and compatibility matrix

**Status:** `NOT_STARTED`

Deliverables:

- `docs/trust/GLOSSARY.md`;
- current-term-to-canonical-term matrix;
- incompatible/legacy vocabulary list;
- engineering-grade definitions for Claim, Evidence, Source, Issuer,
  Verification, Credential, Provenance, Freshness, Requirement, TrustSpec, Rule,
  Evaluation, Proof, Proof Pack, Dependency, Acceptance, Acceptance Receipt,
  Trust Cache, Trust Graph, Trust Execution Graph, and Employment
  Executability;
- explicit separation of evidence state, requirement state, readiness,
  presentation, acceptance, Recognition, and Start.

Acceptance gates:

- every canonical term has one meaning and at least one current repository
  mapping;
- no bare success word hides source, freshness, limitation, or authority;
- product claim prohibitions remain intact;
- current and submitted evidence are separate.

### Bundle 01B — ADR set

**Status:** `NOT_STARTED`

Required ADR decisions:

1. Evidence and policy are separate domains.
2. Compiler results are immutable.
3. TrustSpecs are versioned.
4. Unknown states fail closed.
5. AI cannot produce authoritative pass/fail decisions.
6. Proof artifacts reference immutable evaluation inputs.
7. Acceptance is distinct from verification.
8. Sensitive data remains off-chain.

The set also locates the pure/impure boundary, canonical Trust Graph snapshot,
evaluation time/freshness owner, result replay/comparison, packet attachment,
and TrustSpec/credential-operations boundary.

Acceptance gates:

- each ADR records considered alternatives and compatibility impact;
- #1382 overlap is resolved from current diff, not title-level inference;
- #1378–#1384 outcome is re-audited against then-current main;
- no ADR claims an open PR as deployed behavior.

### Bundle 01C — Canonical trust state machines

**Status:** `NOT_STARTED`

Deliverables:

- lifecycle states and allowed transitions for evidence, verification,
  requirement evaluation, proof, and acceptance;
- state diagrams;
- executable-style examples with exact input/result language;
- negative authorization and anti-enumeration scenarios;
- stale/unavailable/access-gated/contradiction/waiver scenarios;
- packet version, comparison, tamper, and replay scenarios;
- explicit non-consequences: no automatic acceptance, Recognition, or start.

Acceptance gates:

- state machines and examples are sufficient to become Wave 02 golden fixtures;
- no wall-clock, random, network, or database dependency is hidden in expected
  compiler behavior;
- security and evidence-integrity negative cases are present.

## 8. Wave 01 open decisions

These questions must be answered before schema code:

1. Is `@vitalcv/domain-evidence` the canonical external evidence input, or does
   the compiler receive a narrower versioned snapshot that it can project to?
2. Which layer owns source freshness: source catalog, canonical adapter runtime,
   or a consolidated policy registry?
3. Is a TrustSpec global, organization-scoped, opportunity-version-scoped, or a
   composable hierarchy of those scopes?
4. Who may draft, publish, supersede, and retire a TrustSpec?
5. How is an explicit waiver authorized, scoped, expired, and audited?
6. Which requirements are pre-application readiness versus post-acceptance
   activation requirements?
7. Does #1382's workflow template become a TrustSpec consumer, a separate
   operational plan, or a superseded parallel abstraction?
8. Which existing readiness results remain compatibility projections and for
   how long?
9. Should compiler results be persisted immediately, only when attached to a
   transaction, or both with distinct record types?
10. Which result fields may be shown publicly, to clinicians, to employers, or
    only to operators?

## 9. Change and migration discipline

For every implementation wave:

1. fetch and reconcile `origin/main`;
2. check open/merged PRs and remote branches by intent;
3. inspect active imports, routes, configuration, tests, and deployment linkage;
4. state the exact source and migration ownership;
5. add negative authorization/evidence-integrity tests before widening access;
6. run the broadest affected suite plus real-PostgreSQL tests for persistence;
7. review the complete diff and migration chain;
8. open a visible draft PR before parallel work can duplicate it;
9. merge only with green required checks and exercised behavior;
10. verify production only by exact Railway SHA and the changed live flow.

For schema work, never use `db push` as the production strategy and never
rewrite a migration already applied to production. Document backfill,
deployment order, rollback or forward recovery, and existing-row behavior.

## 10. Verification ledger

Wave 00 verification is documentation-proportional. Final command results and
known caveats are recorded in the PR and completion report.

| Check | Wave 00 purpose | Result |
|---|---|---|
| dependency install | Prove lockfile/workspace resolves in isolated worktree | Passed |
| web Turbo build | Baseline task-graph/build signal | Passed initially from Turbo cache; the root test gate later performed a fresh web production build after the sitemap correction |
| documentation formatting | Reject whitespace errors | Passed before staging; repeated after staging |
| claims/copy/source-adapter gates | Preserve public truth and canonical adapter boundaries | Passed |
| `pnpm typecheck` | Required pre-commit baseline | Passed, 50/50 Turbo tasks; shared-cache provenance recorded |
| `pnpm build` | Required pre-commit baseline | Passed, 35/35 Turbo tasks; shared-cache provenance recorded |
| `pnpm test` | Required pre-commit baseline | Passed after serialized Prisma-client recovery: package/web 21/21 tasks, web 4,527 passed with 45 existing skips, backend 343/343 suites and 2,761/2,761 tests |
| real PostgreSQL | Exercise the canonical backend suite and migration chain | Passed through `scripts/backend-test-db.sh`; an initial shared-client collision was diagnosed and the serialized rerun passed |
| browser/visual | No rendered UI change | Not required; not run |
| production | Not authorized or required for Wave 00 | Not run |

## 11. Wave completion report template

Every completed wave reports:

### Current state

- branch and worktree;
- baseline and new commit SHA;
- files changed;
- PR and deployment status.

### What changed

- product, API/schema, authorization, evidence/audit, and visual behavior;
- explicit list of areas deliberately unchanged.

### Validation

- commands run and results;
- tests not run and why;
- database/browser/production evidence.

### Risks and gaps

- known limitations;
- unsettled dependencies and active PR conflicts;
- security, migration, or compatibility concerns.

### Next execution unit

- exact bundle;
- prerequisites;
- acceptance gate;
- stop conditions.

## 12. Next action

Request review of Wave 00 architecture evidence. If accepted, execute Wave 01
Bundle 01A first. Do not start Wave 02 schema work until the full Wave 01 exit
gate is approved and the credential-operations and hire-to-start overlaps have
been reconciled against current `main`.
