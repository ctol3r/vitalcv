/**
 * W2-PR70A — Replay Efficiency Comparison tests.
 */
import {
  buildReplayEfficiencyComparison,
  REPLAY_EFFICIENCY_RATIO_CAP,
  KNOWN_REPLAY_EFFICIENCY_VERDICTS,
} from '../replayEfficiencyComparison';
import { STANDARD_BENCHMARK_BASELINES } from '../trustOperationalBenchmark';
import { makeBundle } from '../_testFixtures';

describe('replayEfficiencyComparison', () => {
  it('marks every replay as REPLAY_REPRODUCED when VitalCV is faster than baseline (uncapped)', () => {
    // VERIFIER_REVIEW_ONLY baseline (7 days) gives 7d / 100ms ≈ 6M× — that
    // exceeds the cap. Synthesize a smaller baseline so we exercise the
    // uncapped median-ratio path.
    const smallBaseline = {
      ...STANDARD_BENCHMARK_BASELINES.NO_REPLAY_SURVIVABILITY,
      metrics: {
        ...STANDARD_BENCHMARK_BASELINES.NO_REPLAY_SURVIVABILITY.metrics,
        replayLatencyMs: 5_000, // 5 s baseline replay
      },
    };
    const bundle = makeBundle({ capsuleIds: ['cap-1', 'cap-2'] });
    const cmp = buildReplayEfficiencyComparison({
      auditBundles: [bundle],
      replayLatencies: { 'cap-1': 100, 'cap-2': 110 },
      baseline: smallBaseline,
    });
    expect(cmp.verdict).toBe('BENCHMARK_OBSERVED');
    expect(cmp.reproducedCount).toBe(2);
    expect(cmp.regressedCount).toBe(0);
    expect(cmp.medianRatio).not.toBeNull();
    expect(cmp.cappedReplayCount).toBe(0);
    expect(cmp.metrics.every(m => m.verdict === 'REPLAY_REPRODUCED')).toBe(true);
  });

  it('caps legacy-credentialing comparison since 60d/100ms exceeds the 1M× ratio cap', () => {
    const bundle = makeBundle({ capsuleIds: ['cap-1'] });
    const cmp = buildReplayEfficiencyComparison({
      auditBundles: [bundle],
      replayLatencies: { 'cap-1': 100 },
      baseline: STANDARD_BENCHMARK_BASELINES.LEGACY_CREDENTIALING,
    });
    expect(cmp.cappedReplayCount).toBe(1);
    expect(cmp.metrics[0].capped).toBe(true);
    // medianRatio is computed only over uncapped ratios — null is the correct
    // signal that every replay is "operationally indistinguishable" beyond
    // the cap, not "no comparison".
    expect(cmp.medianRatio).toBeNull();
    expect(cmp.verdict).toBe('BENCHMARK_OBSERVED');
  });

  it('emits REPLAY_NOT_REPRODUCIBLE when baseline does not support replay', () => {
    const bundle = makeBundle({ capsuleIds: ['cap-1'] });
    const cmp = buildReplayEfficiencyComparison({
      auditBundles: [bundle],
      replayLatencies: { 'cap-1': 50 },
      baseline: STANDARD_BENCHMARK_BASELINES.NO_REPLAY_SURVIVABILITY,
    });
    expect(cmp.notReproducibleCount).toBe(1);
    expect(cmp.metrics[0].verdict).toBe('REPLAY_NOT_REPRODUCIBLE');
    expect(cmp.metrics[0].ratio).toBeNull();
    expect(cmp.verdict).toBe('BENCHMARK_OBSERVED');
  });

  it('caps absurd ratios but reports the cap explicitly', () => {
    const bundle = makeBundle({ capsuleIds: ['cap-1'] });
    const cmp = buildReplayEfficiencyComparison({
      auditBundles: [bundle],
      replayLatencies: { 'cap-1': 0.00001 }, // forces ratio above the 1M× cap
      baseline: STANDARD_BENCHMARK_BASELINES.LEGACY_CREDENTIALING,
    });
    expect(cmp.cappedReplayCount).toBe(1);
    expect(cmp.metrics[0].ratio).toBe(REPLAY_EFFICIENCY_RATIO_CAP);
    expect(cmp.metrics[0].capped).toBe(true);
    expect(cmp.metrics[0].reason).toContain('capped');
  });

  it('preserves AMBIGUOUS when latencies are missing', () => {
    const bundle = makeBundle({ capsuleIds: ['cap-1', 'cap-2'] });
    const cmp = buildReplayEfficiencyComparison({
      auditBundles: [bundle],
      replayLatencies: {},
      baseline: STANDARD_BENCHMARK_BASELINES.LEGACY_CREDENTIALING,
    });
    expect(cmp.ambiguousCount).toBe(2);
    expect(cmp.verdict).toBe('BENCHMARK_AMBIGUOUS');
    expect(cmp.ambiguous).toBe(true);
  });

  it('fails closed to BENCHMARK_BREACH when bundle contains a CONTAINMENT_BREACH', () => {
    const bundle = makeBundle({ capsuleIds: ['cap-1'], breachCount: 1, partitioned: false });
    const cmp = buildReplayEfficiencyComparison({
      auditBundles: [bundle],
      replayLatencies: { 'cap-1': 50 },
      baseline: STANDARD_BENCHMARK_BASELINES.LEGACY_CREDENTIALING,
    });
    expect(cmp.verdict).toBe('BENCHMARK_BREACH');
    expect(cmp.breachedCount).toBeGreaterThan(0);
  });

  it('reports REPLAY_REGRESSED when VitalCV is slower than the baseline value', () => {
    const fastBaseline = {
      ...STANDARD_BENCHMARK_BASELINES.NO_REPLAY_SURVIVABILITY,
      metrics: {
        ...STANDARD_BENCHMARK_BASELINES.NO_REPLAY_SURVIVABILITY.metrics,
        replayLatencyMs: 10,
      },
    };
    const bundle = makeBundle({ capsuleIds: ['cap-1'] });
    const cmp = buildReplayEfficiencyComparison({
      auditBundles: [bundle],
      replayLatencies: { 'cap-1': 100 },
      baseline: fastBaseline,
    });
    expect(cmp.metrics[0].verdict).toBe('REPLAY_REGRESSED');
    expect(cmp.regressedCount).toBe(1);
    expect(cmp.verdict).toBe('BENCHMARK_REGRESSED');
  });

  it('emits a deterministic comparison digest', () => {
    const bundle = makeBundle({ capsuleIds: ['cap-1', 'cap-2'] });
    const args = {
      auditBundles: [bundle],
      replayLatencies: { 'cap-1': 100, 'cap-2': 110 },
      baseline: STANDARD_BENCHMARK_BASELINES.VERIFIER_REVIEW_ONLY,
    };
    const a = buildReplayEfficiencyComparison(args);
    const b = buildReplayEfficiencyComparison(args);
    expect(a.comparisonDigest).toBe(b.comparisonDigest);
  });

  it('exposes frozen verdict sentinels', () => {
    expect(KNOWN_REPLAY_EFFICIENCY_VERDICTS).toContain('REPLAY_REPRODUCED');
    expect(KNOWN_REPLAY_EFFICIENCY_VERDICTS).toContain('REPLAY_NOT_REPRODUCIBLE');
    expect(Object.isFrozen(KNOWN_REPLAY_EFFICIENCY_VERDICTS)).toBe(true);
  });
});
