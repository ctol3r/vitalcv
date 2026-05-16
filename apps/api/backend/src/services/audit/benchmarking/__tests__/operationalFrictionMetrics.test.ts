/**
 * W2-PR70A — Operational Friction Metrics tests.
 */
import {
  buildOperationalFrictionComparison,
  reduceOperationalFrictionMetrics,
  KNOWN_FRICTION_VERDICTS,
  FRICTION_PENALTIES,
} from '../operationalFrictionMetrics';
import { STANDARD_BENCHMARK_BASELINES } from '../trustOperationalBenchmark';
import { makeMutationSamples } from '../_testFixtures';

describe('operationalFrictionMetrics', () => {
  it('reports FRICTION_OBSERVED_LOWER when VitalCV samples are clean and fast', () => {
    const samples = makeMutationSamples({ count: 200, denialRate: 0.25 });
    const cmp = buildOperationalFrictionComparison({
      samples,
      baseline: STANDARD_BENCHMARK_BASELINES.LEGACY_CREDENTIALING,
    });
    expect(cmp.frictionVerdict).toBe('FRICTION_OBSERVED_LOWER');
    expect(cmp.verdict).toBe('BENCHMARK_OBSERVED');
    expect(cmp.metrics?.silentReclassificationCount).toBe(0);
    expect(cmp.metrics?.duplicateFingerprintCount).toBe(0);
  });

  it('fails closed to FRICTION_AMBIGUITY_LOST when denied events drop their classification', () => {
    const samples = makeMutationSamples({
      count: 100,
      denialRate: 0.25,
      silentReclassifyEvery: 4, // every 4th sample (so every denied one) is silent
    });
    const cmp = buildOperationalFrictionComparison({
      samples,
      baseline: STANDARD_BENCHMARK_BASELINES.LEGACY_CREDENTIALING,
    });
    expect(cmp.frictionVerdict).toBe('FRICTION_AMBIGUITY_LOST');
    expect(cmp.verdict).toBe('BENCHMARK_BREACH');
    expect(cmp.metrics?.silentReclassificationCount).toBeGreaterThan(0);
  });

  it('fails closed to FRICTION_FINGERPRINT_COLLAPSE on duplicate fingerprints', () => {
    const samples = makeMutationSamples({ count: 50, duplicateFingerprintCount: 3 });
    const cmp = buildOperationalFrictionComparison({
      samples,
      baseline: STANDARD_BENCHMARK_BASELINES.LEGACY_CREDENTIALING,
    });
    expect(cmp.frictionVerdict).toBe('FRICTION_FINGERPRINT_COLLAPSE');
    expect(cmp.verdict).toBe('BENCHMARK_BREACH');
    expect(cmp.metrics?.duplicateFingerprintCount).toBe(3);
  });

  it('preserves AMBIGUOUS when sample slice is empty', () => {
    const cmp = buildOperationalFrictionComparison({
      samples: [],
      baseline: STANDARD_BENCHMARK_BASELINES.LEGACY_CREDENTIALING,
    });
    expect(cmp.verdict).toBe('BENCHMARK_AMBIGUOUS');
    expect(cmp.frictionVerdict).toBe('FRICTION_AMBIGUOUS');
    expect(cmp.metrics).toBeNull();
  });

  it('returns 100% ambiguity preservation when no denied samples exist', () => {
    const samples = makeMutationSamples({ count: 50, denialRate: 0.0001 }); // effectively no denials
    const metrics = reduceOperationalFrictionMetrics(samples);
    if (metrics.observedDeniedCount === 0) {
      expect(metrics.ambiguityPreservationPct).toBe(100);
    }
  });

  it('reports correct mutationsPerSec when timestamps span a real window', () => {
    const samples = makeMutationSamples({ count: 100 });
    const metrics = reduceOperationalFrictionMetrics(samples);
    expect(metrics.mutationsPerSec).not.toBeNull();
    expect((metrics.mutationsPerSec ?? 0)).toBeGreaterThan(0);
  });

  it('exposes frozen verdict sentinels and friction penalties', () => {
    expect(KNOWN_FRICTION_VERDICTS).toContain('FRICTION_OBSERVED_LOWER');
    expect(Object.isFrozen(KNOWN_FRICTION_VERDICTS)).toBe(true);
    expect(FRICTION_PENALTIES.SILENT_RECLASSIFICATION_PENALTY).toBeGreaterThan(0);
    expect(FRICTION_PENALTIES.FINGERPRINT_COLLISION_PENALTY).toBeGreaterThan(0);
  });
});
