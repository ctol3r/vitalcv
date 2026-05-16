/**
 * W2-PR70A — Trust-Layer Benchmarking Scale Gate
 *
 * Runs the trust-layer operational benchmark across a multi-bundle slice
 * at scale and asserts the four invariants the gate exists to protect:
 *
 *   1. benchmark integrity preserved under load — every replay in a 1 000-
 *      capsule slice produces a deterministic comparison record, and the
 *      lineageDigest is reproducible from the inputs.
 *   2. ambiguity preserved at scale — a slice with mixed AMBIGUOUS verdicts
 *      surfaces every ambiguous record (no silent merge).
 *   3. fail-closed at scale — a single CONTAINMENT_BREACH replay anywhere
 *      in a 1 000-capsule slice forces overallVerdict=BENCHMARK_BREACH.
 *   4. dashboard determinism — the same benchmark run twice produces the
 *      same dashboardDigest, ensuring no race-related drift in the
 *      operator-facing surface.
 *
 * Pure mock-free test — exercises the real benchmarking + dashboard modules.
 */
import {
  buildTrustOperationalBenchmark,
  reproduceLineageDigest,
} from '../../audit/benchmarking/trustOperationalBenchmark';
import { buildTrustLayerPerformanceDashboard } from '../../audit/benchmarking/trustLayerPerformanceDashboard';
import { runBenchmarkChaosSimulation } from '../../audit/benchmarking/benchmarkChaosSimulation';
import { reduceOperationalFrictionMetrics } from '../../audit/benchmarking/operationalFrictionMetrics';
import { makeBundle, makeMutationSamples } from '../../audit/benchmarking/_testFixtures';

