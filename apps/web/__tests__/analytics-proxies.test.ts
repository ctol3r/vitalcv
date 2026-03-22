import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('analytics proxies', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.BACKEND_URL = 'http://backend.test';
  });

  it('forwards analytics events to the backend route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../app/api/analytics/event/route');
    const response = await POST(new Request('http://localhost/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'clinician.alert_viewed',
        properties: { npi: '1234567890', alertCount: 2 },
      }),
    }) as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/analytics/event',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'clinician.alert_viewed',
          properties: { npi: '1234567890', alertCount: 2 },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it('forwards funnel reads to the backend route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        clinicianLaunch: {
          signIns: 1,
          alertViews: 2,
          applicationDetailViews: 1,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/analytics/funnel/route');
    const response = await GET();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/analytics/funnel',
      expect.objectContaining({
        cache: 'no-store',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      clinicianLaunch: {
        signIns: 1,
        alertViews: 2,
        applicationDetailViews: 1,
      },
    });
  });
});
