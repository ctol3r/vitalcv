/**
 * economicMetricsEngine.ts — Orchestrator + fail-closed verdict logic.
 *
 * Wave: W2-PR60A.
 *
 * The engine ingests a window of ReplayEvidence and produces an
 * EconomicTrustReport. The verdict is the load-bearing field — every numeric
 * field must be consumed in the context of the verdict, never alone.
 *
 * Verdict ladder (applied in order; first match wins):
 *
 *   FAIL_CLOSED — input is structurally broken:
 *     • windowEnd < windowStart
 *     • > 25% of the dataset has malformed=true (chaos contamination threshold)
 *     • integrity failure rate > 50%
 *     • any decision lies outside [windowStart, windowEnd]
 *     • computed metric returned NaN or +/-Infinity
 *
 *   INCONCLUSIVE — sample is not strong enough to claim ROI:
 *     • totalReplays < 30 (PROVEN floor)
 *     • integrity failure rate > 15%
 *     • any single tenant accounts for > 90% of the sample (TENANT_AMBIGUITY)
 *     • trustEfficiency.confidence < 0.5
 *
 *   PROBABLE — useful for steering, not for filings:
 *     • totalReplays in [30, 100)
 *     • all metrics observed/derived basis
 *     • trustEfficiency.confidence in [0.5, 0.85)
 *
 *   PROVEN — only when all of the following hold:
 *     • totalReplays ≥ 100
 *     • integrity failure rate ≤ 5%
 *     • no chaos contamination (malformed count = 0)
 *     • trustEfficiency.confidence ≥ 0.85
 *     • operationalSavings basis = 'derived' with confidence ≥ 0.7
 *
 * The thresholds are calibration; do not adjust without bumping
 * METHODOLOGY_VERSION below.
 */

import { createHash } from 'crypto';

import { computeOperationalSavings } from './operationalSavings';
import { computeReplayReuseEfficiency } from './replayReuse';
import { computeTimeToStart } from './timeToStart';
import { computeTrustEfficiencyScore } from './trustEfficiency';
import { computeVerifierEfficiency } from './verifierEfficiency';
import type {
  AmbiguousMetric,
  EconomicTrustReport,
  EconomicVerdict,
  LongitudinalDatapoint,
  ManualCostBaseline,
  ReplayEvidence,
  VerdictReason,
} from './types';

export const ECONOMIC_METRICS_METHODOLOGY_VERSION = '1.0';

export const VERDICT_THRESHOLDS = {
  proven: { minReplays: 100, maxIntegrityFailureRate: 0.05, minConfidence: 0.85 },
  probable: { minReplays: 30, maxIntegrityFailureRate: 0.15, minConfidence: 0.5 },
  failClosedChaosRate: 0.25,
  failClosedIntegrityRate: 0.5,
  inconclusiveTenantShareCeiling: 0.9,
  inconclusiveIntegrityFailureRate: 0.15,
  inconclusiveConfidenceFloor: 0.5,
  provenSavingsConfidenceFloor: 0.7,
} as const;

export interface EconomicMetricsEngineOptions {
  windowStart: Date;
  windowEnd: Date;
  manualCostBaseline?: ManualCostBaseline;
  /** Optional prior trend datapoints to prepend to this report's `trend` field. */
  priorTrend?: readonly LongitudinalDatapoint[];
  /** When true (default), all metrics with NaN bounds force FAIL_CLOSED. */
  strictFiniteCheck?: boolean;
}

