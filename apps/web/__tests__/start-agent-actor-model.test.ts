/**
 * A2.0 — the actor model.
 *
 * This suite IS the gate for the sub-wave: it proves a background run cannot
 * reach identity-bound tools, cannot disclose, and produces a context that
 * says so honestly rather than one that guesses.
 */
import { describe, expect, it, vi } from 'vitest';
import { assembleStartAgentContext } from '@/lib/agent/context-assembler';
import { generateStartPlanV2 } from '@/lib/agent/policy/start-policy-v2';
import { buildStartAgentTools, type CanonicalReaders } from '@/lib/agent/tools/canonical-tools';
import { createToolRegistry, ToolActorError } from '@/lib/agent/tools/registry';
import type { AgentTool } from '@/lib/agent/tools/contract';

const NOW = '2026-08-08T00:00:00.000Z';
const NPI = '1234567893';
const SUBJECT = 'user_actor_1';

const shareExecutor = vi.fn(async () => ({ shareId: 's1', status: 'delivered' }));

function readers(overrides: Partial<CanonicalReaders> = {}): CanonicalReaders {
  return {
    readNppesIdentity: async () => ({ found: true, retrievedAt: NOW }),
    readOwnershipState: async () => ({ state: 'verified' }),
    readProfileCompleteness: async () => ({ score: 100, missingFields: [] }),
    readSourceCoverage: async () => [{ sourceId: 'STATE_BOARD', state: 'stale', checkedAt: NOW }],
    readOpportunities: async () => ({ opportunityRefs: ['opp-42'] }),
    readAgentConsents: async () => [],
    readActionHistory: async () => [],
    triggerSourceRefresh: async () => ({ requested: true }),
    executeApplyShare: shareExecutor as CanonicalReaders['executeApplyShare'],
    ...overrides,
  };
}

const IDENTITY_BOUND = ['ownership_state', 'clinician_profile_retrieval', 'execute_apply_share'];
const SESSION_FREE = [
  'npi_identity_resolution',
  'source_observation_retrieval',
  'opportunity_retrieval',
  'consent_state_retrieval',
  'action_history_retrieval',
  'trigger_source_refresh',
];

describe('actor-scoped tool availability', () => {
  it('a clinician session reaches every tool', () => {
    const registry = createToolRegistry(buildStartAgentTools(readers()), {
      actor: 'clinician_session',
    });
    expect(registry.actor).toBe('clinician_session');
    expect(registry.availableTools()).toHaveLength(registry.list().length);
  });

  it('defaults to a clinician session, so pre-A2 callers are unchanged', () => {
    expect(createToolRegistry(buildStartAgentTools(readers())).actor).toBe('clinician_session');
  });

  it('the scheduler cannot reach identity-bound tools — the A2.0 gate', async () => {
    const registry = createToolRegistry(buildStartAgentTools(readers()), {
      actor: 'system_scheduler',
    });
    for (const id of IDENTITY_BOUND) {
      expect(registry.isAvailable(id), `${id} must be unavailable to the scheduler`).toBe(false);
      await expect(registry.execute(id, { npi: NPI }), id).rejects.toBeInstanceOf(ToolActorError);
    }
    expect(shareExecutor).not.toHaveBeenCalled();
  });

  it('the scheduler still reaches every session-free tool', async () => {
    const registry = createToolRegistry(buildStartAgentTools(readers()), {
      actor: 'system_scheduler',
    });
    for (const id of SESSION_FREE) {
      expect(registry.isAvailable(id), `${id} should be available to the scheduler`).toBe(true);
    }
    await expect(registry.execute('trigger_source_refresh', { npi: NPI })).resolves.toMatchObject({
      requested: true,
    });
  });

  it('refuses a Level-3 tool for the scheduler even when it wrongly lists the actor (D1)', async () => {
    // The declaration is the mistake a future contributor makes; the hard
    // invariant is what stops it from becoming a background disclosure.
    const misdeclared: AgentTool = {
      id: 'rogue_share',
      description: 'A disclosing tool that wrongly claims the scheduler may run it.',
      requiredPermission: 'execute_with_consent',
      allowedActors: ['clinician_session', 'system_scheduler'],
      inputSchema: { fields: { consentScope: { type: 'string', required: true } } },
      outputSchema: { fields: { executed: { type: 'boolean', required: true } } },
      execute: async () => ({ executed: true }),
    };
    const registry = createToolRegistry([misdeclared], { actor: 'system_scheduler' });
    expect(registry.isAvailable('rogue_share')).toBe(false);
    await expect(
      registry.execute('rogue_share', { consentScope: 'share_packet:opportunity:x' }),
    ).rejects.toThrow(/may never execute a disclosing action/);
  });

  it('the same misdeclared tool still runs for a clinician session with a proof', async () => {
    const tool: AgentTool = {
      id: 'consented_thing',
      description: 'Level 3.',
      requiredPermission: 'execute_with_consent',
      allowedActors: ['clinician_session'],
      inputSchema: { fields: { consentScope: { type: 'string', required: true } } },
      outputSchema: { fields: { executed: { type: 'boolean', required: true } } },
      execute: async () => ({ executed: true }),
    };
    const registry = createToolRegistry([tool], { actor: 'clinician_session' });
    await expect(
      registry.execute(
        'consented_thing',
        { consentScope: 'scope:x' },
        {
          consentProof: {
            consentId: 'c1',
            subjectRef: SUBJECT,
            scope: 'scope:x',
            grantedAt: NOW,
            verifiedAt: NOW,
          },
        },
      ),
    ).resolves.toMatchObject({ executed: true });
  });
});

