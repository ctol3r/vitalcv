# W230-C2 — Opportunity Architecture

**Wave:** 230 · **Depends on:** [C1](./C1-mobility-signal-inventory.md)
**Date:** 2026-06-21
**Status:** architecture only — no implementation this wave.

The `OpportunityObject`: requirements expressed in the **same vocabulary as evidence and trust**, so gap detection (C3) and readiness (C5) are pure deterministic diffs — not matching ML.

---

## 0. Design rule

An opportunity's requirements must be checkable against an `EvidenceCollection` + `TrustProjection` by set operations only. Therefore every requirement is one of three checkable kinds, all keyed on existing enums (`EvidenceClass`, `EvidenceStatus`, `TrustDimension`).

## 1. `OpportunityObject`

```ts
interface OpportunityObject {
  opportunityId: string;
  title: string;
  /** Org context (reuse backend Opportunity.organizationId). */
  organizationKey: string | null;
  specialty: string | null;
  /** States the role covers — the mobility axis. */
  states: string[];
  requirements: OpportunityRequirement[];
  /** Schema version for the contract (vitalcv.opportunity.v1). */
  schema: 'vitalcv.opportunity.v1';
}
```

## 2. `OpportunityRequirement` (three checkable kinds)

```ts
type OpportunityRequirement =
  | EvidenceRequirement
  | TrustRequirement
  | ExperienceRequirement;

interface RequirementBase {
  requirementId: string;
  label: string;
  /** mandatory blocks readiness; preferred only lowers strength. */
  necessity: 'mandatory' | 'preferred';
}

/** "Needs a decision-grade license in CA." */
interface EvidenceRequirement extends RequirementBase {
  kind: 'evidence';
  evidenceClass: EvidenceClass;          // licensure | board_cert | registration | exclusion | ...
  /** Minimum status that satisfies it. Default 'checked' (decision-grade). */
  minStatus: EvidenceStatus;             // almost always 'checked'
  /** Optional jurisdiction constraint (the mobility axis). */
  jurisdiction?: string;                 // e.g. 'CA'
}

/** "AuthorityTrust must be >= 0.6." */
interface TrustRequirement extends RequirementBase {
  kind: 'trust';
  dimension: TrustDimension;             // authority | professional | leadership | ...
  minScore: number;                      // 0..1
}

/** "Needs >= N decision-grade professional evidence items." */
interface ExperienceRequirement extends RequirementBase {
  kind: 'experience';
  dimension: TrustDimension;             // typically 'professional' | 'leadership'
  minDecisionGradeCount: number;
}
```

## 3. Why these three kinds cover the brief's examples

| Brief example | Requirement |
|---|---|
| Missing License | `EvidenceRequirement{ evidenceClass:'licensure', minStatus:'checked', jurisdiction:'X' }` |
| Missing Board Certification | `EvidenceRequirement{ evidenceClass:'board_cert', minStatus:'checked' }` |
| Missing Experience | `ExperienceRequirement{ dimension:'professional', minDecisionGradeCount: N }` |
| Missing Leadership | `ExperienceRequirement{ dimension:'leadership', minDecisionGradeCount: N }` or `TrustRequirement{ dimension:'leadership', minScore }` |

Every example is checkable by a pure function over `EvidenceCollection.byClass` / `TrustProjection.dimensions` — no algorithm beyond comparison.

## 4. Source of opportunities (reuse, don't rebuild)

- The backend already has `Opportunity { specialties[], statesCovered[], requirements[] }` (Wave 227) + `opportunityService`. `OpportunityObject` is a **normalized view** over that record — a pure adapter `fromBackendOpportunity()` maps `statesCovered → states` and the loosely-typed `requirements[]` into the three typed kinds.
- No new persistence: opportunities live in the existing store; `OpportunityObject` is the evidence-vocabulary projection (parallels how `EvidenceObject` is a view over `ClaimRecord`).
- A default requirement template per specialty (e.g. "active state license + clear exclusion + Medicare enrollment") can be a static, versioned config — deterministic, editable, no model.

## 5. Honesty constraints

1. `minStatus` defaults to `'checked'` — a mandatory requirement is satisfied **only** by decision-grade evidence (gated/stale never satisfies).
2. Jurisdiction match is exact and case-normalized; "licensed in CA" never satisfies "needs NV" (compact eligibility is handled in C5, not by loosening the match).
3. `preferred` requirements influence strength/ranking only — never flip Blocked→Ready.
4. Requirements reference only existing enums, so an opportunity can never demand a trust signal the engine can't honestly compute.

## 6. Success-criteria answers

- **How do we represent opportunities?** `OpportunityObject` (§1), a normalized view over the existing backend Opportunity.
- **How do we represent requirements?** Three checkable kinds keyed on `EvidenceClass`/`EvidenceStatus`/`TrustDimension` (§2).

**Deliverable status:** complete. → C3 (Gap Engine).
