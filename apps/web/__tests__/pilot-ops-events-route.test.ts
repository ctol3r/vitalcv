import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, fetchMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

vi.mock('@/lib/api', () => ({
  getBackendBase: () => 'http://backend.test',
}));

vi.mock('@/lib/server/marketplace-proxy', () => ({
  buildMarketplaceHeaders: (session: { userId?: string | null }, init?: HeadersInit) => {
    const headers = new Headers(init);
    headers.set('Accept', 'application/json');
    if (session.userId) {
      headers.set('x-clerk-user-id', session.userId);
    }
    return headers;
  },
}));

function jsonResponse(body: unknown, status = 202) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => body),
  };
}

describe('/api/pilot-ops/events route', () => {
  beforeEach(() => {
    authMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('forwards anonymous events when Clerk auth is unavailable', async () => {
    authMock.mockRejectedValueOnce(new Error('clerk unavailable'));
    fetchMock.mockResolvedValueOnce(jsonResponse({ accepted: true }) as never);

    const { POST } = await import('../app/api/pilot-ops/events/route');
    const { NextRequest } = await import('next/server');

    const req = new NextRequest('http://localhost/api/pilot-ops/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'page_loaded' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(202);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/pilot-ops/events',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(options.headers);
    expect(headers.get('x-clerk-user-id')).toBeNull();
    expect(await res.json()).toEqual({ accepted: true });
  });
});
