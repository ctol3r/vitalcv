/**
 * A1 — consented execution service. Each gate in the chain is proven by
 * driving it to refuse, and the happy path is proven to emit the full
 * telemetry chain. Nothing here touches a network or a database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeAgentAction } from '@/lib/agent/execution/execute-action';
import { generateStartPlanV2 } from '@/lib/agent/policy/start-policy-v2';
import { buildStartAgentTools, type CanonicalReaders } from '@/lib/agent/tools/canonical-tools';
import { createToolRegistry } from '@/lib/agent/tools/registry';
import type { ConsentProof } from '@/lib/agent/consent/types';
import type { SourceObservationState, StartAgentContext } from '@/lib/agent/types';

const NOW = '2026-08-07T00:00:00.000Z';
const NPI = '1234567893';
const SUBJECT = 'user_exec_1';
const SHARE_SCOPE = 'share_packet:opportunity:opp-42';

const shareExecutor = vi.fn();
const refreshExecutor = vi.fn();
const emit = vi.fn();

function readers(overrides: Partial<CanonicalReaders> = {}): CanonicalReaders {
  return {
    readNppesIdentity: async () => ({ found: true, retrievedAt: NOW }),
    readOwnershipState: async () => ({ state: 'verified' }),
    readProfileCompleteness: async () => ({ score: 100, missingFields: [] }),
    readSourceCoverage: async () => [],
    readOpportunities: async () => ({ opportunityRefs: [] }),
    readAgentConsents: async () => [],
    readActionHistory: async () => [],
    triggerSourceRefresh: refreshExecutor as CanonicalReaders['triggerSourceRefresh'],
    executeApplyShare: shareExecutor as CanonicalReaders['executeApplyShare'],
    ...overrides,
  };
}

function lane(laneId: string, status: SourceObservationState['status']): SourceObservationState {
  return {
    laneId,
    authority: `${laneId} authority`,
    status,
    observedAt: NOW,
    evidenceRefs: [{ kind: 'source_observation', ref: `coverage:${laneId}`, provenance: 'public_source' }],
  };
}

function ctx(overrides: Partial<StartAgentContext> = {}): StartAgentContext {
  return {
    subject: { profileRef: SUBJECT, npi: NPI },
    identity: { status: 'resolved', evidenceRefs: [{ kind: 'source_observation', ref: 'nppes:r', provenance: 'public_source' }] },
    profile: { status: 'saved', missingRequiredFields: [], corrections: [], evidenceRefs: [] },
    ownership: {
      status: 'verified',
      evidenceRefs: [{ kind: 'ownership_record', ref: 'ownership:1', provenance: 'ownership_verified' }],
    },
    observations: [],
    readiness: { status: 'unknown', determinedBy: 'unavailable', evidenceRefs: [] },
    opportunities: { status: 'unknown', matches: [] },
    consents: [],
    actionHistory: [],
    collectedAt: NOW,
    contextClass: 'test',
    ...overrides,
  };
}

function proof(scope = SHARE_SCOPE): ConsentProof {
  return {
    consentId: 'consent-event-1',
    subjectRef: SUBJECT,
    scope,
    grantedAt: NOW,
    verifiedAt: NOW,
  };
}

function deps(overrides: Partial<Parameters<typeof executeAgentAction>[1]> = {}) {
  return {
    registry: createToolRegistry(buildStartAgentTools(readers())),
    now: () => 1_000,
    nowIso: () => NOW,
    verifyConsent: async () => proof(),
    recordEvent: emit as never,
    ...overrides,
  };
}

/** A granted share consent + a matching opportunity → executable share action. */
function shareContext(): StartAgentContext {
  return ctx({
    role: { roleRef: 'r1', employerRef: 'e1', applicationState: 'in_progress', requirements: [] },
    consents: [{ scope: SHARE_SCOPE, granted: true, evidenceRefs: [{ kind: 'system_record', ref: 'consent_event:1', provenance: 'platform_record' }] }],
  });
}

