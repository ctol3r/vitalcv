/**
 * W2-PR70A — Trust Operational Benchmark core tests.
 *
 * Pure-transform tests (no prisma, no DB). Synthetic audit bundles drive
 * the reduce → compare → roll-up pipeline.
 */
import {
  STANDARD_BENCHMARK_BASELINES,
  TrustBenchmarkError,
  assertBenchmarkSafe,
  buildTrustOperationalBenchmark,
  reproduceLineageDigest,
  KNOWN_BENCHMARK_VERDICTS,
  reduceVitalCVProfile,
} from '../trustOperationalBenchmark';
import { makeBundle } from '../_testFixtures';

describe('buildTrustOperationalBenchmark — core invariants', () => {
  it('produces BENCHMARK_OBSERVED on a clean slice with sub-second replay latency', () => {
    const bundle = makeBundle({ capsuleIds: ['cap-1', 'cap-2', 'cap-3'] });
    const benchmark = buildTrustOperationalBenchmark({
      benchmarkId: 'bench-001',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: {
        auditBundles: [bundle],
        replayLatencies: { 'cap-1': 50, 'cap-2': 60, 'cap-3': 55 },
      },
    });
    expect(benchmark.overallVerdict).toBe('BENCHMARK_OBSERVED');
    expect(benchmark.vitalcvProfile.replayCount).toBe(3);
    expect(benchmark.vitalcvProfile.cleanReplayCount).toBe(3);
    expect(benchmark.vitalcvProfile.partialSurvivabilityPct).toBe(100);
    expect(benchmark.comparisons.length).toBe(4);
    expect(reproduceLineageDigest(benchmark)).toBe(benchmark.lineageDigest);
  });

  it('fails closed to BENCHMARK_BREACH when slice contains a CONTAINMENT_BREACH replay', () => {
    const bundle = makeBundle({
      cleanCount: 2,
      breachCount: 1,
      partitioned: false,
      partialSurvivabilityPct: 60,
    });
    const benchmark = buildTrustOperationalBenchmark({
      benchmarkId: 'bench-002',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: {
        auditBundles: [bundle],
        replayLatencies: { 'cap-1': 50 },
      },
    });
    expect(benchmark.overallVerdict).toBe('BENCHMARK_BREACH');
    expect(benchmark.vitalcvProfile.breachCount).toBe(1);
    expect(() => assertBenchmarkSafe(benchmark)).toThrow(TrustBenchmarkError);
  });

  it('preserves ambiguity when the slice has zero replays', () => {
    const benchmark = buildTrustOperationalBenchmark({
      benchmarkId: 'bench-003',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: { auditBundles: [] },
    });
    expect(benchmark.overallVerdict).toBe('BENCHMARK_AMBIGUOUS');
    expect(benchmark.ambiguous).toBe(true);
    expect(benchmark.vitalcvProfile.replayCount).toBe(0);
    expect(() => assertBenchmarkSafe(benchmark)).toThrow(TrustBenchmarkError);
  });

  it('preserves ambiguity when ambiguous quarantines are present (no silent merge)', () => {
    const bundle = makeBundle({
      capsuleIds: ['cap-1', 'cap-2', 'cap-3'],
      cleanCount: 1,
      ambiguousCount: 1,
      quarantinedCount: 1,
      partialSurvivabilityPct: 100,
    });
    const benchmark = buildTrustOperationalBenchmark({
      benchmarkId: 'bench-004',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: {
        auditBundles: [bundle],
        replayLatencies: { 'cap-1': 100, 'cap-2': 100, 'cap-3': 100 },
      },
    });
    expect(benchmark.vitalcvProfile.ambiguousCount).toBe(1);
    expect(benchmark.vitalcvProfile.ambiguityPreservationPct).toBe(100);
  });

  it('emits a deterministic lineage digest that survives input permutation', () => {
    const bundleA = makeBundle({ capsuleIds: ['cap-1', 'cap-2'] });
    const bundleB = makeBundle({ bundleId: 'bundle-2', capsuleIds: ['cap-3'] });
    const benchmark1 = buildTrustOperationalBenchmark({
      benchmarkId: 'bench-005',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: {
        auditBundles: [bundleA, bundleB],
        replayLatencies: { 'cap-1': 1, 'cap-2': 1, 'cap-3': 1 },
      },
    });
    const benchmark2 = buildTrustOperationalBenchmark({
      benchmarkId: 'bench-005',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: {
        auditBundles: [bundleB, bundleA],
        replayLatencies: { 'cap-1': 1, 'cap-2': 1, 'cap-3': 1 },
      },
    });
    expect(benchmark1.lineageDigest).toBe(benchmark2.lineageDigest);
  });

  it('compares against all four standard baselines by default', () => {
    const bundle = makeBundle({ capsuleIds: ['cap-1'] });
    const benchmark = buildTrustOperationalBenchmark({
      benchmarkId: 'bench-006',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: { auditBundles: [bundle], replayLatencies: { 'cap-1': 100 } },
    });
    const baselineIds = benchmark.comparisons.map(c => c.baselineId).slice().sort();
    expect(baselineIds).toEqual([
      'LEGACY_CREDENTIALING',
      'NO_REPLAY_SURVIVABILITY',
      'TRADITIONAL_AUDIT_WORKFLOW',
      'VERIFIER_REVIEW_ONLY',
    ]);
  });

  it('exposes every standard baseline with non-empty derivation citations', () => {
    for (const id of Object.keys(STANDARD_BENCHMARK_BASELINES) as Array<keyof typeof STANDARD_BENCHMARK_BASELINES>) {
      const baseline = STANDARD_BENCHMARK_BASELINES[id];
      expect(baseline.derivation.length).toBeGreaterThan(20);
      expect(baseline.evidenceSources.length).toBeGreaterThan(0);
    }
  });

  it('exposes the canonical verdict + baseline sentinels frozen', () => {
    expect(KNOWN_BENCHMARK_VERDICTS).toContain('BENCHMARK_OBSERVED');
    expect(KNOWN_BENCHMARK_VERDICTS).toContain('BENCHMARK_BREACH');
    expect(Object.isFrozen(KNOWN_BENCHMARK_VERDICTS)).toBe(true);
  });
});

describe('reduceVitalCVProfile — reduction invariants', () => {
  it('returns zero-counts and null latencies on an empty slice', () => {
    const profile = reduceVitalCVProfile({ auditBundles: [] });
    expect(profile.replayCount).toBe(0);
    expect(profile.medianReplayMs).toBeNull();
    expect(profile.p95ReplayMs).toBeNull();
    expect(profile.operationalFrictionUnits).toBeNull();
  });

  it('aggregates clean / quarantined / ambiguous / contaminated correctly', () => {
    const bundle = makeBundle({
      cleanCount: 3,
      quarantinedCount: 2,
      ambiguousCount: 1,
      contaminatedCount: 1,
      partialSurvivabilityPct: 85.7,
    });
    const profile = reduceVitalCVProfile({ auditBundles: [bundle] });
    expect(profile.cleanReplayCount).toBe(3);
    expect(profile.quarantinedCount).toBe(2);
    expect(profile.ambiguousCount).toBe(1);
    expect(profile.contaminatedCount).toBe(1);
    expect(profile.partialSurvivabilityPct).toBeCloseTo(85.7, 2);
  });
});
