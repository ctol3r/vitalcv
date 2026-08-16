import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, fetchMock } = vi.hoisted(() => ({ authMock: vi.fn(), fetchMock: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('@/lib/server/marketplace-proxy', () => ({
  MARKETPLACE_BACKEND: 'http://backend.test',
  buildMarketplaceHeaders: vi.fn(async () => new Headers({ 'x-clerk-user-id': 'verified-user' })),
}));
vi.stubGlobal('fetch', fetchMock);

async function callRoute(appId = 'app/unsafe') {
  const { GET } = await import('../app/api/applications/[appId]/hire-to-start/route');
  return GET(new NextRequest('http://localhost/api/applications/example/hire-to-start'), {
    params: Promise.resolve({ appId }),
  });
}

describe('GET hire-to-start proxy', () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    fetchMock.mockReset();
  });

  it('rejects an anonymous request and remains private', async () => {
    authMock.mockResolvedValue({ userId: null });
    const response = await callRoute();
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards verified identity without caching and preserves the backend status', async () => {
    authMock.mockResolvedValue({ userId: 'verified-user' });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ currentStage: 'employer_review' }), { status: 200 }));
    const response = await callRoute();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/applications/app%2Funsafe/hire-to-start',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('degrades honestly when the backend is unavailable', async () => {
    authMock.mockResolvedValue({ userId: 'verified-user' });
    fetchMock.mockRejectedValue(new Error('offline'));
    const response = await callRoute('app-1');
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
