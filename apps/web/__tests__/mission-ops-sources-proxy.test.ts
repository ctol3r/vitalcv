import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('/api/internal/mission-ops/sources proxy', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.BACKEND_URL = 'http://backend.test';
  });

  it('forwards live source health responses without caching', async () => {
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

    const { GET } = await import('../app/api/internal/mission-ops/sources/route');
    const response = await GET();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/mission-ops/sources',
      expect.objectContaining({
        cache: 'no-store',
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

  it('returns a 502 when the backend cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

    const { GET } = await import('../app/api/internal/mission-ops/sources/route');
    const response = await GET();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'Backend unreachable.' });
  });
});
