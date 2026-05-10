/**
 * replayReuse.ts — Replay reuse efficiency.
 *
 * Wave: W2-PR60A.
 *
 * Replay reuse efficiency = sum(reusedArtifactCount) / sum(evidenceArtifactCount),
 * computed across the window. A higher value means more decisions piggy-backed
 * on already-verified evidence rather than triggering fresh upstream calls —
 * i.e. the audit replay surface is doing economic work, not just compliance work.
 *
 * Reported as a per-replay distribution (bootstrap on per-replay ratios) so
 * uncertainty reflects between-replay variance, not just aggregate fraction
 * volatility. The distinction matters when a single high-volume replay
 * dominates the totals — the per-replay view exposes that.
 *
 * `reusedArtifactCount > evidenceArtifactCount` is treated as malformed
 * because reuse cannot exceed the artifact count in any consistent replay.
 * Such records are excluded and counted via `inconsistentReplays`.
 */

import { buildMetric } from './statUtil';
import type { AmbiguousMetric, ReplayEvidence } from './types';

export interface ReplayReuseSummary {
  metric: AmbiguousMetric;
  totalArtifacts: number;
  totalReused: number;
  inconsistentReplays: number;
  /** Aggregate ratio (sum reuse / sum total). Always present alongside the bootstrap mean. */
  aggregateRatio: number;
}

export function computeReplayReuseEfficiency(
  replays: readonly ReplayEvidence[],
): ReplayReuseSummary {
  if (replays.length === 0) {
    return {
      metric: {
        point: 0,
        low: 0,
        high: 0,
        confidence: 0,
        basis: 'unknown',
        sampleSize: 0,
        unit: 'ratio',
      },
      totalArtifacts: 0,
      totalReused: 0,
      inconsistentReplays: 0,
      aggregateRatio: 0,
    };
  }

  let totalArtifacts = 0;
  let totalReused = 0;
  let inconsistentReplays = 0;
  const ratios: number[] = [];

  for (const r of replays) {
    if (r.malformed) continue;
    if (
      !Number.isFinite(r.evidenceArtifactCount) ||
      !Number.isFinite(r.reusedArtifactCount) ||
      r.evidenceArtifactCount < 0 ||
      r.reusedArtifactCount < 0
    ) {
      inconsistentReplays += 1;
      continue;
    }
    if (r.reusedArtifactCount > r.evidenceArtifactCount) {
      inconsistentReplays += 1;
      continue;
    }
    if (r.evidenceArtifactCount === 0) {
      // Replay touched zero artifacts — uninformative for reuse.
      continue;
    }
    totalArtifacts += r.evidenceArtifactCount;
    totalReused += r.reusedArtifactCount;
    ratios.push(r.reusedArtifactCount / r.evidenceArtifactCount);
  }

  const aggregateRatio = totalArtifacts === 0 ? 0 : totalReused / totalArtifacts;

  if (ratios.length === 0) {
    return {
      metric: {
        point: aggregateRatio,
        low: 0,
        high: 0,
        confidence: 0,
        basis: 'unknown',
        sampleSize: 0,
        unit: 'ratio',
      },
      totalArtifacts,
      totalReused,
      inconsistentReplays,
      aggregateRatio,
    };
  }

  const metric = buildMetric(ratios, { unit: 'ratio', seed: 0xb1ade, sampleSizeScale: 50 });
  return { metric, totalArtifacts, totalReused, inconsistentReplays, aggregateRatio };
}
