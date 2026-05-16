/**
 * auditSurvivabilityComparison.ts — W2-PR70A
 *
 * Audit-survivability benchmark. Pure transform comparing VitalCV's
 * containment-boundary survivability to a modeled baseline (legacy paper-
 * binder PSV, traditional point-in-time audit, etc).
 *
 * Hard invariants:
 *   - VitalCV's survivability is read from the audit-bundle containment
 *     boundary's `partialSurvivabilityPct`, NOT recomputed locally. The
 *     boundary IS the survivability surface; recomputing risks divergence.
 *   - When a baseline does not differentiate audit survivability (e.g.
 *     truly degenerate cases), the metric is AMBIGUOUS — never coerced.
 *   - A bundle whose boundary reports `partitioned: false` is surfaced
 *     verbatim and its survivability counted toward AMBIGUITY, not OBSERVED.
 *   - Quarantined / contaminated / ambiguous records all count toward
 *     "operator-actionable survivability" — only outright loss (records
 *     that vanished entirely from the bundle) are excluded.
 */
import { sha256ForPayload } from '../../../utils/deterministic';
import type { AuditBundle } from '../replayEngine';
import type {
  BenchmarkBaselineModel,
  BenchmarkVerdict,
} from './trustOperationalBenchmark';

// ── Types ────────────────────────────────────────────────────────────────────

export type SurvivabilityVerdict =
  | 'SURVIVAL_OBSERVED'      // VitalCV preserves more of the slice than baseline
  | 'SURVIVAL_PARITY'        // within ±5%
  | 'SURVIVAL_REGRESSED'     // baseline preserves more than VitalCV
  | 'SURVIVAL_AMBIGUOUS'     // boundary not partitioned
  | 'SURVIVAL_BREACH';       // CONTAINMENT_BREACH detected

export interface SurvivabilityBundleMetric {
  schema: 'vitalcv.audit-survivability-bundle-metric.v1';
  bundleId: string;
  totalReplayed: number;
  cleanCount: number;
  quarantinedCount: number;
  ambiguousCount: number;
  contaminatedCount: number;
  partialSurvivabilityPct: number;
  baselineSurvivabilityPct: number | null;
  delta: number | null;
  verdict: SurvivabilityVerdict;
  partitioned: boolean;
  reason: string;
}

