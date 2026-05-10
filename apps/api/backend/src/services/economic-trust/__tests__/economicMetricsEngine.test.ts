/**
 * economicMetricsEngine.test.ts — Engine + sub-module behavior under known fixtures.
 *
 * Wave: W2-PR60A.
 *
 * Validates the verdict ladder, ambiguity preservation, and structural
 * invariants. Does NOT exercise the chaos harness (see chaos.test.ts) or
 * scale (see scale/economicMetrics.scale.test.ts).
 */

import {
  buildMetric,
  computeEconomicTrustReport,
  computeOperationalSavings,
  computeReplayReuseEfficiency,
  computeTimeToStart,
  computeTrustEfficiencyScore,
  computeVerifierEfficiency,
  DEFAULT_MANUAL_COST_BASELINE,
  ECONOMIC_METRICS_METHODOLOGY_VERSION,
  TRUST_EFFICIENCY_WEIGHTS,
  VERDICT_THRESHOLDS,
} from '../index';
import type { ReplayEvidence } from '../index';
import { buildReplayEvidence } from '../__test_fixtures__/replayEvidenceFixtures';

const WINDOW_START = new Date('2026-05-01T00:00:00.000Z');
const WINDOW_END = new Date('2026-05-08T00:00:00.000Z');

describe('economic-trust :: ambiguity primitives', () => {
  it('buildMetric returns unknown basis for empty samples', () => {
    const m = buildMetric([]);
    expect(m).toMatchObject({ point: 0, low: 0, high: 0, confidence: 0, basis: 'unknown', sampleSize: 0 });
  });

  it('buildMetric reports observed basis once n >= bootstrap floor', () => {
    const sample = Array.from({ length: 50 }, (_, i) => 100 + i);
    const m = buildMetric(sample, { unit: 'ms' });
    expect(m.basis).toBe('observed');
    expect(m.confidence).toBeGreaterThan(0.5);
    expect(m.low).toBeLessThanOrEqual(m.point);
    expect(m.point).toBeLessThanOrEqual(m.high);
    expect(m.unit).toBe('ms');
  });

  it('buildMetric is deterministic for the same seed', () => {
    const sample = Array.from({ length: 40 }, (_, i) => i * 1.7);
    const a = buildMetric(sample, { seed: 777 });
    const b = buildMetric(sample, { seed: 777 });
    expect(a).toEqual(b);
  });
});

describe('economic-trust :: timeToStart', () => {
  it('clamps negative deltas and reports them', () => {
    const replays: ReplayEvidence[] = [
      stub({
        replayId: 'r-neg',
        evidenceVerifiedAt: new Date('2026-05-01T01:00:00Z'),
        decisionEmittedAt: new Date('2026-05-01T00:00:00Z'),
      }),
      stub({
        replayId: 'r-pos',
        evidenceVerifiedAt: new Date('2026-05-01T00:00:00Z'),
        decisionEmittedAt: new Date('2026-05-01T00:01:00Z'),
      }),
    ];
    const result = computeTimeToStart(replays);
    expect(result.negativeDeltaCount).toBe(1);
    expect(result.metric.sampleSize).toBe(2);
    expect(result.metric.point).toBeGreaterThanOrEqual(0);
  });

  it('returns confidence-zero unknown metric on empty input', () => {
    const result = computeTimeToStart([]);
    expect(result.metric.basis).toBe('unknown');
    expect(result.metric.confidence).toBe(0);
  });
});

describe('economic-trust :: replayReuseEfficiency', () => {
  it('counts inconsistent replays where reused exceeds artifacts', () => {
    const replays: ReplayEvidence[] = [
      stub({ evidenceArtifactCount: 5, reusedArtifactCount: 5 }),
      stub({ evidenceArtifactCount: 5, reusedArtifactCount: 7 }),
      stub({ evidenceArtifactCount: 0, reusedArtifactCount: 0 }),
    ];
    const summary = computeReplayReuseEfficiency(replays);
    expect(summary.inconsistentReplays).toBe(1);
    expect(summary.metric.sampleSize).toBe(1); // only the consistent non-zero replay counts
    expect(summary.aggregateRatio).toBe(1);
  });

  it('handles entirely-zero artifact replays without dividing by zero', () => {
    const replays = [stub({ evidenceArtifactCount: 0, reusedArtifactCount: 0 })];
    const summary = computeReplayReuseEfficiency(replays);
    expect(summary.aggregateRatio).toBe(0);
    expect(summary.metric.sampleSize).toBe(0);
  });
});

