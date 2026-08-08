/**
 * Start Agent A0 — model layer tests: the ModelContextBuilder's exclusions
 * are proven by poisoning every excluded category and asserting the poison
 * never reaches the serialized payload; the template model's narrative
 * validates and stays claim-free; a narrative inventing actions is rejected.
 */
import { describe, expect, it } from 'vitest';
import { validateNarrative } from '@/lib/agent/model/agent-model';
import { buildModelContext } from '@/lib/agent/model/context-builder';
import { DeterministicTemplateModel, getAgentModel } from '@/lib/agent/model/template-model';
import { generateStartPlan } from '@/lib/agent/policy/start-policy-v1';
import type { StartAgentContext } from '@/lib/agent/types';

const NOW = '2026-08-07T00:00:00.000Z';

const POISON = {
  profileRef: 'user_SECRET_CLERK_SUBJECT_2abc',
  npi: '1999999992',
  evidenceRef: 'raw-credential-blob-DEA-BX1234563-token-sk_live_abcdef',
};

function poisonedContext(): StartAgentContext {
  return {
    subject: { profileRef: POISON.profileRef, npi: POISON.npi },
    identity: {
      status: 'resolved',
      evidenceRefs: [{ kind: 'source_observation', ref: POISON.evidenceRef, provenance: 'public_source' }],
    },
    profile: { status: 'saved', missingRequiredFields: [], corrections: [], evidenceRefs: [] },
    ownership: { status: 'none', evidenceRefs: [] },
    observations: [],
    readiness: { status: 'unknown', determinedBy: 'unavailable', evidenceRefs: [] },
    opportunities: { status: 'unknown', matches: [] },
    consents: [],
    actionHistory: [],
    collectedAt: NOW,
    contextClass: 'test',
  };
}

describe('ModelContextBuilder privacy', () => {
  it('excludes subject identifiers and evidence refs from the model payload', () => {
    const context = poisonedContext();
    const plan = generateStartPlan(context, { now: NOW });
    const payload = JSON.stringify(buildModelContext(plan, context));

    expect(payload).not.toContain(POISON.profileRef);
    expect(payload).not.toContain(POISON.npi);
    expect(payload).not.toContain(POISON.evidenceRef);
    expect(payload).not.toContain('sk_live');
    // The subject is the fixed opaque token, never an identifier.
    expect(JSON.parse(payload).subject).toBe('subject');
  });

  it('carries only structured classifications and agent-authored text', () => {
    const context = poisonedContext();
    const plan = generateStartPlan(context, { now: NOW });
    const payload = buildModelContext(plan, context);
    const allowedTopLevel = [
      'planId',
      'policyVersion',
      'contextClass',
      'subject',
      'states',
      'blockers',
      'actions',
      'rankedActionIds',
    ];
    expect(Object.keys(payload).sort()).toEqual([...allowedTopLevel].sort());
    for (const blocker of payload.blockers) {
      expect(blocker).not.toHaveProperty('evidenceRefs');
    }
    for (const action of payload.actions) {
      expect(action).not.toHaveProperty('evidenceRefs');
    }
  });
});

describe('DeterministicTemplateModel', () => {
  it('is the default model and produces a validating narrative', async () => {
    const context = poisonedContext();
    const plan = generateStartPlan(context, { now: NOW });
    const model = getAgentModel();
    expect(model.modelVersion).toBe('template-v1');
    const narrative = await model.explain(buildModelContext(plan, context));
    expect(validateNarrative(narrative, plan, context)).toHaveLength(0);
    expect(narrative.planId).toBe(plan.planId);
    expect(narrative.actionExplanations.length).toBe(plan.rankedActionIds.length);
  });

  it('rejects a narrative that references an action the plan does not carry', async () => {
    const context = poisonedContext();
    const plan = generateStartPlan(context, { now: NOW });
    const narrative = await new DeterministicTemplateModel().explain(buildModelContext(plan, context));
    const forged = {
      ...narrative,
      actionExplanations: [
        ...narrative.actionExplanations,
        { actionId: 'act_invented_by_model', explanation: 'A brand-new requirement I made up.' },
      ],
    };
    const violations = validateNarrative(forged, plan, context);
    expect(violations.some((v) => v.code === 'narrative_unknown_action')).toBe(true);
  });

  it('rejects a narrative that smuggles a forbidden claim', async () => {
    const context = poisonedContext();
    const plan = generateStartPlan(context, { now: NOW });
    const narrative = await new DeterministicTemplateModel().explain(buildModelContext(plan, context));
    const readyPhrase = ['ready', 'to', 'start'].join(' ');
    const forged = { ...narrative, summary: `${narrative.summary} You are ${readyPhrase}!` };
    const violations = validateNarrative(forged, plan, context);
    expect(violations.some((v) => v.code === 'ready_to_start_claim')).toBe(true);
  });
});
