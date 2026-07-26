# W245 — Career OS Hardening

**Date:** 2026-06-21 · QA/hardening record (no new strategy, doctrine, or frameworks).

---

## 0. Scope correction (honest)

There is **no "Career OS", no "Career Home" page, and no `/career` / `/memory` / `/reputation` / `/mobility` route** in the codebase. The "experiences" this wave hardens are the real surfaces that exist:

- **Data layer (the experiences):** `EvidenceCollection → GraphProjection → TrustProjection → TimelineProjection` (the `@vitalcv/domain-evidence` pipeline).
- **APIs:** `/api/evidence/[id]`, `/api/graph/[id]`, `/api/graph/[id]/trust`, `/api/timeline/[id]`.
- **Product UI:** `/packet/[entityId]` (Career Packet).
- **Dev UI:** `/dev/graph/[entityId]` (noindex, dev-only).

Reputation/Mobility remain design-only (W230/W235) — nothing to productionize.

## 1. C1–C3 — Experience validation

| Experience | Typed | Tested |
|---|---|---|
| Evidence | `tsc` 0 errors | adapter (6) + collection (4) + route (2) |
| Trust | `tsc` 0 errors | propagate (8) + trust (5) + route (2) |
| Timeline | `tsc` 0 errors | timeline (8) + timeline (4) + route (2) |
| End-to-end | — | **integration (6)** — see C4 |

## 2. C4 — Integration test (new)

`apps/web/__tests__/career-os-integration.test.ts` runs the full pipeline from one passport and asserts **no honesty-drift across layers**:
- a `checked` source is decision-grade at collection, graph, and trust;
- a `gated` source is non-decision-grade at *every* layer (gated→0 trustScore, in `weakening` never `supporting`, never positive timeline impact);
- an `EXPIRED` registration decays coherently and never inflates overall trust;
- decision-grade evidence counts agree across graph/trust/timeline;
- end-to-end determinism.

**This is the "Career OS is coherent" guarantee, mechanized.** 6 tests, green.

## 3. C5 — Performance audit (measured)

Full pipeline (`buildEvidenceCollection → projectEvidenceToGraph → propagateTrust → projectTimeline`) on synthetic data:

| Evidence objects | Pipeline time |
|---|---|
| 100 | ~6 ms (incl. JIT warmup) |
| 1,000 | ~2.5 ms |
| 5,000 | ~25 ms |

- **Linear (O(n))**, as designed — pure transforms, no quadratic joins.
- A real clinician carries ~10–30 evidence objects → **sub-millisecond** pure compute.
- The dominant request cost is the upstream passport fetch (network), **not** the projection. Recommended (already designed in `06`): ETag the response on `lastCheckedAt`. No code change required for current scale.

## 4. C6 — Accessibility audit

| Surface | Finding | Action |
|---|---|---|
| `/packet/[entityId]` (product) | semantic `<main>/<header>/<section>`, `h1`→`h2`, `<dl>`, status chips carry **text labels** (not color-only), degraded banner `role="status"`, export is a real `<a>` | already accessible; no change needed |
| `/dev/graph/[entityId]` (dev) | tables lacked `scope="col"` | **added `scope="col"` to all column headers** |

The one product surface (the Career Packet) was already built accessibly in W205 (status is never conveyed by color alone — the recruiter chip and every source row render their state as text). The dev explorer is noindex/dev-only; the `scope` fix is a low-cost correctness improvement.

## 5. C7 — Merge readiness

Folded into PR #444 (clean branch `feat/career-evidence-stack` off `origin/main`). W245 adds: the integration test, the dev-explorer a11y fix, and this record. Re-validated on the clean branch:

| Check | Result |
|---|---|
| package tests | 28/28 |
| web stack + integration + regression | green (incl. new 6 integration tests) |
| `tsc --noEmit` (package + web) | 0 errors |
| `banned-verified-label` vitest (on origin/main) | green — enforces the bare-`Verified` rule |
| ESLint (changed files) | clean |
| `pnpm turbo run build --filter @vitalcv/web` | tasks successful, exit 0 |

> **Note on `check:claims`:** the 20-phrase public-claims scanner (`scripts/check-public-claims.ts`) is **pre-existing uncommitted WIP not present on `origin/main`**, so it was correctly excluded from this clean PR and cannot run on this base. The stack's public copy was verified clean against it on the source branch during W205–W240; the committed `banned-verified-label` test enforces the most critical sub-rule (no bare `Verified`) and is green here. If/when the `check:claims` infra lands on `main`, CI will cover the full phrase list.

**Career OS data layer is typed, tested, accessible, performant — and the PR is build-clean and mergeable, pending the mandatory Codex SAFE verdict (the one gate that remains).**
