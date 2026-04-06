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

  it('fails closed when passport analytics download is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('analytics timeout')));

    const { POST } = await import('../app/api/passport/analytics/[npi]/download/route');
    const response = await POST(new Request('http://localhost/api/passport/analytics/1234567890/download', {
      method: 'POST',
    }) as never, {
      params: Promise.resolve({ npi: '1234567890' }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Passport analytics unavailable',
      detail: 'analytics timeout',
    });
  });

  it('passes through passport analytics tracker responses without fabricating success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: true, event: 'bundle_download', npi: '1234567890' }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../app/api/passport/analytics/[npi]/download/route');
    const response = await POST(new Request('http://localhost/api/passport/analytics/1234567890/download', {
      method: 'POST',
    }) as never, {
      params: Promise.resolve({ npi: '1234567890' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/passport/analytics/1234567890/download',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
      }),
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      event: 'bundle_download',
      npi: '1234567890',
    });
  });

  it('returns upstream passport analytics failures instead of ok:true fallbacks', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'analytics_denied' }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      },
    )));

    const { POST } = await import('../app/api/passport/analytics/[npi]/share/route');
    const response = await POST(new Request('http://localhost/api/passport/analytics/1234567890/share', {
      method: 'POST',
    }) as never, {
      params: Promise.resolve({ npi: '1234567890' }),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'analytics_denied',
    });
  });
});