describe('reduced context', () => {
  async function assemble(actor: 'clinician_session' | 'system_scheduler') {
    const registry = createToolRegistry(buildStartAgentTools(readers()), { actor });
    return assembleStartAgentContext({
      subject: { profileRef: SUBJECT, npi: NPI },
      contextClass: 'actor_test',
      now: NOW,
      registry,
    });
  }

  it('a clinician session assembles a full context', async () => {
    const { context } = await assemble('clinician_session');
    expect(context).toMatchObject({ actor: 'clinician_session', completeness: 'full' });
    expect(context.ownership.status).toBe('verified');
  });

  it('a scheduler assembles a reduced context with ownership UNKNOWN, not none', async () => {
    const { context, inputGaps } = await assemble('system_scheduler');
    expect(context).toMatchObject({ actor: 'system_scheduler', completeness: 'reduced' });
    // The distinction the whole sub-wave rests on: "we could not look" is
    // neither "there is no claim" nor "the claim is good".
    expect(context.ownership.status).toBe('unknown');
    expect(context.ownership.evidenceRefs).toEqual([]);
    expect(inputGaps).toContain('ownership_state:actor_unavailable');
    expect(inputGaps).toContain('clinician_profile_retrieval:actor_unavailable');
  });

  it('the registry binding wins over a claimed actor', async () => {
    // A caller cannot say "I am the scheduler" while holding a session
    // registry, or vice versa — the capabilities decide.
    const registry = createToolRegistry(buildStartAgentTools(readers()), {
      actor: 'system_scheduler',
    });
    const { context } = await assembleStartAgentContext({
      subject: { profileRef: SUBJECT, npi: NPI },
      contextClass: 'actor_test',
      now: NOW,
      actor: 'clinician_session',
      registry,
    });
    expect(context.actor).toBe('system_scheduler');
  });

  it('an ordinary read failure still leaves the context FULL', async () => {
    // Reduced means "structurally out of reach for this actor", not "a read
    // happened to fail" — otherwise a flaky source would masquerade as a
    // different kind of run.
    const registry = createToolRegistry(
      buildStartAgentTools(readers({ readSourceCoverage: async () => null })),
      { actor: 'clinician_session' },
    );
    const { context, inputGaps } = await assembleStartAgentContext({
      subject: { profileRef: SUBJECT, npi: NPI },
      contextClass: 'actor_test',
      now: NOW,
      registry,
    });
    expect(context.completeness).toBe('full');
    expect(inputGaps).toContain('source_observation_retrieval');
  });
});

describe('planning from a reduced context', () => {
  async function reducedPlan() {
    const registry = createToolRegistry(buildStartAgentTools(readers()), {
      actor: 'system_scheduler',
    });
    const { context } = await assembleStartAgentContext({
      subject: { profileRef: SUBJECT, npi: NPI },
      contextClass: 'actor_test',
      now: NOW,
      registry,
    });
    return { plan: generateStartPlanV2(context, { now: NOW }), context };
  }

  it('carries actor and completeness onto the plan', async () => {
    const { plan } = await reducedPlan();
    expect(plan).toMatchObject({ actor: 'system_scheduler', completeness: 'reduced' });
  });

  it('invents no ownership blocker when ownership is merely unreadable', async () => {
    const { plan } = await reducedPlan();
    expect(plan.blockers.map((b) => b.type)).not.toContain('ownership_verification_required');
    expect(plan.actions.map((a) => a.type)).not.toContain('verify_ownership');
  });

  it('derives no share work it cannot justify', async () => {
    const { plan } = await reducedPlan();
    expect(plan.actions.map((a) => a.type)).not.toContain('prepare_share_packet');
    // …but the background work it CAN justify is still there.
    expect(plan.actions.map((a) => a.type)).toContain('refresh_source_observation');
  });

  it('still refuses to clear ownership: a full context with the same NPI does derive the share', async () => {
    // The contrast that proves suppression is about the unknown state, not
    // about the scheduler simply producing thinner plans.
    const registry = createToolRegistry(
      buildStartAgentTools(
        readers({
          readAgentConsents: async () => [
            { scope: 'share_packet:opportunity:opp-42', granted: true, eventRef: 'e1', at: NOW },
          ],
        }),
      ),
      { actor: 'clinician_session' },
    );
    const { context } = await assembleStartAgentContext({
      subject: { profileRef: SUBJECT, npi: NPI },
      contextClass: 'actor_test',
      now: NOW,
      registry,
    });
    const plan = generateStartPlanV2(context, { now: NOW });
    expect(context.completeness).toBe('full');
    expect(plan.actions.map((a) => a.type)).toContain('prepare_share_packet');
  });
});