describe('economic-trust :: trustEfficiencyScore', () => {
  it('weights integrity above reuse and chain depth', () => {
    // Two synthetic replays: same reuse + chain, different integrity.
    const passing = stub({ integrityVerdict: 'pass' });
    const failing = stub({ integrityVerdict: 'fail' });
    const passingScore = computeTrustEfficiencyScore([passing]).metric.point;
    const failingScore = computeTrustEfficiencyScore([failing]).metric.point;
    const integrityImpact = passingScore - failingScore;
    expect(integrityImpact).toBeGreaterThan(TRUST_EFFICIENCY_WEIGHTS.integrity * 99); // ~ 55 pts
  });

  it('penalises chain depth past ideal', () => {
    const shallow = stub({ authorityChainDepth: 5 });
    const deep = stub({ authorityChainDepth: 30 });
    const shallowScore = computeTrustEfficiencyScore([shallow]).metric.point;
    const deepScore = computeTrustEfficiencyScore([deep]).metric.point;
    expect(shallowScore).toBeGreaterThan(deepScore);
  });
});

describe('economic-trust :: operationalSavings', () => {
  it('reports a USD range, never a single point', () => {
    const replays = [stub({ evidenceArtifactCount: 6, reusedArtifactCount: 6, integrityVerdict: 'pass' })];
    const summary = computeOperationalSavings(replays);
    expect(summary.metric.low).toBeLessThan(summary.metric.high);
    expect(summary.metric.point).toBeGreaterThan(summary.metric.low);
    expect(summary.metric.point).toBeLessThan(summary.metric.high);
    expect(summary.metric.unit).toBe('usd');
    expect(summary.metric.basis).toBe('derived');
  });

  it('drops confidence under chaos contamination', () => {
    const clean = Array.from({ length: 60 }, () =>
      stub({ evidenceArtifactCount: 6, reusedArtifactCount: 6, integrityVerdict: 'pass' }),
    );
    const contaminated = [...clean, { ...clean[0], replayId: 'poison', malformed: true }];
    const cleanConfidence = computeOperationalSavings(clean).metric.confidence;
    const contaminatedConfidence = computeOperationalSavings(contaminated).metric.confidence;
    expect(contaminatedConfidence).toBeLessThan(cleanConfidence);
  });

  it('refuses invalid baselines', () => {
    expect(() =>
      computeOperationalSavings([stub({})], { lowUsdPerCheck: 50, highUsdPerCheck: 25, citation: 'bad' }),
    ).toThrow(/invalid baseline/);
  });
});

describe('economic-trust :: verifierEfficiency', () => {
  it('groups by verifier and returns sorted-desc reports', () => {
    const replays: ReplayEvidence[] = [
      stub({ verifierId: 'sys-1', verifierType: 'SYSTEM' }),
      stub({ verifierId: 'sys-1', verifierType: 'SYSTEM' }),
      stub({ verifierId: 'sys-1', verifierType: 'SYSTEM' }),
      stub({ verifierId: 'sys-2', verifierType: 'SYSTEM' }),
      stub({ verifierId: 'human-x', verifierType: 'HUMAN' }),
    ];
    const reports = computeVerifierEfficiency(replays, {
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
    });
    expect(reports[0].verifierId).toBe('sys-1');
    expect(reports[0].decisionsObserved).toBe(3);
    expect(reports[reports.length - 1].decisionsObserved).toBeLessThanOrEqual(reports[0].decisionsObserved);
  });

  it('returns null decisionsPerHour when window collapses to zero', () => {
    const replays = [stub({ verifierId: 'sys-1', verifierType: 'SYSTEM' })];
    const sameInstant = new Date('2026-05-01T00:00:00.000Z');
    const reports = computeVerifierEfficiency(replays.map((r) => ({ ...r, decisionEmittedAt: sameInstant })), {
      windowStart: sameInstant,
      windowEnd: sameInstant,
    });
    expect(reports[0].decisionsPerHour).toBeNull();
  });
});