export function computeEconomicTrustReport(
  replays: readonly ReplayEvidence[],
  options: EconomicMetricsEngineOptions,
): EconomicTrustReport {
  const reasons: VerdictReason[] = [];
  const failClosedReasons: string[] = [];
  const generatedAt = new Date();
  const inputDigest = digestInput(replays, options);

  // Window sanity.
  if (options.windowEnd.getTime() < options.windowStart.getTime()) {
    return failClosedReport({
      reason: { code: 'WINDOW_CONTRADICTION', detail: 'windowEnd is before windowStart' },
      windowStart: options.windowStart,
      windowEnd: options.windowEnd,
      generatedAt,
      inputDigest,
      totalReplays: replays.length,
      tenantCount: countTenants(replays),
      priorTrend: options.priorTrend,
    });
  }

  // Out-of-window decisions are a structural error.
  for (const r of replays) {
    if (
      r.decisionEmittedAt.getTime() < options.windowStart.getTime() ||
      r.decisionEmittedAt.getTime() > options.windowEnd.getTime()
    ) {
      return failClosedReport({
        reason: {
          code: 'WINDOW_CONTRADICTION',
          detail: `replay ${r.replayId} decisionEmittedAt outside window`,
        },
        windowStart: options.windowStart,
        windowEnd: options.windowEnd,
        generatedAt,
        inputDigest,
        totalReplays: replays.length,
        tenantCount: countTenants(replays),
        priorTrend: options.priorTrend,
      });
    }
  }

  const malformedCount = replays.filter((r) => r.malformed).length;
  const usable = replays.filter((r) => !r.malformed);
  const integrityNonPass = usable.filter((r) => r.integrityVerdict !== 'pass').length;
  const integrityFailureRate = usable.length === 0 ? 0 : integrityNonPass / usable.length;
  const chaosRate = replays.length === 0 ? 0 : malformedCount / replays.length;

  if (chaosRate > VERDICT_THRESHOLDS.failClosedChaosRate) {
    failClosedReasons.push(
      `chaos contamination rate ${(chaosRate * 100).toFixed(1)}% exceeds ${(VERDICT_THRESHOLDS.failClosedChaosRate * 100).toFixed(0)}% ceiling`,
    );
  }
  if (integrityFailureRate > VERDICT_THRESHOLDS.failClosedIntegrityRate) {
    failClosedReasons.push(
      `integrity failure rate ${(integrityFailureRate * 100).toFixed(1)}% exceeds ${(VERDICT_THRESHOLDS.failClosedIntegrityRate * 100).toFixed(0)}% ceiling`,
    );
  }

  // Compute primitives — even on fail-closed paths so the report still carries
  // diagnostic numbers the operator can inspect.
  const timeToStart = computeTimeToStart(replays);
  const replayReuse = computeReplayReuseEfficiency(replays);
  const trustEfficiency = computeTrustEfficiencyScore(replays);
  const operationalSavings = computeOperationalSavings(replays, options.manualCostBaseline);
  const verifierEfficiency = computeVerifierEfficiency(replays, {
    windowStart: options.windowStart,
    windowEnd: options.windowEnd,
  });

  const strictFiniteCheck = options.strictFiniteCheck ?? true;
  if (strictFiniteCheck) {
    for (const m of [
      timeToStart.metric,
      replayReuse.metric,
      trustEfficiency.metric,
      operationalSavings.metric,
    ]) {
      if (!metricIsFinite(m)) {
        failClosedReasons.push('one or more metrics produced non-finite bounds');
        break;
      }
    }
  }

  // Tenant-share ambiguity.
  const tenantCounts = new Map<string, number>();
  for (const r of replays) tenantCounts.set(r.tenantId, (tenantCounts.get(r.tenantId) ?? 0) + 1);
  const dominantShare =
    replays.length === 0
      ? 0
      : Math.max(...Array.from(tenantCounts.values())) / replays.length;

  // Decide verdict.
  let verdict: EconomicVerdict;
  if (failClosedReasons.length > 0) {
    verdict = 'FAIL_CLOSED';
    reasons.push({ code: 'CHAOS_THRESHOLD_EXCEEDED', detail: failClosedReasons.join('; ') });
  } else if (replays.length < VERDICT_THRESHOLDS.probable.minReplays) {
    verdict = 'INCONCLUSIVE';
    reasons.push({
      code: 'SAMPLE_TOO_SMALL',
      detail: `n=${replays.length} below probable floor ${VERDICT_THRESHOLDS.probable.minReplays}`,
    });
  } else if (
    integrityFailureRate > VERDICT_THRESHOLDS.inconclusiveIntegrityFailureRate ||
    trustEfficiency.metric.confidence < VERDICT_THRESHOLDS.inconclusiveConfidenceFloor ||
    dominantShare > VERDICT_THRESHOLDS.inconclusiveTenantShareCeiling
  ) {
    verdict = 'INCONCLUSIVE';
    if (integrityFailureRate > VERDICT_THRESHOLDS.inconclusiveIntegrityFailureRate) {
      reasons.push({
        code: 'INTEGRITY_FAILURE_RATE_HIGH',
        detail: `integrity failure rate ${(integrityFailureRate * 100).toFixed(1)}% above ${(VERDICT_THRESHOLDS.inconclusiveIntegrityFailureRate * 100).toFixed(0)}%`,
      });
    }
    if (trustEfficiency.metric.confidence < VERDICT_THRESHOLDS.inconclusiveConfidenceFloor) {
      reasons.push({
        code: 'CONFIDENCE_BELOW_THRESHOLD',
        detail: `trust efficiency confidence ${trustEfficiency.metric.confidence.toFixed(2)} below ${VERDICT_THRESHOLDS.inconclusiveConfidenceFloor}`,
      });
    }
    if (dominantShare > VERDICT_THRESHOLDS.inconclusiveTenantShareCeiling) {
      reasons.push({
        code: 'TENANT_AMBIGUITY',
        detail: `single tenant accounts for ${(dominantShare * 100).toFixed(1)}% of replays`,
      });
    }
  } else if (
    replays.length >= VERDICT_THRESHOLDS.proven.minReplays &&
    integrityFailureRate <= VERDICT_THRESHOLDS.proven.maxIntegrityFailureRate &&
    malformedCount === 0 &&
    trustEfficiency.metric.confidence >= VERDICT_THRESHOLDS.proven.minConfidence &&
    operationalSavings.metric.confidence >= VERDICT_THRESHOLDS.provenSavingsConfidenceFloor &&
    operationalSavings.metric.basis === 'derived'
  ) {
    verdict = 'PROVEN';
    reasons.push({ code: 'OK', detail: 'all PROVEN preconditions satisfied' });
  } else {
    verdict = 'PROBABLE';
    reasons.push({
      code: 'OK',
      detail: `n=${replays.length}, integrity ok=${(1 - integrityFailureRate).toFixed(2)}, confidence=${trustEfficiency.metric.confidence.toFixed(2)}`,
    });
  }

  const trendDatapoint: LongitudinalDatapoint = {
    windowStart: options.windowStart,
    windowEnd: options.windowEnd,
    verdict,
    trustEfficiencyPoint: trustEfficiency.metric.point,
    replayReuseEfficiencyPoint: replayReuse.metric.point,
    operationalSavingsLowUsd: operationalSavings.metric.low,
    operationalSavingsHighUsd: operationalSavings.metric.high,
    sampleSize: replays.length,
  };
  const trend = [...(options.priorTrend ?? []), trendDatapoint];

  return {
    verdict,
    reasons,
    generatedAt,
    windowStart: options.windowStart,
    windowEnd: options.windowEnd,
    totalReplays: replays.length,
    tenantCount: tenantCounts.size,
    timeToStartMs: timeToStart.metric,
    replayReuseEfficiency: replayReuse.metric,
    trustEfficiencyScore: trustEfficiency.metric,
    operationalSavingsUsd: operationalSavings.metric,
    verifierEfficiency,
    trend,
    failClosedReasons,
    inputDigest,
  };
}

