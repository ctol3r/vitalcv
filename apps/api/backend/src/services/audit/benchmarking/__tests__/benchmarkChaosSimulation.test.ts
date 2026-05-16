/**
 * W2-PR70A — Benchmark Chaos Simulation tests.
 *
 * Each chaos mode has a deterministic expectation; the simulator surfaces
 * an `expectationMet` bit so a regression in the benchmark flips this test
 * red without contaminating the original benchmark module.
 */
import {
  KNOWN_BENCHMARK_CHAOS_MODES,
  runBenchmarkChaosSimulation,
} from '../benchmarkChaosSimulation';
import { makeBundle } from '../_testFixtures';

describe('benchmarkChaosSimulation', () => {
  const cleanInputs = () => ({
    auditBundles: [makeBundle({ capsuleIds: ['c1', 'c2', 'c3'] })],
    replayLatencies: { c1: 50, c2: 60, c3: 70 },
  });

  it('INJECT_CONTAINMENT_BREACH expects BENCHMARK_BREACH', () => {
    const result = runBenchmarkChaosSimulation({
      benchmarkId: 'chaos-1',
      generatedAt: '2026-05-09T00:00:00.000Z',
      mode: 'INJECT_CONTAINMENT_BREACH',
      inputs: cleanInputs(),
    });
    expect(result.observedVerdict).toBe('BENCHMARK_BREACH');
    expect(result.expectationMet).toBe(true);
  });

  it('EMPTY_REPLAY_SLICE expects BENCHMARK_AMBIGUOUS', () => {
    const result = runBenchmarkChaosSimulation({
      benchmarkId: 'chaos-2',
      generatedAt: '2026-05-09T00:00:00.000Z',
      mode: 'EMPTY_REPLAY_SLICE',
      inputs: cleanInputs(),
    });
    expect(result.observedVerdict).toBe('BENCHMARK_AMBIGUOUS');
    expect(result.expectationMet).toBe(true);
    expect(result.observedAmbiguous).toBe(true);
  });

  it('STRIP_LATENCIES still produces a verdict (soft expectation)', () => {
    const result = runBenchmarkChaosSimulation({
      benchmarkId: 'chaos-3',
      generatedAt: '2026-05-09T00:00:00.000Z',
      mode: 'STRIP_LATENCIES',
      inputs: cleanInputs(),
    });
    // Verdict could be OBSERVED, AMBIGUOUS, or PARITY depending on slice. All are accepted.
    expect(['BENCHMARK_OBSERVED', 'BENCHMARK_AMBIGUOUS', 'BENCHMARK_PARITY']).toContain(result.observedVerdict);
    expect(result.expectationMet).toBe(true);
  });

  it('AMBIGUITY_FLOOD preserves all ambiguity through the survivability axis', () => {
    const result = runBenchmarkChaosSimulation({
      benchmarkId: 'chaos-4',
      generatedAt: '2026-05-09T00:00:00.000Z',
      mode: 'AMBIGUITY_FLOOD',
      inputs: cleanInputs(),
    });
    // Ambiguity flooding still produces an operator-actionable surface.
    expect(['BENCHMARK_OBSERVED', 'BENCHMARK_AMBIGUOUS', 'BENCHMARK_PARITY']).toContain(result.observedVerdict);
    expect(result.expectationMet).toBe(true);
  });

  it('BASELINE_NULL_METRICS expects BENCHMARK_AMBIGUOUS', () => {
    const result = runBenchmarkChaosSimulation({
      benchmarkId: 'chaos-5',
      generatedAt: '2026-05-09T00:00:00.000Z',
      mode: 'BASELINE_NULL_METRICS',
      inputs: cleanInputs(),
    });
    expect(result.observedVerdict).toBe('BENCHMARK_AMBIGUOUS');
    expect(result.expectationMet).toBe(true);
  });

  it('NO_CHAOS produces a non-BREACH verdict on clean inputs', () => {
    const result = runBenchmarkChaosSimulation({
      benchmarkId: 'chaos-6',
      generatedAt: '2026-05-09T00:00:00.000Z',
      mode: 'NO_CHAOS',
      inputs: cleanInputs(),
    });
    expect(result.observedVerdict).not.toBe('BENCHMARK_BREACH');
    expect(result.expectationMet).toBe(true);
  });

  it('produces deterministic scenario digests for repeated runs', () => {
    const inputs = cleanInputs();
    const a = runBenchmarkChaosSimulation({
      benchmarkId: 'chaos-7',
      generatedAt: '2026-05-09T00:00:00.000Z',
      mode: 'NO_CHAOS',
      inputs,
    });
    const b = runBenchmarkChaosSimulation({
      benchmarkId: 'chaos-7',
      generatedAt: '2026-05-09T00:00:00.000Z',
      mode: 'NO_CHAOS',
      inputs,
    });
    expect(a.scenario.scenarioDigest).toBe(b.scenario.scenarioDigest);
  });

  it('exposes frozen chaos-mode sentinels covering all six modes', () => {
    expect(KNOWN_BENCHMARK_CHAOS_MODES).toEqual([
      'INJECT_CONTAINMENT_BREACH',
      'EMPTY_REPLAY_SLICE',
      'STRIP_LATENCIES',
      'AMBIGUITY_FLOOD',
      'BASELINE_NULL_METRICS',
      'NO_CHAOS',
    ]);
    expect(Object.isFrozen(KNOWN_BENCHMARK_CHAOS_MODES)).toBe(true);
  });
});
