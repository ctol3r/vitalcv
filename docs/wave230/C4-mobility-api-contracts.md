# W230-C4 — Mobility API Contracts

**Wave:** 230 · **Depends on:** [C2](./C2-opportunity-architecture.md), [C3](./C3-gap-engine-blueprint.md), [C5](./C5-readiness-architecture.md)
**Date:** 2026-06-21

Read-only, versioned (`vitalcv.mobility.*.v1`) contracts. Per-entity (distinct from the existing aggregate `/api/intelligence/mobility`). All compose existing services; none mutates; none changes recruiter surfaces.

---

## 0. Conventions

- `entityId` = `VcvEntity.canonicalId` or NPI (matches `fetchPassportEntity`).
- Compose passport runtime → `EvidenceCollection` → `GraphProjection` → `TrustProjection` (W220–222) + `OpportunityObject` (C2) + `detectGaps` (C3) + `projectReadiness` (C5).
- `Cache-Control: no-store`; honest empty states; no bare `Verified`; passes `pnpm check:claims`.

---

## 1. `GET /mobility/:entityId`

Overview: mobility posture across the states/specialties the clinician is already evidenced for.

```jsonc
{
  "schema": "vitalcv.mobility.v1",
  "subjectKey": "…",
  "mobilityTrust": 0.5,                    // TrustProjection.dimensions[mobility].score
  "licensedStates": ["CA"],               // decision-grade licensure jurisdictions
  "compactEligibleStates": ["NV", "AZ"],  // from NLC/Counseling compact membership
  "reusableEvidenceCount": 4,             // decision-grade evidence
  "summary": "Source-backed in CA; compact endorsement path to NV/AZ."
}
```
Composes: `TrustProjection` + licensure evidence jurisdictions + compact tables.

## 2. `GET /mobility/:entityId/gaps?opportunityId=`

The `GapReport` (C3) for a specific opportunity (or a specialty default template if no `opportunityId`).

```jsonc
{
  "schema": "vitalcv.mobility-gaps.v1",
  "subjectKey": "…",
  "opportunityId": "opp-123",
  "mandatoryUnmet": 1,
  "preferredUnmet": 1,
  "gaps": [
    { "requirementId": "lic-nv", "label": "NV state license", "necessity": "mandatory",
      "kind": "missing", "reason": "No decision-grade NV licensure on file.",
      "blockingEvidenceIds": [],
      "remediation": { "type": "apply_endorsement", "detail": "NV is NLC compact-eligible.", "estimatedDays": 10 } }
  ]
}
```
Composes: `OpportunityObject` + `EvidenceCollection` + `TrustProjection` via `detectGaps`.

## 3. `GET /mobility/:entityId/opportunities`

Opportunities the clinician could be evaluated against, each with a readiness verdict (C5). **Not a matching algorithm** — a deterministic per-opportunity readiness pass over the existing `listPublicOpportunities()` set, filtered by specialty/state overlap.

```jsonc
{
  "schema": "vitalcv.mobility-opportunities.v1",
  "subjectKey": "…",
  "opportunities": [
    { "opportunityId": "opp-123", "title": "Hospitalist — NV", "state": "NV",
      "readiness": "near_ready", "mandatoryUnmet": 1, "estimatedStartDays": 10 }
  ],
  "note": "Deterministic readiness over posted opportunities; ranking/matching is out of scope (W260)."
}
```
The `note` is mandatory honesty — this endpoint does not rank or recommend; it evaluates.

## 4. `GET /mobility/:entityId/readiness?opportunityId=`

The `ReadinessProjection` (C5) for one opportunity.

```jsonc
{
  "schema": "vitalcv.mobility-readiness.v1",
  "subjectKey": "…",
  "opportunityId": "opp-123",
  "readiness": "near_ready",              // ready | near_ready | blocked | unknown
  "rationale": "All mandatory met except NV license, which has a compact endorsement path.",
  "blockers": [],
  "fixableGaps": ["lic-nv"],
  "estimatedStartDays": 10
}
```

## 5. Contract summary

| Route | Schema | Composes | New logic |
|---|---|---|---|
| `GET /mobility/:entityId` | `mobility.v1` | TrustProjection + licensure jurisdictions + compact tables | licensure→state index |
| `GET /mobility/:entityId/gaps` | `mobility-gaps.v1` | `detectGaps` (C3) | gap engine |
| `GET /mobility/:entityId/opportunities` | `mobility-opportunities.v1` | readiness pass over `listPublicOpportunities()` | per-opportunity readiness |
| `GET /mobility/:entityId/readiness` | `mobility-readiness.v1` | `projectReadiness` (C5) | readiness projector |

Four read routes; all pure composition over existing services + the new gap/readiness projectors. None touches `/packet`, `/passport`, `/employer-review`, or the existing `/api/graph/*`.

## 6. Success-criteria answer

- **How do we connect trust to opportunity?** The mobility routes feed `TrustProjection` + `EvidenceCollection` into `detectGaps` / `projectReadiness` against an `OpportunityObject` — trust dimensions become requirement checks, gaps become remediation paths.

**Deliverable status:** complete. → C5 (Readiness Architecture).
