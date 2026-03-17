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
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      orgId: null,
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
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('accept')).toBe('application/json');
    expect(headers.get('x-clerk-user-id')).toBe('clerk-user-1');
    expect(headers.get('x-clerk-user-email')).toBe('ada@example.com');
    expect(headers.get('x-clerk-user-role')).toBe('operator');
    expect(headers.get('x-user-role')).toBe('operator');
    expect(headers.get('x-org-id')).toBe('org-active-1');
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
      type: 'system_response',
      message: 'Copilot requires active investigation context.',
      results: [],
      graphInsights: [],
    });

    const { POST: askPost } = await import('../app/api/copilot/ask/route');
    const askResponse = await askPost(new NextRequest('http://localhost/api/copilot/ask', {
      method: 'POST',
      body: JSON.stringify({ query: 'summarize this provider' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never);

    expect(askResponse.status).toBe(200);
    await expect(askResponse.json()).resolves.toMatchObject({
      answer: 'Copilot requires active investigation context.',
      intent: 'SYSTEM_RESPONSE',
      suggestions: expect.any(Array),
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
