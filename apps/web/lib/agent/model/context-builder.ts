/**
 * ModelContextBuilder — the ONLY doorway between VitalCV state and a model.
 *
 * Allowlist construction: the payload is built field-by-field from the
 * structured plan; nothing is spread or passed through wholesale. Categories
 * that must never reach a model payload:
 *
 *   - secrets / tokens / API keys (never present in plan or context types,
 *     and excluded here by construction);
 *   - raw identity-document images or blobs;
 *   - full credential payloads — the agent layer only ever carries opaque
 *     evidence REFS, and even those are stripped here;
 *   - the subject's stable identifiers (profileRef, npi) — narration does
 *     not need them, so they are replaced with the fixed token 'subject';
 *   - unrelated clinician data (nothing outside the plan enters at all).
 *
 * Tests prove the exclusions hold by poisoning every excluded field and
 * asserting the serialized payload never contains the poison values.
 */
import type { StartAgentContext, StartPlan } from '../types';

export interface ModelPlanContext {
  planId: string;
  policyVersion: string;
  contextClass: string;
  subject: 'subject';
  states: {
    identity: string;
    ownership: string;
    employerReview: string | null;
    readiness: string;
    opportunities: string;
  };
  blockers: Array<{
    id: string;
    type: string;
    what: string;
    whyItMatters: string;
    controlledBy: string;
    vitalcvCanActNow: boolean;
  }>;
  actions: Array<{
    id: string;
    type: string;
    title: string;
    reason: string;
    owner: string;
    permission: string;
    status: string;
    expectedOutcome: string;
    priority: number;
  }>;
  rankedActionIds: string[];
}

export function buildModelContext(
  plan: StartPlan,
  context: StartAgentContext,
): ModelPlanContext {
  return {
    planId: plan.planId,
    policyVersion: plan.policyVersion,
    contextClass: plan.contextClass,
    subject: 'subject',
    states: {
      identity: context.identity.status,
      ownership: context.ownership.status,
      employerReview: context.employerReview?.status ?? null,
      readiness: context.readiness.status,
      opportunities: context.opportunities.status,
    },
    blockers: plan.blockers.map((b) => ({
      id: b.id,
      type: b.type,
      what: b.what,
      whyItMatters: b.whyItMatters,
      controlledBy: b.controlledBy,
      vitalcvCanActNow: b.vitalcvCanActNow,
    })),
    actions: plan.actions.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      reason: a.reason,
      owner: a.owner,
      permission: a.permission,
      status: a.status,
      expectedOutcome: a.expectedOutcome,
      priority: a.priority,
    })),
    rankedActionIds: [...plan.rankedActionIds],
  };
}
