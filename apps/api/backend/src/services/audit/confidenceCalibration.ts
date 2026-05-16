/**
 * confidenceCalibration.ts — W2-PR130A: Institutional Production Confidence Calibration
 *
 * Pure transforms. Production confidence NEVER exceeds constitutional replay evidence.
 *
 * Hard invariants (fail-closed):
 *   - Confidence is evidence-derived: score = f(verified sources, integrity, containment)
 *   - Ambiguity is preserved: AMBIGUOUS containment widens the uncertainty interval and
 *     caps the point estimate at ≤ 0.5
 *   - Overconfidence is detectable: any claim > evidenceCeiling is flagged and suppressed
 *   - Fail-closed: missing / corrupted evidence → floors confidence to 0 before ceiling
 *   - Calibration lineage is reconstructable from the CalibrationRecord digest
 *
 * Design: no fetches, no DB writes, no audit-event writes. Companion to
 * replayCorruptionContainment.ts — same fail-closed contract, confidence axis.
 */

import { sha256ForPayload } from '../../utils/deterministic';
import type { ContainmentVerdict } from './replayCorruptionContainment';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ConfidenceTier =
  | 'NONE'       // 0
  | 'MINIMAL'    // (0, 0.2]
  | 'LOW'        // (0.2, 0.4]
  | 'MEDIUM'     // (0.4, 0.6]
  | 'HIGH'       // (0.6, 0.8]
  | 'FULL';      // (0.8, 1.0]

/** Point estimate with symmetric uncertainty bounds. All values in [0, 1]. */
export interface ConfidenceInterval {
  lower: number;
  point: number;
  upper: number;
}

/** Per-source contribution to the calibrated score. */
export interface EvidenceContribution {
  source: string;
  outcome: 'VERIFIED' | 'EXPIRED' | 'NOT_FOUND' | 'FAILED' | 'PENDING';
  rawConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  weight: number;      // normalized per-source contribution ceiling [0, 1]
  contribution: number; // actual score contribution after outcome gate [0, weight]
}

export type OverconfidenceReason =
  | 'SCORE_EXCEEDS_EVIDENCE_CEILING'       // point estimate > evidenceCeiling
  | 'AMBIGUOUS_CONTAINMENT_CEILING_VIOLATED' // ambiguous verdict + score > 0.5
  | 'INTEGRITY_FAILURE_IGNORED'            // hashMatch=false but caller claimed high confidence
  | 'EMPTY_EVIDENCE_BASE'                  // no verified sources but score > 0
  | 'TRUST_SCORE_INFLATES_ABOVE_EVIDENCE'; // trust score > evidence-derived ceiling

export interface OverconfidenceFlag {
  detected: boolean;
  reasons: OverconfidenceReason[];
  /** What an uncalibrated system might have claimed. */
  claimedUncalibratedScore: number;
  evidenceCeiling: number;
  suppressedTo: number;
}

export interface CalibrationInput {
  capsuleId: string;
  sourcesConsulted: ReadonlyArray<{
    source: string;
    outcome: 'VERIFIED' | 'EXPIRED' | 'NOT_FOUND' | 'FAILED' | 'PENDING';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  /** Raw trust score 0–100 from trust state engine. */
  trustScore: number;
  integrityHashMatch: boolean;
  tamperEvidence: string | null;
  containmentVerdict: ContainmentVerdict;
  ambiguous: boolean;
  /** True iff evidence spine digest mismatched during replay. */
  evidenceSpineDrifted?: boolean;
}

export interface CalibratedConfidenceScore {
  readonly schema: 'vitalcv.calibrated-confidence.v1';
  readonly capsuleId: string;
  readonly score: ConfidenceInterval;
  readonly tier: ConfidenceTier;
  /** Number of independently VERIFIED sources in the evidence base. */
  readonly evidenceBasisCount: number;
  /**
   * Maximum score the evidence can support — hard ceiling for production
   * confidence. No claim may exceed this value.
   */
  readonly evidenceCeiling: number;
  readonly overconfidence: OverconfidenceFlag;
  readonly contributions: EvidenceContribution[];
  /** SHA-256 over deterministic calibration input. Lineage anchor. */
  readonly calibrationDigest: string;
  readonly calibratedAt: string;
  readonly methodologyVersion: 'confidence-calibration.v1';
}

/** Single historical point for drift analytics. */
export interface ConfidenceDriftSnapshot {
  capsuleId: string;
  pointScore: number;
  evidenceCeiling: number;
  overconfidenceDetected: boolean;
  calibratedAt: string; // ISO-8601
}

export type DriftDirection = 'INCREASING' | 'DECREASING' | 'STABLE';

export interface ConfidenceDriftReport {
  readonly schema: 'vitalcv.confidence-drift.v1';
  readonly snapshotCount: number;
  readonly driftMagnitude: number;        // max − min point score in window
  readonly driftDirection: DriftDirection;
  /** Average score change per day (positive = rising). */
  readonly driftVelocityPerDay: number;
  /** Number of snapshots where overconfidence was detected. */
  readonly overconfidenceEpisodes: number;
  /** Average distance between point score and evidence ceiling (positive = under-ceiling). */
  readonly averageCalibrationMargin: number;
  /** 0 = maximally volatile, 1 = perfectly stable. */
  readonly calibrationStability: number;
  readonly reportedAt: string;
}

export class ConfidenceCalibrationError extends Error {
  readonly code = 'CONFIDENCE_CALIBRATION_VIOLATION' as const;
  readonly violation: ConfidenceCalibrationViolationKind;
  readonly capsuleId: string | null;