export interface AuditSurvivabilityComparison {
  schema: 'vitalcv.audit-survivability-comparison.v1';
  baselineId: string;
  baselineLabel: string;
  baselineDerivation: string;
  bundleCount: number;
  totalReplayed: number;
  totalClean: number;
  totalQuarantined: number;
  totalAmbiguous: number;
  totalContaminated: number;
  totalBreached: number;
  /** Population-weighted survivability across the input slice. */
  weightedSurvivabilityPct: number;
  baselineSurvivabilityPct: number | null;
  /** Survivability delta vs baseline. Positive = VitalCV preserves more. */
  surplusPct: number | null;
  /** Number of bundles whose boundary reported partitioned: false. */
  unpartitionedCount: number;
  bundleMetrics: SurvivabilityBundleMetric[];
  verdict: BenchmarkVerdict;
  ambiguous: boolean;
  reason: string;
  comparisonDigest: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PARITY_TOLERANCE_PCT = 5;

function classifyBundle(
  bundle: AuditBundle,
  baselinePct: number | null,
): SurvivabilityBundleMetric {
  const boundary = bundle.containment.boundary;
  const partitioned = boundary.partitioned;
  const breaches = bundle.containment.quarantines.filter(
    q => q.verdict === 'CONTAINMENT_BREACH',
  ).length;

  const base: Omit<SurvivabilityBundleMetric, 'verdict' | 'reason' | 'delta'> = {
    schema: 'vitalcv.audit-survivability-bundle-metric.v1',
    bundleId: bundle.bundleId,
    totalReplayed: boundary.totalReplayed,
    cleanCount: boundary.cleanCount,
    quarantinedCount: boundary.quarantinedCount,
    ambiguousCount: boundary.ambiguousCount,
    contaminatedCount: boundary.contaminatedCount,
    partialSurvivabilityPct: boundary.partialSurvivabilityPct,
    baselineSurvivabilityPct: baselinePct,
    partitioned,
  };

  if (breaches > 0) {
    return {
      ...base,
      delta: null,
      verdict: 'SURVIVAL_BREACH',
      reason: `Bundle contains ${breaches} CONTAINMENT_BREACH record(s); survivability cannot be certified.`,
    };
  }
  if (!partitioned) {
    return {
      ...base,
      delta: null,
      verdict: 'SURVIVAL_AMBIGUOUS',
      reason: `Bundle boundary reported partitioned=false; partial survivability ${boundary.partialSurvivabilityPct.toFixed(2)}% preserved as ambiguous.`,
    };
  }
  if (baselinePct === null) {
    return {
      ...base,
      delta: null,
      verdict: 'SURVIVAL_AMBIGUOUS',
      reason: 'Baseline survivability not derivable; comparison preserved as ambiguous.',
    };
  }

  const delta = boundary.partialSurvivabilityPct - baselinePct;
  if (Math.abs(delta) <= PARITY_TOLERANCE_PCT) {
    return {
      ...base,
      delta,
      verdict: 'SURVIVAL_PARITY',
      reason: `VitalCV survivability ${boundary.partialSurvivabilityPct.toFixed(2)}% within ±${PARITY_TOLERANCE_PCT}% of baseline ${baselinePct}%.`,
    };
  }
  if (delta > PARITY_TOLERANCE_PCT) {
    return {
      ...base,
      delta,
      verdict: 'SURVIVAL_OBSERVED',
      reason: `VitalCV survivability ${boundary.partialSurvivabilityPct.toFixed(2)}% exceeds baseline ${baselinePct}% by ${delta.toFixed(2)}%.`,
    };
  }
  return {
    ...base,
    delta,
    verdict: 'SURVIVAL_REGRESSED',
    reason: `VitalCV survivability ${boundary.partialSurvivabilityPct.toFixed(2)}% trails baseline ${baselinePct}% by ${(-delta).toFixed(2)}%.`,
  };
}

// ── Builder ──────────────────────────────────────────────────────────────────

export interface BuildAuditSurvivabilityComparisonInput {
  auditBundles: ReadonlyArray<AuditBundle>;
  baseline: BenchmarkBaselineModel;
}

export function buildAuditSurvivabilityComparison(
  input: BuildAuditSurvivabilityComparisonInput,
): AuditSurvivabilityComparison {
  const baselinePct = input.baseline.metrics.auditSurvivabilityPct;
  const bundleMetrics = input.auditBundles.map(b => classifyBundle(b, baselinePct));

  let totalReplayed = 0;
  let totalClean = 0;
  let totalQuarantined = 0;
  let totalAmbiguous = 0;
  let totalContaminated = 0;
  let totalBreached = 0;
  let unpartitionedCount = 0;
  let weightedSurvivableCount = 0;

  for (const m of bundleMetrics) {
    totalReplayed += m.totalReplayed;
    totalClean += m.cleanCount;
    totalQuarantined += m.quarantinedCount;
    totalAmbiguous += m.ambiguousCount;
    totalContaminated += m.contaminatedCount;
    if (!m.partitioned) unpartitionedCount += 1;
    if (m.verdict === 'SURVIVAL_BREACH') {
      totalBreached += m.totalReplayed;
      continue;
    }
    // Survivable count = clean + quarantined + ambiguous (operator-actionable).
    // Contaminated records still surface as records, so they survived too.
    weightedSurvivableCount +=
      m.cleanCount + m.quarantinedCount + m.ambiguousCount + m.contaminatedCount;
  }

  const observedPopulation = totalReplayed - totalBreached;
  const weightedSurvivabilityPct =
    observedPopulation === 0
      ? 0
      : (weightedSurvivableCount / observedPopulation) * 100;

  const surplusPct =
    baselinePct === null ? null : weightedSurvivabilityPct - baselinePct;

  let verdict: BenchmarkVerdict;
  let ambiguous = false;
  let reason: string;

  const breachBundles = bundleMetrics.filter(m => m.verdict === 'SURVIVAL_BREACH').length;
  const observedBundles = bundleMetrics.filter(m => m.verdict === 'SURVIVAL_OBSERVED').length;
  const regressedBundles = bundleMetrics.filter(m => m.verdict === 'SURVIVAL_REGRESSED').length;
  const ambiguousBundles = bundleMetrics.filter(m => m.verdict === 'SURVIVAL_AMBIGUOUS').length;

  if (breachBundles > 0) {
    verdict = 'BENCHMARK_BREACH';
    reason = `${breachBundles} bundle(s) reported CONTAINMENT_BREACH; benchmark fails closed.`;
  } else if (input.auditBundles.length === 0) {
    verdict = 'BENCHMARK_AMBIGUOUS';
    ambiguous = true;
    reason = 'No bundles in input slice; survivability cannot be benchmarked.';
  } else if (regressedBundles > 0 && observedBundles === 0) {
    verdict = 'BENCHMARK_REGRESSED';
    reason = `${regressedBundles} bundle(s) trailed baseline; no improvements observed.`;
  } else if (observedBundles > 0 && regressedBundles === 0) {
    verdict = 'BENCHMARK_OBSERVED';
    ambiguous = ambiguousBundles > 0;
    reason = `VitalCV preserved survivability above baseline in ${observedBundles}/${bundleMetrics.length} bundle(s); ${ambiguousBundles} preserved as ambiguous.`;
  } else if (observedBundles > regressedBundles) {
    verdict = 'BENCHMARK_OBSERVED';
    ambiguous = ambiguousBundles > 0;
    reason = `${observedBundles} bundle(s) outperformed baseline vs ${regressedBundles} regression(s); ${ambiguousBundles} ambiguous.`;
  } else if (observedBundles === regressedBundles && observedBundles > 0) {
    verdict = 'BENCHMARK_PARITY';
    ambiguous = ambiguousBundles > 0;
    reason = `Mixed survivability outcome — ${observedBundles} observed, ${regressedBundles} regressed.`;
  } else {
    verdict = 'BENCHMARK_AMBIGUOUS';
    ambiguous = true;
    reason = `No concrete bundle verdict producible (${ambiguousBundles}/${bundleMetrics.length} ambiguous).`;
  }

  const comparisonDigest = sha256ForPayload({
    schema: 'vitalcv.audit-survivability-comparison-digest.v1',
    baselineId: input.baseline.baselineId,
    bundles: bundleMetrics
      .map(m => ({
        bundleId: m.bundleId,
        totalReplayed: m.totalReplayed,
        partialSurvivabilityPct: m.partialSurvivabilityPct,
        verdict: m.verdict,
      }))
      .slice()
      .sort((a, b) => a.bundleId.localeCompare(b.bundleId)),
  });

  return {
    schema: 'vitalcv.audit-survivability-comparison.v1',
    baselineId: input.baseline.baselineId,
    baselineLabel: input.baseline.label,
    baselineDerivation: input.baseline.derivation,
    bundleCount: input.auditBundles.length,
    totalReplayed,
    totalClean,
    totalQuarantined,
    totalAmbiguous,
    totalContaminated,
    totalBreached,
    weightedSurvivabilityPct,
    baselineSurvivabilityPct: baselinePct,
    surplusPct,
    unpartitionedCount,
    bundleMetrics,
    verdict,
    ambiguous,
    reason,
    comparisonDigest,
  };
}

// ── Sentinels ────────────────────────────────────────────────────────────────

export const KNOWN_SURVIVABILITY_VERDICTS = Object.freeze([
  'SURVIVAL_OBSERVED',
  'SURVIVAL_PARITY',
  'SURVIVAL_REGRESSED',
  'SURVIVAL_AMBIGUOUS',
  'SURVIVAL_BREACH',
] as const);
