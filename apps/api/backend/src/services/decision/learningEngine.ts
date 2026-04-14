/**
 * Learning Engine
 *
 * Defines how system decisions improve over time by capturing the delta between:
 * 1. System Recommendation (Recognition)
 * 2. Human Action (Acceptance)
 * 3. Real-World Outcome (Start Activation / Drift)
 */

export enum SystemRecommendation {
  CHECKING = 'CHECKING',
  PARTIAL = 'PARTIAL',
  DECISION_GRADE = 'DECISION_GRADE',
  BLOCKED = 'BLOCKED',
}

export enum HumanActionType {
  ACCEPTED = 'ACCEPTED',
  FLAGGED = 'FLAGGED',
  REQUESTED_DATA = 'REQUESTED_DATA',
}

export enum RealWorldOutcome {
  START_ACTIVATED = 'START_ACTIVATED',
  START_FAILED = 'START_FAILED',
  DRIFT_OCCURRED = 'DRIFT_OCCURRED',
  PENDING = 'PENDING',
}

export interface DecisionLearningEvent {
  clinicianNpi: string;
  recognitionState: SystemRecommendation | string;
  humanAction: HumanActionType | string;
  outcome: RealWorldOutcome;
  mismatchDetected: boolean;
  mismatchReason: string | null;
  createdAt: Date;
}

export class LearningEngine {
  /**
   * Evaluates the alignment between system recommendation, human action, and outcome.
   * Returns a structured learning event indicating if a mismatch occurred.
   */
  static evaluateDecisionCycle(
    npi: string,
    systemState: string,
    humanAction: string,
    outcome: RealWorldOutcome
  ): DecisionLearningEvent {
    let mismatchDetected = false;
    let mismatchReason: string | null = null;

    // Detect Human Override Mismatch
    if (systemState === SystemRecommendation.DECISION_GRADE && humanAction === HumanActionType.FLAGGED) {
      mismatchDetected = true;
      mismatchReason = 'Human Override: System confident, Human rejected';
    }

    // Detect False Positive Mismatch
    if (systemState === SystemRecommendation.DECISION_GRADE && humanAction === HumanActionType.ACCEPTED && (outcome === RealWorldOutcome.START_FAILED || outcome === RealWorldOutcome.DRIFT_OCCURRED)) {
      mismatchDetected = true;
      mismatchReason = 'False Positive: System confident, Human accepted, but Start failed or drifted early';
    }

    // Detect False Negative Mismatch
    if (systemState === SystemRecommendation.PARTIAL && humanAction === HumanActionType.ACCEPTED && outcome === RealWorldOutcome.START_ACTIVATED) {
      mismatchDetected = true;
      mismatchReason = 'False Negative: System cautious, Human accepted, Start succeeded';
    }

    return {
      clinicianNpi: npi,
      recognitionState: systemState,
      humanAction,
      outcome,
      mismatchDetected,
      mismatchReason,
      createdAt: new Date(),
    };
  }
}
