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

describe('hire-to-start mutation proxies', () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    fetchMock.mockReset();
  });

  it('keeps start-ready private and rejects anonymous callers', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { POST } = await import('../app/api/applications/[appId]/start-ready/route');
    const response = await POST(new NextRequest('http://localhost/api/applications/app-1/start-ready', { method: 'POST' }), {
      params: Promise.resolve({ appId: 'app-1' }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards actual-first-day confirmation with verified identity and no caching', async () => {
    authMock.mockResolvedValue({ userId: 'verified-user' });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ state: 'started' }), { status: 201 }));
    const { POST } = await import('../app/api/applications/[appId]/start/route');
    const response = await POST(new NextRequest('http://localhost/api/applications/app-1/start', {
      method: 'POST',
      body: JSON.stringify({ startedAt: '2026-08-14T12:00:00.000Z' }),
    }), { params: Promise.resolve({ appId: 'app/unsafe' }) });

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/applications/app%2Funsafe/start',
      expect.objectContaining({ method: 'POST', cache: 'no-store' }),
    );
  });

  it('rejects an anonymous actual-first-day confirmation without touching the backend', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { POST } = await import('../app/api/applications/[appId]/start/route');
    const response = await POST(new NextRequest('http://localhost/api/applications/app-1/start', {
      method: 'POST',
      body: JSON.stringify({ startedAt: '2026-08-14T12:00:00.000Z' }),
    }), { params: Promise.resolve({ appId: 'app-1' }) });
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('encodes both application and requirement ids for requirement updates', async () => {
    authMock.mockResolvedValue({ userId: 'verified-user' });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { PATCH } = await import('../app/api/applications/[appId]/activation/requirements/[requirementId]/route');
    const response = await PATCH(new NextRequest('http://localhost/api/applications/app/requirements/req', {
      method: 'PATCH', body: JSON.stringify({ toStatus: 'submitted' }),
    }), { params: Promise.resolve({ appId: 'app/unsafe', requirementId: 'req/unsafe' }) });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/applications/app%2Funsafe/activation/requirements/req%2Funsafe',
      expect.objectContaining({ method: 'PATCH', cache: 'no-store' }),
    );
  });
});
