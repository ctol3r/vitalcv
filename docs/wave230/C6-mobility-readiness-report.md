# W230-C6 — Mobility Readiness Report

**Wave:** 230 · **Synthesizes:** [C1](./C1-mobility-signal-inventory.md)–[C5](./C5-readiness-architecture.md)
**Date:** 2026-06-21

The executable plan to build the Career Mobility foundation on top of the shipped evidence/graph/trust layers. Outcome: implementation-ready, no matching ML.

---

## 0. Six success-criteria answers

1. **Represent opportunities** → `OpportunityObject`, a normalized view over the existing backend `Opportunity` (C2). No new store.
2. **Represent requirements** → three checkable kinds (`EvidenceRequirement` / `TrustRequirement` / `ExperienceRequirement`) keyed on existing enums (C2).
3. **Calculate readiness** → `projectReadiness` precedence over the gap report — Ready/Near Ready/Blocked/Unknown (C5).
4. **Identify gaps** → `detectGaps` pure per-requirement evaluation over `byClass` + `dimensions` (C3).
5. **Connect trust to opportunity** → `TrustRequirement`/`ExperienceRequirement` read `TrustProjection.dimensions`; gaps carry remediation (C3/C4).
6. **Evolve Trust Engine → Mobility Engine** → a new pure module `packages/domain-evidence/src/mobility/` consuming `TrustProjection` + `EvidenceCollection` + `OpportunityObject`. Additive; the trust engine is unchanged.

## 1. Affected packages

| Package | Change | Risk |
|---|---|---|
| `packages/domain-evidence` | + `src/mobility/` (`OpportunityObject`, `detectGaps`, `projectReadiness`, opportunity adapter) — all pure | Low |
| `packages/domain-evidence` | possibly reference compact-state tables; keep them in app/backend, pass results in (purity) | Low |
| `apps/web` | + 4 read routes under `/mobility/*`; reuse passport runtime + evidence/trust composition | Low |
| `apps/api/backend` | reuse `opportunityService`, `computeReadiness`, `endorsementDelays` — no change to existing routes | Low–Med |
| recruiter surfaces | none — `/packet`, `/passport`, `/employer-review`, `/api/graph/*` untouched | None |

## 2. Affected routes

**New (additive, read-only):** `GET /mobility/:entityId`, `…/gaps`, `…/opportunities`, `…/readiness`.
**Unchanged:** everything shipped to date (evidence, graph, trust, packet, passport, employer-review). The existing aggregate `/api/intelligence/mobility` is left as-is — the new routes are per-entity and clearly distinct.

## 3. Schema impact

- **No Prisma migration.** `OpportunityObject` is a view over the existing `Opportunity` record; gaps/readiness are computed projections over existing evidence.
- **New versioned API contracts only:** `vitalcv.opportunity.v1`, `vitalcv.mobility.v1`, `vitalcv.mobility-gaps.v1`, `vitalcv.mobility-opportunities.v1`, `vitalcv.mobility-readiness.v1`.
- **No new enums in the evidence vocabulary** — requirements reuse `EvidenceClass`/`EvidenceStatus`/`TrustDimension`.

## 4. Migration & correctness risks

| Risk | Severity | Mitigation |
|---|---|---|
| Gated/stale evidence satisfying a mandatory requirement | **High (doctrine)** | `minStatus` defaults `checked`; gap test proves gated→`insufficient`, never satisfied |
| `ready` produced without decision-grade coverage | **High** | `projectReadiness` precedence + a partial-fixture test (parallels W205 recruiter rollup) |
| `unknown` conflated with `blocked` | Med | explicit separate verdict; "absence of evidence is not a fail" test |
| Fabricated `estimatedStartDays` | Med | `null` unless readiness engine/endorsement table supplies a real number |
| Cross-state license over-credited | Med | exact jurisdiction match; compact only via explicit `apply_endorsement` remediation |
| Opportunity requirements drift from backend shape | Med | single `fromBackendOpportunity` adapter + golden-fixture test |
| Perceived "matching/recommendation" overreach | Med (product) | `/opportunities` carries a mandatory `note`: deterministic evaluation, not ranking (ranking deferred to W260) |

## 5. Performance

- All per-entity; bounded by one clinician's evidence. Reuses the cached evidence/trust composition (ETag on `lastCheckedAt`).
- `/mobility/:entityId/opportunities` iterates posted opportunities (filtered by specialty/state first) — cap + `truncated` flag, no silent limit.

## 6. Test strategy (when built)

1. **Unit (pure):** `detectGaps` per requirement kind; `projectReadiness` precedence (ready/near/blocked/unknown); opportunity adapter.
2. **Honesty/property:** gated never satisfies; `ready` only with decision-grade mandatory coverage; `unknown ≠ blocked`; `estimatedStartDays` null unless sourced; deterministic.
3. **Contract:** each route returns its `vitalcv.*.v1` schema + honest empty/`truncated` states.
4. **Regression:** evidence/graph/trust/packet suites stay green; `pnpm check:claims`, typecheck, web build.
5. **Codex SAFE** before merge.

## 7. Effort estimates (1 unit ≈ a focused PR w/ tests)

| Item | Effort |
|---|---|
| `OpportunityObject` types + `fromBackendOpportunity` adapter + tests | 1.5 |
| `detectGaps` + Gap model + tests (per requirement kind) | 2 |
| `projectReadiness` + precedence + honesty tests | 1.5 |
| 4 `/mobility/*` routes + contract tests | 2 |
| Licensure→state index + compact endorsement wiring | 1.5 |
| Dev mobility view (optional, parallels graph explorer) | 1 |

**Total ≈ 9.5 units.** ~75% reuse (trust/evidence/graph already shipped; opportunity store + readiness engine + compact tables already exist). The only genuinely new logic is the gap engine and readiness precedence — both pure, both small, both fully testable.

## 8. Recommended build order (when the user says go)

1. `OpportunityObject` + adapter (foundation).
2. `detectGaps` + `GET /mobility/:entityId/gaps`.
3. `projectReadiness` + `GET /mobility/:entityId/readiness`.
4. `GET /mobility/:entityId` overview + licensure→state index.
5. `GET /mobility/:entityId/opportunities` (deterministic readiness pass; explicitly not ranking).

Matching/ranking stays out of scope until W260 — this wave is the foundation, exactly as briefed.

**Deliverable status:** W230 complete — C1–C6 in `docs/wave230/`.
