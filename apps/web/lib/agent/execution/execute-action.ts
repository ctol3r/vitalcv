/**
 * Consented execution service — A1.
 *
 * The ordered gate chain for executing one planned action. Every gate fails
 * closed and every refusal is a named, honest outcome rather than a silent
 * no-op:
 *
 *   1. the action must exist in a freshly regenerated plan for the CURRENT
 *      canonical state — a stale client-held plan cannot authorize anything;
 *   2. `human_only` is refused outright;
 *   3. its owner must be `vitalcv` — clinician/employer/source/institution
 *      work is never executed on their behalf;
 *   4. the action must not already be completed, suppressed, or blocked on a
 *      dependency;
 *   5. Level 3 requires a ConsentProof minted RIGHT NOW from the consent
 *      ledger (a revocation landing after plan generation is honored);
 *   6. a tool mapping must exist;
 *   7. the tool registry re-checks the permission ceiling and the proof's
 *      scope against the invocation.
 *
 * Every attempt emits telemetry: `agent_action_presented` on entry, then
 * exactly one terminal event (`agent_action_completed`, `agent_action_failed`,
 * or `agent_action_blocked`) carrying owner, outcome, and elapsed time.
 */
import type { ConsentProof } from '../consent/types';
import type { RecordAgentEventInput } from '../telemetry/agent-run-store';
import type { AgentAction, StartAgentContext, StartPlan } from '../types';
import type { ToolRegistry } from '../tools/registry';
import { toolInvocationFor } from './action-executors';

/**
 * The consent store and telemetry writer both reach Prisma (and therefore
 * `server-only`), so they are imported lazily: this service stays a pure,
 * injectable module that unit tests can drive without a database.
 */
async function defaultVerifyConsent(
  subjectRef: string,
  scope: string,
  now: string,
): Promise<ConsentProof | null> {
  const { verifyAgentConsent } = await import('../consent/consent-store');
  return verifyAgentConsent(subjectRef, scope, now);
}

async function defaultRecordEvent(input: RecordAgentEventInput): Promise<{ persisted: boolean }> {
  const { recordAgentEvent } = await import('../telemetry/agent-run-store');
  return recordAgentEvent(input);
}

export const EXECUTION_REFUSAL_CODES = [
  'action_not_in_current_plan',
  'action_not_actionable',
  'not_vitalcv_owned',
  'human_only',
  'consent_not_granted',
  'no_executor',
  'tool_refused',
  'capability_failed',
] as const;
export type ExecutionRefusalCode = (typeof EXECUTION_REFUSAL_CODES)[number];

export interface ExecuteActionResult {
  executed: boolean;
  actionId: string;
  planId: string;
  /** Present when `executed` is false. */
  refusal?: { code: ExecutionRefusalCode; detail: string };
  /** Canonical capability output, when it ran. */
  output?: unknown;
  consentId?: string;
  elapsedMs: number;
}

export interface ExecuteActionDeps {
  registry: ToolRegistry;
  /** Injected for determinism in tests; defaults to wall clock. */
  now?: () => number;
  nowIso?: () => string;
  verifyConsent?: (subjectRef: string, scope: string, now: string) => Promise<ConsentProof | null>;
  recordEvent?: (input: RecordAgentEventInput) => Promise<{ persisted: boolean }>;
}

export interface ExecuteActionInput {
  /** Freshly generated plan for the CURRENT canonical state. */
  plan: StartPlan;
  context: StartAgentContext;
  actionId: string;
  subjectRef: string;
  runId?: string;
}

function actionable(action: AgentAction): boolean {
  return (
    action.status === 'ready' ||
    action.status === 'awaiting_consent' ||
    action.status === 'failed'
  );
}

