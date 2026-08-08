/**
 * Model layer contract.
 *
 * The model is the reasoning/EXPLANATION layer, never the source of the
 * plan's truth. Its permitted jobs in A0: explain, summarize, turn structured
 * actions into clinician language, answer "why does this matter?" from
 * approved context, rephrase. It may not introduce a blocker, a requirement,
 * or a state the structured plan does not carry — `validateNarrative` rejects
 * narratives that reference unknown actions or contain forbidden claims, and
 * every narrative is validated before it leaves the server.
 *
 * Provider bindings sit BEHIND this interface. A0 ships only the
 * deterministic template implementation (./template-model.ts); an LLM-backed
 * implementation belongs behind the same interface, gated on the existing
 * canonical AI gate (`isAnthropicConfigured()` in lib/ai/anthropic.ts), and
 * its output goes through the same validator. Tests and CI never make model
 * network calls.
 */
import { scanTextForForbiddenClaims } from '../forbidden-claims';
import type { TruthViolation } from '../truth-boundary';
import type { StartAgentContext, StartPlan } from '../types';
import type { ModelPlanContext } from './context-builder';

export interface AgentNarrative {
  planId: string;
  policyVersion: string;
  modelVersion: string;
  /** Clinician-facing summary of where things stand and the next step. */
  summary: string;
  /** One explanation per presented action; actionIds must exist in the plan. */
  actionExplanations: Array<{ actionId: string; explanation: string }>;
}

export interface AgentModel {
  readonly modelVersion: string;
  explain(planContext: ModelPlanContext): Promise<AgentNarrative>;
}

/**
 * A narrative is only usable if it stays inside the structured plan: correct
 * plan reference, no unknown actions, no forbidden claims anywhere in its
 * text. Returns violations; callers must drop (not repair) a failing
 * narrative and fall back to the deterministic template model.
 */
export function validateNarrative(
  narrative: AgentNarrative,
  plan: StartPlan,
  context: StartAgentContext,
): TruthViolation[] {
  const violations: TruthViolation[] = [];

  if (narrative.planId !== plan.planId) {
    violations.push({
      code: 'narrative_wrong_plan',
      subjectPath: 'narrative.planId',
      detail: `narrative references ${narrative.planId}, plan is ${plan.planId}.`,
    });
  }
  if (narrative.policyVersion !== plan.policyVersion) {
    violations.push({
      code: 'narrative_wrong_policy_version',
      subjectPath: 'narrative.policyVersion',
      detail: 'narratives must carry the plan policy version they explain.',
    });
  }

  const actionIds = new Set(plan.actions.map((a) => a.id));
  for (const item of narrative.actionExplanations) {
    if (!actionIds.has(item.actionId)) {
      violations.push({
        code: 'narrative_unknown_action',
        subjectPath: `narrative.actionExplanations:${item.actionId}`,
        detail: 'a narrative may not introduce actions the plan does not carry.',
      });
    }
    for (const hit of scanTextForForbiddenClaims(item.explanation, context)) {
      violations.push({
        code: hit.code,
        subjectPath: `narrative.actionExplanations:${item.actionId}`,
        detail: hit.detail,
      });
    }
  }
  for (const hit of scanTextForForbiddenClaims(narrative.summary, context)) {
    violations.push({ code: hit.code, subjectPath: 'narrative.summary', detail: hit.detail });
  }

  return violations;
}
