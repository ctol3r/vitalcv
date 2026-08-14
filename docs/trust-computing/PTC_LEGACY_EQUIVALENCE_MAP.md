# PTC legacy equivalence map

Status: compatibility contract proposed in PTC-WAVE-00. It does not change current readiness behavior.

## Compatibility rule

The Trust Compiler starts alongside the mobility engine. No current caller is switched until characterization and equivalence tests prove that every legacy-representable scenario has the same product result. Richer compiler states may expose distinctions the four-value legacy `GapKind` cannot represent, but an adapter—not a silent behavior change—owns that projection.

```text
OpportunityObject
  -> toTrustSpec()
  -> compileTrustSpecToIR()
  -> compileProfessionalState()

existing path remains:
OpportunityObject
  -> detectGaps()
  -> projectReadiness()
```

## Type and function mapping

| Legacy contract | Compiler contract | Treatment |
| --- | --- | --- |
| `OpportunityObject` | `TrustSpec` | ADAPT; `opportunityId` becomes deterministic `specId`, `organizationKey` is retained, version is adapter-owned and explicit. |
| `OpportunityRequirement` | `TrustSpecRequirement` | ADAPT; retain original `requirementId`, label, and necessity. |
| `EvidenceRequirement` | evidence-class/jurisdiction/status constraints | ADAPT; mandatory status is normalized to decision-grade `checked` regardless of hostile `minStatus`. |
| `TrustRequirement` | trust-dimension threshold IR | ADAPT for compatibility only; employer policy should prefer evidence-addressable predicates. |
| `ExperienceRequirement` | decision-grade count IR | ADAPT to `COUNT_AT_LEAST` over the named dimension. |
| `detectGaps()` | per-requirement evaluator + compilation | EXTRACT semantics, RETAIN function/API. |
| `Gap` | `RequirementEvaluation` | ADAPT; evaluation has richer status, evidence/source IDs, typed reason, and dependencies. |
| `GapRemediation` | `TrustActionCandidate` | ADAPT; legacy detail text is a product projection, not optimizer truth. |
| `GapReport` | `CompilationResult` | ADAPT; subject/policy identity and deterministic ordering remain, with hashes/version added. |
| `projectReadiness()` | compatibility readiness projector | RETAIN function/API; new compiler does not decide acceptance/readiness UI semantics automatically. |
| `ReadinessProjection` | product projection over `CompilationResult` | ADAPT only after equivalence gate. |
| `composeCareerModel()` | current composition root | RETAIN unchanged; no compiler is inserted during the additive phase. |

## Opportunity adapter rules

### Evidence requirement

```text
kind: evidence
evidenceClass -> EVIDENCE_EXISTS selector
jurisdiction -> JURISDICTION_EQUALS
minStatus -> VALUE_IN(status)
necessity -> mandatory/preferred
```

For mandatory requirements the effective status remains `checked`, matching current fail-closed behavior. A mandatory requirement that declares `gated`, `pending`, `stale`, `reviewRequired`, or another non-decision-grade state cannot pass.

### Trust requirement

```text
kind: trust
dimension -> TRUST_DIMENSION selector
minScore -> threshold predicate
```

This is a compatibility operator, not the preferred TrustSpec authoring model. A broad derived score can hide which evidence matters. New institutional policy should use evidence-addressable conditions wherever possible.

### Experience requirement

```text
kind: experience
dimension -> DECISION_GRADE_COUNT selector
minDecisionGradeCount -> COUNT_AT_LEAST
```

Counts include only decision-grade inputs, matching current trust projection semantics.

### Adapter rejection

`toTrustSpec()` rejects duplicate IDs, invalid thresholds, unsupported evidence/status values, unknown dependencies, and semantics it cannot express. It must not repair or infer policy intent from labels.

## Semantic extraction from `detectGaps()`

| Current behavior | New ownership | Compatibility requirement |
| --- | --- | --- |
| `jurisdictionOf()` reads `value.jurisdiction` | pure evidence selector | Same trimming and exact jurisdiction comparison in legacy mode. |
| `statusSatisfies()` | status predicate evaluator | `checked` satisfies checked; non-checked mandatory evidence never passes. |
| mandatory effective status forced to checked | evaluator policy guard | Preserve exactly. |
| evidence class + optional jurisdiction candidate selection | evidence selector | Preserve matching set; new compiler evaluates all candidates for conflicts rather than trusting insertion order. |
| trust dimension lookup | compatibility IR evaluator | Preserve null/threshold behavior. |
| decision-grade experience count | count evaluator | Preserve exact count. |
| mandatory-first, requirement-ID ordering | canonical result ordering | Preserve exact public order. |
| remediation selection | legacy product adapter/action candidate factory | Preserve visible legacy result until callers move. |

The following are not compiler semantics:

- English `reason` strings;
- `candidates[0]` as an authoritative winner when no candidate satisfies;
- the lossy `insufficient` bucket;
- `estimatedDays: null` scaffolding;
- product labels `ready`, `near_ready`, `blocked`, and `unknown`;
- any implication of employer acceptance.

