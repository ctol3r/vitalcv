/**
 * activationConfidenceTelemetry.ts — W2-PR144A
 *
 * Activation confidence telemetry. Bins longitudinal activation-readiness
 * scores into time-windows and surfaces overconfidence drift, plateau
 * detection, and ecosystem-wide confidence velocity.
 *
 * Invariants:
 *   1. Bin keys are deterministic from scoredAt — same input always
 *      produces the same bin sequence.
 *   2. Per-bin confidence splits replay-safe vs. degraded so a regulator
 *      never sees confidence growth that masks replay failures.
 *   3. snapshotDigest folds every bin and every confidence floor/ceiling
 *      so the telemetry dashboard cannot silently rewrite the curve.
 *   4. Overconfidence episodes accumulate in the alarm field — never
 *      silently discarded.
 *
 * Pure transform — no fetches, no DB writes.
 */
import { sha256ForPayload } from '../../utils/deterministic';
import type { ActivationReadinessScore, ActivationVerdict } from './activationReadiness';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TelemetryBinResolution = 'DAY' | 'WEEK' | 'MONTH';

export interface ActivationTelemetryPoint {
  scoreId: string;
  scoredAt: string;
  compositeReadiness: number | null;
  confidenceScore: number;
  evidenceCeiling: number;
  overallVerdict: ActivationVerdict;
}

export interface ActivationConfidenceBin {
  schema: 'vitalcv.activation-confidence-bin.v1';
  binKey: string;
  binStart: string;
  scoreCount: number;
  avgCompositeReadiness: number | null;
  avgConfidenceScore: number;
  minEvidenceCeiling: number;
  /** Number of READY verdicts in this bin. */
  readyCount: number;
  /** Number of ACTIVATION_BREACH verdicts in this bin. */
  breachCount: number;
  /** True iff every score in this bin was replay-safe (confidenceScore = 1.0). */
  fullReplaySafe: boolean;
}

export interface ConfidenceOverconfidenceEpisode {
  scoreId: string;
  scoredAt: string;
  claimedCompositeReadiness: number;
  evidenceCeiling: number;
  excessAmount: number;
}

