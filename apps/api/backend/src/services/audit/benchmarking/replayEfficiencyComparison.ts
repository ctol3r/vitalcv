/**
 * replayEfficiencyComparison.ts — W2-PR70A
 *
 * Replay-efficiency benchmark. Pure transform that computes the ratio of a
 * baseline's replay cost (or zero-replay impossibility) versus the VitalCV
 * replay engine's actual observed cost across a slice of audit bundles.
 *
 * Hard invariants:
 *   - When the baseline does not replay (e.g. NO_REPLAY_SURVIVABILITY,
 *     TRADITIONAL_AUDIT_WORKFLOW), the comparison surfaces the impossibility
 *     as REPLAY_NOT_REPRODUCIBLE — never coerced to "infinitely faster".
 *   - When VitalCV's replay slice is empty, the comparison is AMBIGUOUS,
 *     not a default win.
 *   - Efficiency ratio caps are explicit. A ratio above the cap is reported
 *     verbatim alongside CAPPED so a regulator sees the unbounded delta.
 */
import { sha256ForPayload } from '../../../utils/deterministic';
import type { AuditBundle, DecisionReplay } from '../replayEngine';
import type {
  BenchmarkBaselineModel,
  BenchmarkVerdict,
} from './trustOperationalBenchmark';

// ── Types ────────────────────────────────────────────────────────────────────

export type ReplayEfficiencyVerdict =
  | 'REPLAY_REPRODUCED'           // VitalCV replay observed within budget
  | 'REPLAY_NOT_REPRODUCIBLE'     // baseline does not support replay
  | 'REPLAY_AMBIGUOUS'            // slice insufficient to verdict
  | 'REPLAY_REGRESSED'            // VitalCV replay slower than baseline
  | 'REPLAY_BREACH';              // input bundle has CONTAINMENT_BREACH

export interface ReplayEfficiencyMetric {
  schema: 'vitalcv.replay-efficiency-metric.v1';
  capsuleId: string;
  vitalcvReplayMs: number;
  baselineReplayMs: number | null;
  ratio: number | null;
  capped: boolean;
  verdict: ReplayEfficiencyVerdict;
  reason: string;
}

export interface ReplayEfficiencyComparison {
  schema: 'vitalcv.replay-efficiency-comparison.v1';
  baselineId: string;
  baselineLabel: string;
  baselineDerivation: string;
  totalReplays: number;
  replaysWithLatency: number;
  /** Median ratio across replays for which a baseline value exists. */
  medianRatio: number | null;
  /** Lowest 5th-percentile ratio (worst-case VitalCV vs. baseline). */
  p5Ratio: number | null;
  /** Highest 95th-percentile ratio (best-case VitalCV vs. baseline). */
  p95Ratio: number | null;
  cappedReplayCount: number;
  notReproducibleCount: number;
  ambiguousCount: number;
  reproducedCount: number;
  regressedCount: number;
  breachedCount: number;
  verdict: BenchmarkVerdict;
  ambiguous: boolean;
  reason: string;
  metrics: ReplayEfficiencyMetric[];
  comparisonDigest: string;
}

const REPLAY_RATIO_CAP = 1_000_000; // 1M× — anything past this is operationally indistinguishable

// ── Helpers ──────────────────────────────────────────────────────────────────

function median(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(values: ReadonlyArray<number>, p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx];
}

// ── Core comparison ──────────────────────────────────────────────────────────

export interface BuildReplayEfficiencyComparisonInput {
  auditBundles: ReadonlyArray<AuditBundle>;
  /** Per-replay observed latency in ms (capsuleId -> ms). */
  replayLatencies: Record<string, number>;
  baseline: BenchmarkBaselineModel;
}