## Status projection

### Compiler to legacy Gap

| Compiler status | Legacy `GapKind` | Compatibility notes |
| --- | --- | --- |
| SATISFIED | satisfied | Same evidence must satisfy legacy predicate. |
| STALE | stale | Preserve blocking evidence IDs and refresh remediation. |
| MISSING | missing | Jurisdiction-scoped licensure uses endorsement remediation; otherwise submit evidence. |
| UNSATISFIED | insufficient | Typed reason remains available outside legacy projection. |
| REVIEW_REQUIRED | insufficient | Project `await_review`; never satisfied. |
| CONFLICTED | insufficient | Project `await_review`; never choose one side silently. |
| SOURCE_UNAVAILABLE | insufficient | Project `await_review` or exact legacy source state behavior; never `missing` if evidence existence is merely unobservable. |
| UNKNOWN | insufficient | Fail closed. Legacy cannot distinguish uncertainty from insufficiency. |
| NOT_APPLICABLE | satisfied only when the policy explicitly marks it non-mandatory/applicable | Never infer N/A from missing evidence. |

### Legacy Gap to compiler expectation

This direction is intentionally not one-to-one:

- `satisfied` requires compiler SATISFIED.
- `stale` requires compiler STALE.
- `missing` is compiler MISSING only when the evaluation can establish absence within the policy/source scope; otherwise compiler UNKNOWN or SOURCE_UNAVAILABLE is more truthful.
- `insufficient` may be UNSATISFIED, REVIEW_REQUIRED, CONFLICTED, SOURCE_UNAVAILABLE, or UNKNOWN.

The equivalence gate compares the product projection, not a false one-to-one status identity.

## Readiness equivalence

Legacy `projectReadiness()` is characterized as:

1. `blocked` when a mandatory missing gap has no remediation.
2. `unknown` when the trust projection has zero decision-grade evidence.
3. `ready` when all mandatory gaps are satisfied.
4. `near_ready` when every mandatory unmet gap has a remediation.
5. otherwise `unknown`.

The compatibility projector must apply those rules in the same order after converting rich compiler results into legacy gaps. The native compiler summary remains a factual count and does not emit a readiness marketing state.

## Characterization tests required before extraction

Extend `packages/domain-evidence/src/mobility/mobility.test.ts` without changing production code. Freeze at least:

1. mandatory checked evidence satisfies;
2. preferred requirement may honor its declared non-checked minimum exactly as current code does;
3. hostile mandatory `minStatus` cannot weaken decision-grade enforcement;
4. jurisdiction exact match, mismatch, whitespace normalization, and absent jurisdiction;
5. multiple candidates where a later checked candidate satisfies;
6. multiple non-satisfying candidates and current blocking-ID ordering;
7. stale versus every other canonical non-checked source state;
8. missing jurisdiction license produces endorsement remediation;
9. missing non-license evidence produces submit-evidence remediation;
10. trust dimension absent, below threshold, equal threshold, and above threshold;
11. experience count zero, below, equal, and above threshold;
12. mandatory-first and lexicographic requirement ordering;
13. mandatory/preferred unmet counts;
14. all five readiness branches and their precedence;
15. repeat-call determinism and input immutability.

Then add `packages/domain-evidence/src/trust-computing/legacyOpportunityAdapter.test.ts` with a table that evaluates each characterized opportunity through both paths.

## Equivalence assertion

For a legacy scenario `s`:

```text
legacy = projectReadiness(s.opportunity, detectGaps(...), trust)
compiler = compileProfessionalState(compileTrustSpecToIR(toTrustSpec(s.opportunity)), ...)
compat = projectCompilationToLegacy(compiler, trust)

assert compat.gapReport == detectGaps(...)
assert compat.readiness == legacy
```

If richer conflict/unknown handling makes exact equality unsafe, keep the legacy caller on the old path and document the deliberate difference in an ADR. Never weaken the compiler to make a legacy green check pass.

## Existing parallel engines and their disposition

- `apps/api/backend/src/services/trust-state/*`: characterize and possibly adapt artifact inputs; do not reuse label-substring policy parsing.
- `trustRulesEngine.ts`: reuse reason taxonomy ideas for negative, conflict, freshness, and source unavailability; do not call it from the compiler.
- `decision/acceptanceGraph.ts`: do not adapt. It is not institutional acceptance persistence and is not the opportunity readiness oracle.
- `orgPolicyEngine.ts`: do not adapt. Default/stub policies are not reviewed institutional policy.
- StartAgent: reuse runtime safety patterns only; its ranking is not the optimizer equivalence target.
- `ActivationRequirement`: later action-output adapter only; not a source of policy truth.
- credential-operations templates from #1382: potential reviewed `toTrustSpec()` input after merge and semantic review; not part of the legacy `OpportunityObject` gate.

## Removal policy

No removal is planned for Demo 1. Deprecation of `detectGaps()` or `projectReadiness()` requires:

- exhaustive characterization;
- equivalence across every active caller;
- product review of richer statuses;
- runtime and browser verification;
- a staged caller migration;
- no public truth-language regression.
