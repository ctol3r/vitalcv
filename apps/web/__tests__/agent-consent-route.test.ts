/**
 * POST/GET /api/agent/consent — the server-derived authorization contract.
 *
 * The client approves an ACTION; the scope is derived from the canonical
 * action in a freshly regenerated plan. These tests pin that a caller cannot
 * author the authorization namespace through either the grant or the revoke
 * surface, and that the derivation gates match the executor's.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanonicalReaders } from '@/lib/agent/tools/canonical-tools';

const authMock = vi.hoisted(() => vi.fn());
const grantMock = vi.hoisted(() => vi.fn());
const revokeMock = vi.hoisted(() => vi.fn());
const readMock = vi.hoisted(() => vi.fn());
const resolveRefMock = vi.hoisted(() => vi.fn());
const readersMock = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/agent/consent/consent-store', () => ({
  grantAgentConsent: grantMock,
  revokeAgentConsent: revokeMock,
  readAgentConsentStates: readMock,
  resolveConsentScopeByRef: resolveRefMock,
  verifyAgentConsent: vi.fn(),
}));
vi.mock('@/lib/agent/server-readers', () => ({ buildProductionReaders: readersMock }));

const NOW = '2026-08-07T00:00:00.000Z';
const NPI = '1234567893';
const SHARE_SCOPE = 'share_packet:opportunity:opp-42';

function readers(overrides: Partial<CanonicalReaders> = {}): CanonicalReaders {
  return {
    readNppesIdentity: async () => ({ found: true, retrievedAt: NOW }),
    readOwnershipState: async () => ({ state: 'verified' }),
    readProfileCompleteness: async () => ({ score: 100, missingFields: [] }),
    readSourceCoverage: async () => [{ sourceId: 'STATE_BOARD', state: 'stale', checkedAt: NOW }],
    readOpportunities: async () => ({ opportunityRefs: ['opp-42'] }),
    // An UNGRANTED share consent is what produces the awaiting-consent
    // prepare action the clinician approves.
    readAgentConsents: async () => [],
    readActionHistory: async () => [],
    triggerSourceRefresh: async () => ({ requested: true }),
    executeApplyShare: async () => null,
    ...overrides,
  };
}

async function loadRoute() {
  return import(new URL('../app/api/agent/consent/route.ts', import.meta.url).href);
}

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/agent/consent', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * The plan the route will regenerate. The share action only appears when
 * something asks for that consent, so this mirrors the real derivation
 * rather than inventing an action id.
 */
async function currentPlan(overrides: Partial<CanonicalReaders> = {}) {
  const { buildCurrentPlan } = await import('@/lib/agent/current-plan');
  readersMock.mockReturnValue(readers(overrides));
  return (await buildCurrentPlan({ subjectRef: 'user_consent_1', npi: NPI, contextClass: 'holder_consent', now: NOW }))
    .plan;
}

beforeEach(() => {
  vi.resetModules();
  authMock.mockReset();
  grantMock.mockReset();
  revokeMock.mockReset();
  readMock.mockReset();
  resolveRefMock.mockReset();
  readersMock.mockReset();
  authMock.mockResolvedValue({ userId: 'user_consent_1' });
  readersMock.mockReturnValue(readers());
  grantMock.mockResolvedValue({ persisted: true, eventId: 'evt-1', changed: true, seq: 1 });
  revokeMock.mockResolvedValue({ persisted: true, eventId: 'evt-2', changed: true, seq: 2 });
  readMock.mockResolvedValue([
    { scope: SHARE_SCOPE, granted: true, eventRef: 'evt-1', seq: 1, at: NOW },
  ]);
  resolveRefMock.mockResolvedValue(SHARE_SCOPE);
});

