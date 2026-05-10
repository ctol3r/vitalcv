/**
 * trustEfficiency.ts — Composite trust-efficiency score (0..100).
 *
 * Wave: W2-PR60A.
 *
 * The score combines three observable signals from each replay:
 *
 *   integrityRate         (0..1) — fraction of replays whose integrity verdict is 'pass'.
 *                                  Inconclusive verdicts count as 0.5 (half-credit), failures as 0.
 *   reusePerCheck         (0..1) — capped reuse efficiency; floor on the per-replay distribution.
 *   chainDepthEfficiency  (0..1) — 1 / (1 + max(0, depth − ideal)). Penalises chain bloat.
 *                                  We do NOT reward "deep" chains: depth past the calibration
 *                                  point is friction, not strength.
 *
 * Composite weights (sum 1.0):
 *
 *   integrityRate          0.55
 *   reusePerCheck          0.25
 *   chainDepthEfficiency   0.20
 *
 * Integrity dominates intentionally — a replay surface that produces fast,
 * cheap, untrustworthy answers is worse than one that produces slower,
 * verified answers. This keeps the metric honest under failure modes that
 * trade integrity for speed.
 *
 * Calibration is held in `TRUST_EFFICIENCY_WEIGHTS` so the CI gate can pin
 * exact bounds — never reweight without bumping the methodology version.
 */

import { buildMetric, clamp01 } from './statUtil';
import type { AmbiguousMetric, ReplayEvidence } from './types';

export const TRUST_EFFICIENCY_METHODOLOGY_VERSION = '1.0';
export const TRUST_EFFICIENCY_WEIGHTS = {
  integrity: 0.55,
  reuse: 0.25,
  chainDepth: 0.2,
} as const;
export const TRUST_EFFICIENCY_IDEAL_CHAIN_DEPTH = 5; // 5-node chain, see replayEngine.

export interface TrustEfficiencySummary {
  metric: AmbiguousMetric;
  components: {
    integrityRate: number;
    reusePerCheck: number;
    chainDepthEfficiency: number;
  };
  methodologyVersion: string;
}

function integrityValue(verdict: ReplayEvidence['integrityVerdict']): number {
  if (verdict === 'pass') return 1;
  if (verdict === 'inconclusive') return 0.5;
  return 0;
}

export function computeTrustEfficiencyScore(
  replays: readonly ReplayEvidence[],
): TrustEfficiencySummary {
  const usable = replays.filter((r) => !r.malformed);
  if (usable.length === 0) {
    return {
      metric: {
        point: 0,
        low: 0,
        high: 0,
        confidence: 0,
        basis: 'unknown',
        sampleSize: 0,
        unit: 'score',
      },
      components: { integrityRate: 0, reusePerCheck: 0, chainDepthEfficiency: 0 },
      methodologyVersion: TRUST_EFFICIENCY_METHODOLOGY_VERSION,
    };
  }

  // Per-replay composite score in 0..100 — bootstrap mean across these.
  const scores: number[] = [];
  let integritySum = 0;
  let reuseSum = 0;
  let chainEffSum = 0;

  for (const r of usable) {
    // Inconsistent reuse (reused > artifacts) is treated as a structural defect
    // — it earns ZERO reuse credit AND zeroes integrity. Otherwise an inflated
    // record would silently saturate the reuse component to 1.0 and raise the
    // composite, which is the exact failure mode the chaos harness probes.
    const inconsistent =
      r.reusedArtifactCount > r.evidenceArtifactCount ||
      r.reusedArtifactCount < 0 ||
      r.evidenceArtifactCount < 0;
    const integrity = inconsistent ? 0 : integrityValue(r.integrityVerdict);
    const reuse =
      inconsistent || r.evidenceArtifactCount === 0
        ? 0
        : clamp01(r.reusedArtifactCount / r.evidenceArtifactCount);
    const overshoot = Math.max(0, r.authorityChainDepth - TRUST_EFFICIENCY_IDEAL_CHAIN_DEPTH);
    const chainEfficiency = 1 / (1 + overshoot);
    integritySum += integrity;
    reuseSum += reuse;
    chainEffSum += chainEfficiency;

    const composite =
      TRUST_EFFICIENCY_WEIGHTS.integrity * integrity +
      TRUST_EFFICIENCY_WEIGHTS.reuse * reuse +
      TRUST_EFFICIENCY_WEIGHTS.chainDepth * chainEfficiency;

    scores.push(clamp01(composite) * 100);
  }

  const metric = buildMetric(scores, {
    unit: 'score',
    seed: 0xc0de1,
    sampleSizeScale: 60,
  });

  return {
    metric,
    components: {
      integrityRate: integritySum / usable.length,
      reusePerCheck: reuseSum / usable.length,
      chainDepthEfficiency: chainEffSum / usable.length,
    },
    methodologyVersion: TRUST_EFFICIENCY_METHODOLOGY_VERSION,
  };
}