export async function executeAgentAction(
  input: ExecuteActionInput,
  deps: ExecuteActionDeps,
): Promise<ExecuteActionResult> {
  const clock = deps.now ?? (() => Date.now());
  const isoClock = deps.nowIso ?? (() => new Date().toISOString());
  const verifyConsent = deps.verifyConsent ?? defaultVerifyConsent;
  const emit = deps.recordEvent ?? defaultRecordEvent;
  const startedAt = clock();
  const { plan, context, actionId, subjectRef } = input;

  const action = plan.actions.find((candidate) => candidate.id === actionId);

  await emit({
    eventType: 'agent_action_presented',
    planId: plan.planId,
    subjectRef,
    ...(input.runId ? { runId: input.runId } : {}),
    actionId,
    ...(action ? { owner: action.owner } : {}),
    metadata: { policyVersion: plan.policyVersion, ...(action ? { actionType: action.type } : {}) },
  });

  const refuse = async (
    code: ExecutionRefusalCode,
    detail: string,
  ): Promise<ExecuteActionResult> => {
    const elapsedMs = clock() - startedAt;
    await emit({
      eventType: 'agent_action_blocked',
      planId: plan.planId,
      subjectRef,
      ...(input.runId ? { runId: input.runId } : {}),
      actionId,
      ...(action ? { owner: action.owner } : {}),
      outcome: code,
      elapsedMs,
      metadata: { detail, ...(action ? { actionType: action.type } : {}) },
    });
    return { executed: false, actionId, planId: plan.planId, refusal: { code, detail }, elapsedMs };
  };

  // 1. The action must exist in the freshly generated plan.
  if (!action) {
    return refuse(
      'action_not_in_current_plan',
      'This action is not in the current plan for your current state. Nothing was run.',
    );
  }

  // 2-3. Categorical facts about the action come before its transient status:
  // "the hospital decides this" is the truthful answer whether the action is
  // waiting, ready, or stale, and it is more useful than "not actionable".
  if (action.permission === 'human_only') {
    return refuse('human_only', 'This decision belongs to a person; VitalCV cannot make it.');
  }
  if (action.owner !== 'vitalcv') {
    return refuse(
      'not_vitalcv_owned',
      `This step belongs to the ${action.owner.replace(/_/g, ' ')}; VitalCV does not do it on their behalf.`,
    );
  }

  // 4. Already-settled or dependency-blocked work does not run.
  if (!actionable(action)) {
    return refuse(
      'action_not_actionable',
      `The action is ${action.status.replace(/_/g, ' ')}, so there is nothing to run.`,
    );
  }

  // 5. Level 3 consent, verified against the ledger right now.
  let consentProof: ConsentProof | undefined;
  if (action.permission === 'execute_with_consent') {
    if (!action.consentScope) {
      return refuse('tool_refused', 'The action names no consent scope, so it cannot be authorized.');
    }
    const proof = await verifyConsent(subjectRef, action.consentScope, isoClock());
    if (!proof) {
      return refuse(
        'consent_not_granted',
        `Your approval for ${action.consentScope.replace(/[_:]/g, ' ')} is not currently on record. Nothing was sent.`,
      );
    }
    consentProof = proof;
  }

  // 6. A tool mapping must exist.
  const invocation = toolInvocationFor(action, context.subject);
  if (!invocation) {
    return refuse(
      'no_executor',
      'VitalCV has no capability wired for this action yet, so it cannot run it.',
    );
  }

  // 7. Execute through the registry (permission ceiling + proof scope re-checked there).
  try {
    const output = await deps.registry.execute<Record<string, unknown>>(
      invocation.toolId,
      invocation.input,
      consentProof ? { consentProof } : undefined,
    );

    // A canonical capability that declined is a FAILURE, never a success.
    if (output && output.executed === false) {
      const elapsedMs = clock() - startedAt;
      const blockedBy = typeof output.blockedBy === 'string' ? output.blockedBy : 'unknown';
      await emit({
        eventType: 'agent_action_failed',
        planId: plan.planId,
        subjectRef,
        ...(input.runId ? { runId: input.runId } : {}),
        actionId,
        owner: action.owner,
        outcome: blockedBy,
        elapsedMs,
        metadata: { actionType: action.type, toolId: invocation.toolId },
      });
      return {
        executed: false,
        actionId,
        planId: plan.planId,
        refusal: {
          code: 'capability_failed',
          detail:
            blockedBy === 'canonical_ownership_authz'
              ? 'The canonical service refused: this record is not confirmed as yours.'
              : 'The canonical service did not complete this action.',
        },
        output,
        elapsedMs,
      };
    }
    if (output && output.requested === false) {
      const elapsedMs = clock() - startedAt;
      await emit({
        eventType: 'agent_action_failed',
        planId: plan.planId,
        subjectRef,
        ...(input.runId ? { runId: input.runId } : {}),
        actionId,
        owner: action.owner,
        outcome: 'capability_declined',
        elapsedMs,
        metadata: { actionType: action.type, toolId: invocation.toolId },
      });
      return {
        executed: false,
        actionId,
        planId: plan.planId,
        refusal: { code: 'capability_failed', detail: 'The canonical service did not accept the request.' },
        output,
        elapsedMs,
      };
    }

    const elapsedMs = clock() - startedAt;
    await emit({
      eventType: 'agent_action_completed',
      planId: plan.planId,
      subjectRef,
      ...(input.runId ? { runId: input.runId } : {}),
      actionId,
      owner: action.owner,
      outcome: 'completed',
      elapsedMs,
      metadata: {
        actionType: action.type,
        toolId: invocation.toolId,
        ...(consentProof ? { consentId: consentProof.consentId } : {}),
        ...(typeof output?.shareId === 'string' ? { shareId: output.shareId } : {}),
      },
    });
    return {
      executed: true,
      actionId,
      planId: plan.planId,
      output,
      ...(consentProof ? { consentId: consentProof.consentId } : {}),
      elapsedMs,
    };
  } catch (error) {
    const elapsedMs = clock() - startedAt;
    await emit({
      eventType: 'agent_action_failed',
      planId: plan.planId,
      subjectRef,
      ...(input.runId ? { runId: input.runId } : {}),
      actionId,
      owner: action.owner,
      outcome: 'threw',
      elapsedMs,
      metadata: { actionType: action.type, toolId: invocation.toolId },
    });
    return {
      executed: false,
      actionId,
      planId: plan.planId,
      refusal: { code: 'tool_refused', detail: (error as Error).message },
      elapsedMs,
    };
  }
}
