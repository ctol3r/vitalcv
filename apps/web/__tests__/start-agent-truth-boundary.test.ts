/**
 * Start Agent A0 — truth-boundary tests. The guard is proven by injecting
 * the bug: hand-crafted plans that collapse a boundary must be caught, and
 * the policy itself must throw rather than return them.
 */
import { describe, expect, it } from 'vitest';
import { generateStartPlan } from '@/lib/agent/policy/start-policy-v1';
import {
  auditTruthBoundaries,
  TruthContractViolationError,
  validateStartPlanStructure,
} from '@/lib/agent/truth-boundary';
import type { AgentAction, StartAgentContext, StartBlocker, StartPlan } from '@/lib/agent/types';

const READY_PHRASE = ['ready', 'to', 'start'].join(' ');

function ctx(overrides: Partial<StartAgentContext> = {}): StartAgentContext {
  return {
    subject: { profileRef: 'subject-1' },
    identity: { status: 'resolved', evidenceRefs: [] },
    profile: { status: 'saved', missingRequiredFields: [], corrections: [], evidenceRefs: [] },
    ownership: { status: 'none', evidenceRefs: [] },
    observations: [],
    readiness: { status: 'unknown', determinedBy: 'unavailable', evidenceRefs: [] },
    opportunities: { status: 'unknown', matches: [] },
    consents: [],
    actionHistory: [],
    collectedAt: '2026-08-07T00:00:00.000Z',
    contextClass: 'test',
    ...overrides,
  };
}

function action(overrides: Partial<AgentAction>): AgentAction {
  return {
    id: 'act_x',
    type: 'informational_note',
    title: 'Note',
    reason: 'Because.',
    owner: 'vitalcv',
    permission: 'observe',
    status: 'ready',
    priority: 1,
    rankTier: 5,
    dependencies: [],
    evidenceRefs: [{ kind: 'system_record', ref: 'context:test', provenance: 'platform_record' }],
    expectedOutcome: 'Nothing changes.',
    resolvesBlockerIds: [],
    ...overrides,
  };
}

function blocker(overrides: Partial<StartBlocker>): StartBlocker {
  return {
    id: 'blk_x',
    type: 'missing_clinician_field',
    what: 'A field is missing.',
    whyItMatters: 'It blocks progress.',
    controlledBy: 'clinician',
    evidenceRefs: [{ kind: 'system_record', ref: 'context:test', provenance: 'platform_record' }],
    resolvableByActionIds: ['act_x'],
    vitalcvCanActNow: false,
    dependsOnBlockerIds: [],
    ...overrides,
  };
}

function plan(overrides: Partial<StartPlan>): StartPlan {
  return {
    planId: 'plan_test',
    subject: { profileRef: 'subject-1' },
    contextClass: 'test',
    contextFingerprint: 'f'.repeat(32),
    blockers: [],
    actions: [action({})],
    rankedActionIds: ['act_x'],
    generatedAt: '2026-08-07T00:00:00.000Z',
    policyVersion: 'start-policy-v1',
    toolsetVersion: 'start-toolset-v1',
    ...overrides,
  };
}

describe('structural validation', () => {
  it('rejects a blocker missing evidence or a linked action', () => {
    const bad = plan({
      blockers: [blocker({ evidenceRefs: [], resolvableByActionIds: [] })],
    });
    const codes = validateStartPlanStructure(bad).map((v) => v.code);
    expect(codes).toContain('blocker_without_evidence');
    expect(codes).toContain('blocker_without_action');
  });

  it('rejects dangling references in both directions', () => {
    const bad = plan({
      blockers: [blocker({ resolvableByActionIds: ['act_missing'] })],
      actions: [action({ resolvesBlockerIds: ['blk_missing'], dependencies: ['act_ghost'] })],
    });
    const codes = validateStartPlanStructure(bad).map((v) => v.code);
    expect(codes).toContain('dangling_action_ref');
    expect(codes).toContain('dangling_blocker_ref');
    expect(codes).toContain('dangling_action_dep');
  });

  it('rejects human_only actions owned by vitalcv', () => {
    const bad = plan({
      actions: [action({ permission: 'human_only', owner: 'vitalcv', status: 'awaiting_external' })],
      rankedActionIds: ['act_x'],
    });
    expect(validateStartPlanStructure(bad).map((v) => v.code)).toContain(
      'human_only_owned_by_vitalcv',
    );
  });

  it('rejects consent actions without a scope and blocked actions in the ranked list', () => {
    const bad = plan({
      actions: [action({ permission: 'execute_with_consent', status: 'blocked_on_dependency' })],
      rankedActionIds: ['act_x'],
    });
    const codes = validateStartPlanStructure(bad).map((v) => v.code);
    expect(codes).toContain('consent_action_without_scope');
    expect(codes).toContain('ranked_unrankable_status');
  });
});

describe('truth-boundary audit', () => {
  it('catches a readiness claim when readiness is not canonical', () => {
    const bad = plan({
      actions: [action({ title: `You are ${READY_PHRASE}` })],
    });
    const codes = auditTruthBoundaries(bad, ctx()).map((v) => v.code);
    expect(codes).toContain('ready_to_start_claim');
  });

  it('catches consent assumed on an execute_with_consent action', () => {
    const bad = plan({
      actions: [
        action({ permission: 'execute_with_consent', consentScope: 'share_packet:x', status: 'ready' }),
      ],
    });
    const codes = auditTruthBoundaries(bad, ctx()).map((v) => v.code);
    expect(codes).toContain('consent_assumed');
  });

  it('catches ownership_verified provenance while ownership is pending', () => {
    const bad = plan({
      actions: [
        action({
          evidenceRefs: [{ kind: 'ownership_record', ref: 'ownership:1', provenance: 'ownership_verified' }],
        }),
      ],
    });
    const codes = auditTruthBoundaries(bad, ctx({ ownership: { status: 'pending', evidenceRefs: [] } })).map(
      (v) => v.code,
    );
    expect(codes).toContain('ownership_provenance_without_verified_state');
  });

  it('catches employer_reviewed provenance while the packet is only opened', () => {
    const bad = plan({
      blockers: [
        blocker({
          evidenceRefs: [{ kind: 'employer_review_record', ref: 'review:1', provenance: 'employer_reviewed' }],
        }),
      ],
      actions: [action({ resolvesBlockerIds: ['blk_x'] })],
    });
    const codes = auditTruthBoundaries(
      bad,
      ctx({ employerReview: { status: 'opened', evidenceRefs: [] } }),
    ).map((v) => v.code);
    expect(codes).toContain('review_provenance_without_reviewed_state');
  });
});

describe('the policy fails closed', () => {
  it('throws instead of returning a plan when the context smuggles bad provenance', () => {
    // Ownership is pending, but the context carries an evidence ref claiming
    // ownership_verified provenance — derivation copies refs verbatim, so the
    // final gate must refuse the whole plan.
    const poisoned = ctx({
      ownership: {
        status: 'pending',
        evidenceRefs: [
          { kind: 'ownership_record', ref: 'ownership:1', provenance: 'ownership_verified' },
        ],
      },
    });
    expect(() => generateStartPlan(poisoned, { now: '2026-08-07T00:00:00.000Z' })).toThrow(
      TruthContractViolationError,
    );
  });
});
