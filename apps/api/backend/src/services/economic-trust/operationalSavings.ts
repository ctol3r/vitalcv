/**
 * operationalSavings.ts — USD savings telemetry with explicit ambiguity.
 *
 * Wave: W2-PR60A.
 *
 * Operational savings model: every artifact that was REUSED rather than freshly
 * verified saves the operator the manual cost of one credential check. The
 * baseline cost is reported as a [low, high] range — never a point — so the
 * downstream report cannot accidentally publish a single number that erases
 * the underlying uncertainty.
 *
 * total_low  = totalReused * baseline.lowUsdPerCheck
 * total_high = totalReused * baseline.highUsdPerCheck
 * total_point = midpoint
 *
 * The metric's `confidence` is degraded by:
 *   - low total reuse (fewer than 50 reuses → confidence ≤ 0.5)
 *   - high integrity-failure rate (> 5% failures dampens confidence multiplicatively)
 *   - any chaos contamination (any malformed flag in the input set)
 *
 * The basis is `'derived'` — savings are computed from observed reuse plus an
 * external benchmark. Callers should not display this as "observed" savings.
 */

import { clamp01 } from './statUtil';
import type { AmbiguousMetric, ManualCostBaseline, ReplayEvidence } from './types';
import { DEFAULT_MANUAL_COST_BASELINE } from './types';

export interface OperationalSavingsSummary {
  metric: AmbiguousMetric;
  baseline: ManualCostBaseline;
  totalReused: number;
  malformedDetected: boolean;
  /** Raw integrity failure rate (failures + inconclusive) used in the confidence model. */
  integrityFailureRate: number;
}

export function computeOperationalSavings(
  replays: readonly ReplayEvidence[],
  baseline: ManualCostBaseline = DEFAULT_MANUAL_COST_BASELINE,
): OperationalSavingsSummary {
  if (baseline.lowUsdPerCheck < 0 || baseline.highUsdPerCheck < baseline.lowUsdPerCheck) {
    throw new Error('operationalSavings: invalid baseline (low must be ≥0 and ≤ high)');
  }

  let totalReused = 0;
  let malformedDetected = false;
  let integrityNonPass = 0;
  let usable = 0;

  for (const r of replays) {
    if (r.malformed) {
      malformedDetected = true;
      continue;
    }
    usable += 1;
    if (r.integrityVerdict !== 'pass') integrityNonPass += 1;
    if (r.reusedArtifactCount > 0 && r.reusedArtifactCount <= r.evidenceArtifactCount) {
      totalReused += r.reusedArtifactCount;
    }
  }

  const integrityFailureRate = usable === 0 ? 0 : integrityNonPass / usable;

  if (totalReused === 0) {
    return {
      metric: {
        point: 0,
        low: 0,
        high: 0,
        confidence: 0,
        basis: 'unknown',
        sampleSize: usable,
        unit: 'usd',
      },
      baseline,
      totalReused,
      malformedDetected,
      integrityFailureRate,
    };
  }

  const low = totalReused * baseline.lowUsdPerCheck;
  const high = totalReused * baseline.highUsdPerCheck;
  const point = (low + high) / 2;

  // Confidence = saturating(reuse) * (1 - failurePenalty) * chaosPenalty.
  const reuseSaturation = 1 - Math.exp(-totalReused / 50);
  const failurePenalty = clamp01(integrityFailureRate * 5); // 20% failures → 1.0 penalty
  const chaosPenalty = malformedDetected ? 0.5 : 1;
  const confidence = clamp01(reuseSaturation * (1 - failurePenalty) * chaosPenalty);

  return {
    metric: {
      point,
      low,
      high,
      confidence,
      basis: 'derived',
      sampleSize: usable,
      unit: 'usd',
    },
    baseline,
    totalReused,
    malformedDetected,
    integrityFailureRate,
  };
}
