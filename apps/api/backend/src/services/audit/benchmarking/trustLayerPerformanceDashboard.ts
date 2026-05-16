/**
 * trustLayerPerformanceDashboard.ts — W2-PR70A
 *
 * Trust-layer performance dashboard. Pure transform that consumes a built
 * `TrustOperationalBenchmark` and projects it to a deterministic, copy-safe
 * dashboard payload suitable for /status surfacing or operator overlays.
 *
 * Hard invariants:
 *   - the dashboard is a PROJECTION of the benchmark — every value is
 *     derivable from the benchmark inputs. No external lookups, no hidden
 *     state.
 *   - every status label is compound (BENCHMARK_OBSERVED, REPLAY_REPRODUCED,
 *     SURVIVAL_OBSERVED). The bare word `Verified` is never used as a label.
 *   - banned operational claims (see CLAUDE.md) are never emitted; copy
 *     uses operator-grounded language ("operator-actionable", "preserved
 *     as ambiguous", "replay-reproducible").
 *   - longitudinal deltas are emitted with a deterministic chain so a
 *     regulator can re-derive the dashboard from prior reports.
 */
import { sha256ForPayload } from '../../../utils/deterministic';
import type {
  BenchmarkVerdict,
  TrustOperationalBenchmark,
} from './trustOperationalBenchmark';

// ── Types ────────────────────────────────────────────────────────────────────

export type CompletionBoardSlot =
  | 'REPLAY_EFFICIENCY_VISIBILITY'
  | 'AUDIT_SURVIVABILITY_BENCHMARKING'
  | 'OPERATIONAL_FRICTION_ACCURACY'
  | 'COMPARATIVE_TRUST_CLARITY'
  | 'BENCHMARK_INFRASTRUCTURE_MATURITY';

export interface CompletionBoardEntry {
  slot: CompletionBoardSlot;
  label: string;
  pct: number;
  reason: string;
}

export interface PerformanceTile {
  schema: 'vitalcv.trust-performance-tile.v1';
  id: string;
  title: string;
  vitalcvDisplay: string;
  baselineDisplay: string;
  deltaDisplay: string;
  verdict: BenchmarkVerdict;
  ambiguous: boolean;
  /** Operator-friendly copy. No banned strings, no bare "Verified". */
  copy: string;
}

export interface LongitudinalDelta {
  schema: 'vitalcv.benchmark-longitudinal-delta.v1';
  windowStart: string;
  windowEnd: string;
  priorSurvivabilityPct: number | null;
  currentSurvivabilityPct: number;
  deltaPct: number | null;
  trend: 'IMPROVING' | 'DEGRADING' | 'STABLE' | 'AMBIGUOUS';
  reason: string;
  chainHash: string;
}

