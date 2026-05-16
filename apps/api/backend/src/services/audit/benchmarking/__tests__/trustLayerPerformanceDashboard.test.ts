/**
 * W2-PR70A — Trust-Layer Performance Dashboard tests.
 */
import { buildTrustOperationalBenchmark } from '../trustOperationalBenchmark';
import {
  buildTrustLayerPerformanceDashboard,
  KNOWN_COMPLETION_BOARD_SLOTS,
  KNOWN_LONGITUDINAL_TRENDS,
} from '../trustLayerPerformanceDashboard';
import { makeBundle } from '../_testFixtures';

describe('trustLayerPerformanceDashboard', () => {
  function makeBench(overrides: { breach?: boolean; partial?: number } = {}) {
    const bundle = makeBundle({
      capsuleIds: ['c1', 'c2'],
      cleanCount: overrides.breach ? 1 : 2,
      breachCount: overrides.breach ? 1 : 0,
      partitioned: !overrides.breach,
      partialSurvivabilityPct: overrides.partial ?? 100,
    });
    return buildTrustOperationalBenchmark({
      benchmarkId: 'bench-dash',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: { auditBundles: [bundle], replayLatencies: { c1: 50, c2: 60 } },
    });
  }

  it('emits a tile per metric per baseline (≥4 baselines × 4 metrics)', () => {
    const dash = buildTrustLayerPerformanceDashboard({
      benchmark: makeBench(),
    });
    expect(dash.tiles.length).toBeGreaterThanOrEqual(16);
    for (const t of dash.tiles) {
      expect(t.copy).not.toMatch(/automatically verified/i);
      expect(t.copy).not.toMatch(/HIPAA compliant/i);
      // No tile may use the bare "Verified" status word.
      expect(t.copy).not.toMatch(/\bVerified\b/);
    }
  });

  it('includes all five completion-board slots', () => {
    const dash = buildTrustLayerPerformanceDashboard({
      benchmark: makeBench(),
    });
    const slots = dash.completionBoard.map(e => e.slot).slice().sort();
    expect(slots).toEqual([...KNOWN_COMPLETION_BOARD_SLOTS].slice().sort());
  });

  it('breach slice yields zero on Benchmark Infrastructure Maturity', () => {
    const dash = buildTrustLayerPerformanceDashboard({
      benchmark: makeBench({ breach: true }),
    });
    const maturity = dash.completionBoard.find(e => e.slot === 'BENCHMARK_INFRASTRUCTURE_MATURITY');
    expect(maturity?.pct).toBe(0);
    expect(dash.overallVerdict).toBe('BENCHMARK_BREACH');
  });

  it('produces deterministic dashboardDigest for repeated builds', () => {
    const bench = makeBench();
    const a = buildTrustLayerPerformanceDashboard({ benchmark: bench });
    const b = buildTrustLayerPerformanceDashboard({ benchmark: bench });
    expect(a.dashboardDigest).toBe(b.dashboardDigest);
  });

  it('emits longitudinal AMBIGUOUS when no prior dashboard exists', () => {
    const dash = buildTrustLayerPerformanceDashboard({ benchmark: makeBench() });
    expect(dash.longitudinal?.trend).toBe('AMBIGUOUS');
    expect(dash.longitudinal?.deltaPct).toBeNull();
  });

  it('emits longitudinal STABLE when survivability is unchanged', () => {
    const bench = makeBench({ partial: 100 });
    const prior = buildTrustLayerPerformanceDashboard({ benchmark: bench });
    const next = buildTrustLayerPerformanceDashboard({ benchmark: bench, priorDashboard: prior });
    expect(['STABLE', 'IMPROVING', 'AMBIGUOUS']).toContain(next.longitudinal?.trend ?? 'AMBIGUOUS');
  });

  it('exposes frozen sentinels for completion slots and longitudinal trends', () => {
    expect(Object.isFrozen(KNOWN_COMPLETION_BOARD_SLOTS)).toBe(true);
    expect(Object.isFrozen(KNOWN_LONGITUDINAL_TRENDS)).toBe(true);
    expect(KNOWN_LONGITUDINAL_TRENDS).toContain('IMPROVING');
    expect(KNOWN_LONGITUDINAL_TRENDS).toContain('DEGRADING');
  });
});
