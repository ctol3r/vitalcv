import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('/api/internal/mission-ops/sources proxy', () => {
  async function loadRoute() {
    return import('../app/api/internal/mission-ops/sources/route');
  }

  function get(headers: Record<string, string> = {}): Request {
    return new Request('http://localhost/api/internal/mission-ops/sources', {
      method: 'GET',
      headers,
    });
  }

  const AUTHED = { authorization: 'Bearer test-cron-secret' };

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.BACKEND_URL = 'http://backend.test';
    process.env.CRON_SECRET = 'test-cron-secret';
    delete process.env.MONITORING_SECRET;
  });

  it('401s anonymous callers without touching the backend', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await loadRoute();
    const response = await GET(get());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('401s on a wrong secret', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await loadRoute();
    const response = await GET(get({ authorization: 'Bearer nope' }));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('500s when no secret is configured at all — fails closed, never open', async () => {
    delete process.env.CRON_SECRET;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await loadRoute();
    const response = await GET(get({ authorization: 'Bearer anything' }));

    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards live source health responses without caching', async () => {
    // The backend route is operator-gated, so the proxy must hold and forward
    // MONITORING_SECRET. Without it this proxy sent no headers at all and the
    // backend answered 401 — the machine auth was protecting a call that never
    // succeeded.
    process.env.MONITORING_SECRET = 'test-monitoring-secret';
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        timestamp: '2026-03-23T12:00:00.000Z',
        spineStatus: 'HEALTHY',
        alerts: [],
        sources: [],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await loadRoute();
    const response = await GET(get(AUTHED));

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/mission-ops/sources',
      expect.objectContaining({
        cache: 'no-store',
        headers: { 'x-monitoring-secret': 'test-monitoring-secret' },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      timestamp: '2026-03-23T12:00:00.000Z',
      spineStatus: 'HEALTHY',
      alerts: [],
      sources: [],
    });
  });

  it('accepts the x-monitoring-secret operator path', async () => {
    delete process.env.CRON_SECRET;
    process.env.MONITORING_SECRET = 'test-monitoring-secret';
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ sources: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await loadRoute();
    const response = await GET(get({ 'x-monitoring-secret': 'test-monitoring-secret' }));

    expect(response.status).toBe(200);
  });

  it('returns a 502 when the backend cannot be reached', async () => {
    // The backend route is operator-gated, so the proxy must hold and forward
    // MONITORING_SECRET. Without it this proxy sent no headers at all and the
    // backend answered 401 — the machine auth was protecting a call that never
    // succeeded.
    process.env.MONITORING_SECRET = 'test-monitoring-secret';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

    const { GET } = await loadRoute();
    const response = await GET(get(AUTHED));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'Backend unreachable.' });
  });
});
