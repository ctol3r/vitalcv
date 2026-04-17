// ── VitalCV Trust Calibration Engine ───────────────────────────────
// Evaluates the confidence of a system recommendation by analyzing
// evidence strength, freshness, issuer trust, and historical sample size.

import { OutcomeMemory } from './outcomeMemory';
import { ReadinessPosture } from '../../../../packages/trust-contract/src/index';

export interface ConfidenceContext {
  /** Percentage of required coverage lanes successfully checked (0.0 - 1.0) */
  evidenceStrength: number;
  /** Percentage of maximum allowed TTL remaining across all lanes (0.0 - 1.0) */
  freshnessScore: number;
  /** Blended score based on the authority of winning issuers (0.0 - 1.0) */
  issuerTrustLevel: number;
  /** Historical success rate (0.0 - 1.0) */
  outcomeHistoryStrength: number;
  /** Number of historical decisions considered */
  sampleSize: number;
}

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type CalibratedDecisionState = 
  | 'READY_CONFIDENT'
  | 'READY_UNCERTAIN'
  | 'BLOCKED_CONFIDENT'
  | 'BLOCKED_UNCERTAIN'
  | 'PENDING';

export interface CalibrationResult {
  confidenceLevel: ConfidenceLevel;
  calibratedState: CalibratedDecisionState;
  context: ConfidenceContext;
}

export function calibrateTrust(
  posture: ReadinessPosture,
  evidenceStrength: number,
  freshnessScore: number,
  issuerTrustLevel: number,
  learningMemory: OutcomeMemory
): CalibrationResult {
  
  const sampleSize = learningMemory.patterns.totalDecisions;
  // If we have history, use successRate, otherwise default to 1.0 (innocent until proven guilty)
  const outcomeHistoryStrength = sampleSize > 0 ? learningMemory.patterns.successRate : 1.0;

  const context: ConfidenceContext = {
    evidenceStrength,
    freshnessScore,
    issuerTrustLevel,
    outcomeHistoryStrength,
    sampleSize,
  };

  // Base confidence calculation (weighted)
  // Evidence: 40%, Issuer Trust: 30%, Freshness: 20%, History: 10%
  const blendedScore = 
    (evidenceStrength * 0.40) +
    (issuerTrustLevel * 0.30) +
    (freshnessScore * 0.20) +
    (outcomeHistoryStrength * 0.10);

  let confidenceLevel: ConfidenceLevel = 'LOW';
  if (blendedScore >= 0.85 && sampleSize >= 0) confidenceLevel = 'HIGH'; // High evidence + good sources
  else if (blendedScore >= 0.60) confidenceLevel = 'MEDIUM';

  // Overrides based on critical flaws
  if (evidenceStrength < 0.5) confidenceLevel = 'LOW';
  if (freshnessScore < 0.2) confidenceLevel = 'LOW';
  if (sampleSize >= 3 && outcomeHistoryStrength < 0.5) confidenceLevel = 'LOW';

  let calibratedState: CalibratedDecisionState = 'PENDING';

  if (posture === ReadinessPosture.DECISION_GRADE || posture === ReadinessPosture.CLEAR) {
    calibratedState = confidenceLevel === 'HIGH' ? 'READY_CONFIDENT' : 'READY_UNCERTAIN';
  } else if (posture === ReadinessPosture.BLOCKED) {
    // If we have strong evidence of a block (e.g. OIG exclusion), we are confident in blocking.
    calibratedState = confidenceLevel === 'HIGH' || confidenceLevel === 'MEDIUM' ? 'BLOCKED_CONFIDENT' : 'BLOCKED_UNCERTAIN';
  } else {
    calibratedState = 'PENDING';
  }

  return {
    confidenceLevel,
    calibratedState,
    context,
  };
}