describe('trust-layer operational benchmarking scale (W2-PR70A scale gate)', () => {
  it('benchmarks 1 000 capsules across 10 bundles in under 8 s with reproducible lineage', () => {
    const N = 1_000;
    const PER_BUNDLE = 100;
    const bundles = [];
    const replayLatencies: Record<string, number> = {};
    for (let b = 0; b < N / PER_BUNDLE; b++) {
      const ids = Array.from({ length: PER_BUNDLE }, (_, i) => `bundle-${b}-cap-${i}`);
      bundles.push(makeBundle({ bundleId: `bundle-${b}`, capsuleIds: ids }));
      for (const id of ids) replayLatencies[id] = 50 + (Math.abs(id.length * 7) % 50);
    }

    const start = process.hrtime.bigint();
    const benchmark = buildTrustOperationalBenchmark({
      benchmarkId: 'bench-scale-1k',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: { auditBundles: bundles, replayLatencies },
    });
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

    const reproduced = reproduceLineageDigest(benchmark);
    expect(reproduced).toBe(benchmark.lineageDigest);
    expect(benchmark.overallVerdict).toBe('BENCHMARK_OBSERVED');
    expect(benchmark.vitalcvProfile.replayCount).toBe(N);
    expect(elapsedMs).toBeLessThan(8_000);

    // eslint-disable-next-line no-console
    console.log(
      `[benchmark-board] trust-operational-benchmark-pct=100.00 ` +
        `n=${N} elapsed_ms=${elapsedMs.toFixed(0)} comparisons=${benchmark.comparisons.length} ` +
        `lineage_digest=${benchmark.lineageDigest.slice(0, 16)}…`,
    );
  });

  it('preserves ambiguity across a 500-capsule mixed-verdict slice (no silent merge)', () => {
    const bundle = makeBundle({
      bundleId: 'bundle-mixed',
      capsuleIds: Array.from({ length: 500 }, (_, i) => `mix-${i}`),
      cleanCount: 250,
      quarantinedCount: 100,
      ambiguousCount: 100,
      contaminatedCount: 50,
      partialSurvivabilityPct: 100,
    });
    const benchmark = buildTrustOperationalBenchmark({
      benchmarkId: 'bench-mixed',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: {
        auditBundles: [bundle],
        replayLatencies: Object.fromEntries(bundle.replays.map(r => [r.capsuleId, 80])),
      },
    });
    expect(benchmark.vitalcvProfile.ambiguousCount).toBe(100);
    expect(benchmark.vitalcvProfile.quarantinedCount).toBe(100);
    expect(benchmark.vitalcvProfile.contaminatedCount).toBe(50);
    expect(benchmark.vitalcvProfile.ambiguityPreservationPct).toBe(100);

    // eslint-disable-next-line no-console
    console.log(
      `[benchmark-board] ambiguity-preservation-pct=100.00 ` +
        `ambiguous=${benchmark.vitalcvProfile.ambiguousCount} ` +
        `quarantined=${benchmark.vitalcvProfile.quarantinedCount} ` +
        `contaminated=${benchmark.vitalcvProfile.contaminatedCount}`,
    );
  });

  it('fails closed at scale — a single CONTAINMENT_BREACH in a 1 000-capsule slice forces BREACH', () => {
    const cleanBundle = makeBundle({
      bundleId: 'bundle-clean',
      capsuleIds: Array.from({ length: 999 }, (_, i) => `clean-${i}`),
    });
    const breachBundle = makeBundle({
      bundleId: 'bundle-breach',
      capsuleIds: ['breach-cap-1'],
      cleanCount: 0,
      breachCount: 1,
      partitioned: false,
    });
    const benchmark = buildTrustOperationalBenchmark({
      benchmarkId: 'bench-fail-closed',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: {
        auditBundles: [cleanBundle, breachBundle],
        replayLatencies: { 'breach-cap-1': 5 },
      },
    });
    expect(benchmark.overallVerdict).toBe('BENCHMARK_BREACH');
    expect(benchmark.vitalcvProfile.breachCount).toBe(1);

    // eslint-disable-next-line no-console
    console.log(
      `[benchmark-board] fail-closed-at-scale=true ` +
        `breach_count=${benchmark.vitalcvProfile.breachCount} ` +
        `replay_count=${benchmark.vitalcvProfile.replayCount}`,
    );
  });

  it('dashboard digest is deterministic across repeated builds (no race drift)', () => {
    const bundle = makeBundle({ capsuleIds: Array.from({ length: 200 }, (_, i) => `det-${i}`) });
    const inputs = {
      auditBundles: [bundle],
      replayLatencies: Object.fromEntries(bundle.replays.map(r => [r.capsuleId, 50])),
    };
    const benchmark = buildTrustOperationalBenchmark({
      benchmarkId: 'bench-dash',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs,
    });

    const N_BUILDS = 50;
    const digests = new Set<string>();
    for (let i = 0; i < N_BUILDS; i++) {
      const dash = buildTrustLayerPerformanceDashboard({ benchmark });
      digests.add(dash.dashboardDigest);
    }
    expect(digests.size).toBe(1);

    // eslint-disable-next-line no-console
    console.log(
      `[benchmark-board] dashboard-determinism-pct=100.00 ` +
        `n_builds=${N_BUILDS} unique_digests=${digests.size}`,
    );
  });

  it('chaos sweep — every chaos mode meets its expectation under a 200-capsule slice', () => {
    const bundle = makeBundle({ capsuleIds: Array.from({ length: 200 }, (_, i) => `chaos-${i}`) });
    const replayLatencies = Object.fromEntries(bundle.replays.map(r => [r.capsuleId, 50]));
    const inputs = { auditBundles: [bundle], replayLatencies };

    const modes = [
      'INJECT_CONTAINMENT_BREACH',
      'EMPTY_REPLAY_SLICE',
      'STRIP_LATENCIES',
      'AMBIGUITY_FLOOD',
      'BASELINE_NULL_METRICS',
      'NO_CHAOS',
    ] as const;

    const failures: string[] = [];
    for (const mode of modes) {
      const result = runBenchmarkChaosSimulation({
        benchmarkId: `chaos-${mode}`,
        generatedAt: '2026-05-09T00:00:00.000Z',
        mode,
        inputs,
      });
      if (!result.expectationMet) failures.push(`${mode}=${result.observedVerdict}`);
    }
    expect(failures).toEqual([]);

    // eslint-disable-next-line no-console
    console.log(
      `[benchmark-board] chaos-expectation-met-pct=100.00 ` +
        `modes=${modes.length} failures=${failures.length}`,
    );
  });

  it('operational-friction reduces 5 000 mutation samples without ambiguity loss', () => {
    const N = 5_000;
    const samples = makeMutationSamples({ count: N, denialRate: 0.25 });
    const start = process.hrtime.bigint();
    const metrics = reduceOperationalFrictionMetrics(samples);
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

    expect(metrics.silentReclassificationCount).toBe(0);
    expect(metrics.duplicateFingerprintCount).toBe(0);
    expect(metrics.ambiguityPreservationPct).toBe(100);
    expect(metrics.sampleCount).toBe(N);
    expect(elapsedMs).toBeLessThan(2_000);

    // eslint-disable-next-line no-console
    console.log(
      `[benchmark-board] friction-ambiguity-preservation-pct=${metrics.ambiguityPreservationPct.toFixed(2)} ` +
        `n=${N} elapsed_ms=${elapsedMs.toFixed(0)} ` +
        `friction_units=${metrics.frictionUnits.toFixed(2)}`,
    );
  });
});