describe('server-derived authorization', () => {
  it('requires a session', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { POST } = await loadRoute();
    expect((await POST(post({ decision: 'grant', actionId: 'act_x' }))).status).toBe(401);
  });

  it('refuses a client-supplied scope outright — the browser never names the namespace', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ decision: 'grant', actionId: 'act_x', scope: 'share_packet:anything-i-want' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.rejectedFields).toContain('scope');
    expect(grantMock).not.toHaveBeenCalled();
  });

  it('refuses a client-supplied planId, subject, or proof', async () => {
    const { POST } = await loadRoute();
    const body = await (
      await POST(post({ decision: 'grant', actionId: 'act_x', planId: 'plan_forged', subjectRef: 'someone', consentProof: {} }))
    ).json();
    expect(body.rejectedFields).toEqual(expect.arrayContaining(['planId', 'subjectRef', 'consentProof']));
    expect(grantMock).not.toHaveBeenCalled();
  });

  it('requires an actionId to grant', async () => {
    const { POST } = await loadRoute();
    expect((await POST(post({ decision: 'grant' }))).status).toBe(400);
    expect((await POST(post({ decision: 'maybe', actionId: 'act_x' }))).status).toBe(400);
  });

  it('derives the scope from the canonical action and records THAT', async () => {
    const plan = await currentPlan();
    const share = plan.actions.find((a) => a.type === 'prepare_share_packet')!;
    expect(share.permission).toBe('execute_with_consent');

    const { POST } = await loadRoute();
    const response = await POST(post({ decision: 'grant', actionId: share.id, npi: NPI }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ scope: SHARE_SCOPE, granted: true, changed: true, eventRef: 'evt-1', seq: 1 });
    expect(grantMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectRef: 'user_consent_1',
        scope: SHARE_SCOPE, // derived from the action, not supplied
        actionId: share.id,
      }),
    );
    // The recorded planId is the SERVER's regenerated plan — note it differs
    // from the plan this test built moments earlier (planId hashes the
    // context fingerprint, which includes the collection clock), while the
    // action id is content-derived and therefore stable across regenerations.
    // That stability is exactly what makes approve-by-action-id workable.
    expect(grantMock.mock.calls[0][0].planId).toBe(body.planId);
    expect(body.planId).not.toBe(plan.planId);
    expect(body.actionId).toBe(share.id);
  });

  it('refuses a stale or nonexistent action with 409', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ decision: 'grant', actionId: 'act_from_a_stale_tab', npi: NPI }));
    expect(response.status).toBe(409);
    expect((await response.json()).refusal).toBe('action_not_in_current_plan');
    expect(grantMock).not.toHaveBeenCalled();
  });

  it('refuses an action that needs no consent', async () => {
    const plan = await currentPlan();
    const refresh = plan.actions.find((a) => a.type === 'refresh_source_observation')!;
    const { POST } = await loadRoute();
    const response = await POST(post({ decision: 'grant', actionId: refresh.id, npi: NPI }));
    expect(response.status).toBe(422);
    expect((await response.json()).refusal).toBe('action_does_not_require_consent');
    expect(grantMock).not.toHaveBeenCalled();
  });

  it('refuses a human-only action — approval would not let VitalCV act', async () => {
    const overrides: Partial<CanonicalReaders> = {
      readSourceCoverage: async () => [{ sourceId: 'STATE_BOARD', state: 'unavailable', checkedAt: NOW }],
    };
    const plan = await currentPlan(overrides);
    const waiting = plan.actions.find((a) => a.permission === 'observe' || a.permission === 'human_only');
    if (!waiting) return;
    readersMock.mockReturnValue(readers(overrides));
    const { POST } = await loadRoute();
    const response = await POST(post({ decision: 'grant', actionId: waiting.id, npi: NPI }));
    expect(response.status).toBe(422);
    expect(['human_only_action', 'action_does_not_require_consent']).toContain(
      (await response.json()).refusal,
    );
    expect(grantMock).not.toHaveBeenCalled();
  });

  it('reports 503 when the ledger write does not persist — never a phantom grant', async () => {
    grantMock.mockResolvedValue({ persisted: false, eventId: null, changed: false, seq: null });
    const plan = await currentPlan();
    const share = plan.actions.find((a) => a.type === 'prepare_share_packet')!;
    const { POST } = await loadRoute();
    const response = await POST(post({ decision: 'grant', actionId: share.id, npi: NPI }));
    expect(response.status).toBe(503);
  });
});

describe('revocation', () => {
  it('derives the scope from a live action', async () => {
    const plan = await currentPlan();
    const share = plan.actions.find((a) => a.type === 'prepare_share_packet')!;
    const { POST } = await loadRoute();
    const response = await POST(post({ decision: 'revoke', actionId: share.id, npi: NPI }));
    expect(response.status).toBe(200);
    expect((await response.json()).granted).toBe(false);
    expect(revokeMock).toHaveBeenCalledWith(expect.objectContaining({ scope: SHARE_SCOPE }));
  });

  it('resolves a server-issued consentRef when the action has left the plan', async () => {
    // The clinician must still be able to withdraw an approval whose action
    // no longer appears — the ref comes from GET, not from the caller's head.
    const { POST } = await loadRoute();
    const response = await POST(post({ decision: 'revoke', consentRef: 'evt-1' }));
    expect(response.status).toBe(200);
    expect((await response.json()).scope).toBe(SHARE_SCOPE);
    expect(resolveRefMock).toHaveBeenCalledWith('user_consent_1', 'evt-1');
    expect(revokeMock).toHaveBeenCalledWith(expect.objectContaining({ scope: SHARE_SCOPE }));
  });

  it('cannot create namespace through the revoke surface', async () => {
    // A scope is still rejected outright…
    const { POST } = await loadRoute();
    expect((await POST(post({ decision: 'revoke', scope: 'invented:scope' }))).status).toBe(400);
    // …and an unknown ref resolves to nothing rather than creating anything.
    resolveRefMock.mockResolvedValue(null);
    const { POST: POST2 } = await loadRoute();
    const response = await POST2(post({ decision: 'revoke', consentRef: 'not-mine' }));
    expect(response.status).toBe(404);
    expect(revokeMock).not.toHaveBeenCalled();
  });

  it('requires an actionId or consentRef', async () => {
    const { POST } = await loadRoute();
    expect((await POST(post({ decision: 'revoke' }))).status).toBe(400);
  });
});

describe('GET /api/agent/consent', () => {
  it('returns the fold for the session subject', async () => {
    const { GET } = await loadRoute();
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).consents[0]).toMatchObject({ scope: SHARE_SCOPE, seq: 1 });
    expect(readMock).toHaveBeenCalledWith('user_consent_1');
  });
});
