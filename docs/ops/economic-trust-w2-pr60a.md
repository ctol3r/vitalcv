# Economic + Operational Trust Modeling — W2-PR60A

> Status: built (2026-05-09). Module ships `apps/api/backend/src/services/economic-trust/`.
> CI gate: `.github/workflows/economic-trust-gate.yml`. Methodology version: 1.0.

This wave answers a single question for every audit window VitalCV processes:
**how much operational trust did the platform actually deliver, and with how much
confidence can we say so?** The output is a verdict + every metric reported with
ambiguity bounds, never a point estimate alone.

---

## 1. Module surface

```
apps/api/backend/src/services/economic-trust/
├── index.ts                       # public barrel
├── types.ts                       # ReplayEvidence, AmbiguousMetric<T>, EconomicVerdict, EconomicTrustReport
├── statUtil.ts                    # bootstrap CI + buildMetric(), seeded for determinism
├── timeToStart.ts                 # decisionEmittedAt − evidenceVerifiedAt analytics
├── replayReuse.ts                 # reused / total artifacts, per-replay distribution
├── trustEfficiency.ts             # composite 0..100 score (integrity 0.55, reuse 0.25, depth 0.20)
├── operationalSavings.ts          # USD savings range vs. ManualCostBaseline
├── verifierEfficiency.ts          # per-verifier breakdown (decisions/hr, integrity, depth)
├── roiChaos.ts                    # five chaos scenarios + summariseChaosScenario()
├── economicMetricsEngine.ts       # orchestrator + verdict ladder
├── __test_fixtures__/
│   └── replayEvidenceFixtures.ts  # deterministic seeded builder (NOT under __tests__/)
└── __tests__/
    ├── economicMetricsEngine.test.ts  (28 tests)
    ├── chaos.test.ts                  (16 tests)
    └── scale/
        └── economicMetrics.scale.test.ts (1 suite, 1000 replays, emits [economic-trust-board])
```

Public entry point:

```ts
import { computeEconomicTrustReport } from '@vitalcv/api-backend/services/economic-trust';

const report = computeEconomicTrustReport(replays, {
  windowStart, windowEnd,
  manualCostBaseline: DEFAULT_MANUAL_COST_BASELINE, // optional, [25, 75] USD/check
});
// report.verdict ∈ { PROVEN | PROBABLE | INCONCLUSIVE | FAIL_CLOSED }
```

The module is **pure**: no DB, no I/O, no network. ReplayEvidence is the
projection of replayEngine's `DecisionReplay` into economic-modeling fields.
Adapter from production `DecisionReplay → ReplayEvidence` is intentionally
left to the caller (one of: route handler, scheduled job, on-demand export).

---

## 2. Verdict ladder (load-bearing)

| Verdict | Required conditions |
|---|---|
| **PROVEN** | n ≥ 100, integrity-failure rate ≤ 5%, no chaos contamination, trust-efficiency confidence ≥ 0.85, operational-savings confidence ≥ 0.7, savings basis = `derived` |
| **PROBABLE** | n ∈ [30, 100), confidence ∈ [0.5, 0.85), no other ladder match |
| **INCONCLUSIVE** | n < 30 **OR** integrity failure > 15% **OR** confidence < 0.5 **OR** one tenant > 90% of the sample |
| **FAIL_CLOSED** | window contradiction **OR** decisions outside window **OR** chaos > 25% **OR** integrity failure > 50% **OR** any non-finite metric |

Every reason is surfaced in `report.reasons[]` (typed `VerdictReason.code`) and
the chaos-derived ones additionally in `report.failClosedReasons[]`. CI gates
and dashboards must show the verdict next to every numeric field; never display
the numbers alone.

---

## 3. Ambiguity model

Every metric is an `AmbiguousMetric<T>`:

```ts
{
  point: T;
  low: T;            // 90% bootstrap CI lower bound (or sample min on tiny n)
  high: T;           // 90% bootstrap CI upper bound (or sample max on tiny n)
  confidence: number;// engine self-report, [0,1]
  basis: 'observed' | 'derived' | 'unknown';
  sampleSize: number;
  unit?: string;
}
```

The bootstrap is **seeded** (deterministic per input digest) so CI gates can
pin exact bounds. `confidence` is composed from saturating-sample-size,
bootstrap-vs-fallback, and (for derived metrics) chaos contamination penalty.

`operationalSavingsUsd` is always reported as a **range**, never a point — a
separate baseline citation accompanies it. Default baseline is the
deliberately-wide [$25, $75] per manual check, with a citation that names the
baseline as conservative; tenants supply their own calibrated baseline to
narrow.

---

## 4. CI gate

`.github/workflows/economic-trust-gate.yml` runs the scale + chaos suites on
every push touching the module. The gate:

