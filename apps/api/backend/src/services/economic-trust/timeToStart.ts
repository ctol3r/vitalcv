/**
 * timeToStart.ts — Onboarding-savings primitive.
 *
 * Wave: W2-PR60A.
 *
 * Time-to-start = decisionEmittedAt − evidenceVerifiedAt, in milliseconds.
 *
 * It is the most direct measure of onboarding savings: every replay that
 * reuses already-verified evidence shaves a fresh-verification cycle off the
 * start window. The metric reports as an AmbiguousMetric so dashboards never
 * see a point estimate without the bootstrap interval that frames it.
 *
 * Negative deltas (decision emitted before evidence verifiedAt) are clamped to
 * zero and tagged via the `negativeDeltaCount` warning. They occur when the
 * upstream replay engine has stamped evidenceVerifiedAt with a backfilled
 * timestamp, and we treat them as "no observable savings" rather than
 * inventing negative latency.
 */

import { buildMetric } from './statUtil';
import type { AmbiguousMetric, ReplayEvidence } from './types';

export interface TimeToStartSummary {
  metric: AmbiguousMetric;
  /** Number of replays whose decision time preceded their evidence-verified time. */
  negativeDeltaCount: number;
  /** P50 latency in ms (median, distinct from mean point estimate). */
  p50Ms: number;
  /** P90 latency in ms. */
  p90Ms: number;
}

export function computeTimeToStart(replays: readonly ReplayEvidence[]): TimeToStartSummary {
  if (replays.length === 0) {
    return {
      metric: {
        point: 0,
        low: 0,
        high: 0,
        confidence: 0,
        basis: 'unknown',
        sampleSize: 0,
        unit: 'ms',
      },
      negativeDeltaCount: 0,
      p50Ms: 0,
      p90Ms: 0,
    };
  }

  const deltas: number[] = [];
  let negativeDeltaCount = 0;
  for (const r of replays) {
    if (r.malformed) continue;
    const delta = r.decisionEmittedAt.getTime() - r.evidenceVerifiedAt.getTime();
    if (delta < 0) {
      negativeDeltaCount += 1;
      deltas.push(0);
    } else {
      deltas.push(delta);
    }
  }

  if (deltas.length === 0) {
    // Every replay was malformed — fail silently with a sample-of-zero metric.
    return {
      metric: {
        point: 0,
        low: 0,
        high: 0,
        confidence: 0,
        basis: 'unknown',
        sampleSize: 0,
        unit: 'ms',
      },
      negativeDeltaCount,
      p50Ms: 0,
      p90Ms: 0,
    };
  }

  const sorted = [...deltas].sort((a, b) => a - b);
  const p50Ms = sorted[Math.floor(sorted.length * 0.5)];
  const p90Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))];
  const metric = buildMetric(deltas, { unit: 'ms', seed: 0xa17a1, sampleSizeScale: 75 });

  return { metric, negativeDeltaCount, p50Ms, p90Ms };
}
