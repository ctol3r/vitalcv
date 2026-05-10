/**
 * economicMetrics.scale.test.ts — 500+ replay scale gate.
 *
 * Wave: W2-PR60A.
 *
 * Runs the engine against a 1000-replay synthetic dataset and asserts the
 * structural invariants that the CI gate guarantees on every push:
 *
 *   1. Verdict is PROVEN or PROBABLE (large clean sample should never be INCONCLUSIVE).
 *   2. Every metric has low <= point <= high.
 *   3. Time-to-start point estimate is bounded (we'd notice if the bootstrap collapsed).
 *   4. Operational savings always reports a non-degenerate USD range.
 *   5. Per-verifier reports cover every verifier in the pool.
 *   6. Engine is deterministic — same input produces identical inputDigest + verdict.
 *   7. Engine returns under a generous wall-clock budget (heuristic, not perf SLO).
 *
 * Emits a `[economic-trust-board]` line to stdout so CI can grep it into the
 * board summary. The format is deliberately simple — workflow log scraping.
 */

import { computeEconomicTrustReport } from '../../index';
import { buildReplayEvidence } from '../../__test_fixtures__/replayEvidenceFixtures';

const WINDOW_START = new Date('2026-05-01T00:00:00.000Z');
const WINDOW_END = new Date('2026-05-08T00:00:00.000Z');
const SAMPLE_SIZE = 1000;
const WALL_CLOCK_BUDGET_MS = 5_000;

describe('economic-trust scale :: 1000-replay window', () => {
  const replays = buildReplayEvidence({
    count: SAMPLE_SIZE,
    seed: 9001,
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
  });

  const start = Date.now();
  const report = computeEconomicTrustReport(replays, {
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
  });
  const elapsedMs = Date.now() - start;

  it('completes within the wall-clock budget', () => {
    expect(elapsedMs).toBeLessThan(WALL_CLOCK_BUDGET_MS);
  });

  it('returns PROVEN or PROBABLE on a clean 1000-replay sample', () => {
    expect(['PROBABLE', 'PROVEN']).toContain(report.verdict);
    expect(report.totalReplays).toBe(SAMPLE_SIZE);
  });

  it('preserves ambiguity bounds on every reported metric', () => {
    const metrics = [
      report.timeToStartMs,
      report.replayReuseEfficiency,
      report.trustEfficiencyScore,
      report.operationalSavingsUsd,
    ];
    for (const m of metrics) {
      expect(m.low).toBeLessThanOrEqual(m.point + 1e-9);
      expect(m.point).toBeLessThanOrEqual(m.high + 1e-9);
      expect(Number.isFinite(m.confidence)).toBe(true);
      expect(m.sampleSize).toBeGreaterThan(0);
    }
  });

  it('reports a non-degenerate USD savings range', () => {
    expect(report.operationalSavingsUsd.high).toBeGreaterThan(report.operationalSavingsUsd.low);
    expect(report.operationalSavingsUsd.basis).toBe('derived');
  });

  it('covers every verifier in the synthetic pool', () => {
    const ids = new Set(report.verifierEfficiency.map((r) => r.verifierId));
    for (const expected of ['sys-1', 'sys-2', 'org-acme', 'reviewer-42']) {
      expect(ids.has(expected)).toBe(true);
    }
  });

  it('is deterministic across runs', () => {
    const second = computeEconomicTrustReport(replays, {
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
    });
    expect(second.inputDigest).toBe(report.inputDigest);
    expect(second.verdict).toBe(report.verdict);
  });

  // Emit a board line CI can grep. Not an assertion — observability hook.
  // eslint-disable-next-line jest/expect-expect
  it('emits an [economic-trust-board] line for CI capture', () => {
    const board = {
      verdict: report.verdict,
      n: report.totalReplays,
      tenants: report.tenantCount,
      timeToStartMsP: round(report.timeToStartMs.point),
      replayReuseRatioP: round(report.replayReuseEfficiency.point, 4),
      trustEfficiencyP: round(report.trustEfficiencyScore.point, 2),
      savingsLowUsd: round(report.operationalSavingsUsd.low, 2),
      savingsHighUsd: round(report.operationalSavingsUsd.high, 2),
      savingsConfidence: round(report.operationalSavingsUsd.confidence, 3),
      digest: report.inputDigest.slice(0, 12),
      methodology: '1.0',
      elapsedMs,
    };
    // Single-line, parseable by the CI gate scraper.
    // eslint-disable-next-line no-console
    console.log(`[economic-trust-board] ${JSON.stringify(board)}`);
    // Trivial assertion to satisfy strict jest configs.
    expect(board.n).toBe(SAMPLE_SIZE);
  });
});

function round(n: number, places = 0): number {
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
}
