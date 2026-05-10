/**
 * chaos.test.ts — Verify fail-closed semantics under each chaos scenario.
 *
 * Wave: W2-PR60A.
 *
 * Every scenario must EITHER fail closed (FAIL_CLOSED / INCONCLUSIVE) OR
 * report a degraded trust-efficiency score relative to the clean baseline.
 * The engine is never allowed to look HEALTHIER under contamination than
 * before contamination — that would be the most dangerous failure mode.
 */

import {
  applyChaosScenario,
  computeEconomicTrustReport,
  summariseChaosScenario,
} from '../index';
import type { ChaosScenarioName } from '../index';
import { buildReplayEvidence } from '../__test_fixtures__/replayEvidenceFixtures';

const WINDOW_START = new Date('2026-05-01T00:00:00.000Z');
const WINDOW_END = new Date('2026-05-08T00:00:00.000Z');

const baseline = buildReplayEvidence({
  count: 200,
  seed: 42,
  windowStart: WINDOW_START,
  windowEnd: WINDOW_END,
});
const baselineReport = computeEconomicTrustReport(baseline, {
  windowStart: WINDOW_START,
  windowEnd: WINDOW_END,
});

const scenarios: Array<{ name: ChaosScenarioName; rate: number; seed: number }> = [
  { name: 'replay_corruption', rate: 0.4, seed: 11 },
  { name: 'integrity_collapse', rate: 0.6, seed: 12 },
  { name: 'verifier_monoculture', rate: 1, seed: 13 },
  { name: 'reuse_inflation', rate: 0.3, seed: 14 },
  { name: 'window_starvation', rate: 1, seed: 15 },
];

describe.each(scenarios)('roiChaos :: $name', ({ name, rate, seed }) => {
  const perturbed = applyChaosScenario(baseline, { name, rate, seed });
  const perturbedReport = computeEconomicTrustReport(perturbed, {
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
  });
  const summary = summariseChaosScenario(name, rate, baselineReport, perturbedReport);

  it('never reports a HIGHER trust-efficiency than the clean baseline', () => {
    expect(summary.trustEfficiencyDelta).toBeLessThanOrEqual(1e-6);
  });

  it('either fails closed OR reports a strict degradation', () => {
    if (!summary.failedClosed) {
      // Probable / Proven outcomes are only acceptable when score actually dropped
      // OR the scenario is verifier_monoculture (a real production state, not a corruption).
      if (name !== 'verifier_monoculture') {
        expect(summary.trustEfficiencyDelta).toBeLessThan(0);
      }
    } else {
      expect(['FAIL_CLOSED', 'INCONCLUSIVE']).toContain(summary.observedVerdict);
    }
  });

  it('exposes a non-empty notes string', () => {
    expect(summary.notes.length).toBeGreaterThan(0);
  });
});

describe('roiChaos :: input validation', () => {
  it('rejects rates outside [0,1]', () => {
    expect(() => applyChaosScenario(baseline, { name: 'replay_corruption', rate: 1.2, seed: 0 })).toThrow();
    expect(() => applyChaosScenario(baseline, { name: 'replay_corruption', rate: -0.1, seed: 0 })).toThrow();
  });
});
