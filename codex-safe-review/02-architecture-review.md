# W228-C2 — Architecture Review

**Date:** 2026-06-21 · Scope: the Career Evidence stack.

---

## 1. Duplication

| Finding | Severity | Notes |
|---|---|---|
| `statusTrustScore` (graph) vs `isDecisionGradeStatus` (collection) | none | distinct concerns; both reference the one trust-state vocabulary |
| Trust-impact math repeated in `trust/propagate.ts` (history) and `timeline/timeline.ts` (events) | **low** | both compute `checked → +score`, `decayed → −(1−score)`. Two ~5-line copies. Candidate to extract a shared `trustDelta(node)` helper. Not a correctness risk (both tested), but the single most actionable cleanup. |
| Test fixture `buildPassportPayload` duplicated across 4 web test files | low | standard test-fixture duplication; could centralize in a test helper. Cosmetic. |
| `makeObject` evidence fixture duplicated across 3 package tests | low | same; cosmetic. |

**Verdict:** one minor logic duplication (trust delta) worth extracting; the rest is test-fixture boilerplate.

## 2. Coupling

| Edge | Assessment |
|---|---|
| package → `@vitalcv/trust-state` | **healthy** — depends only on the canonical status enum/labels; keeps EvidenceStatus from drifting. |
| package → app | **none** (verified by grep) — the package is fully app-agnostic. The only mention of `apps/web` is a doc comment. |
| adapter → passport types | **expected** — `passport-to-evidence.ts` is the *intended* coupling point (all PassportData knowledge lives here, package stays clean). Mirrors how `career-packet.ts` couples to PassportData. |
| routes → adapter + projectors | **thin** — each route is a 3–5 line composition; no business logic in routes. |

**Verdict:** coupling is deliberate and one-directional (app→package, never package→app). The adapter is the single seam.

## 3. Circular dependencies

**None.** Import scan shows a strict DAG: `types → collection → graph → trust → timeline`. No back-edges, no sibling imports. The pipeline is linear at runtime too.

## 4. Future bottlenecks

| Bottleneck | When it bites | Mitigation (designed, not yet needed) |
|---|---|---|
| Per-request recomputation | every API call rebuilds the full pipeline from the passport | cache the EvidenceCollection behind an ETag on `lastCheckedAt`; the pipeline downstream is cheap (O(n) over one clinician's evidence) |
| Passport is the only evidence source | richer evidence (audit/watchtower/recognition tables) not yet read | the adapter is the seam — add `claimRecordToEvidence`, `recognitionToEvidence` adapters without touching the package |
| Graph node taxonomy is the focused 3-type model (`subject/evidence/source`) | if the UI needs the 21-type `graph-system/types.ts` vocabulary | add a `mapToGraphSystemNode` projector; the current model is intentionally minimal and self-contained |
| Routes under existing `/api/graph/*` namespace | none today (static siblings win) | documented in 05; reviewed-safe |

**Verdict:** no architectural bottleneck blocks merge. All scaling concerns are addressed additively at the adapter seam — the package never needs to change.

## 5. Extensibility assessment

The facade pattern is the strength: `EvidenceObject` is a view, so new evidence sources, new graph consumers, mobility (W230), and memory deepening (W225) all plug in at the adapter or as new projectors **without modifying the package's core**. The strict layering means a change to `timeline` can never affect `graph` or `trust`.
