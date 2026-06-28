/**
 * Workflow definition engine (Wave 1300, C3)
 * ──────────────────────────────────────────────────────────────────────────
 * Workflows are stored as DECLARATIVE configuration and evaluated against the
 * Career Model. A workflow step's gate is checked against REAL facts — readiness
 * level and decision-grade evidence count — so configuration can describe a
 * process but can never confer decision-grade or move a step to "complete" on
 * evidence that isn't actually checked. This preserves the canonical path
 * (Recognition → Acceptance → Start) without weakening the honesty contract.
 *
 * Pure: evaluation reads the model; it never mutates evidence or fires effects.
 */
import type { CareerModel, MobilityReadiness } from '@vitalcv/domain-evidence';

/** Declarative gate for a step. All present conditions must hold. */
export interface WorkflowGate {
  /** Minimum decision-grade (checked) evidence required. */
  minDecisionGradeEvidence?: number;
  /** Required readiness level(s) — any match satisfies. */
  readinessIn?: MobilityReadiness[];
}

export interface WorkflowStep {
  stepId: string;
  label: string;
  gate: WorkflowGate;
}

export interface WorkflowDefinition {
  workflowId: string;
  label: string;
  steps: WorkflowStep[];
}

export type StepState = 'complete' | 'available' | 'blocked';

export interface StepEvaluation {
  stepId: string;
  label: string;
  state: StepState;
  /** Honest reason for the state. */
  reason: string;
}

export interface WorkflowEvaluation {
  workflowId: string;
  label: string;
  subjectKey: string;
  steps: StepEvaluation[];
  /** First non-complete step id, or null if all complete. */
  currentStepId: string | null;
}

function gateSatisfied(gate: WorkflowGate, model: CareerModel): boolean {
  if (
    typeof gate.minDecisionGradeEvidence === 'number' &&
    model.meta.decisionGradeEvidence < gate.minDecisionGradeEvidence
  ) {
    return false;
  }
  if (gate.readinessIn && gate.readinessIn.length > 0 && !gate.readinessIn.includes(model.readiness.readiness)) {
    return false;
  }
  return true;
}

/**
 * Evaluate a workflow against a model. Steps are sequential: a step is
 * `complete` if its gate holds, `available` if it's the first unmet step whose
 * gate holds, otherwise `blocked`. A gate is satisfied ONLY by real
 * decision-grade facts — never by configuration alone.
 */
export function evaluateWorkflow(definition: WorkflowDefinition, model: CareerModel): WorkflowEvaluation {
  const steps: StepEvaluation[] = [];
  let currentStepId: string | null = null;

  for (const step of definition.steps) {
    const satisfied = gateSatisfied(step.gate, model);

    let state: StepState;
    let reason: string;
    if (satisfied && currentStepId === null) {
      // Gate holds and all prior steps complete → this step is complete.
      state = 'complete';
      reason = 'Gate satisfied by decision-grade facts.';
    } else if (!satisfied && currentStepId === null) {
      // First unmet step.
      state = 'available';
      reason = describeGate(step.gate, model);
      currentStepId = step.stepId;
    } else {
      // A prior step is unmet → downstream steps are blocked.
      state = 'blocked';
      reason = 'Blocked by an earlier incomplete step.';
    }

    steps.push({ stepId: step.stepId, label: step.label, state, reason });
  }

  return { workflowId: definition.workflowId, label: definition.label, subjectKey: model.identity.subjectKey, steps, currentStepId };
}

function describeGate(gate: WorkflowGate, model: CareerModel): string {
  const parts: string[] = [];
  if (typeof gate.minDecisionGradeEvidence === 'number') {
    parts.push(`needs ${gate.minDecisionGradeEvidence} decision-grade evidence (have ${model.meta.decisionGradeEvidence})`);
  }
  if (gate.readinessIn && gate.readinessIn.length > 0) {
    parts.push(`needs readiness in [${gate.readinessIn.join(', ')}] (is ${model.readiness.readiness})`);
  }
  return parts.length ? `Available: ${parts.join('; ')}.` : 'Available.';
}