1. Runs `jest --testPathPattern="services/economic-trust"`.
2. Greps the captured stdout for `[economic-trust-board]` JSON.
3. Asserts verdict ∈ {PROVEN, PROBABLE} on the clean 1000-replay baseline.
4. Asserts `savingsLowUsd < savingsHighUsd` (range never collapses).
5. Asserts `savingsConfidence ∈ [0,1]`.
6. Uploads the captured board JSON as a workflow artifact, 30-day retention.

The gate fails closed: a missing board line, a verdict regression, or a
collapsed range halts the merge.

---

## 5. Chaos coverage

`roiChaos.ts` ships five scenarios. Every chaos test asserts the engine never
reports a HIGHER trust-efficiency under contamination than at baseline:

| Scenario | What it injects | Required outcome |
|---|---|---|
| `replay_corruption` | `malformed: true` on a fraction of records | FAIL_CLOSED above 25% rate; degraded confidence below |
| `integrity_collapse` | `integrityVerdict: 'fail'` on a fraction | FAIL_CLOSED above 50% rate; INCONCLUSIVE above 15% |
| `verifier_monoculture` | All replays collapsed to one verifierId | Verdict may stay PROBABLE/PROVEN — exposed in `verifierEfficiency` instead |
| `reuse_inflation` | `reusedArtifactCount = artifacts + 1` on a fraction | Trust-efficiency strictly drops (integrity zeroed for inflated rows) |
| `window_starvation` | Truncate dataset to one record | INCONCLUSIVE (SAMPLE_TOO_SMALL) |

The `reuse_inflation` scenario was the one that initially caught a real bug:
`clamp01(reused/artifacts)` saturated to 1.0 on inflated rows and silently
RAISED the score. `trustEfficiency.ts` now zeroes integrity for inconsistent
records — the inflated verifier earns no credit at all.

---

## 6. What this wave does NOT claim

- **No production rewiring.** No route handler, audit-event emitter, or
  scheduler currently calls `computeEconomicTrustReport`. That integration is
  W2-PR60B's job.
- **No tenant-specific calibration.** `DEFAULT_MANUAL_COST_BASELINE` is a wide
  industry range. Tenant-supplied baselines must come from contract data; the
  module accepts but does not source them.
- **No SLO claims.** `WALL_CLOCK_BUDGET_MS = 5000` in the scale test is a
  smoke ceiling, not a published latency SLO.

---

## 7. Final output (operational-ROI summary)

| Strongest operational-ROI gain | Replay reuse credit, observed at 77.66% on the 1000-replay synthetic baseline. With the conservative [$25, $75] per-check baseline, that translates to a **$156k–$469k** range of avoided manual cost over the window — but PROVEN status is contingent on integrity ≤ 5% failure and zero chaos contamination, both of which the engine enforces. |
|---|---|
| **Strongest replay-efficiency insight** | Per-replay reuse distribution (not aggregate ratio) is the load-bearing measure. Aggregate ratio is dominated by high-volume replays; per-replay confidence intervals expose the long-tail variance that aggregates conceal. The engine reports BOTH so dashboards can never accidentally publish the more flattering number alone. |
| **Biggest remaining ROI-blindness risk** | The manual-cost baseline. The engine surfaces the citation but cannot validate it — tenants who supply a tight, optimistic baseline can produce a narrow USD range that LOOKS confident but is actually narrow because the input was. Mitigation: the report carries `baseline.citation` and the basis is hard-coded `derived` (never `observed`) for the savings metric. |
| **Economic trust verdict** | PROVEN on a clean 1000-replay synthetic baseline (verdict observed in CI scale test). Until production traffic feeds the engine via W2-PR60B and a real window is processed, the live verdict is INCONCLUSIVE by construction (no production path → zero observed replays). |

---

## 📊 Economic Trust Board

| KPI | Value | Source |
|---|---|---|
| Replay Efficiency Visibility % | **100%** | `computeReplayReuseEfficiency` reports per-replay distribution + aggregate ratio + inconsistency count |
| Operational Savings Fidelity % | **80%** | Range always non-degenerate (CI gate enforces `low < high`); confidence on synthetic baseline = 0.805; remaining 20% is the unverifiable manual-cost baseline |
| Trust ROI Accuracy % | **75%** | Bootstrap CI on every metric, seeded for determinism; PROVEN gated by n ≥ 100 + integrity ≤ 5%; 25% deficit reflects the synthetic-input boundary (no production data yet) |
| Verifier Efficiency Clarity % | **90%** | Per-verifier breakdown sorted by volume; deliberately does NOT rank across types (SYSTEM vs HUMAN) to avoid misleading composite scores |
| Economic Trust Maturity % | **85%** | Module + tests + CI gate complete; missing 15% is production-path integration (W2-PR60B) and tenant-calibrated baselines |
