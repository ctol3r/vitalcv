# W225-C6 — Professional Memory Readiness Report

**Wave:** 225 · **Synthesizes:** C1–C5
**Date:** 2026-06-21

The state of the Professional Memory bridge: C2/C3 (CareerEvent + TimelineProjection) and the primary memory route are **built and tested**; C4 sub-views, C5 PRE deepening, and richer sources are designed.

---

## 0. Six success-criteria answers

1. **Represent a career over time** → `TimelineProjection.events` — one `CareerEvent` per evidence node with trust/mobility/recognition impact (built).
2. **Derive timelines** → `projectTimeline(evidence, graph, trust)`, a pure deterministic merge (built).
3. **Model recognition** → recognition/acceptance/start evidence → `recognitionImpact` + `TimelineProjection.recognition`, projected from the signed canonical path (built; C5).
4. **Model reputation** → `ReputationSummary.standing` deterministic threshold over decision-grade evidence + trust trend; honest `unknown` (built).
5. **Connect trust history to mobility** → `CareerEvent` carries both `trustImpact` and `mobilityImpact`; a checked license is reinforcement *and* mobility-expansion in one event (built).
6. **Evolve Graph → Memory** → Memory is the timeline projection over the graph + trust layers; no new store (built).

## 1. Packages impacted

| Package | Change | Status |
|---|---|---|
| `packages/domain-evidence` | + `src/timeline/timeline.ts` (`CareerEvent`, `TimelineProjection`, `projectTimeline`) + tests | **built** |
| `apps/web` | + `GET /api/timeline/[entityId]` + adapter reuse + tests | **built** |
| recruiter surfaces | none — `/packet`, `/passport`, `/employer-review`, `/api/graph/*` untouched | — |

## 2. Schemas impacted

- **No Prisma migration.** Timeline is a projection over existing evidence/graph/trust (which themselves project the passport). No new tables.
- **New API contracts:** `vitalcv.timeline.v1` (built); `vitalcv.timeline-{events,trust-history,recognition,reputation}.v1` (designed, C4).
- **No new evidence enums** — `CareerEventType` is derived from existing `EvidenceClass`.

## 3. Routes impacted

**New (built):** `GET /api/timeline/[entityId]`.
**New (designed):** the four `/api/timeline/:id/*` sub-views (filters over the same projection).
**Unchanged:** everything shipped to date.

## 4. Migration & correctness risks

| Risk | Severity | Mitigation |
|---|---|---|
| Trust impact inflated by an event | **High (doctrine)** | `trustImpact` bounded [−1,1] via the monotonic trust scores; test asserts `≤ 1` |
| Fabricated reputation | **High** | `standing: 'unknown'` when `decisionGradeEvidence === 0`; tested |
| Timeline mistaken for the audit log | Med | C1/C4 state it is evidence-derived, not the recorded audit history |
| PRE synthesized by a projection | **High** | one-direction rule (C5 §2); normalizers never mint `VerifiedCanonicalPath` |
| Non-deterministic ordering | Med | stable sort by `occurredAt` then `eventId`; determinism test |
| Banned strings / bare `Verified` | Med | `check:claims` + `banned-verified-label` green |

## 5. Validation performed (built portion)

| Check | Result |
|---|---|
| `domain-evidence` package tests | 28/28 (collection 4, graph 8, trust 8, timeline 8) |
| web timeline + regression | 21/21 |
| `tsc --noEmit` (package + web) | exit 0, 0 errors |
| `pnpm check:claims` | pass |
| ESLint (new route) | clean |

## 6. Effort estimates (remaining, 1 unit ≈ a focused PR w/ tests)

| Item | Effort |
|---|---|
| Four `/api/timeline/:id/*` sub-view routes + contract tests | 1 |
| Dev timeline view (extend `/dev/graph/[entityId]` or new `/dev/timeline`) | 1 |
| Deepen PRE sources beyond the passport (read canonical tables directly) | 2 |
| Merge richer recorded events (audit/watchtower) per W215-C4 | 3 |

**Built now ≈ 3 units; remaining ≈ 7 units.** The bridge is functional today on passport-derived evidence; deepening it to the full recorded history is additive and gated.

## 7. Merge gate

`dist/` is turbo-prebuilt in CI. This increment stacks on the unmerged evidence/graph/trust stack and needs a real **`codex exec` SAFE verdict** before `gh pr merge`.

**Deliverable status:** W225 complete — C2/C3 + primary route built and green; C1/C4/C5/C6 delivered in `docs/wave225/`.
