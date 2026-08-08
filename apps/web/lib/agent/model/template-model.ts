/**
 * Deterministic template model — the default AgentModel.
 *
 * Renders clinician language purely from the structured plan context. No
 * network, no key, no nondeterminism, so CI runs it everywhere an AgentModel
 * is needed and production uses it as the honest fallback whenever an
 * LLM-backed model is unavailable or its narrative fails validation.
 */
import type { AgentModel, AgentNarrative } from './agent-model';
import type { ModelPlanContext } from './context-builder';

export const TEMPLATE_MODEL_VERSION = 'template-v1';

const OWNER_PHRASE: Record<string, string> = {
  vitalcv: 'VitalCV can handle this',
  clinician: 'this one is yours',
  employer: 'the employer holds this step',
  source: 'the source authority holds this step',
  other_institution: 'another institution holds this step',
};

const PERMISSION_PHRASE: Record<string, string> = {
  observe: 'nothing runs — this is a heads-up',
  recommend: 'a recommended next step',
  prepare: 'VitalCV prepares it; nothing is sent',
  execute_with_consent: 'runs only after your approval',
  human_only: 'VitalCV cannot do this for you',
};

function summaryOf(ctx: ModelPlanContext): string {
  const blockerCount = ctx.blockers.length;
  const topActionId = ctx.rankedActionIds[0];
  const top = ctx.actions.find((a) => a.id === topActionId);
  const blockerLine =
    blockerCount === 0
      ? 'Nothing is currently blocking progress that VitalCV can see.'
      : blockerCount === 1
        ? 'One thing currently stands between you and your next step.'
        : `${blockerCount} things currently stand between you and your next step.`;
  const topLine = top
    ? `Most useful next: ${top.title} — ${OWNER_PHRASE[top.owner] ?? top.owner}, ${PERMISSION_PHRASE[top.permission] ?? top.permission}.`
    : 'There is no action to take right now.';
  return `${blockerLine} ${topLine}`;
}

function explanationOf(ctx: ModelPlanContext, actionId: string): string {
  const action = ctx.actions.find((a) => a.id === actionId);
  if (!action) return '';
  const ownerPhrase = OWNER_PHRASE[action.owner] ?? action.owner;
  const permissionPhrase = PERMISSION_PHRASE[action.permission] ?? action.permission;
  return `${action.reason} ${action.expectedOutcome} (${ownerPhrase}; ${permissionPhrase}.)`;
}

export class DeterministicTemplateModel implements AgentModel {
  readonly modelVersion = TEMPLATE_MODEL_VERSION;

  async explain(planContext: ModelPlanContext): Promise<AgentNarrative> {
    return {
      planId: planContext.planId,
      policyVersion: planContext.policyVersion,
      modelVersion: this.modelVersion,
      summary: summaryOf(planContext),
      actionExplanations: planContext.rankedActionIds.map((actionId) => ({
        actionId,
        explanation: explanationOf(planContext, actionId),
      })),
    };
  }
}

/**
 * Model selection seam. A0 always returns the template model. When an
 * LLM-backed AgentModel lands (A1+), it plugs in here behind the same
 * interface, gated on the canonical AI gate (lib/ai/anthropic.ts
 * `isAnthropicConfigured()`), with the template model as the fallback path —
 * and every narrative still passes `validateNarrative` before use.
 */
export function getAgentModel(): AgentModel {
  return new DeterministicTemplateModel();
}
