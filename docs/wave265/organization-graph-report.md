# Wave 265 — Organization Graph

**Branch:** `feat/org-graph` (stacked on `feat/career-evidence-stack` / PR #444) · **Date:** 2026-06-23

W265 asked to productionize "organization entities." The real org-entity system is **pre-existing backend** (`entityResolutionService`, `VcvEntity` ORG) — not touched here. Instead this builds an **organization graph over my own evidence stack**, grounded in real passport data my adapter was dropping. The pre-existing backend is untouched.

---

## What was built

| C | Artifact |
|---|---|
| C1 Organization types | `OrganizationKind` (verification_authority / licensing_board / credential_issuer / training_institution / employer / other), `OrganizationNode`, `OrganizationGraph` |
| C3 Relationship typing | `ClinicianOrganizationRelationship` typed by backing evidence class (TRAINED_AT / CERTIFIED_BY / VERIFIED_BY / EMPLOYED_BY) |
| — Projector | `projectOrganizations(collection, graph)` — pure; collapses evidence→source into direct clinician↔org edges |
| C2 API | `GET /api/organizations/[entityId]` → `vitalcv.organizations.v1` |
| — Adapter | `passportToEvidenceCollection` now emits **training evidence** (`training.records[].institutionName`) — closes the W228-flagged gap and makes institutions real org nodes |

## Where organizations come from (real data, not fabricated)

- **Training institutions** — `passport.training.records[].institutionName` (residency/fellowship). Previously dropped by the adapter; now emitted.
- **Credential issuers** — `passport.authority.credentials[].issuerName` (e.g. ABMS).
- **Licensing boards** — licensure/registration sources (e.g. state medical board).
- **Verification authorities** — NPPES / OIG / PECOS.

An organization is simply a source that backs the clinician's evidence; its `kind` is the most-specific career role across the evidence classes it backs.

## Honesty (tested)

- `trustContribution` is the **mean of the trust scores of the evidence the org backs** — bounded [0,1], gated evidence = 0. An org backing only gated evidence contributes **0** (tested); no org inflates trust above its evidence.
- `decisionGrade` on a relationship is true only if the org backs ≥1 decision-grade evidence.
- Deterministic; a shared source dedupes into one org.

## C4 — Clinician ↔ Organization integration

Tested end-to-end: a clinician with a Johns Hopkins residency + an ABMS board cert + NPPES identity →
- `Johns Hopkins` org (`training_institution`, `TRAINED_AT`),
- `ABMS` org (`credential_issuer`, `CERTIFIED_BY`),
- `NPPES` org (`verification_authority`, `VERIFIED_BY`),
- every relationship rooted at `subject:entity-1`.

## Success criteria

| Criterion | Result |
|---|---|
| typed | `next build` clean |
| tested | package: 33 (5 org) · web: 3 org + full regression 37/37 (no regression from the training-evidence change) |
| performant (C5) | pure O(n) grouping over one clinician's evidence; pipeline measured 25ms/5k (W245) |
| mergeable (C6) | `pnpm turbo run build --filter @vitalcv/web` → 14/14 tasks, exit 0 |

## What this does NOT touch

The pre-existing entity/organization backend (`entityResolutionService`, `VcvEntity` ORG, `VcvEntityRelationship`, `organizationContext`). Reconciling this evidence-derived org graph with those persisted org entities is a documented follow-on, intentionally not done to keep the PR scoped and avoid editing code I didn't author.

## Merge

Stacked on PR #444. Requires a **Codex SAFE verdict** before merge.