export interface TrustLayerPerformanceDashboard {
  schema: 'vitalcv.trust-layer-performance-dashboard.v1';
  benchmarkId: string;
  generatedAt: string;
  overallVerdict: BenchmarkVerdict;
  overallReason: string;
  ambiguous: boolean;
  tiles: PerformanceTile[];
  completionBoard: CompletionBoardEntry[];
  longitudinal: LongitudinalDelta | null;
  dashboardDigest: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMs(value: number | null): string {
  if (value === null) return 'unobserved';
  if (value >= 86_400_000) return `${(value / 86_400_000).toFixed(1)}d`;
  if (value >= 3_600_000) return `${(value / 3_600_000).toFixed(1)}h`;
  if (value >= 60_000) return `${(value / 60_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}s`;
  return `${value.toFixed(2)}ms`;
}

function formatPct(value: number | null): string {
  if (value === null) return 'unobserved';
  return `${value.toFixed(1)}%`;
}

function formatRatio(value: number | null): string {
  if (value === null) return 'n/a';
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k×`;
  return `${value.toFixed(1)}×`;
}

function tileCopy(args: {
  vitalcvDisplay: string;
  baselineDisplay: string;
  verdict: BenchmarkVerdict;
  metricLabel: string;
}): string {
  switch (args.verdict) {
    case 'BENCHMARK_OBSERVED':
      return `VitalCV ${args.metricLabel} ${args.vitalcvDisplay} — operator-actionable advantage over baseline ${args.baselineDisplay}.`;
    case 'BENCHMARK_PARITY':
      return `VitalCV ${args.metricLabel} ${args.vitalcvDisplay} — operationally on par with baseline ${args.baselineDisplay}.`;
    case 'BENCHMARK_REGRESSED':
      return `VitalCV ${args.metricLabel} ${args.vitalcvDisplay} — regressed below baseline ${args.baselineDisplay}; operator review required.`;
    case 'BENCHMARK_AMBIGUOUS':
      return `${args.metricLabel} preserved as ambiguous — VitalCV ${args.vitalcvDisplay} vs baseline ${args.baselineDisplay}; insufficient evidence to certify.`;
    case 'BENCHMARK_BREACH':
      return `${args.metricLabel} fail-closed — input slice or baseline corrupted; benchmark cannot certify.`;
  }
}

// ── Builder ──────────────────────────────────────────────────────────────────

export interface BuildTrustLayerPerformanceDashboardInput {
  benchmark: TrustOperationalBenchmark;
  /** Optional prior dashboard (for longitudinal delta). */
  priorDashboard?: TrustLayerPerformanceDashboard | null;
  /** Override for board completion percentages (defaults derived from verdict). */
  completionOverrides?: Partial<Record<CompletionBoardSlot, number>>;
}

export function buildTrustLayerPerformanceDashboard(
  input: BuildTrustLayerPerformanceDashboardInput,
): TrustLayerPerformanceDashboard {
  const benchmark = input.benchmark;
  const profile = benchmark.vitalcvProfile;

  // ── Tiles ────────────────────────────────────────────────────────────────
  const tiles: PerformanceTile[] = benchmark.comparisons.flatMap(comparison => {
    const decision = comparison.metrics.find(m => m.name === 'decisionLatency');
    const replay = comparison.metrics.find(m => m.name === 'replayLatency');
    const survivability = comparison.metrics.find(m => m.name === 'auditSurvivability');
    const ambiguity = comparison.metrics.find(m => m.name === 'ambiguityPreservation');

    const slots: PerformanceTile[] = [];
    if (decision) {
      slots.push({
        schema: 'vitalcv.trust-performance-tile.v1',
        id: `${comparison.baselineId}.decisionLatency`,
        title: `Decision latency vs ${comparison.baselineLabel}`,
        vitalcvDisplay: formatMs(decision.vitalcv),
        baselineDisplay: formatMs(decision.baseline),
        deltaDisplay: formatRatio(decision.ratio),
        verdict: decision.verdict,
        ambiguous: decision.ambiguous,
        copy: tileCopy({
          vitalcvDisplay: formatMs(decision.vitalcv),
          baselineDisplay: formatMs(decision.baseline),
          verdict: decision.verdict,
          metricLabel: 'decision latency',
        }),
      });
    }
    if (replay) {
      slots.push({
        schema: 'vitalcv.trust-performance-tile.v1',
        id: `${comparison.baselineId}.replayLatency`,
        title: `Replay latency vs ${comparison.baselineLabel}`,
        vitalcvDisplay: formatMs(replay.vitalcv),
        baselineDisplay: formatMs(replay.baseline),
        deltaDisplay: formatRatio(replay.ratio),
        verdict: replay.verdict,
        ambiguous: replay.ambiguous,
        copy: tileCopy({
          vitalcvDisplay: formatMs(replay.vitalcv),
          baselineDisplay: formatMs(replay.baseline),
          verdict: replay.verdict,
          metricLabel: 'replay latency',
        }),
      });
    }
    if (survivability) {
      slots.push({
        schema: 'vitalcv.trust-performance-tile.v1',
        id: `${comparison.baselineId}.auditSurvivability`,
        title: `Audit survivability vs ${comparison.baselineLabel}`,
        vitalcvDisplay: formatPct(survivability.vitalcv),
        baselineDisplay: formatPct(survivability.baseline),
        deltaDisplay: survivability.delta === null ? 'n/a' : `${survivability.delta >= 0 ? '+' : ''}${survivability.delta.toFixed(1)}pp`,
        verdict: survivability.verdict,
        ambiguous: survivability.ambiguous,
        copy: tileCopy({
          vitalcvDisplay: formatPct(survivability.vitalcv),
          baselineDisplay: formatPct(survivability.baseline),
          verdict: survivability.verdict,
          metricLabel: 'audit survivability',
        }),
      });
    }
    if (ambiguity) {
      slots.push({
        schema: 'vitalcv.trust-performance-tile.v1',
        id: `${comparison.baselineId}.ambiguityPreservation`,
        title: `Ambiguity preservation vs ${comparison.baselineLabel}`,
        vitalcvDisplay: formatPct(ambiguity.vitalcv),
        baselineDisplay: formatPct(ambiguity.baseline),
        deltaDisplay: ambiguity.delta === null ? 'n/a' : `${ambiguity.delta >= 0 ? '+' : ''}${ambiguity.delta.toFixed(1)}pp`,
        verdict: ambiguity.verdict,
        ambiguous: ambiguity.ambiguous,
        copy: tileCopy({
          vitalcvDisplay: formatPct(ambiguity.vitalcv),
          baselineDisplay: formatPct(ambiguity.baseline),
          verdict: ambiguity.verdict,
          metricLabel: 'ambiguity preservation',
        }),
      });
    }
    return slots;
  });

  // ── Completion board ─────────────────────────────────────────────────────
  const completionBoard = buildCompletionBoard(benchmark, input.completionOverrides);

  // ── Longitudinal delta ───────────────────────────────────────────────────
  const longitudinal = buildLongitudinalDelta(benchmark, input.priorDashboard ?? null);

  const dashboardDigest = sha256ForPayload({
    schema: 'vitalcv.trust-layer-performance-dashboard-digest.v1',
    benchmarkId: benchmark.benchmarkId,
    overallVerdict: benchmark.overallVerdict,
    tiles: tiles
      .map(t => ({
        id: t.id,
        verdict: t.verdict,
        vitalcvDisplay: t.vitalcvDisplay,
        baselineDisplay: t.baselineDisplay,
      }))
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id)),
    completionBoard: completionBoard
      .map(e => ({ slot: e.slot, pct: e.pct }))
      .slice()
      .sort((a, b) => a.slot.localeCompare(b.slot)),
    longitudinalChain: longitudinal?.chainHash ?? null,
  });

  return {
    schema: 'vitalcv.trust-layer-performance-dashboard.v1',
    benchmarkId: benchmark.benchmarkId,
    generatedAt: benchmark.generatedAt,
    overallVerdict: benchmark.overallVerdict,
    overallReason: benchmark.overallReason,
    ambiguous: benchmark.ambiguous,
    tiles,
    completionBoard,
    longitudinal,
    dashboardDigest,
  };
}

// ── Completion board reduction ───────────────────────────────────────────────

function pctFromVerdict(verdict: BenchmarkVerdict): number {
  switch (verdict) {
    case 'BENCHMARK_OBSERVED':
      return 100;
    case 'BENCHMARK_PARITY':
      return 75;
    case 'BENCHMARK_AMBIGUOUS':
      return 50;
    case 'BENCHMARK_REGRESSED':
      return 25;
    case 'BENCHMARK_BREACH':
      return 0;
  }
}

function buildCompletionBoard(
  benchmark: TrustOperationalBenchmark,
  overrides?: Partial<Record<CompletionBoardSlot, number>>,
): CompletionBoardEntry[] {
  const replayCmps = benchmark.comparisons.flatMap(c => c.metrics.filter(m => m.name === 'replayLatency'));
  const survivabilityCmps = benchmark.comparisons.flatMap(c => c.metrics.filter(m => m.name === 'auditSurvivability'));
  const frictionCmps = benchmark.comparisons.flatMap(c => c.metrics.filter(m => m.name === 'operationalFriction'));

  const replayPct =
    overrides?.REPLAY_EFFICIENCY_VISIBILITY ??
    averagePct(replayCmps.map(m => pctFromVerdict(m.verdict)));
  const survivabilityPct =
    overrides?.AUDIT_SURVIVABILITY_BENCHMARKING ??
    averagePct(survivabilityCmps.map(m => pctFromVerdict(m.verdict)));
  const frictionPct =
    overrides?.OPERATIONAL_FRICTION_ACCURACY ??
    averagePct(frictionCmps.map(m => pctFromVerdict(m.verdict)));
  const clarityPct =
    overrides?.COMPARATIVE_TRUST_CLARITY ??
    averagePct(benchmark.comparisons.map(c => pctFromVerdict(c.verdict)));
  const maturityPct =
    overrides?.BENCHMARK_INFRASTRUCTURE_MATURITY ??
    pctFromVerdict(benchmark.overallVerdict);

  return [
    {
      slot: 'REPLAY_EFFICIENCY_VISIBILITY',
      label: 'Replay Efficiency Visibility',
      pct: replayPct,
      reason: replayCmps.length === 0
        ? 'No replay-latency comparisons produced.'
        : `${replayCmps.filter(m => m.verdict === 'BENCHMARK_OBSERVED').length}/${replayCmps.length} replay comparisons observed gain.`,
    },
    {
      slot: 'AUDIT_SURVIVABILITY_BENCHMARKING',
      label: 'Audit Survivability Benchmarking',
      pct: survivabilityPct,
      reason: survivabilityCmps.length === 0
        ? 'No survivability comparisons produced.'
        : `${survivabilityCmps.filter(m => m.verdict === 'BENCHMARK_OBSERVED').length}/${survivabilityCmps.length} survivability comparisons observed gain.`,
    },
    {
      slot: 'OPERATIONAL_FRICTION_ACCURACY',
      label: 'Operational Friction Accuracy',
      pct: frictionPct,
      reason: frictionCmps.length === 0
        ? 'No friction comparisons produced.'
        : `${frictionCmps.filter(m => m.verdict === 'BENCHMARK_OBSERVED').length}/${frictionCmps.length} friction comparisons observed gain.`,
    },
    {
      slot: 'COMPARATIVE_TRUST_CLARITY',
      label: 'Comparative Trust Clarity',
      pct: clarityPct,
      reason: `${benchmark.comparisons.filter(c => c.verdict === 'BENCHMARK_OBSERVED').length}/${benchmark.comparisons.length} baseline comparison(s) reached BENCHMARK_OBSERVED.`,
    },
    {
      slot: 'BENCHMARK_INFRASTRUCTURE_MATURITY',
      label: 'Benchmark Infrastructure Maturity',
      pct: maturityPct,
      reason: benchmark.overallReason,
    },
  ];
}

function averagePct(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ── Longitudinal delta ───────────────────────────────────────────────────────

function buildLongitudinalDelta(
  benchmark: TrustOperationalBenchmark,
  prior: TrustLayerPerformanceDashboard | null,
): LongitudinalDelta | null {
  const currentSurvivabilityPct = benchmark.vitalcvProfile.partialSurvivabilityPct;

  const priorSurvivabilityPct = prior?.tiles
    .find(t => t.id.endsWith('.auditSurvivability') && t.vitalcvDisplay !== 'unobserved')
    ?.vitalcvDisplay
    ? Number.parseFloat(
        (prior?.tiles.find(t => t.id.endsWith('.auditSurvivability'))?.vitalcvDisplay ?? '').replace('%', ''),
      )
    : null;

  let trend: LongitudinalDelta['trend'];
  let deltaPct: number | null;
  let reason: string;

  if (priorSurvivabilityPct === null || Number.isNaN(priorSurvivabilityPct)) {
    deltaPct = null;
    trend = 'AMBIGUOUS';
    reason = 'No prior dashboard available; longitudinal delta preserved as ambiguous.';
  } else {
    deltaPct = currentSurvivabilityPct - priorSurvivabilityPct;
    if (Math.abs(deltaPct) <= 1) {
      trend = 'STABLE';
      reason = `Survivability stable within ±1pp (prior ${priorSurvivabilityPct.toFixed(2)}% → current ${currentSurvivabilityPct.toFixed(2)}%).`;
    } else if (deltaPct > 0) {
      trend = 'IMPROVING';
      reason = `Survivability improved by ${deltaPct.toFixed(2)}pp (prior ${priorSurvivabilityPct.toFixed(2)}% → current ${currentSurvivabilityPct.toFixed(2)}%).`;
    } else {
      trend = 'DEGRADING';
      reason = `Survivability degraded by ${(-deltaPct).toFixed(2)}pp (prior ${priorSurvivabilityPct.toFixed(2)}% → current ${currentSurvivabilityPct.toFixed(2)}%).`;
    }
  }

  const chainHash = sha256ForPayload({
    schema: 'vitalcv.benchmark-longitudinal-chain.v1',
    priorChain: prior?.dashboardDigest ?? null,
    benchmarkId: benchmark.benchmarkId,
    currentSurvivabilityPct,
    priorSurvivabilityPct,
  });

  return {
    schema: 'vitalcv.benchmark-longitudinal-delta.v1',
    windowStart: benchmark.inputs.sliceWindow.from,
    windowEnd: benchmark.inputs.sliceWindow.to,
    priorSurvivabilityPct,
    currentSurvivabilityPct,
    deltaPct,
    trend,
    reason,
    chainHash,
  };
}

// ── Sentinels ────────────────────────────────────────────────────────────────

export const KNOWN_COMPLETION_BOARD_SLOTS = Object.freeze([
  'REPLAY_EFFICIENCY_VISIBILITY',
  'AUDIT_SURVIVABILITY_BENCHMARKING',
  'OPERATIONAL_FRICTION_ACCURACY',
  'COMPARATIVE_TRUST_CLARITY',
  'BENCHMARK_INFRASTRUCTURE_MATURITY',
] as const);

export const KNOWN_LONGITUDINAL_TRENDS = Object.freeze([
  'IMPROVING',
  'DEGRADING',
  'STABLE',
  'AMBIGUOUS',
] as const);
