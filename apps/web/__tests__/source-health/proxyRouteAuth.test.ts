/**
 * GET /api/internal/source-health — the machine-auth boundary.
 *
 * The probe/ and snapshots/ subroutes were guarded from the start; this
 * top-level proxy was not, so anonymous callers reached the backend's
 * mission-ops source inventory through the web origin. It is a byte-identical
 * twin of /api/internal/mission-ops/sources, which had the same hole.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GET /api/internal/source-health', () => {
  async function loadRoute() {
    return import('@/app/api/internal/source-health/route');
  }

  function get(headers: Record<string, string> = {}): Request {
    return new Request('http://localhost/api/internal/source-health', {
      method: 'GET',
      headers,
    });
  }

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.BACKEND_URL = 'http://backend.test';
    process.env.CRON_SECRET = 'test-cron-secret';
    delete process.env.MONITORING_SECRET;
  });

  it('401s anonymous callers without reaching the backend', async () => {
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

  it('proxies the backend inventory for an authorized caller', async () => {
    // The backend route is operator-gated, so the proxy must hold and forward
    // MONITORING_SECRET. Without it this proxy sent no headers at all and the
    // backend answered 401 — the machine auth above was protecting a call that
    // never succeeded.
    process.env.MONITORING_SECRET = 'test-monitoring-secret';
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ spineStatus: 'HEALTHY', sources: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await loadRoute();
    const response = await GET(get({ authorization: 'Bearer test-cron-secret' }));

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/mission-ops/sources',
      expect.objectContaining({
        cache: 'no-store',
        headers: { 'x-monitoring-secret': 'test-monitoring-secret' },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ spineStatus: 'HEALTHY', sources: [] });
  });
});