function failClosedReport(args: {
  reason: VerdictReason;
  windowStart: Date;
  windowEnd: Date;
  generatedAt: Date;
  inputDigest: string;
  totalReplays: number;
  tenantCount: number;
  priorTrend?: readonly LongitudinalDatapoint[];
}): EconomicTrustReport {
  const failedMetric: AmbiguousMetric = {
    point: 0,
    low: 0,
    high: 0,
    confidence: 0,
    basis: 'unknown',
    sampleSize: 0,
  };
  const trendDatapoint: LongitudinalDatapoint = {
    windowStart: args.windowStart,
    windowEnd: args.windowEnd,
    verdict: 'FAIL_CLOSED',
    trustEfficiencyPoint: 0,
    replayReuseEfficiencyPoint: 0,
    operationalSavingsLowUsd: 0,
    operationalSavingsHighUsd: 0,
    sampleSize: 0,
  };
  return {
    verdict: 'FAIL_CLOSED',
    reasons: [args.reason],
    generatedAt: args.generatedAt,
    windowStart: args.windowStart,
    windowEnd: args.windowEnd,
    totalReplays: args.totalReplays,
    tenantCount: args.tenantCount,
    timeToStartMs: { ...failedMetric, unit: 'ms' },
    replayReuseEfficiency: { ...failedMetric, unit: 'ratio' },
    trustEfficiencyScore: { ...failedMetric, unit: 'score' },
    operationalSavingsUsd: { ...failedMetric, unit: 'usd' },
    verifierEfficiency: [],
    trend: [...(args.priorTrend ?? []), trendDatapoint],
    failClosedReasons: [args.reason.detail],
    inputDigest: args.inputDigest,
  };
}

function metricIsFinite(m: AmbiguousMetric): boolean {
  return (
    Number.isFinite(m.point) &&
    Number.isFinite(m.low) &&
    Number.isFinite(m.high) &&
    Number.isFinite(m.confidence) &&
    Number.isFinite(m.sampleSize)
  );
}

function countTenants(replays: readonly ReplayEvidence[]): number {
  const ids = new Set<string>();
  for (const r of replays) ids.add(r.tenantId);
  return ids.size;
}

function digestInput(
  replays: readonly ReplayEvidence[],
  options: EconomicMetricsEngineOptions,
): string {
  const hash = createHash('sha256');
  hash.update(`window:${options.windowStart.toISOString()}-${options.windowEnd.toISOString()}|`);
  hash.update(`methodology:${ECONOMIC_METRICS_METHODOLOGY_VERSION}|`);
  for (const r of replays) {
    hash.update(
      [
        r.replayId,
        r.tenantId,
        r.verifierType,
        r.verifierId,
        r.evidenceVerifiedAt.toISOString(),
        r.decisionEmittedAt.toISOString(),
        r.replayCompletedAt.toISOString(),
        String(r.replayDurationMs),
        String(r.evidenceArtifactCount),
        String(r.reusedArtifactCount),
        String(r.authorityChainDepth),
        r.integrityVerdict,
        r.decisionOutcome,
        r.malformed ? '1' : '0',
      ].join('|') + '\n',
    );
  }
  return hash.digest('hex');
}
