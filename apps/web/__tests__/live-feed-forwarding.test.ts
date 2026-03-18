import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

vi.mock('@/lib/api', () => ({
  getApiBase: () => 'http://backend.test',
  getBackendBase: () => 'http://backend.test',
}));

describe('live feed route forwarding', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    authMock.mockReset();
    process.env.BACKEND_URL = 'http://backend.test';
  });

  it('proxies backend live feed payloads and marks them as live delivery', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      orgId: 'org-1',
      sessionClaims: {},
    });

    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        schema: 'https://vitalcv.com/feed/live/v1',
        generatedAt: '2026-03-17T10:00:00.000Z',
        total: 1,
        events: [{
          id: 'evt-1',
          type: 'FINDING_CREATED',
          source: 'event_bus',
          timestamp: '2026-03-17T10:00:00.000Z',
          payload: {
            findingId: 'finding-1',
            investigatorId: 'trust_decline',
            severity: 'high',
            operation: 'created',
          },
        }],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/feed/live/route');
    const response = await GET(new NextRequest('http://localhost/api/feed/live?limit=4') as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/feed/live?limit=4',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      total: 1,
      delivery: {
        mode: 'live',
        reason: 'ok',
      },
    });
  });

  it('serves cached live feed payload when backend becomes unavailable', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      orgId: 'org-1',
      sessionClaims: {},
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          schema: 'https://vitalcv.com/feed/live/v1',
          generatedAt: '2026-03-17T10:00:00.000Z',
          total: 1,
          events: [{
            id: 'evt-1',
            type: 'FINDING_CREATED',
            source: 'event_bus',
            timestamp: '2026-03-17T10:00:00.000Z',
            payload: {
              findingId: 'finding-1',
              investigatorId: 'trust_decline',
              severity: 'high',
              operation: 'created',
            },
          }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ error: 'backend_unavailable' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/feed/live/route');

    const seededResponse = await GET(new NextRequest('http://localhost/api/feed/live?limit=4') as never);
    await seededResponse.json();

    const fallbackResponse = await GET(new NextRequest('http://localhost/api/feed/live?limit=4') as never);
    await expect(fallbackResponse.json()).resolves.toMatchObject({
      total: 1,
      events: [expect.objectContaining({ id: 'evt-1' })],
      delivery: {
        mode: 'cached',
        reason: 'backend_unavailable',
      },
    });
  });

  it('forwards missing-session reads to the backend public live feed', async () => {
    authMock.mockResolvedValue({
      userId: null,
      orgId: null,
      sessionClaims: {},
    });

    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        schema: 'https://vitalcv.com/feed/live/v1',
        generatedAt: '2026-03-17T10:00:00.000Z',
        total: 1,
        events: [{
          id: 'evt-public-1',
          type: 'FINDING_CREATED',
          source: 'event_bus',
          timestamp: '2026-03-17T10:00:00.000Z',
          payload: {
            findingId: 'finding-1',
            investigatorId: 'trust_decline',
            severity: 'high',
            operation: 'created',
          },
        }],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/feed/live/route');
    const response = await GET(new NextRequest('http://localhost/api/feed/live') as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/feed/live',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      total: 1,
      delivery: {
        mode: 'live',
        reason: 'ok',
      },
    });
  });
});
