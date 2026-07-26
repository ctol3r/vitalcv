# Wave 270 — Mobility Engine (the missing layer)

**Branch:** `feat/mobility-engine` (stacked on `feat/career-evidence-stack` / PR #444) · **Date:** 2026-06-23

W270 asked to productionize the Opportunity Network "leveraging Mobility" — but Mobility was **design-only** (W230) and never built, making the `Wallet → Mobility → Opportunities` chain unbuildable. This PR builds the missing Mobility layer (my own W230 design) so the chain is real, not faked. The pre-existing Opportunity Network (backend TS + Python matcher + Solidity) is untouched.

---

## What was built

Implements W230-C2/C3/C5 as a pure module + read APIs over the shipped evidence/trust pipeline.

| Layer | Artifact |
|---|---|
| Opportunity model | `OpportunityObject` + 3 requirement kinds (`evidence`/`trust`/`experience`) — W230-C2 |
| Gap engine | `detectGaps()` → honest `satisfied`/`missing`/`insufficient`/`stale` + remediation — W230-C3 |
| Readiness | `projectReadiness()` → `ready`/`near_ready`/`blocked`/`unknown` precedence — W230-C5 |
| Overview | `deriveMobilityOverview()` → licensed states + mobility trust + reusable count — W230-C4 |
| Template | `defaultReadinessTemplate(state)` — a standard readiness template (NOT employer matching) |
| APIs | `GET /api/mobility/:id`, `…/readiness?state=XX`, `…/gaps?state=XX` |

## Success criteria

| Criterion | Result |
|---|---|
| **typed** | `tsc`/`next build` clean (one duplicate-key bug found + fixed) |
| **tested** | package: 38 tests (10 new mobility) · web: 7 mobility integration + route tests |
| **secure** | `state` param whitelisted (`^[A-Za-z]{2}$`) — cannot inject; pure engine has no I/O |
| **performant** | pure O(n) over one clinician's evidence; pipeline already measured at 25ms/5k objects (W245) |
| **mergeable** | `pnpm turbo run build --filter @vitalcv/web` → 14/14 tasks, exit 0 |

## Honesty invariants (carried from the trust layer, tested)

- A mandatory requirement is satisfied **only** by decision-grade (`checked`) evidence — gated/stale never satisfies (tested).
- `ready` is unreachable without decision-grade mandatory coverage; absent evidence is honest `unknown`, **not** `blocked`/failure (tested).
- Deterministic; no ML, no ranking (ranking is W260, explicitly out of scope).
- `/readiness` evaluates against a **standard readiness template**, not a specific employer opportunity — documented in the route and schema, so it is never read as a match/guarantee.

## C4 — the integration that W270 wanted

`Wallet → Mobility → Opportunities` is now real: a clinician's credentials (the wallet's evidence) → `EvidenceCollection` → `TrustProjection` → mobility readiness. Test proves: a CA-licensed, identity+exclusion-checked clinician is **READY** for CA and **NEAR_READY** for NV (endorsement path), with `licensedStates: ['CA']`.

## What this does NOT touch

The pre-existing Opportunity Network — `opportunityService.ts`, `matcha.ts`, the Python `ai-matcher-service`, `MatchingPool.sol` — is **not modified**. Wiring this readiness layer into those (e.g. `fromBackendOpportunity` to evaluate against real posted opportunities) is a documented follow-on, intentionally not done here to keep the PR scoped and avoid editing code I didn't author.

## Merge

Stacked on PR #444 (needs the evidence/trust pipeline). Requires a **Codex SAFE verdict** before merge, same as #444/#445.
