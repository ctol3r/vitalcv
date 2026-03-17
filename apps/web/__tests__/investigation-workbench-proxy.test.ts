import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

vi.mock('@/lib/api', () => ({
  getApiBase: () => 'http://backend.test',
}));

describe('/api/investigation/workbench proxy', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    authMock.mockReset();
    process.env.BACKEND_URL = 'http://backend.test';
  });

  it('rejects requests without any investigation anchor', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    const { GET } = await import('../app/api/investigation/workbench/route');

    const response = await GET(new NextRequest('http://localhost/api/investigation/workbench') as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'At least one anchor (npi, findingId, storylineId) is required',
    });
  });

  it('forwards combined anchors with resolved active org context', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      orgId: null,
      sessionClaims: {
        email: 'ada@example.com',
        role: 'investigator',
      },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ activeOrgId: 'org-active-1' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          anchor: {
            npi: '1234567890',
            findingId: 'finding-1',
            storylineId: 'story-1',
          },
          provider: null,
          finding: null,
          storyline: null,
          relatedFindings: [],
          navigation: null,
          generatedAt: '2026-03-16T00:00:00.000Z',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/investigation/workbench/route');
    const response = await GET(new NextRequest(
      'http://localhost/api/investigation/workbench?npi=1234567890&findingId=finding-1&storylineId=story-1',
    ) as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://backend.test/api/me/workspaces',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://backend.test/api/investigation/workbench?npi=1234567890&findingId=finding-1&storylineId=story-1',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );

    const [, upstreamInit] = fetchMock.mock.calls[1] as [string, { headers: Headers }];
    expect(upstreamInit.headers.get('x-clerk-user-id')).toBe('clerk-user-1');
    expect(upstreamInit.headers.get('x-clerk-user-email')).toBe('ada@example.com');
    expect(upstreamInit.headers.get('x-clerk-user-role')).toBe('investigator');
    expect(upstreamInit.headers.get('x-user-role')).toBe('investigator');
    expect(upstreamInit.headers.get('x-org-id')).toBe('org-active-1');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      anchor: {
        npi: '1234567890',
        findingId: 'finding-1',
        storylineId: 'story-1',
      },
      provider: null,
      finding: null,
      storyline: null,
      relatedFindings: [],
      navigation: null,
      generatedAt: '2026-03-16T00:00:00.000Z',
    });
  });

  it('returns an empty workbench payload for unauthenticated requests', async () => {
    authMock.mockResolvedValue({ userId: null, orgId: null, sessionClaims: {} });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/investigation/workbench/route');
    const response = await GET(new NextRequest('http://localhost/api/investigation/workbench?npi=1234567890') as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      anchor: {
        npi: '1234567890',
        findingId: undefined,
        storylineId: undefined,
      },
      provider: null,
      finding: null,
      storyline: null,
      relatedFindings: [],
      navigation: null,
      generatedAt: expect.any(String),
    });
  });

  it('returns an empty workbench payload when org context is unavailable', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      orgId: null,
      sessionClaims: {
        email: 'ada@example.com',
      },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ activeOrgId: null }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/investigation/workbench/route');
    const response = await GET(new NextRequest('http://localhost/api/investigation/workbench?findingId=finding-1') as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      anchor: {
        npi: undefined,
        findingId: 'finding-1',
        storylineId: undefined,
      },
      provider: null,
      finding: null,
      storyline: null,
      relatedFindings: [],
      navigation: null,
      generatedAt: expect.any(String),
    });
  });
});