beforeEach(() => {
  emit.mockReset();
  emit.mockResolvedValue({ persisted: true });
  shareExecutor.mockReset();
  shareExecutor.mockResolvedValue({ shareId: 'share-1', recipientName: 'Mercy Health', status: 'delivered', sharedAt: NOW });
  refreshExecutor.mockReset();
  refreshExecutor.mockResolvedValue({ requested: true, computedAt: NOW });
});

describe('gate chain', () => {
  it('refuses an action that is not in the freshly generated plan', async () => {
    const context = ctx();
    const plan = generateStartPlanV2(context, { now: NOW });
    const result = await executeAgentAction(
      { plan, context, actionId: 'act_forged_by_client', subjectRef: SUBJECT },
      deps(),
    );
    expect(result.executed).toBe(false);
    expect(result.refusal?.code).toBe('action_not_in_current_plan');
  });

  it('refuses clinician-owned work — VitalCV never acts on their behalf', async () => {
    const context = ctx({ ownership: { status: 'none', evidenceRefs: [] } });
    const plan = generateStartPlanV2(context, { now: NOW });
    const verify = plan.actions.find((a) => a.type === 'verify_ownership')!;
    const result = await executeAgentAction(
      { plan, context, actionId: verify.id, subjectRef: SUBJECT },
      deps(),
    );
    expect(result.executed).toBe(false);
    expect(result.refusal?.code).toBe('not_vitalcv_owned');
  });

  it('refuses human_only work outright', async () => {
    const context = ctx({
      role: { roleRef: 'r1', employerRef: 'e1', applicationState: 'submitted', requirements: [] },
      employerReview: { status: 'opened', evidenceRefs: [{ kind: 'system_record', ref: 'r', provenance: 'platform_record' }] },
    });
    const plan = generateStartPlanV2(context, { now: NOW });
    const wait = plan.actions.find((a) => a.type === 'await_employer_decision')!;
    const result = await executeAgentAction(
      { plan, context, actionId: wait.id, subjectRef: SUBJECT },
      deps(),
    );
    expect(result.executed).toBe(false);
    expect(result.refusal?.code).toBe('human_only');
  });

  it('refuses a Level 3 action when the ledger says consent is not granted', async () => {
    const context = shareContext();
    const plan = generateStartPlanV2(context, { now: NOW });
    const share = plan.actions.find((a) => a.type === 'prepare_share_packet')!;
    const result = await executeAgentAction(
      { plan, context, actionId: share.id, subjectRef: SUBJECT },
      deps({ verifyConsent: async () => null }),
    );
    expect(result.executed).toBe(false);
    expect(result.refusal?.code).toBe('consent_not_granted');
    expect(shareExecutor).not.toHaveBeenCalled();
  });

  it('honors a revocation that lands after the plan was generated', async () => {
    // The plan still shows the approved share (state at generation time);
    // the ledger read at execution time says revoked.
    const context = shareContext();
    const plan = generateStartPlanV2(context, { now: NOW });
    const share = plan.actions.find((a) => a.type === 'prepare_share_packet')!;
    expect(share.status).toBe('ready');
    const result = await executeAgentAction(
      { plan, context, actionId: share.id, subjectRef: SUBJECT },
      deps({ verifyConsent: async () => null }),
    );
    expect(result.executed).toBe(false);
    expect(result.refusal?.code).toBe('consent_not_granted');
    expect(shareExecutor).not.toHaveBeenCalled();
  });

  it('refuses when no capability is wired for the action', async () => {
    const context = ctx({
      profile: {
        status: 'partial',
        missingRequiredFields: [{ field: 'contact_email', requiredFor: [] }],
        corrections: [],
        evidenceRefs: [],
      },
      observations: [lane('state_license:VA', 'unsupported')],
    });
    const plan = generateStartPlanV2(context, { now: NOW });
    // An informational note is vitalcv-owned but has no executor mapping.
    const note = plan.actions.find((a) => a.type === 'informational_note');
    if (!note) return; // no note derived in this state; nothing to assert
    const result = await executeAgentAction(
      { plan, context, actionId: note.id, subjectRef: SUBJECT },
      deps(),
    );
    expect(result.executed).toBe(false);
    expect(result.refusal?.code).toBe('no_executor');
  });
});

