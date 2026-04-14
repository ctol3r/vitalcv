/**
 * Next Best Action (NBA) Engine
 *
 * Defines how VitalCV recommends the next best action based on system state,
 * drift events, and learning signals.
 */

export enum RecommendedAction {
  PROCEED = 'PROCEED',
  REQUEST_DATA = 'REQUEST_DATA',
  REVERIFY = 'REVERIFY',
  ESCALATE = 'ESCALATE',
  HOLD = 'HOLD',
}

export interface SystemStateContext {
  decisionState: 'CHECKING' | 'PARTIAL' | 'DECISION_GRADE' | 'BLOCKED' | 'UNKNOWN';
  activationState: 'NOT_STARTABLE' | 'READY_TO_START' | 'ACTIVE';
  hasHardDrift: boolean;
  hasSoftDrift: boolean;
  learningConfidenceFactor: number; // 0.0 to 1.0 (based on historical accuracy)
}

export interface NextBestActionOutput {
  action: RecommendedAction;
  reason: string;
  confidence: number;
}

export class NextBestActionEngine {
  /**
   * Evaluates current clinician context to recommend the safest, most efficient
   * next step for the employer.
   */
  static determineNextAction(context: SystemStateContext): NextBestActionOutput {
    const { decisionState, activationState, hasHardDrift, hasSoftDrift, learningConfidenceFactor } = context;

    // 1. The Entropy Rule (Drift overrides everything)
    if (hasHardDrift) {
      return {
        action: RecommendedAction.ESCALATE,
        reason: 'Critical anomaly (Hard Drift) detected. Immediate compliance review required.',
        confidence: 0.99,
      };
    }

    if (hasSoftDrift) {
      return {
        action: RecommendedAction.REVERIFY,
        reason: 'Data is stale or minor discrepancies found. Re-verify before proceeding.',
        confidence: 0.85 * learningConfidenceFactor,
      };
    }

    // 2. The Blocking Rule
    if (decisionState === 'BLOCKED') {
      return {
        action: activationState === 'ACTIVE' ? RecommendedAction.ESCALATE : RecommendedAction.HOLD,
        reason: 'Primary sources indicate blocking condition (e.g., OIG exclusion). Do not proceed.',
        confidence: 0.95,
      };
    }

    // 3. The Processing Rule
    if (decisionState === 'CHECKING' || decisionState === 'UNKNOWN') {
      return {
        action: RecommendedAction.HOLD,
        reason: 'Verification is currently processing. Await final results.',
        confidence: 0.90,
      };
    }

    // 4. The Data Gap Rule
    if (decisionState === 'PARTIAL') {
      return {
        action: RecommendedAction.REQUEST_DATA,
        reason: 'Missing coverage on critical sources. Request additional data from clinician.',
        confidence: 0.80 * learningConfidenceFactor,
      };
    }

    // 5. The Clear Rule
    if (decisionState === 'DECISION_GRADE') {
      return {
        action: RecommendedAction.PROCEED,
        reason: activationState === 'NOT_STARTABLE' 
          ? 'Clear to Accept. All critical sources verified.' 
          : 'Clear to Activate. Clinician is fully verified and accepted.',
        confidence: 0.90 * learningConfidenceFactor,
      };
    }

    // Fallback
    return {
      action: RecommendedAction.HOLD,
      reason: 'System state indeterminate. Holding for manual review.',
      confidence: 0.50,
    };
  }
}
