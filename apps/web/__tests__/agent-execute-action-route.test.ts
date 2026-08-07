/**
 * POST /api/agent/execute-action — auth, refusal of client-authored plan /
 * consent / subject, server-side plan regeneration, and honest refusal
 * semantics (a declined action is a 200 with executed:false and a reason).
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanonicalReaders } from '@/lib/agent/tools/canonical-tools';

const authMock = vi.hoisted(() => vi.fn());
const readersMock = vi.hoisted(() => vi.fn());
const verifyConsentMock = vi.hoisted(() => vi.fn());
const recordEventMock = vi.hoisted(() => vi.fn());
const shareMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/agent/server-readers', () => ({ buildProductionReaders: readersMock }));
vi.mock('@/lib/agent/consent/consent-store', () => ({
  verifyAgentConsent: verifyConsentMock,
  readAgentConsentStates: vi.fn(async () => []),
  grantAgentConsent: vi.fn(),
  revokeAgentConsent: vi.fn(),
}));
vi.mock('@/lib/agent/telemetry/agent-run-store', () => ({
  recordAgentEvent: recordEventMock,
  readAgentActionHistory: vi.fn(async () => []),
  persistAgentRun: vi.fn(),
}));

const NOW = '2026-08-07T00:00:00.000Z';
const NPI = '1234567893';
const SHARE_SCOPE = 'share_packet:opportunity:opp-42';

function readers(overrides: Partial<CanonicalReaders> = {}): CanonicalReaders {
  return {
    readNppesIdentity: async () => ({ found: true, retrievedAt: NOW }),
    readOwnershipState: async () => ({ state: 'verified' }),
    readProfileCompleteness: async () => ({ score: 100, missingFields: [] }),
    readSourceCoverage: async () => [{ sourceId: 'STATE_BOARD', state: 'stale', checkedAt: NOW }],
    readOpportunities: async () => ({ opportunityRefs: [] }),
    readAgentConsents: async () => [],
    readActionHistory: async () => [],
    triggerSourceRefresh: refreshMock as CanonicalReaders['triggerSourceRefresh'],
    executeApplyShare: shareMock as CanonicalReaders['executeApplyShare'],
    ...overrides,
  };
}

async function loadRoute() {
  return import(new URL('../app/api/agent/execute-action/route.ts', import.meta.url).href);
}

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/agent/execute-action', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

/** Regenerate the plan the same way the route does, to discover action ids. */
async function currentPlan(overrides: Partial<CanonicalReaders> = {}) {
  const { assembleStartAgentContext } = await import('@/lib/agent/context-assembler');
  const { generateStartPlanV2 } = await import('@/lib/agent/policy/start-policy-v2');
  const { context } = await assembleStartAgentContext({
    subject: { profileRef: 'user_exec_route', npi: NPI },
    contextClass: 'holder_execute',
    now: NOW,
    readers: readers(overrides),
  });
  return generateStartPlanV2(context, { now: NOW });
}

beforeEach(() => {
  vi.resetModules();
  authMock.mockReset();
  readersMock.mockReset();
  verifyConsentMock.mockReset();
  recordEventMock.mockReset();
  shareMock.mockReset();
  refreshMock.mockReset();
  authMock.mockResolvedValue({ userId: 'user_exec_route' });
  readersMock.mockReturnValue(readers());
  recordEventMock.mockResolvedValue({ persisted: true });
  refreshMock.mockResolvedValue({ requested: true, computedAt: NOW });
  shareMock.mockResolvedValue({ shareId: 'share-1', status: 'delivered', sharedAt: NOW });
  verifyConsentMock.mockResolvedValue(null);
});

describe('POST /api/agent/execute-action', () => {
  it('requires a session', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { POST } = await loadRoute();
    expect((await POST(post({ actionId: 'act_x' }))).status).toBe(401);
  });

  it('refuses a client-authored plan, consent proof, or subject', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      post({ actionId: 'act_x', plan: {}, consentProof: { scope: 'x' }, subjectRef: 'someone' }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.rejectedFields).toEqual(expect.arrayContaining(['plan', 'consentProof', 'subjectRef']));
  });

  it('requires an actionId and validates any supplied NPI', async () => {
    const { POST } = await loadRoute();
    expect((await POST(post({}))).status).toBe(400);
    expect((await POST(post({ actionId: 'act_x', npi: 'nope' }))).status).toBe(400);
  });

  it('refuses an action absent from the regenerated plan with 200 + reason', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ actionId: 'act_not_real', npi: NPI }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.executed).toBe(false);
    expect(body.refusal.code).toBe('action_not_in_current_plan');
    expect(body.policyVersion).toBe('start-policy-v2');
  });

  it('executes a Level 2 refresh through the canonical capability', async () => {
    const plan = await currentPlan();
    const refresh = plan.actions.find((a) => a.type === 'refresh_source_observation')!;
    const { POST } = await loadRoute();
    const response = await POST(post({ actionId: refresh.id, npi: NPI }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.executed).toBe(true);
    expect(refreshMock).toHaveBeenCalledWith(NPI);
  });

  it('refuses a Level 3 share when the ledger has no grant, and runs it when it does', async () => {
    const granted: Partial<CanonicalReaders> = {
      readAgentConsents: async () => [
        { scope: SHARE_SCOPE, granted: true, eventRef: 'evt-1', at: NOW },
      ],
    };
    readersMock.mockReturnValue(readers(granted));
    const plan = await currentPlan(granted);
    const share = plan.actions.find((a) => a.type === 'prepare_share_packet')!;

    const { POST } = await loadRoute();
    const refused = await (await POST(post({ actionId: share.id, npi: NPI }))).json();
    expect(refused.executed).toBe(false);
    expect(refused.refusal.code).toBe('consent_not_granted');
    expect(shareMock).not.toHaveBeenCalled();

    verifyConsentMock.mockResolvedValue({
      consentId: 'evt-1',
      subjectRef: 'user_exec_route',
      scope: SHARE_SCOPE,
      grantedAt: NOW,
      verifiedAt: NOW,
    });
    const { POST: POST2 } = await loadRoute();
    const executed = await (await POST2(post({ actionId: share.id, npi: NPI }))).json();
    expect(executed.executed).toBe(true);
    expect(executed.consentId).toBe('evt-1');
    expect(shareMock).toHaveBeenCalledWith(
      expect.objectContaining({ npi: NPI, opportunityRef: 'opp-42' }),
    );
  });

  it('returns 503 when canonical ownership state cannot be read', async () => {
    readersMock.mockReturnValue(
      readers({
        readOwnershipState: async () => {
          throw new Error('down');
        },
      }),
    );
    const { POST } = await loadRoute();
    const response = await POST(post({ actionId: 'act_x', npi: NPI }));
    expect(response.status).toBe(503);
  });
});