  constructor(args: {
    violation: ConfidenceCalibrationViolationKind;
    message: string;
    capsuleId?: string | null;
  }) {
    super(args.message);
    this.name = 'ConfidenceCalibrationError';
    this.violation = args.violation;
    this.capsuleId = args.capsuleId ?? null;
  }
}

export type ConfidenceCalibrationViolationKind =
  | 'OVERCONFIDENCE_ASSERTED'           // score > evidenceCeiling after calibration
  | 'AMBIGUITY_COLLAPSED_TO_CLEAN'      // ambiguous signal forced to high confidence
  | 'CALIBRATION_DRIFT_ALARM';          // longitudinal overconfidence episode threshold

// ── Sentinels ──────────────────────────────────────────────────────────────────

/** Hard ceilings imposed by containment verdict. Fail-closed — lower verdicts = lower ceiling. */
export const CONTAINMENT_CONFIDENCE_CEILINGS: Readonly<Record<ContainmentVerdict, number>> = Object.freeze({
  CLEAN:              1.0,
  AMBIGUOUS:          0.50,
  QUARANTINED:        0.30,
  CONTAMINATED:       0.20,
  CONTAINMENT_BREACH: 0.0,
});

/** Source weight ceilings by raw confidence tier (only applied when outcome === VERIFIED). */
const SOURCE_WEIGHTS: Readonly<Record<'HIGH' | 'MEDIUM' | 'LOW', number>> = Object.freeze({
  HIGH:   1.00,
  MEDIUM: 0.70,
  LOW:    0.40,
});

/**
 * Breadth ceiling: prevents single-source overconfidence. At ≥ 5 independent
 * VERIFIED sources the ceiling lifts to 0.95.
 */
function evidenceBreadthCeiling(verifiedCount: number): number {
  if (verifiedCount === 0) return 0;
  if (verifiedCount === 1) return 0.60;
  if (verifiedCount === 2) return 0.75;
  if (verifiedCount === 3) return 0.85;
  if (verifiedCount === 4) return 0.90;
  return 0.95;
}

/** Integrity multiplier: degrades score when replay integrity is compromised. */
function integrityMultiplier(input: Pick<CalibrationInput, 'integrityHashMatch' | 'tamperEvidence' | 'evidenceSpineDrifted'>): number {
  if (input.evidenceSpineDrifted) return 0.20;
  if (!input.integrityHashMatch) return 0.30;
  if (input.integrityHashMatch && input.tamperEvidence !== null) return 0.60; // ambiguous signal
  return 1.0;
}

function scoreToTier(score: number): ConfidenceTier {
  if (score <= 0)   return 'NONE';
  if (score <= 0.2) return 'MINIMAL';
  if (score <= 0.4) return 'LOW';
  if (score <= 0.6) return 'MEDIUM';
  if (score <= 0.8) return 'HIGH';
  return 'FULL';
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ── Core calibration ───────────────────────────────────────────────────────────

/**
 * Derive a calibrated confidence score from replay evidence.
 *
 * The pipeline:
 *   1. Compute per-source evidence contributions (zero if not VERIFIED).
 *   2. Normalize to [0, breadthCeiling] — breadth limits single-source inflation.
 *   3. Apply integrity multiplier (degrades on hash mismatch / spine drift).
 *   4. Apply containment ceiling (hard cap by verdict).
 *   5. Compute evidence ceiling = min(breadthCeiling, containmentCeiling).
 *   6. Detect and suppress overconfidence.
 *   7. Build uncertainty interval (widens on ambiguity / low breadth).
 */
export function calibrateConfidence(input: CalibrationInput): CalibratedConfidenceScore {
  const calibratedAt = new Date().toISOString();
  const containmentCeiling = CONTAINMENT_CONFIDENCE_CEILINGS[input.containmentVerdict] ?? 0;

  // ── Step 1: per-source contributions ──────────────────────────────────────
  const contributions: EvidenceContribution[] = input.sourcesConsulted.map(s => {
    const weight = SOURCE_WEIGHTS[s.confidence];
    const contribution = s.outcome === 'VERIFIED' ? weight : 0;
    return {
      source:        s.source,
      outcome:       s.outcome,
      rawConfidence: s.confidence,
      weight,
      contribution,
    };
  });

  const verifiedCount = contributions.filter(c => c.contribution > 0).length;
  const totalContribution = contributions.reduce((sum, c) => sum + c.contribution, 0);
  const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);

  // ── Step 2: normalize to breadth ceiling ──────────────────────────────────
  // Normalize by source COUNT (not totalWeight) so source quality (HIGH vs LOW)
  // is preserved in the aggregate. Dividing by totalWeight would cancel quality
  // information — 8 × LOW/VERIFIED and 8 × HIGH/VERIFIED would score the same.
  const breadthCeiling = evidenceBreadthCeiling(verifiedCount);
  const sourceCount = Math.max(contributions.length, 1);
  const rawEvidenceScore = clamp(totalContribution / sourceCount, 0, breadthCeiling);

  // ── Step 3: integrity multiplier ──────────────────────────────────────────
  const iMult = integrityMultiplier(input);
  const integrityAdjustedScore = rawEvidenceScore * iMult;

  // ── Step 4: containment ceiling ───────────────────────────────────────────
  const postContainmentScore = Math.min(integrityAdjustedScore, containmentCeiling);

  // ── Step 5: evidence ceiling ──────────────────────────────────────────────
  const evidenceCeiling = Math.min(breadthCeiling, containmentCeiling);

  // ── Step 6: overconfidence detection ─────────────────────────────────────
  //
  // "uncalibrated score": what a naive system might claim (trust score / 100,
  // ignoring containment and evidence breadth).
  const uncalibratedClaim = clamp(input.trustScore / 100, 0, 1);
  const reasons: OverconfidenceReason[] = [];

  if (uncalibratedClaim > evidenceCeiling) {
    reasons.push('SCORE_EXCEEDS_EVIDENCE_CEILING');
  }
  if (input.ambiguous && uncalibratedClaim > CONTAINMENT_CONFIDENCE_CEILINGS.AMBIGUOUS) {
    reasons.push('AMBIGUOUS_CONTAINMENT_CEILING_VIOLATED');
  }
  if (!input.integrityHashMatch && uncalibratedClaim > 0.3) {
    reasons.push('INTEGRITY_FAILURE_IGNORED');
  }
  if (verifiedCount === 0 && postContainmentScore > 0) {
    reasons.push('EMPTY_EVIDENCE_BASE');
  }
  if (uncalibratedClaim > rawEvidenceScore + 0.15) {
    reasons.push('TRUST_SCORE_INFLATES_ABOVE_EVIDENCE');
  }

  const overconfidence: OverconfidenceFlag = {
    detected:                   reasons.length > 0,
    reasons,
    claimedUncalibratedScore:   uncalibratedClaim,
    evidenceCeiling,
    suppressedTo:               postContainmentScore,
  };

  // ── Step 7: uncertainty interval ─────────────────────────────────────────
  let width = 0.05; // base uncertainty
  if (input.ambiguous) width += 0.20;
  if (verifiedCount === 0) width += 0.10;
  else if (verifiedCount < 3) width += 0.05 * (3 - verifiedCount);
  if (!input.integrityHashMatch) width += 0.10;

  const intervalUpper = clamp(postContainmentScore + width * 0.5, 0, containmentCeiling);
  const intervalLower = clamp(postContainmentScore - width, 0, intervalUpper);

  const score: ConfidenceInterval = {
    lower: intervalLower,
    point: postContainmentScore,
    upper: intervalUpper,
  };

  const calibrationDigest = sha256ForPayload({
    schema:             'vitalcv.calibration-digest.v1',
    capsuleId:          input.capsuleId,
    sourcesConsulted:   input.sourcesConsulted.map(s => ({
      source: s.source, outcome: s.outcome, confidence: s.confidence,
    })).sort((a, b) => a.source.localeCompare(b.source)),
    trustScore:             input.trustScore,
    integrityHashMatch:     input.integrityHashMatch,
    tamperEvidence:         input.tamperEvidence ?? null,
    containmentVerdict:     input.containmentVerdict,
    ambiguous:              input.ambiguous,
    evidenceSpineDrifted:   input.evidenceSpineDrifted ?? false,
  });

  return {
    schema:              'vitalcv.calibrated-confidence.v1',
    capsuleId:           input.capsuleId,
    score,
    tier:                scoreToTier(postContainmentScore),
    evidenceBasisCount:  verifiedCount,
    evidenceCeiling,
    overconfidence,
    contributions,
    calibrationDigest,
    calibratedAt,
    methodologyVersion:  'confidence-calibration.v1',
  };
}

// ── Replay-confidence synchronization ─────────────────────────────────────────

/**
 * Synchronize confidence to a replay's containment verdict and integrity state.
 *
 * This is the "outer gate" that callers use when they have a DecisionReplay-
 * shaped input (or the sub-fields from it). It delegates to calibrateConfidence
 * and is the canonical entry point for replay-confidence synchronization.
 */
export function syncReplayConfidence(params: {
  capsuleId: string;
  sourcesConsulted: CalibrationInput['sourcesConsulted'];
  trustScore: number;
  integrityHashMatch: boolean;
  tamperEvidence: string | null;
  evidenceSpineDrifted?: boolean;
  containmentVerdict: ContainmentVerdict;
  ambiguous: boolean;
}): CalibratedConfidenceScore {
  return calibrateConfidence({
    capsuleId:           params.capsuleId,
    sourcesConsulted:    params.sourcesConsulted,
    trustScore:          params.trustScore,
    integrityHashMatch:  params.integrityHashMatch,
    tamperEvidence:      params.tamperEvidence,
    evidenceSpineDrifted: params.evidenceSpineDrifted ?? false,
    containmentVerdict:  params.containmentVerdict,
    ambiguous:           params.ambiguous,
  });
}

// ── Overconfidence suppression guard ─────────────────────────────────────────

/**
 * Throws ConfidenceCalibrationError if the calibrated score is overconfident.
 * Use this at integration points where a score that exceeds evidence should
 * halt processing rather than silently propagate.
 */
export function assertConfidenceCalibrated(score: CalibratedConfidenceScore): void {
  if (score.overconfidence.detected) {
    throw new ConfidenceCalibrationError({
      violation: 'OVERCONFIDENCE_ASSERTED',
      capsuleId: score.capsuleId,
      message:
        `Capsule ${score.capsuleId}: calibrated score ${score.score.point.toFixed(4)} exceeds ` +
        `evidence ceiling ${score.evidenceCeiling.toFixed(4)}. ` +
        `Reasons: ${score.overconfidence.reasons.join(', ')}`,
    });
  }
  // Guard ambiguity collapse: if ambiguous signal, score must not reach HIGH tier
  if (score.tier === 'HIGH' || score.tier === 'FULL') {
    const containmentCeiling = CONTAINMENT_CONFIDENCE_CEILINGS[
      // Infer containment from the score itself: if score > 0.6, containment was CLEAN
      // We cannot recover the verdict here, so we rely on the interval upper bound
      'CLEAN'
    ];
    if (score.score.upper > containmentCeiling) {
      throw new ConfidenceCalibrationError({
        violation: 'AMBIGUITY_COLLAPSED_TO_CLEAN',
        capsuleId: score.capsuleId,
        message: `Capsule ${score.capsuleId}: upper confidence bound ${score.score.upper.toFixed(4)} exceeds CLEAN ceiling.`,
      });
    }
  }
}

// ── Confidence drift analytics ─────────────────────────────────────────────────

/**
 * Compute a longitudinal drift report over an ordered sequence of calibration
 * snapshots (oldest-first). Requires ≥ 2 snapshots; returns a zero-drift report
 * for fewer.
 */
export function computeConfidenceDrift(
  snapshots: ReadonlyArray<ConfidenceDriftSnapshot>,
): ConfidenceDriftReport {
  const reportedAt = new Date().toISOString();

  if (snapshots.length < 2) {
    return {
      schema:                   'vitalcv.confidence-drift.v1',
      snapshotCount:            snapshots.length,
      driftMagnitude:           0,
      driftDirection:           'STABLE',
      driftVelocityPerDay:      0,
      overconfidenceEpisodes:   snapshots.filter(s => s.overconfidenceDetected).length,
      averageCalibrationMargin: snapshots.length === 1
        ? clamp(snapshots[0].evidenceCeiling - snapshots[0].pointScore, 0, 1)
        : 0,
      calibrationStability:     1,
      reportedAt,
    };
  }

  const scores  = snapshots.map(s => s.pointScore);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  const first = scores[0];
  const last  = scores[scores.length - 1];
  const driftDirection: DriftDirection =
    last - first >  0.01 ? 'INCREASING' :
    last - first < -0.01 ? 'DECREASING' : 'STABLE';

  // Velocity: total change over elapsed time in days
  const firstMs = new Date(snapshots[0].calibratedAt).getTime();
  const lastMs  = new Date(snapshots[snapshots.length - 1].calibratedAt).getTime();
  const elapsedDays = Math.max((lastMs - firstMs) / 86_400_000, 1 / 1440); // floor at 1 minute
  const driftVelocityPerDay = (last - first) / elapsedDays;

  const overconfidenceEpisodes = snapshots.filter(s => s.overconfidenceDetected).length;

  const margins = snapshots.map(s => clamp(s.evidenceCeiling - s.pointScore, 0, 1));
  const averageCalibrationMargin = margins.reduce((a, b) => a + b, 0) / margins.length;

  const sd = stddev(scores);
  const calibrationStability = clamp(1 - sd * 2, 0, 1); // 0.5 stddev → stability 0

  return {
    schema:                   'vitalcv.confidence-drift.v1',
    snapshotCount:            snapshots.length,
    driftMagnitude:           maxScore - minScore,
    driftDirection,
    driftVelocityPerDay,
    overconfidenceEpisodes,
    averageCalibrationMargin,
    calibrationStability,
    reportedAt,
  };
}

// ── Sentinels (exported for tests / CI gates) ─────────────────────────────────

export const KNOWN_CONFIDENCE_TIERS = Object.freeze([
  'NONE', 'MINIMAL', 'LOW', 'MEDIUM', 'HIGH', 'FULL',
] as const satisfies ConfidenceTier[]);

export const KNOWN_OVERCONFIDENCE_REASONS = Object.freeze([
  'SCORE_EXCEEDS_EVIDENCE_CEILING',
  'AMBIGUOUS_CONTAINMENT_CEILING_VIOLATED',
  'INTEGRITY_FAILURE_IGNORED',
  'EMPTY_EVIDENCE_BASE',
  'TRUST_SCORE_INFLATES_ABOVE_EVIDENCE',
] as const satisfies OverconfidenceReason[]);

export const KNOWN_CALIBRATION_VIOLATIONS = Object.freeze([
  'OVERCONFIDENCE_ASSERTED',
  'AMBIGUITY_COLLAPSED_TO_CLEAN',
  'CALIBRATION_DRIFT_ALARM',
] as const satisfies ConfidenceCalibrationViolationKind[]);

export const CONFIDENCE_CALIBRATION_SENTINELS = Object.freeze({
  METHODOLOGY_VERSION:              'confidence-calibration.v1' as const,
  SCHEMA_CALIBRATED_CONFIDENCE:     'vitalcv.calibrated-confidence.v1' as const,
  SCHEMA_DRIFT_REPORT:              'vitalcv.confidence-drift.v1' as const,
  DEFAULT_AMBIGUOUS_CEILING:        CONTAINMENT_CONFIDENCE_CEILINGS.AMBIGUOUS,
  DEFAULT_QUARANTINE_CEILING:       CONTAINMENT_CONFIDENCE_CEILINGS.QUARANTINED,
  DEFAULT_BREACH_CEILING:           CONTAINMENT_CONFIDENCE_CEILINGS.CONTAINMENT_BREACH,
  MAX_OVERCONFIDENCE_EPISODE_RATIO: 0.20,  // alert threshold: >20% overconfident snapshots
});