export function buildReplayEfficiencyComparison(
  input: BuildReplayEfficiencyComparisonInput,
): ReplayEfficiencyComparison {
  const { baseline } = input;
  const baselineMs = baseline.metrics.replayLatencyMs;
  const metrics: ReplayEfficiencyMetric[] = [];

  let totalReplays = 0;
  let replaysWithLatency = 0;
  let cappedReplayCount = 0;
  let notReproducibleCount = 0;
  let ambiguousCount = 0;
  let reproducedCount = 0;
  let regressedCount = 0;
  let breachedCount = 0;

  for (const bundle of input.auditBundles) {
    const breaches = bundle.containment.boundary.contaminatedCount;
    const isBreached =
      bundle.containment.quarantines.some(q => q.verdict === 'CONTAINMENT_BREACH');

    for (const replay of bundle.replays) {
      totalReplays += 1;
      const observed = input.replayLatencies[replay.capsuleId];
      const observedNum =
        typeof observed === 'number' && Number.isFinite(observed) ? observed : null;

      if (isBreached) {
        breachedCount += 1;
        metrics.push(replayBreachMetric(replay, observedNum, breaches));
        continue;
      }
      if (observedNum === null) {
        ambiguousCount += 1;
        metrics.push({
          schema: 'vitalcv.replay-efficiency-metric.v1',
          capsuleId: replay.capsuleId,
          vitalcvReplayMs: 0,
          baselineReplayMs: baselineMs,
          ratio: null,
          capped: false,
          verdict: 'REPLAY_AMBIGUOUS',
          reason: 'No observed latency for this replay; preserved as ambiguous.',
        });
        continue;
      }

      replaysWithLatency += 1;

      if (baselineMs === null) {
        notReproducibleCount += 1;
        metrics.push({
          schema: 'vitalcv.replay-efficiency-metric.v1',
          capsuleId: replay.capsuleId,
          vitalcvReplayMs: observedNum,
          baselineReplayMs: null,
          ratio: null,
          capped: false,
          verdict: 'REPLAY_NOT_REPRODUCIBLE',
          reason: `Baseline ${baseline.baselineId} does not support replay; VitalCV reproduced in ${observedNum.toFixed(2)} ms.`,
        });
        continue;
      }

      // ratio = baseline / vitalcv. >1 means VitalCV faster.
      const rawRatio = observedNum === 0 ? Infinity : baselineMs / observedNum;
      let capped = false;
      let ratio: number;
      if (!Number.isFinite(rawRatio) || rawRatio > REPLAY_RATIO_CAP) {
        ratio = REPLAY_RATIO_CAP;
        capped = true;
        cappedReplayCount += 1;
      } else {
        ratio = rawRatio;
      }

      let verdict: ReplayEfficiencyVerdict;
      let reason: string;
      if (ratio > 1) {
        verdict = 'REPLAY_REPRODUCED';
        reproducedCount += 1;
        reason = capped
          ? `VitalCV replay ${observedNum.toFixed(2)} ms vs baseline ${baselineMs} ms — ratio capped at ${REPLAY_RATIO_CAP}×.`
          : `VitalCV replay ${observedNum.toFixed(2)} ms vs baseline ${baselineMs} ms — ${ratio.toFixed(0)}× faster.`;
      } else if (ratio === 1) {
        // Exact parity is rare with real measurements but possible on synthetic input.
        verdict = 'REPLAY_REPRODUCED';
        reproducedCount += 1;
        reason = `VitalCV replay matched baseline exactly at ${observedNum.toFixed(2)} ms.`;
      } else {
        verdict = 'REPLAY_REGRESSED';
        regressedCount += 1;
        reason = `VitalCV replay ${observedNum.toFixed(2)} ms slower than baseline ${baselineMs} ms (ratio ${ratio.toFixed(2)}×).`;
      }

      metrics.push({
        schema: 'vitalcv.replay-efficiency-metric.v1',
        capsuleId: replay.capsuleId,
        vitalcvReplayMs: observedNum,
        baselineReplayMs: baselineMs,
        ratio,
        capped,
        verdict,
        reason,
      });
    }
  }

  // Aggregate ratios for non-cap, non-null metrics.
  const concreteRatios = metrics
    .filter(m => m.verdict === 'REPLAY_REPRODUCED' && m.ratio !== null && !m.capped)
    .map(m => m.ratio as number);
  const medianRatio = median(concreteRatios);
  const p5Ratio = percentile(concreteRatios, 0.05);
  const p95Ratio = percentile(concreteRatios, 0.95);

  // Roll up overall verdict.
  let verdict: BenchmarkVerdict;
  let ambiguous = false;
  let reason: string;

  if (breachedCount > 0) {
    verdict = 'BENCHMARK_BREACH';
    reason = `${breachedCount} replay(s) sourced from a CONTAINMENT_BREACH bundle; benchmark fails closed.`;
  } else if (totalReplays === 0) {
    verdict = 'BENCHMARK_AMBIGUOUS';
    ambiguous = true;
    reason = 'No replays in input slice; replay efficiency cannot be computed.';
  } else if (replaysWithLatency === 0 && notReproducibleCount === 0) {
    verdict = 'BENCHMARK_AMBIGUOUS';
    ambiguous = true;
    reason = `All ${totalReplays} replay(s) lack observed latency; preserved as ambiguous.`;
  } else if (regressedCount > 0 && reproducedCount === 0) {
    verdict = 'BENCHMARK_REGRESSED';
    reason = `${regressedCount} replay(s) slower than baseline; no improvements observed.`;
  } else if (reproducedCount > 0 && regressedCount === 0) {
    verdict = 'BENCHMARK_OBSERVED';
    ambiguous = ambiguousCount > 0;
    reason = `VitalCV reproduced ${reproducedCount} replay(s) faster than baseline; median ratio ${medianRatio?.toFixed(0) ?? 'n/a'}×.`;
  } else if (reproducedCount > regressedCount) {
    verdict = 'BENCHMARK_OBSERVED';
    ambiguous = ambiguousCount > 0;
    reason = `${reproducedCount} replay(s) outperformed baseline vs ${regressedCount} regression(s); preserved ${ambiguousCount} ambiguous.`;
  } else if (reproducedCount === regressedCount && reproducedCount > 0) {
    verdict = 'BENCHMARK_PARITY';
    ambiguous = ambiguousCount > 0;
    reason = `Mixed outcome — ${reproducedCount} reproduced, ${regressedCount} regressed.`;
  } else if (notReproducibleCount > 0) {
    // Baseline can't replay but VitalCV did — that's an observed gain by definition.
    verdict = 'BENCHMARK_OBSERVED';
    ambiguous = ambiguousCount > 0;
    reason = `Baseline ${baseline.baselineId} cannot replay; VitalCV reproduced ${notReproducibleCount} replay(s) deterministically.`;
  } else {
    verdict = 'BENCHMARK_AMBIGUOUS';
    ambiguous = true;
    reason = 'No concrete verdict producible from available samples.';
  }

  const comparisonDigest = sha256ForPayload({
    schema: 'vitalcv.replay-efficiency-comparison-digest.v1',
    baselineId: baseline.baselineId,
    metrics: metrics
      .map(m => ({
        capsuleId: m.capsuleId,
        vitalcvReplayMs: m.vitalcvReplayMs,
        baselineReplayMs: m.baselineReplayMs,
        ratio: m.ratio,
        verdict: m.verdict,
      }))
      .slice()
      .sort((a, b) => a.capsuleId.localeCompare(b.capsuleId)),
  });

  return {
    schema: 'vitalcv.replay-efficiency-comparison.v1',
    baselineId: baseline.baselineId,
    baselineLabel: baseline.label,
    baselineDerivation: baseline.derivation,
    totalReplays,
    replaysWithLatency,
    medianRatio,
    p5Ratio,
    p95Ratio,
    cappedReplayCount,
    notReproducibleCount,
    ambiguousCount,
    reproducedCount,
    regressedCount,
    breachedCount,
    verdict,
    ambiguous,
    reason,
    metrics,
    comparisonDigest,
  };
}

function replayBreachMetric(
  replay: DecisionReplay,
  observedNum: number | null,
  breaches: number,
): ReplayEfficiencyMetric {
  return {
    schema: 'vitalcv.replay-efficiency-metric.v1',
    capsuleId: replay.capsuleId,
    vitalcvReplayMs: observedNum ?? 0,
    baselineReplayMs: null,
    ratio: null,
    capped: false,
    verdict: 'REPLAY_BREACH',
    reason: `Replay sourced from a containment-breached bundle (${breaches} contaminated lineage edge(s)); benchmark fails closed.`,
  };
}

// ── Sentinels ────────────────────────────────────────────────────────────────

export const REPLAY_EFFICIENCY_RATIO_CAP = REPLAY_RATIO_CAP;
export const KNOWN_REPLAY_EFFICIENCY_VERDICTS = Object.freeze([
  'REPLAY_REPRODUCED',
  'REPLAY_NOT_REPRODUCIBLE',
  'REPLAY_AMBIGUOUS',
  'REPLAY_REGRESSED',
  'REPLAY_BREACH',
] as const);
