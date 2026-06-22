# W228-C4/C5 — Risk Assessment + Migration Risks

**Date:** 2026-06-21

---

## 1. Doctrine invariants — status

| Invariant | Held? | Evidence |
|---|---|---|
| Partial stays partial / no tier upgrade | ✅ | `decisionGrade ⇔ checked`, monotonic `statusTrustScore`, no-inflation tests |
| Decision-grade = `checked` only | ✅ | `isDecisionGradeStatus`; `buildEvidenceCollection` throws on violation |
| Gated/stale never positive | ✅ | verbatim status in adapter; gated→weakening; gated trustScore 0 |
| Pure transforms (no fetch/write) | ✅ | package has zero I/O; routes fetch via existing runtime only |
| No new persistence | ✅ | no Prisma changes; all projections over the passport |
| Zero PHI | ✅ | only source-backed credential evidence, same as passport |
| No bare `Verified` / banned strings | ✅ | `banned-verified-label` + `check:claims` green |
| `VerifiedCanonicalPath` not minted by projections | ✅ | recognition projected read-only; no path construction (W225-C5) |
| Recruiter surfaces unbroken | ✅ | career-packet/employer-proof/export regression green |
| Honest absence (no fabricated trust/reputation) | ✅ | null dimensions, unknown standing tests |

**No broken invariants. No trust violations.**

## 2. Current-stack risks

| Risk | Severity | Status |
|---|---|---|
| API route handlers untested | medium | open — recommend 4 smoke tests (03 §2, 07) |
| Per-request recomputation cost | low | acceptable at clinician scale; ETag caching designed |
| Unauthenticated routes | low/policy | consistent with passport; flagged (05 §4) |
| `dist/` gitignored | low | CI must `pnpm turbo run build --filter @vitalcv/web` (same as trust-state) |
| Branch carries unrelated WIP | **medium** | the merge must scope to this stack (07) |

## 3. Migration risks for downstream waves (C5)

### Wallet (W250)
- **Risk:** wallet may expect evidence to be user-editable/holdable; EvidenceObject is currently a **read-only projection** of source-backed data.
- **Mitigation:** keep the projection read-only; wallet writes go to the existing holder/upload path, then surface as evidence with honest `notDecisionGrade`/`pending` status until verified. Never let wallet edits mint `checked`.

### Mobility (W230)
- **Risk:** gap/readiness logic could be tempted to let a gated license satisfy a requirement.
- **Mitigation:** designed already (W230-C3/C5) — `minStatus` defaults `checked`; `ready` requires decision-grade. The trust dimensions (incl. `mobility`) are already exposed and bounded.

### Network (W270)
- **Risk:** cross-entity edges (clinician↔employer↔institution) could create cycles or trust leakage between subjects.
- **Mitigation:** current graph is single-subject (anchored on one `subjectKey`). Multi-subject must keep the monotonic-down rule **per subject** — never propagate a positive across the network. Add a per-subject boundary test when networked.

### Opportunity Matching (W260)
- **Risk:** matching/ranking could be read as a recommendation/guarantee.
- **Mitigation:** W230-C4 mandates the honesty `note` (deterministic evaluation, not ranking); matching stays out of scope until W260 and must remain explainable (no opaque scoring).

### Recognition (W250-3 / PRE)
- **Risk:** deepening PRE could let a projection synthesize a recognition or relax `VerifiedCanonicalPath` branding.
- **Mitigation:** the one-direction rule (W225-C5 §2) — projections read PRE, never mint it; TypeScript branding enforces it.

## 4. Net risk posture

**Low.** The stack adds no persistence, holds every doctrine invariant under test, and isolates all future expansion at the adapter seam. The only medium items are operational (route tests, branch scoping), not architectural.
