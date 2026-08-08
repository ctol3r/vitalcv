/**
 * POST /api/agent/start-plan — route contract tests: auth gate, refusal of
 * client-authored provenance, canonical NPI validation, honest 503 when
 * canonical state is unreadable, and a happy path that proves the route
 * mutates no clinician truth (its only write is the mocked telemetry call).
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanonicalReaders } from '@/lib/agent/tools/canonical-tools';

const authMock = vi.hoisted(() => vi.fn());
const persistMock = vi.hoisted(() => vi.fn());
const readersMock = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/agent/telemetry/agent-run-store', () => ({
  persistAgentRun: persistMock,
}));
vi.mock('@/lib/agent/server-readers', () => ({
  buildProductionReaders: readersMock,
}));

const NOW = '2026-08-07T00:00:00.000Z';

function healthyReaders(overrides: Partial<CanonicalReaders> = {}): CanonicalReaders {
  return {
    readNppesIdentity: async () => ({ found: true, retrievedAt: NOW }),
    readOwnershipState: async () => ({ state: 'verified' }),
    readProfileCompleteness: async () => ({ score: 100, missingFields: [] }),
    readSourceCoverage: async () => [{ sourceId: 'NPPES_API', state: 'checked', checkedAt: NOW }],
    readOpportunities: async () => null,
    readAgentConsents: async () => [],
    readActionHistory: async () => [],
    triggerSourceRefresh: async () => ({ requested: true }),
    executeApplyShare: async () => null,
    ...overrides,
  };
}

async function loadRoute() {
  return import(new URL('../app/api/agent/start-plan/route.ts', import.meta.url).href);
}

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/agent/start-plan', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.resetModules();
  authMock.mockReset();
  persistMock.mockReset();
  readersMock.mockReset();
  authMock.mockResolvedValue({ userId: 'user_test_1' });
  persistMock.mockResolvedValue({ persisted: true, runId: 'run-1' });
  readersMock.mockReturnValue(healthyReaders());
});

describe('POST /api/agent/start-plan', () => {
  it('returns 401 without a session', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { POST } = await loadRoute();
    const response = await POST(post({}));
    expect(response.status).toBe(401);
  });

  it('refuses client-authored provenance outright', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      post({
        npi: '1234567893',
        ownership: { status: 'verified' },
        evidenceRefs: [{ ref: 'x' }],
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('client-authored provenance');
    expect(body.rejectedFields).toEqual(expect.arrayContaining(['ownership', 'evidenceRefs']));
    expect(persistMock).not.toHaveBeenCalled();
  });

  it('validates the NPI with the canonical checker', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ npi: 'not-an-npi' }));
    expect(response.status).toBe(400);
  });

  it('returns 503 when canonical ownership state is unreadable', async () => {
    readersMock.mockReturnValue(
      healthyReaders({
        readOwnershipState: async () => {
          throw new Error('down');
        },
      }),
    );
    const { POST } = await loadRoute();
    const response = await POST(post({ npi: '1234567893' }));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe('canonical state unavailable');
  });

  it('generates a structured plan for the signed-in subject and only writes telemetry', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ npi: '1234567893' }));
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.plan.policyVersion).toBe('start-policy-v2');
    expect(body.plan.toolsetVersion).toBe('start-toolset-v2');
    expect(body.plan.subject.profileRef).toBe('user_test_1');
    expect(Array.isArray(body.plan.blockers)).toBe(true);
    expect(Array.isArray(body.plan.rankedActionIds)).toBe(true);
    expect(body.narrative?.modelVersion).toBe('template-v1');
    expect(body.inputGaps).toContain('opportunity_retrieval');
    expect(body.telemetry).toEqual({ persisted: true, runId: 'run-1' });

    // The only write the route performs is the telemetry call, for the
    // session subject — no clinician truth mutation exists on this path.
    expect(persistMock).toHaveBeenCalledTimes(1);
    expect(persistMock.mock.calls[0][0].subjectRef).toBe('user_test_1');
  });

  it('still returns the plan when telemetry cannot persist', async () => {
    persistMock.mockResolvedValue({ persisted: false, runId: null });
    const { POST } = await loadRoute();
    const response = await POST(post({ npi: '1234567893' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.telemetry.persisted).toBe(false);
    expect(body.plan.policyVersion).toBe('start-policy-v2');
  });
});
