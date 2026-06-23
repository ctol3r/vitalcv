# W228-C3 — Test Coverage Review

**Date:** 2026-06-21 · Measured: package 28 tests / web stack 20 tests + 24 regression.

---

## 1. Coverage by module

| Module | Tested behaviors | Grade |
|---|---|---|
| `collection.ts` | byClass grouping, coverage summary, **decisionGrade fail-closed**, dedup | **strong** |
| `projectors/graph.ts` | license/cert projection, no dup nodes, no orphans, **no inflation**, **no false decision-grade**, enumerated rel types, stats | **strong** |
| `trust/propagate.ts` | 7 dimensions present, identity/authority scoring, **null for no-evidence**, **no inflation**, gated→weakening, overall bounds, history reinforcement/decay, **determinism** | **strong** |
| `timeline/timeline.ts` | event per node, ordering, trust/mobility/recognition impact, **honest reputation standing**, unknown standing, **determinism** | **strong** |
| `passport-to-evidence.ts` | verbatim status, class mapping, primary-source→checked, self-reported→notDecisionGrade, verified_by links, no bare Verified | **strong** |

## 2. Missing coverage (honest gaps)

| Gap | Severity | Recommendation |
|---|---|---|
| **API route handlers have no direct tests** (`/api/evidence`, `/api/graph`, `/api/graph/trust`, `/api/timeline`) | **medium** | The route logic (param await, schema envelope, error 500 path, `Cache-Control`) is untested. Routes are thin (3–5 lines) and the composed functions are well-tested, but the handler wiring is not. **Add 4 route smoke tests** (mock `resolvePassportRuntimePassport`) — listed as a pre-merge recommendation in 07. |
| `propagateTrust` — `mobility` and `institutional` dimensions not directly asserted | low | covered indirectly; add 2 assertions. |
| Adapter — `training` evidence class not exercised (no training fixture) | low | add a training credential fixture. |
| Adapter — credential `REVOKED`/`SUSPENDED` → `reviewRequired` lifecycle path untested | low | add one fixture. |
| Dev explorer UI (`GraphExplorerClient`) | none (acceptable) | dev-only tool, not a production surface. |

## 3. Weak coverage

- **Timeline recognition path** is tested only in the package (synthetic recognition fixture); the web integration test has no recognition evidence (passport fixtures don't carry recognition). Acceptable — the package test covers the logic; the web path is a thin pass-through.
- **Edge-case classifiers** (`classifyEvidenceClass` fallback to `licensure`, unusual sourceIds) are partially covered. The board-vs-license bug found and fixed in W221 has a regression test.

## 4. Critical paths (well covered)

The doctrine-critical invariants all have direct, dedicated tests:

1. **decisionGrade ⇔ checked** — `collection.test.ts` (fail-closed), `graph.test.ts` (no false decision-grade), adapter test (self-reported never decision-grade).
2. **No trust inflation** — `graph.test.ts` (`≤ statusTrustScore`), `propagate.test.ts` (no dimension exceeds max contributing), `timeline.test.ts` (`trustImpact ≤ 1`).
3. **Gated stays gated** — adapter test (verbatim status), `propagate.test.ts` (gated→weakening).
4. **Honest absence** — `propagate.test.ts` (null dimension), `timeline.test.ts` (unknown standing).
5. **Determinism** — trust + timeline determinism tests.
6. **No bare `Verified` / banned strings** — `banned-verified-label.test.ts` (scans lib too), `check:claims`.
7. **Recruiter surface unbroken** — career-packet + employer-proof-packet + export-packet-route regression all green.

## 5. Verdict

Coverage of the **pure logic and the doctrine invariants is strong** (the things most likely to cause a trust violation). The one real gap is **route-handler smoke tests** — medium severity, cheap to close, and recommended (not strictly required) before merge. Everything else is low-severity polish.
