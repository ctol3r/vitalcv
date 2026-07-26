# W235-C6 — Reputation Readiness Report

**Wave:** 235 · **Synthesizes:** C1–C5
**Date:** 2026-06-21 · Design only — no code (the unmerged stack is in SAFE review, W228).

---

## 0. Five success-criteria answers

1. **How do we derive reputation?** Re-project objective trust/evidence/recognition signals into 5 domain dimensions + history — no new measurement (C2/C3).
2. **How do we avoid subjective scoring?** The Objectivity Contract (C2 §0): traceable `basis`, evidence-bounded, decision-grade-gated, no editorial weights, honest absence. No ratings, no ML.
3. **How do we represent reputation through time?** Deterministic growth/decay/recovery/milestone projection over `CareerEvent`s (C4).
4. **How do we connect reputation to mobility?** Same licensure/registration evidence feeds both; a reputation growth in those classes *is* a mobility-expansion event (C4 §5, C5 §6).
5. **How do we preserve trust invariants?** Reputation scores are anchored to and bounded by trust dimension scores (`min`/`mean`, never `sum`); decision-grade gating + honest absence carry through (C3 §5).

## 1. Affected packages

| Package | Change | Risk |
|---|---|---|
| `packages/domain-evidence` | + `src/reputation/reputation.ts` (`projectReputation`, `ReputationProjection`, `ReputationDimension`, `ReputationHistory`) — pure, reads evidence+trust+timeline | Low |
| `apps/web` | + 3 read routes `/reputation/:id(/history,/dimensions)` reusing the existing adapter+pipeline | Low |
| recruiter surfaces | none | None |

Layering stays acyclic: `reputation` sits **above** `timeline` (`types→collection→graph→trust→timeline→reputation`). It reads, never feeds back.

## 2. Affected schemas

- **No Prisma migration.** Reputation is a projection over the passport-derived pipeline. No new tables.
- **New API contracts:** `vitalcv.reputation.v1`, `vitalcv.reputation-history.v1`, `vitalcv.reputation-dimensions.v1`.
- **No new evidence/trust enums** — reputation dimensions map from existing trust dimensions + evidence classes.

## 3. Migration risks

| Risk | Severity | Mitigation |
|---|---|---|
| Reputation read as a subjective/quality score | **High (product)** | Objectivity Contract + `basis` in every payload; copy never implies endorsement; passes `check:claims` |
| Combination inflates above evidence ceiling | **High (doctrine)** | `min`/`mean` only, never `sum`; property test `score ≤ contributing trust score` |
| Reputation history mistaken for a recorded log | Med | documented as evidence-derived (Rule 35) |
| Gated/stale raising reputation | Med | decision-grade gating in score + breadth; tested |
| Overlap (academic/research) double-counts | Low | independent computation; documented; no cross-dimension feedback |

## 4. Testing strategy (when built)

1. **Unit (pure):** dimension mapping totality; `score ≤ contributing trust score` (no inflation); null/unknown for empty domains; recovery detection (decay→later-reinforcement); milestone replay determinism.
2. **Objectivity property:** every dimension `score` reconstructable from its `basis` evidenceIds; no score without decision-grade backing.
3. **Contract:** each route returns its `vitalcv.reputation*.v1` schema + honest empty states.
4. **Regression:** evidence/graph/trust/timeline + recruiter suites stay green; `check:claims`, typecheck, build.
5. **Codex SAFE** before merge.

## 5. Effort estimates (1 unit ≈ a focused PR w/ tests)

| Item | Effort |
|---|---|
| `projectReputation` + dimension mapping + tests | 2 |
| Reputation history (growth/decay/recovery/milestones) + tests | 2 |
| 3 `/reputation/*` routes + contract tests | 1.5 |
| Extend dev explorer with a reputation view (optional) | 1 |

**Total ≈ 6.5 units, ~80% reuse** (trust + timeline already ship). The only genuinely new logic is recovery/milestone detection and the dimension mapping — both pure, both small.

## 6. Sequencing note (important)

**This wave is design only and deliberately added no code** — the W220–225 stack is unmerged and in SAFE review (W228). Per W228's merge-readiness, the recommended order is: **commit + scope the stack → CI build → Codex SAFE → merge**, *then* build W230 (mobility) and W235 (reputation) on the merged base. Building reputation now would deepen an already-five-waves-deep unmerged stack. Hold the build until SAFE.

**Deliverable status:** W235 complete — C1–C6 in `docs/wave235/`. No code added.
