/**
 * W2-PR70A — Audit Survivability Comparison tests.
 */
import {
  buildAuditSurvivabilityComparison,
  KNOWN_SURVIVABILITY_VERDICTS,
} from '../auditSurvivabilityComparison';
import { STANDARD_BENCHMARK_BASELINES } from '../trustOperationalBenchmark';
import { makeBundle } from '../_testFixtures';

describe('auditSurvivabilityComparison', () => {
  it('marks bundle SURVIVAL_OBSERVED when VitalCV survivability exceeds baseline', () => {
    const bundle = makeBundle({
      capsuleIds: ['c1', 'c2', 'c3'],
      cleanCount: 3,
      partialSurvivabilityPct: 100,
    });
    const cmp = buildAuditSurvivabilityComparison({
      auditBundles: [bundle],
      baseline: STANDARD_BENCHMARK_BASELINES.LEGACY_CREDENTIALING,
    });
    expect(cmp.verdict).toBe('BENCHMARK_OBSERVED');
    expect(cmp.weightedSurvivabilityPct).toBe(100);
    expect(cmp.surplusPct).toBeGreaterThan(0);
    expect(cmp.bundleMetrics[0].verdict).toBe('SURVIVAL_OBSERVED');
  });

  it('preserves SURVIVAL_AMBIGUOUS when boundary is not partitioned', () => {
    const bundle = makeBundle({
      capsuleIds: ['c1', 'c2'],
      cleanCount: 1,
      contaminatedCount: 1,
      partialSurvivabilityPct: 50,
      partitioned: false,
    });
    const cmp = buildAuditSurvivabilityComparison({
      auditBundles: [bundle],
      baseline: STANDARD_BENCHMARK_BASELINES.LEGACY_CREDENTIALING,
    });
    expect(cmp.bundleMetrics[0].verdict).toBe('SURVIVAL_AMBIGUOUS');
    expect(cmp.unpartitionedCount).toBe(1);
    expect(cmp.verdict).toBe('BENCHMARK_AMBIGUOUS');
  });

  it('counts contaminated records as operator-actionable survivors', () => {
    const bundle = makeBundle({
      capsuleIds: ['c1', 'c2'],
      cleanCount: 1,
      contaminatedCount: 1,
      partialSurvivabilityPct: 100,
    });
    const cmp = buildAuditSurvivabilityComparison({
      auditBundles: [bundle],
      baseline: STANDARD_BENCHMARK_BASELINES.LEGACY_CREDENTIALING,
    });
    // contaminated still surface as records, so they count toward survival.
    expect(cmp.weightedSurvivabilityPct).toBe(100);
  });

  it('fails closed to BENCHMARK_BREACH on a CONTAINMENT_BREACH bundle', () => {
    const bundle = makeBundle({
      capsuleIds: ['c1'],
      cleanCount: 0,
      breachCount: 1,
      partitioned: false,
    });
    const cmp = buildAuditSurvivabilityComparison({
      auditBundles: [bundle],
      baseline: STANDARD_BENCHMARK_BASELINES.LEGACY_CREDENTIALING,
    });
    expect(cmp.verdict).toBe('BENCHMARK_BREACH');
    expect(cmp.bundleMetrics[0].verdict).toBe('SURVIVAL_BREACH');
  });

  it('emits PARITY when survivability is within tolerance', () => {
    const customBaseline = {
      ...STANDARD_BENCHMARK_BASELINES.VERIFIER_REVIEW_ONLY,
      metrics: {
        ...STANDARD_BENCHMARK_BASELINES.VERIFIER_REVIEW_ONLY.metrics,
        auditSurvivabilityPct: 97,
      },
    };
    const bundle = makeBundle({ capsuleIds: ['c1'], cleanCount: 1, partialSurvivabilityPct: 100 });
    const cmp = buildAuditSurvivabilityComparison({
      auditBundles: [bundle],
      baseline: customBaseline,
    });
    expect(cmp.bundleMetrics[0].verdict).toBe('SURVIVAL_PARITY');
  });

  it('handles empty slice as BENCHMARK_AMBIGUOUS', () => {
    const cmp = buildAuditSurvivabilityComparison({
      auditBundles: [],
      baseline: STANDARD_BENCHMARK_BASELINES.LEGACY_CREDENTIALING,
    });
    expect(cmp.verdict).toBe('BENCHMARK_AMBIGUOUS');
    expect(cmp.bundleCount).toBe(0);
  });

  it('exposes frozen verdict sentinels', () => {
    expect(KNOWN_SURVIVABILITY_VERDICTS).toContain('SURVIVAL_OBSERVED');
    expect(KNOWN_SURVIVABILITY_VERDICTS).toContain('SURVIVAL_BREACH');
    expect(Object.isFrozen(KNOWN_SURVIVABILITY_VERDICTS)).toBe(true);
  });
});
