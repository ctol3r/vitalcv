import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * GET /api/internal/source-health — the top-level proxy, not probe/ or
 * snapshots/. Those two were guarded from birth via _auth.ts; this route
 * shipped unauthenticated. These tests pin the same machine-auth contract
 * on it: no secret → 401, wrong secret → 401, unconfigured env → 500
 * (fail closed), valid secret → proxies the backend report.
 */
describe('GET /api/internal/source-health — auth', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('BACKEND_URL', 'http://backend.test');
    vi.stubEnv('CRON_SECRET', 'good-cron');
    vi.stubEnv('MONITORING_SECRET', 'good-mon');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function callRoute(headers?: Record<string, string>) {
    const { GET } = await import('../../app/api/internal/source-health/route');
    return GET(new Request('https://x.test/api/internal/source-health', { headers }));
  }

  it('401 for anonymous requests, without contacting the backend', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await callRoute();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('401 on a wrong Bearer token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await callRoute({ Authorization: 'Bearer wrong' });

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('401 on a wrong x-monitoring-secret', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await callRoute({ 'x-monitoring-secret': 'wrong' });

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('500 when neither secret is configured — fail closed, not open', async () => {
    vi.stubEnv('CRON_SECRET', '');
    vi.stubEnv('MONITORING_SECRET', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await callRoute({ Authorization: 'Bearer anything' });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'no probe auth configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('valid Bearer token proxies the backend report', async () => {
    const report = {
      timestamp: '2026-03-23T12:00:00.000Z',
      spineStatus: 'HEALTHY',
      alerts: [],
      sources: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify(report),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const response = await callRoute({ Authorization: 'Bearer good-cron' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/mission-ops/sources',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(report);
  });

  it('valid x-monitoring-secret also proxies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ spineStatus: 'HEALTHY' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const response = await callRoute({ 'x-monitoring-secret': 'good-mon' });

    expect(response.status).toBe(200);
  });

  it('authenticated caller still gets 502 when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

    const response = await callRoute({ Authorization: 'Bearer good-cron' });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'Backend unreachable.' });
  });
});