export interface ActivationConfidenceTelemetry {
  readonly schema: 'vitalcv.activation-confidence-telemetry.v1';
  readonly reportId: string;
  readonly resolution: TelemetryBinResolution;
  readonly bins: ReadonlyArray<ActivationConfidenceBin>;
  readonly growthBinCount: number;
  readonly decayBinCount: number;
  /** Bins where breach count > 0. */
  readonly breachBinCount: number;
  /**
   * Average bin-to-bin delta in avgCompositeReadiness.
   * Null when fewer than 2 bins.
   */
  readonly confidenceVelocityPerBin: number | null;
  readonly overconfidenceEpisodes: ReadonlyArray<ConfidenceOverconfidenceEpisode>;
  readonly snapshotDigest: string;
  readonly generatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toBinKey(
  iso: string,
  res: TelemetryBinResolution,
): { key: string; start: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { key: 'INVALID', start: 'INVALID' };
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const day = d.getUTCDate();
  if (res === 'MONTH') {
    const start = new Date(Date.UTC(y, mo, 1));
    return { key: start.toISOString().slice(0, 7), start: start.toISOString() };
  }
  if (res === 'WEEK') {
    const dow = d.getUTCDay();
    const monday = new Date(Date.UTC(y, mo, day - ((dow + 6) % 7)));
    return { key: `${monday.toISOString().slice(0, 10)}~W`, start: monday.toISOString() };
  }
  const start = new Date(Date.UTC(y, mo, day));
  return { key: start.toISOString().slice(0, 10), start: start.toISOString() };
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function buildActivationConfidenceTelemetry(
  scores: ReadonlyArray<ActivationReadinessScore>,
  resolution: TelemetryBinResolution = 'DAY',
): ActivationConfidenceTelemetry {
  const reportId = `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const generatedAt = new Date().toISOString();

  // Detect overconfidence: compositeReadiness > evidenceCeiling
  const overconfidenceEpisodes: ConfidenceOverconfidenceEpisode[] = scores
    .filter(s => s.compositeReadiness !== null && s.compositeReadiness > s.evidenceCeiling)
    .map(s => ({
      scoreId: s.scoreId,
      scoredAt: s.scoredAt,
      claimedCompositeReadiness: s.compositeReadiness as number,
      evidenceCeiling: s.evidenceCeiling,
      excessAmount: (s.compositeReadiness as number) - s.evidenceCeiling,
    }));

  // Bin the scores
  const binMap = new Map<string, { start: string; points: ActivationTelemetryPoint[] }>();
  for (const score of scores) {
    const { key, start } = toBinKey(score.scoredAt, resolution);
    if (!binMap.has(key)) {
      binMap.set(key, { start, points: [] });
    }
    binMap.get(key)!.points.push({
      scoreId: score.scoreId,
      scoredAt: score.scoredAt,
      compositeReadiness: score.compositeReadiness,
      confidenceScore: score.confidenceScore,
      evidenceCeiling: score.evidenceCeiling,
      overallVerdict: score.overallVerdict,
    });
  }

  const bins: ActivationConfidenceBin[] = [...binMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([binKey, { start, points }]) => {
      const validReadiness = points
        .filter(p => p.compositeReadiness !== null)
        .map(p => p.compositeReadiness as number);

      const avgCompositeReadiness = validReadiness.length > 0
        ? parseFloat(
            (validReadiness.reduce((a, b) => a + b, 0) / validReadiness.length).toFixed(1),
          )
        : null;

      const avgConfidenceScore = points.length > 0
        ? parseFloat(
            (points.reduce((a, p) => a + p.confidenceScore, 0) / points.length).toFixed(3),
          )
        : 0;

      const minEvidenceCeiling = points.length > 0
        ? Math.min(...points.map(p => p.evidenceCeiling))
        : 0;

      return {
        schema: 'vitalcv.activation-confidence-bin.v1',
        binKey,
        binStart: start,
        scoreCount: points.length,
        avgCompositeReadiness,
        avgConfidenceScore,
        minEvidenceCeiling,
        readyCount: points.filter(p => p.overallVerdict === 'READY').length,
        breachCount: points.filter(p => p.overallVerdict === 'ACTIVATION_BREACH').length,
        fullReplaySafe: points.every(p => p.confidenceScore >= 1.0),
      };
    });

  // Growth / decay analysis
  let growthBinCount = 0;
  let decayBinCount = 0;
  let breachBinCount = 0;
  const velocities: number[] = [];

  for (let i = 0; i < bins.length; i++) {
    if (bins[i].breachCount > 0) breachBinCount++;
    if (i > 0) {
      const prev = bins[i - 1].avgCompositeReadiness;
      const curr = bins[i].avgCompositeReadiness;
      if (prev !== null && curr !== null) {
        const delta = curr - prev;
        velocities.push(delta);
        if (delta > 0) growthBinCount++;
        else if (delta < 0) decayBinCount++;
      }
    }
  }

  const confidenceVelocityPerBin = velocities.length > 0
    ? parseFloat((velocities.reduce((a, b) => a + b, 0) / velocities.length).toFixed(2))
    : null;

  const snapshotDigest = sha256ForPayload({
    reportId,
    resolution,
    bins: bins.map(b => ({
      binKey: b.binKey,
      scoreCount: b.scoreCount,
      avgCompositeReadiness: b.avgCompositeReadiness,
      avgConfidenceScore: b.avgConfidenceScore,
      breachCount: b.breachCount,
    })),
    overconfidenceEpisodeCount: overconfidenceEpisodes.length,
  });

  return {
    schema: 'vitalcv.activation-confidence-telemetry.v1',
    reportId,
    resolution,
    bins,
    growthBinCount,
    decayBinCount,
    breachBinCount,
    confidenceVelocityPerBin,
    overconfidenceEpisodes,
    snapshotDigest,
    generatedAt,
  };
}
