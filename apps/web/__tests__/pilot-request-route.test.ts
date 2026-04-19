import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  getBackendBase: () => 'http://backend.test',
}));

async function loadPilotRequestRoute() {
  return import(new URL('../app/api/pilot-request/route.ts', import.meta.url).href);
}

describe('/api/pilot-request route', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.MONITORING_SECRET = 'monitoring-secret';
  });

  it('creates an attributable pilot handoff record for JSON requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      item: { id: 'queue-1' },
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadPilotRequestRoute();
    const { NextRequest } = await import('next/server');

    const response = await POST(new NextRequest('http://localhost/api/pilot-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization: 'Mercy General',
        name: 'Ada Lovelace',
        email: 'ada@mercy.test',
        usecase: 'Need a measured NPI-to-review pilot.',
      }),
    }));

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/internal/pilot-ops/queue',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-monitoring-secret': 'monitoring-secret',
          'x-clerk-user-email': 'ada@mercy.test',
          'x-clerk-user-role': 'PILOT_REQUEST',
        }),
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      source: 'manual',
      owner: 'Pilot Success',
      route: '/pilot',
      title: 'Pilot request — Mercy General',
      details: {
        organization: 'Mercy General',
        name: 'Ada Lovelace',
        email: 'ada@mercy.test',
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      itemId: 'queue-1',
      owner: 'Pilot Success',
      nextStep: 'Pilot Success will confirm scope, clinician count, and the first clinician NPI for employer review.',
      metricNotice: 'Pilot KPI baselines stay unavailable until the pilot records a real employer review open and employer decision on the same case.',
      successCriteria: expect.arrayContaining([
        'Use one real clinician NPI to create a reviewable passport and employer decision context.',
        'Record a real employer review open and employer decision on the same case.',
      ]),
    });
  });

  it('redirects form submissions back to the pilot page with a recorded state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      item: { id: 'queue-2' },
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadPilotRequestRoute();
    const { NextRequest } = await import('next/server');

    const response = await POST(new NextRequest('http://localhost/api/pilot-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        organization: 'Mercy General',
        name: 'Ada Lovelace',
        email: 'ada@mercy.test',
        usecase: 'Need a measured NPI-to-review pilot.',
      }),
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost/pilot?requested=1');
  });
});

describe('/pilot page intake confirmation', () => {
  it('keeps owner, next step, metric honesty, and success criteria visible after submission', async () => {
    const { default: PilotPage } = await import('../app/pilot/page');

    const markup = renderToStaticMarkup(await PilotPage({
      searchParams: Promise.resolve({ requested: '1' }),
    }));

    expect(markup).toContain('Pilot handoff recorded');
    expect(markup).toContain('Pilot Success now owns the next step.');
    expect(markup).toContain('Owner:');
    expect(markup).toContain('Pilot Success');
    expect(markup).toContain('Pilot KPI baselines stay unavailable until the pilot records a real employer review open and employer decision on the same case.');
    expect(markup).toContain('Use one real clinician NPI to create a reviewable passport and employer decision context.');
    expect(markup).toContain('Record a real employer review open and employer decision on the same case.');
  });
});