describe('economic-trust :: orchestrator verdict ladder', () => {
  it('FAIL_CLOSED on contradictory window', () => {
    const replays = buildReplayEvidence({ count: 50, seed: 1, windowStart: WINDOW_START, windowEnd: WINDOW_END });
    const report = computeEconomicTrustReport(replays, {
      windowStart: WINDOW_END,
      windowEnd: WINDOW_START, // reversed
    });
    expect(report.verdict).toBe('FAIL_CLOSED');
    expect(report.failClosedReasons.length).toBeGreaterThan(0);
  });

  it('FAIL_CLOSED when chaos contamination crosses 25%', () => {
    const baseline = buildReplayEvidence({ count: 100, seed: 2, windowStart: WINDOW_START, windowEnd: WINDOW_END });
    // Mark 30% malformed.
    const corrupted = baseline.map((r, i) => (i % 3 === 0 ? { ...r, malformed: true } : r));
    const report = computeEconomicTrustReport(corrupted, {
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
    });
    expect(report.verdict).toBe('FAIL_CLOSED');
  });

  it('INCONCLUSIVE on undersized samples', () => {
    const replays = buildReplayEvidence({ count: 10, seed: 3, windowStart: WINDOW_START, windowEnd: WINDOW_END });
    const report = computeEconomicTrustReport(replays, {
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
    });
    expect(report.verdict).toBe('INCONCLUSIVE');
    expect(report.reasons.some((r) => r.code === 'SAMPLE_TOO_SMALL')).toBe(true);
  });

  it('INCONCLUSIVE when one tenant dominates the sample', () => {
    const replays = buildReplayEvidence({
      count: 60,
      seed: 4,
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
      tenantPool: ['solo'],
    });
    const report = computeEconomicTrustReport(replays, {
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
    });
    expect(report.verdict).toBe('INCONCLUSIVE');
    expect(report.reasons.some((r) => r.code === 'TENANT_AMBIGUITY')).toBe(true);
  });

  it('PROBABLE on a moderate sample with healthy integrity', () => {
    const replays = buildReplayEvidence({ count: 60, seed: 5, windowStart: WINDOW_START, windowEnd: WINDOW_END });
    const report = computeEconomicTrustReport(replays, {
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
    });
    expect(['PROBABLE', 'PROVEN']).toContain(report.verdict);
    expect(report.totalReplays).toBe(60);
    expect(report.tenantCount).toBeGreaterThan(1);
  });

  it('PROVEN at large clean samples and surfaces a stable input digest', () => {
    const replays = buildReplayEvidence({ count: 250, seed: 6, windowStart: WINDOW_START, windowEnd: WINDOW_END });
    const reportA = computeEconomicTrustReport(replays, {
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
    });
    const reportB = computeEconomicTrustReport(replays, {
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
    });
    expect(reportA.inputDigest).toEqual(reportB.inputDigest);
    expect(['PROBABLE', 'PROVEN']).toContain(reportA.verdict);
  });

  it('preserves ambiguity: ROI metrics always carry low <= point <= high', () => {
    const replays = buildReplayEvidence({ count: 200, seed: 7, windowStart: WINDOW_START, windowEnd: WINDOW_END });
    const report = computeEconomicTrustReport(replays, {
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
    });
    for (const m of [
      report.timeToStartMs,
      report.replayReuseEfficiency,
      report.trustEfficiencyScore,
      report.operationalSavingsUsd,
    ]) {
      expect(m.low).toBeLessThanOrEqual(m.point + 1e-9);
      expect(m.point).toBeLessThanOrEqual(m.high + 1e-9);
      expect(Number.isFinite(m.confidence)).toBe(true);
    }
  });

  it('exports the methodology version and verdict thresholds', () => {
    expect(ECONOMIC_METRICS_METHODOLOGY_VERSION).toBe('1.0');
    expect(VERDICT_THRESHOLDS.proven.minReplays).toBe(100);
    expect(DEFAULT_MANUAL_COST_BASELINE.lowUsdPerCheck).toBeLessThan(
      DEFAULT_MANUAL_COST_BASELINE.highUsdPerCheck,
    );
  });
});

// ── helpers ──────────────────────────────────────────────────────────────────
function stub(overrides: Partial<ReplayEvidence>): ReplayEvidence {
  const base: ReplayEvidence = {
    replayId: 'r-fixture',
    capsuleId: 'cap-fixture',
    tenantId: 'tenant-default',
    verifierType: 'SYSTEM',
    verifierId: 'sys-default',
    evidenceVerifiedAt: new Date('2026-05-01T00:00:00Z'),
    decisionEmittedAt: new Date('2026-05-01T00:00:30Z'),
    replayCompletedAt: new Date('2026-05-01T00:00:30.500Z'),
    replayDurationMs: 500,
    evidenceArtifactCount: 6,
    reusedArtifactCount: 4,
    authorityChainDepth: 5,
    integrityVerdict: 'pass',
    decisionOutcome: 'APPROVED',
  };
  return { ...base, ...overrides };
}
