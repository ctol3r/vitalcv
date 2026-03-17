import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();
const loadStorylineDetailMock = vi.fn();
const normalizeActionDetailResponseMock = vi.fn((payload) => payload);

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

vi.mock('@/lib/api', () => ({
  getApiBase: () => 'http://backend.test',
  getBackendBase: () => 'http://backend.test',
}));

vi.mock('@/lib/intelligence/server', () => ({
  loadStorylineDetail: loadStorylineDetailMock,
}));

vi.mock('@/lib/intelligence/detail-normalizers', () => ({
  normalizeActionDetailResponse: normalizeActionDetailResponseMock,
}));

describe('intelligence auth forwarding', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    authMock.mockReset();
    loadStorylineDetailMock.mockReset();
    normalizeActionDetailResponseMock.mockClear();
    process.env.BACKEND_URL = 'http://backend.test';
  });

  it('buildForwardHeaders resolves the active workspace org and forwards role aliases', async () => {
    const getToken = vi.fn().mockResolvedValue('clerk-session-token');
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      orgId: null,
      getToken,
      sessionClaims: {
        email: 'ada@example.com',
        vitalcv: { role: 'operator' },
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ activeOrgId: 'org-active-1' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { buildForwardHeaders } = await import('../app/api/intelligence/_shared');
    const headers = await buildForwardHeaders({ 'Content-Type': 'application/json' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/me/workspaces',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );
    const [, workspaceInit] = fetchMock.mock.calls[0] as [string, { headers: Headers }];
    expect(workspaceInit.headers.get('authorization')).toBe('Bearer clerk-session-token');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('accept')).toBe('application/json');
    expect(headers.get('authorization')).toBe('Bearer clerk-session-token');
    expect(headers.get('x-clerk-user-id')).toBe('clerk-user-1');
    expect(headers.get('x-clerk-user-email')).toBe('ada@example.com');
    expect(headers.get('x-clerk-user-role')).toBe('operator');
    expect(headers.get('x-user-role')).toBe('operator');
    expect(headers.get('x-org-id')).toBe('org-active-1');
  });

  it('returns the live provider directory when the session is missing', async () => {
    authMock.mockResolvedValue({ userId: null, orgId: null, sessionClaims: {} });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        entries: [{
          npi: '1902301456',
          fullName: 'Amelia Hart',
          specialties: ['Medical Oncology'],
          credentialCount: 3,
          activeCredentials: 3,
          primaryIssuer: 'Mayo Clinic Jacksonville',
          credentialHealth: 'VERIFIED',
          lastVerifiedAt: '2026-03-17T00:00:00.000Z',
          trustScore: 61,
        }],
        totalProviders: 1,
        pageInfo: {
          totalAvailable: 1,
        },
        snapshotReady: true,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/intelligence/providers/route');
    const response = await GET(new NextRequest('http://localhost/api/intelligence/providers') as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/directory?page=1&pageSize=12&limit=12&minTrustScore=0',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      accessMode: 'full',
      reason: 'ok',
      total: 1,
      providers: [{
        npi: '1902301456',
        name: 'Amelia Hart',
      }],
    });
  });

  it('proxies intelligence system health to the canonical backend pulse endpoint', async () => {
    authMock.mockResolvedValue({ userId: null, orgId: null, sessionClaims: {} });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        status: 'HEALTHY',
        providers: 5,
        findings: 42,
        storylines: 11,
        systemState: 'ALIVE',
        lastEventAt: '2026-03-17T10:46:18.000Z',
        generatedAt: '2026-03-17T11:00:00.000Z',
        agents: [{
          id: 'data-sanity',
          name: 'Data Sanity Agent',
          enabled: true,
          lastRun: '2026-03-17T10:30:00.000Z',
          lastIssueCount: 0,
        }],
        totalIssues: 0,
        totalAutoRepaired: 0,
        totalSurfaced: 0,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/intelligence/system-health/route');
    const response = await GET(new NextRequest('http://localhost/api/intelligence/system-health') as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/system-health',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      accessMode: 'full',
      reason: 'ok',
      overall: 'healthy',
      headline: '42 findings across 11 storylines are live.',
      cards: expect.arrayContaining([
        expect.objectContaining({
          id: 'findings',
          summary: '42 active findings',
        }),
      ]),
    });
  });

  it('surfaces findings backend errors without synthesizing a fallback payload', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      orgId: 'org-clerk-1',
      sessionClaims: {},
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        error: 'findings_feed_failed',
        error_description: 'Findings feed unavailable upstream.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/intelligence/findings/route');
    const response = await GET(new NextRequest('http://localhost/api/intelligence/findings') as never);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: 'findings_feed_failed',
      error_description: 'Findings feed unavailable upstream.',
    });
  });

  it('proxies intelligence findings to the canonical findings feed', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      orgId: 'org-clerk-1',
      sessionClaims: {},
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        findings: [{
          findingId: 'finding-1',
          investigatorId: 'trust_decline',
          findingType: 'trust_decline',
          severity: 'critical',
          status: 'new',
          title: 'Trust score dropped',
          summary: 'Licensure source is stale.',
          explanation: 'Confidence degraded after stale source detection.',
          entityIds: ['provider:1234567890'],
          metadata: { npi: '1234567890' },
          priorityScore: 0.96,
          confidence: 0.91,
          storylineKey: 'storyline-1',
          supportingEvidence: [],
          updatedAt: '2026-03-15T12:00:00.000Z',
        }],
        total: 1,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/intelligence/findings/route');
    const response = await GET(new NextRequest('http://localhost/api/intelligence/findings?limit=1') as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/findings?limit=1&offset=0',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      accessMode: 'full',
      reason: 'ok',
      total: 1,
      findings: [expect.objectContaining({ id: 'finding-1' })],
    });
  });

  it('does not reuse stale findings payloads when the backend later fails', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      orgId: 'org-clerk-1',
      sessionClaims: {},
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          findings: [{
            findingId: 'finding-1',
            investigatorId: 'trust_decline',
            findingType: 'trust_decline',
            severity: 'critical',
            status: 'new',
            title: 'Trust score dropped',
            summary: 'Licensure source is stale.',
            explanation: 'Confidence degraded after stale source detection.',
            entityIds: ['provider:1234567890'],
            metadata: { npi: '1234567890' },
            priorityScore: 0.96,
            confidence: 0.91,
            storylineKey: null,
            supportingEvidence: [],
            updatedAt: '2026-03-15T12:00:00.000Z',
          }],
          total: 1,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          error: 'findings_feed_failed',
          error_description: 'Findings feed unavailable upstream.',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/intelligence/findings/route');

    const seededResponse = await GET(new NextRequest('http://localhost/api/intelligence/findings?limit=1') as never);
    await expect(seededResponse.json()).resolves.toMatchObject({
      accessMode: 'full',
      reason: 'ok',
      total: 1,
      findings: [expect.objectContaining({ id: 'finding-1' })],
    });

    const fallbackResponse = await GET(new NextRequest('http://localhost/api/intelligence/findings?limit=1') as never);
    expect(fallbackResponse.status).toBe(503);
    await expect(fallbackResponse.json()).resolves.toMatchObject({
      error: 'findings_feed_failed',
      error_description: 'Findings feed unavailable upstream.',
    });
  });

  it('proxies the bare findings route to the backend findings feed', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      orgId: 'org-clerk-1',
      sessionClaims: {
        email: 'ada@example.com',
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        schema: 'https://vitalcv.com/findings/v2',
        total: 1,
        findings: [{ findingId: 'finding-1', title: 'Escalation window' }],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/findings/route');
    const response = await GET(new NextRequest('http://localhost/api/findings?limit=1') as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/findings?limit=1',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Headers }];
    expect(init.headers.get('x-org-id')).toBe('org-clerk-1');
    await expect(response.json()).resolves.toMatchObject({
      total: 1,
      findings: [{ findingId: 'finding-1' }],
    });
  });

  it('proxies the bare storylines route to the backend storyline feed', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      orgId: 'org-clerk-1',
      sessionClaims: {},
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        total: 1,
        storylines: [{ storylineId: 'story-1', title: 'Escalation window' }],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/storylines/route');
    const response = await GET(new NextRequest('http://localhost/api/storylines?limit=1') as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/storylines?limit=1',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      total: 1,
      storylines: [{ storylineId: 'story-1' }],
    });
  });

  it('proxies the bare providers route to the backend provider listing', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      orgId: 'org-clerk-1',
      sessionClaims: {},
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        total: 1,
        providers: [{ npi: '1234567890', fullName: 'Ada Lovelace' }],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/providers/route');
    const response = await GET(new NextRequest('http://localhost/api/providers?limit=1') as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/providers?limit=1',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      total: 1,
      providers: [{ npi: '1234567890' }],
    });
  });

  it('proxies intelligence actions and annotates successful live responses', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      orgId: 'org-clerk-1',
      sessionClaims: {
        email: 'ada@example.com',
        role: 'investigator',
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        total: 1,
        actions: [{
          actionId: 'action-1',
          actionType: 'VERIFY_CREDENTIAL',
          priority: 'critical',
          priorityScore: 99,
          status: 'pending',
          recommendedAction: 'Verify credential for Clinician 1003000126',
          explanation: 'Conflicting credential evidence detected.',
          confidence: 0.94,
          createdAt: '2026-03-17T11:00:00.000Z',
          sourceFindingIds: ['finding-1'],
          targetEntity: {
            entityType: 'provider',
            entityId: '1003000126',
            entityLabel: 'Clinician 1003000126',
          },
          evidence: [],
        }],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/intelligence/actions/route');
    const response = await GET(new NextRequest('http://localhost/api/intelligence/actions?limit=1') as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/actions?limit=1&offset=0',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      accessMode: 'full',
      reason: 'ok',
      total: 1,
      actions: [expect.objectContaining({
        id: 'action-1',
        title: 'Verify credential for Clinician 1003000126',
      })],
      pageInfo: {
        page: 1,
        pageSize: 1,
        totalPages: 1,
        hasNextPage: false,
        returned: 1,
      },
    });
  });

  it('uses the authenticated storyline detail loader for single-item refresh requests', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1', orgId: 'org-clerk-1' });
    loadStorylineDetailMock.mockResolvedValue({
      storyline: { id: 'story-1', title: 'Escalation window' },
    });

    const { GET } = await import('../app/api/storylines/[...path]/route');
    const response = await GET(new Request('http://localhost/api/storylines/story-1') as never, {
      params: Promise.resolve({ path: ['story-1'] }),
    });

    expect(loadStorylineDetailMock).toHaveBeenCalledWith('story-1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      storyline: { id: 'story-1', title: 'Escalation window' },
    });
  });

  it('forwards authenticated action status mutations with org and role context', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      orgId: 'org-clerk-1',
      sessionClaims: {
        email: 'ada@example.com',
        role: 'investigator',
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        action: {
          id: 'action-1',
          status: 'completed',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { PATCH } = await import('../app/api/actions/[id]/status/route');
    const response = await PATCH(new Request('http://localhost/api/actions/action-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    }) as never, {
      params: Promise.resolve({ id: 'action-1' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/actions/action-1/status',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.any(Headers),
        body: JSON.stringify({ status: 'completed' }),
        cache: 'no-store',
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Headers }];
    expect(init.headers.get('x-clerk-user-id')).toBe('clerk-user-1');
    expect(init.headers.get('x-clerk-user-email')).toBe('ada@example.com');
    expect(init.headers.get('x-clerk-user-role')).toBe('investigator');
    expect(init.headers.get('x-user-role')).toBe('investigator');
    expect(init.headers.get('x-org-id')).toBe('org-clerk-1');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      action: {
        id: 'action-1',
        status: 'completed',
      },
    });
  });

  it('fails closed on status mutations when org context is missing', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      orgId: null,
      sessionClaims: {
        email: 'ada@example.com',
        role: 'investigator',
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ activeOrgId: null }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { PATCH } = await import('../app/api/actions/[id]/status/route');
    const response = await PATCH(new Request('http://localhost/api/actions/action-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    }) as never, {
      params: Promise.resolve({ id: 'action-1' }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'organization_context_required',
      error_description: 'Organization workspace required. Switch to an organization workspace to continue.',
      workspaceSwitchHref: '/workspace/switch',
    });
  });

  it('returns structured copilot fallback responses when unauthenticated', async () => {
    authMock.mockResolvedValue({ userId: null, orgId: null, sessionClaims: {} });

    const { POST: queryPost } = await import('../app/api/copilot/query/route');
    const queryResponse = await queryPost(new NextRequest('http://localhost/api/copilot/query', {
      method: 'POST',
      body: JSON.stringify({ query: 'show active investigations' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never);

    expect(queryResponse.status).toBe(200);
    await expect(queryResponse.json()).resolves.toMatchObject({
      status: 'limited',
      title: 'Copilot requires authentication',
      message: 'Sign in before running Copilot investigation workflows.',
      results: [],
      graphInsights: [],
      document: {
        mode: 'summary',
      },
    });

    const { POST: askPost } = await import('../app/api/copilot/ask/route');
    const askResponse = await askPost(new NextRequest('http://localhost/api/copilot/ask', {
      method: 'POST',
      body: JSON.stringify({ query: 'summarize this provider' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never);

    expect(askResponse.status).toBe(200);
    await expect(askResponse.json()).resolves.toMatchObject({
      answer: 'Sign in before running Copilot investigation workflows.',
      intent: 'LIMITED',
      suggestions: expect.any(Array),
      data: {
        status: 'limited',
      },
    });
  });

  it('forwards authenticated copilot investigation planning requests', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      orgId: 'org-clerk-1',
      sessionClaims: {
        email: 'ada@example.com',
        role: 'investigator',
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        schema: 'https://vitalcv.com/copilot/investigation/v1',
        objective: 'Assess provider 1234567890',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../app/api/copilot/investigation/route');
    const response = await POST(new NextRequest('http://localhost/api/copilot/investigation', {
      method: 'POST',
      body: JSON.stringify({ providerId: '1234567890' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/copilot/investigation',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
        body: JSON.stringify({ providerId: '1234567890' }),
        cache: 'no-store',
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Headers }];
    expect(init.headers.get('x-clerk-user-id')).toBe('clerk-user-1');
    expect(init.headers.get('x-org-id')).toBe('org-clerk-1');
    expect(response.status).toBe(200);
  });

  it('fails closed for investigation network proxy when org context is missing', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      orgId: null,
      sessionClaims: {
        email: 'ada@example.com',
        role: 'investigator',
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ activeOrgId: null }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../app/api/investigation/network/[npi]/route');
    const response = await POST(new NextRequest('http://localhost/api/investigation/network/1234567890?depth=2', {
      method: 'POST',
      body: JSON.stringify({ depth: 2 }),
      headers: { 'Content-Type': 'application/json' },
    }) as never, {
      params: Promise.resolve({ npi: '1234567890' }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'organization_context_required',
      error_description: 'Organization workspace required. Switch to an organization workspace to continue.',
      workspaceSwitchHref: '/workspace/switch',
    });
  });

  it('returns empty successful outcomes payloads when unauthenticated', async () => {
    authMock.mockResolvedValue({ userId: null, orgId: null, sessionClaims: {} });

    const { GET } = await import('../app/api/findings/outcomes/route');
    const response = await GET(new NextRequest('http://localhost/api/findings/outcomes?limit=25') as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      schema: 'https://vitalcv.com/outcome-history/v1',
      outcomes: [],
      total: 0,
      generatedAt: expect.any(String),
    });
  });
});
