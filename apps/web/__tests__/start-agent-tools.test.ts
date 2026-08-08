/**
 * Start Agent A0 — tool contract, registry permission ceiling, canonical
 * mapping conservatism, and context-assembler honesty (a failed read is a
 * gap or a refusal, never a state).
 */
import { describe, expect, it } from 'vitest';
import { assembleStartAgentContext, ContextAssemblyError } from '@/lib/agent/context-assembler';
import { buildStartAgentTools, type CanonicalReaders } from '@/lib/agent/tools/canonical-tools';
import { validateAgainstSchema, type AgentTool } from '@/lib/agent/tools/contract';
import {
  createToolRegistry,
  ToolContractError,
  ToolPermissionError,
} from '@/lib/agent/tools/registry';

const NOW = '2026-08-07T00:00:00.000Z';

function readers(overrides: Partial<CanonicalReaders> = {}): CanonicalReaders {
  return {
    readNppesIdentity: async () => ({ found: true, retrievedAt: NOW }),
    readOwnershipState: async () => ({ state: 'verified' }),
    readProfileCompleteness: async () => ({ score: 100, missingFields: [] }),
    readSourceCoverage: async () => [
      { sourceId: 'NPPES_API', state: 'checked', checkedAt: NOW },
      { sourceId: 'OIG_LEIE', state: 'stale', checkedAt: NOW },
      { sourceId: 'STATE_BOARD', state: 'reviewRequired', checkedAt: NOW },
      { sourceId: 'PECOS_PUBLIC', state: 'previewOnly', checkedAt: NOW },
    ],
    readOpportunities: async () => ({ opportunityRefs: [] }),
    ...overrides,
  };
}

describe('schema validation', () => {
  it('rejects missing required fields, wrong types, and unexpected fields', () => {
    const schema = { fields: { npi: { type: 'string' as const, required: true } } };
    expect(validateAgainstSchema({}, schema)).toContain('missing required field: npi');
    expect(validateAgainstSchema({ npi: 5 }, schema).join(' ')).toContain('expected string');
    expect(validateAgainstSchema({ npi: 'x', extra: 1 }, schema)).toContain('unexpected field: extra');
    expect(validateAgainstSchema({ npi: '1234567893' }, schema)).toHaveLength(0);
  });
});

describe('registry permission ceiling', () => {
  const consentTool: AgentTool = {
    id: 'test_level3',
    description: 'level 3',
    requiredPermission: 'execute_with_consent',
    allowedActors: ['clinician_session'],
    inputSchema: { fields: {} },
    outputSchema: { fields: {} },
    execute: async () => ({}),
  };
  const humanTool: AgentTool = {
    id: 'test_level4',
    description: 'level 4',
    requiredPermission: 'human_only',
    allowedActors: ['clinician_session'],
    inputSchema: { fields: {} },
    outputSchema: { fields: {} },
    execute: async () => ({}),
  };

  it('refuses Level 3 and Level 4 execution in A0', async () => {
    const registry = createToolRegistry([consentTool, humanTool]);
    await expect(registry.execute('test_level3', {})).rejects.toThrow(ToolPermissionError);
    await expect(registry.execute('test_level4', {})).rejects.toThrow(ToolPermissionError);
  });

  it('executes Levels 0–2 and enforces both schema directions', async () => {
    const tools = buildStartAgentTools(readers());
    const registry = createToolRegistry(tools);
    const result = await registry.execute<{ resolved: boolean }>('npi_identity_resolution', {
      npi: '1234567893',
    });
    expect(result.resolved).toBe(true);

    await expect(registry.execute('npi_identity_resolution', {})).rejects.toThrow(ToolContractError);

    const draft = await registry.execute<{ draft: Record<string, unknown> }>(
      'share_apply_preparation',
      { planId: 'plan_x', actionId: 'act_x', consentScope: 'share_packet:e1' },
    );
    expect(draft.draft.executed).toBe(false);
  });
});

describe('canonical coverage mapping', () => {
  it('maps conservatively and never upgrades a state', async () => {
    const registry = createToolRegistry(buildStartAgentTools(readers()));
    const result = await registry.execute<{
      available: boolean;
      observations: Array<{ laneId: string; status: string }>;
    }>('source_observation_retrieval', { npi: '1234567893' });
    const byLane = Object.fromEntries(result.observations.map((o) => [o.laneId, o.status]));
    expect(byLane.nppes_api).toBe('current'); // checked is the ONLY state that maps up
    expect(byLane.oig_leie).toBe('stale');
    expect(byLane.state_board).toBe('review_required');
    expect(byLane.pecos_public).toBe('not_checked'); // previewOnly can never present as an observation
  });

  it('fails closed on an unrecognized ownership state', async () => {
    const registry = createToolRegistry(
      buildStartAgentTools(readers({ readOwnershipState: async () => ({ state: 'SOMETHING_NEW' }) })),
    );
    const result = await registry.execute<{ status: string }>('ownership_state', { npi: '1234567893' });
    expect(result.status).toBe('pending');
  });
});

describe('context assembler honesty', () => {
  it('reports failed optional reads as input gaps, not states', async () => {
    const { context, inputGaps } = await assembleStartAgentContext({
      subject: { profileRef: 'subject-1', npi: '1234567893' },
      contextClass: 'test',
      now: NOW,
      readers: readers({
        readSourceCoverage: async () => {
          throw new Error('down');
        },
        readOpportunities: async () => null,
      }),
    });
    expect(inputGaps).toContain('source_observation_retrieval');
    expect(inputGaps).toContain('opportunity_retrieval');
    expect(context.observations).toHaveLength(0);
    expect(context.opportunities.status).toBe('unknown');
    // Readiness stays unknown/unavailable in A0 — nothing else may claim it.
    expect(context.readiness.status).toBe('unknown');
    expect(context.readiness.determinedBy).toBe('unavailable');
  });

  it('refuses to plan when the canonical ownership state cannot be read', async () => {
    await expect(
      assembleStartAgentContext({
        subject: { profileRef: 'subject-1', npi: '1234567893' },
        contextClass: 'test',
        now: NOW,
        readers: readers({
          readOwnershipState: async () => {
            throw new Error('ownership service down');
          },
        }),
      }),
    ).rejects.toThrow(ContextAssemblyError);
  });
});