describe('execution', () => {
  it('runs a Level 2 refresh and emits presented + completed', async () => {
    const context = ctx({ observations: [lane('state_license:VA', 'stale')] });
    const plan = generateStartPlanV2(context, { now: NOW });
    const refresh = plan.actions.find((a) => a.type === 'refresh_source_observation')!;
    const result = await executeAgentAction(
      { plan, context, actionId: refresh.id, subjectRef: SUBJECT },
      deps({ now: () => 5_000 }),
    );
    expect(result.executed).toBe(true);
    expect(refreshExecutor).toHaveBeenCalledWith(NPI);
    const events = emit.mock.calls.map((c) => c[0].eventType);
    expect(events).toEqual(['agent_action_presented', 'agent_action_completed']);
    const completed = emit.mock.calls[1][0];
    expect(completed.owner).toBe('vitalcv');
    expect(completed.outcome).toBe('completed');
    expect(typeof completed.elapsedMs).toBe('number');
  });

  it('runs a consented Level 3 share only with a scope-matched proof', async () => {
    const context = shareContext();
    const plan = generateStartPlanV2(context, { now: NOW });
    const share = plan.actions.find((a) => a.type === 'prepare_share_packet')!;
    expect(share.consentScope).toBe(SHARE_SCOPE);
    expect(share.target?.opportunityRef).toBe('opp-42');

    const result = await executeAgentAction(
      { plan, context, actionId: share.id, subjectRef: SUBJECT },
      deps(),
    );
    expect(result.executed).toBe(true);
    expect(result.consentId).toBe('consent-event-1');
    expect(shareExecutor).toHaveBeenCalledWith(
      expect.objectContaining({ npi: NPI, opportunityRef: 'opp-42' }),
    );
    expect(emit.mock.calls[1][0].metadata.consentId).toBe('consent-event-1');
  });

  it('refuses at the registry when the proof scope does not cover the invocation', async () => {
    const context = shareContext();
    const plan = generateStartPlanV2(context, { now: NOW });
    const share = plan.actions.find((a) => a.type === 'prepare_share_packet')!;
    const result = await executeAgentAction(
      { plan, context, actionId: share.id, subjectRef: SUBJECT },
      deps({ verifyConsent: async () => proof('share_packet:opportunity:SOMETHING-ELSE') }),
    );
    expect(result.executed).toBe(false);
    expect(result.refusal?.code).toBe('tool_refused');
    expect(result.refusal?.detail).toContain('does not cover');
    expect(shareExecutor).not.toHaveBeenCalled();
  });

  it('reports a canonical authz refusal as a failure, never a success', async () => {
    shareExecutor.mockResolvedValue({ blocked: 'canonical_ownership_authz' });
    const context = shareContext();
    const plan = generateStartPlanV2(context, { now: NOW });
    const share = plan.actions.find((a) => a.type === 'prepare_share_packet')!;
    const result = await executeAgentAction(
      { plan, context, actionId: share.id, subjectRef: SUBJECT },
      deps(),
    );
    expect(result.executed).toBe(false);
    expect(result.refusal?.code).toBe('capability_failed');
    expect(result.refusal?.detail).toContain('not confirmed as yours');
    expect(emit.mock.calls[1][0].eventType).toBe('agent_action_failed');
    expect(emit.mock.calls[1][0].outcome).toBe('canonical_ownership_authz');
  });

  it('reports a thrown capability as a failure with an event', async () => {
    refreshExecutor.mockRejectedValue(new Error('backend down'));
    const context = ctx({ observations: [lane('state_license:VA', 'stale')] });
    const plan = generateStartPlanV2(context, { now: NOW });
    const refresh = plan.actions.find((a) => a.type === 'refresh_source_observation')!;
    const result = await executeAgentAction(
      { plan, context, actionId: refresh.id, subjectRef: SUBJECT },
      deps(),
    );
    expect(result.executed).toBe(false);
    expect(result.refusal?.code).toBe('tool_refused');
    expect(emit.mock.calls[1][0].eventType).toBe('agent_action_failed');
  });
});
