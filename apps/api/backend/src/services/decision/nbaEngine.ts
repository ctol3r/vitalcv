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
  derivedFromLearning: boolean;
}

export interface LearningCohortStats {
  totalDecisions: number;
  successRate: number; // % that resulted in START_ACTIVATED
  driftRate: number;   // % that resulted in DRIFT_OCCURRED
  failRate: number;    // % that resulted in START_FAILED
}

export class NextBestActionEngine {
  /**
   * Evaluates current clinician context to recommend the safest, most efficient
   * next step for the employer based on REAL EMPIRICAL LEARNING DATA.
   */
  static determineNextAction(
    context: SystemStateContext,
    cohortStats?: LearningCohortStats
  ): NextBestActionOutput {
    const { decisionState, activationState, hasHardDrift, hasSoftDrift } = context;

    // 1. The Entropy Rule (Drift overrides everything)
    if (hasHardDrift) {
      return {
        action: RecommendedAction.ESCALATE,
        reason: 'Critical anomaly (Hard Drift) detected. Immediate compliance review required.',
        confidence: 0.99,
        derivedFromLearning: false,
      };
    }

    if (hasSoftDrift) {
      return {
        action: RecommendedAction.REVERIFY,
        reason: 'Data is stale or minor discrepancies found. Re-verify before proceeding.',
        confidence: 0.85,
        derivedFromLearning: false,
      };
    }

    // 2. The Blocking Rule
    if (decisionState === 'BLOCKED') {
      return {
        action: activationState === 'ACTIVE' ? RecommendedAction.ESCALATE : RecommendedAction.HOLD,
        reason: 'Primary sources indicate blocking condition (e.g., OIG exclusion). Do not proceed.',
        confidence: 0.95,
        derivedFromLearning: false,
      };
    }

    // 3. The Processing Rule
    if (decisionState === 'CHECKING' || decisionState === 'UNKNOWN') {
      return {
        action: RecommendedAction.HOLD,
        reason: 'Verification is currently processing. Await final results.',
        confidence: 0.90,
        derivedFromLearning: false,
      };
    }

    // --- EMPIRICAL LEARNING ZONE ---
    // If we have statistically significant historical data for this decision state
    if (cohortStats && cohortStats.totalDecisions > 10) {
      if (cohortStats.driftRate > 0.15) {
        // High historic drift risk -> override normal PROCEED
        return {
          action: RecommendedAction.REQUEST_DATA,
          reason: `Profiles with these signals have a ${Math.round(cohortStats.driftRate * 100)}% historic drift rate. Request deeper verification.`,
          confidence: Math.max(0.6, 1 - cohortStats.driftRate),
          derivedFromLearning: true,
        };
      }

      if (decisionState === 'PARTIAL' && cohortStats.successRate > 0.85) {
        // Historic data proves this PARTIAL state is actually safe to proceed
        return {
          action: RecommendedAction.PROCEED,
          reason: `Historical data shows ${Math.round(cohortStats.successRate * 100)}% success rate for this profile type despite missing non-critical data.`,
          confidence: cohortStats.successRate,
          derivedFromLearning: true,
        };
      }
      
      if (decisionState === 'DECISION_GRADE') {
        return {
          action: RecommendedAction.PROCEED,
          reason: `Clear to proceed. Verified by empirical ${Math.round(cohortStats.successRate * 100)}% success rate across ${cohortStats.totalDecisions} similar profiles.`,
          confidence: cohortStats.successRate,
          derivedFromLearning: true,
        };
      }
    }

    // --- FALLBACK TO STATIC RULES ---
    if (decisionState === 'PARTIAL') {
      return {
        action: RecommendedAction.REQUEST_DATA,
        reason: 'Missing coverage on critical sources. Request additional data from clinician.',
        confidence: 0.80,
        derivedFromLearning: false,
      };
    }

    if (decisionState === 'DECISION_GRADE') {
      return {
        action: RecommendedAction.PROCEED,
        reason: activationState === 'NOT_STARTABLE' 
          ? 'Clear to Accept. All critical sources verified.' 
          : 'Clear to Activate. Clinician is fully verified and accepted.',
        confidence: 0.90,
        derivedFromLearning: false,
      };
    }

    return {
      action: RecommendedAction.HOLD,
      reason: 'System state indeterminate. Holding for manual review.',
      confidence: 0.50,
      derivedFromLearning: false,
    };
  }
}
