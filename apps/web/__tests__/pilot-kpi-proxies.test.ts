import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('pilot KPI proxy routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.BACKEND_URL = 'http://backend.test';
    process.env.MONITORING_SECRET = 'monitoring-secret';
  });

  it('forwards CSV export requests with scoped geography filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('section,label,value\nfilters,geography_tag,CA', {
      status: 200,
      headers: { 'Content-Type': 'text/csv' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/pilot-kpi-export/route');
    const response = await GET({
      nextUrl: new URL('http://app.test/api/pilot-kpi-export?days=30&org=org-1&pilotId=pilot-1&lane=icu&geo=CA'),
    } as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/internal/pilot/kpis/export?days=30&orgContextId=org-1&pilotId=pilot-1&workflowLane=icu&geographyTag=CA',
      expect.objectContaining({
        headers: { 'x-monitoring-secret': 'monitoring-secret' },
        cache: 'no-store',
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('filters,geography_tag,CA');
  });

  it('forwards JSON export requests with scoped geography filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      appliedFilter: {
        orgContextId: 'org-1',
        pilotId: 'pilot-1',
        workflowLane: 'icu',
        geographyTag: 'CA',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/pilot-kpi-json/route');
    const response = await GET({
      nextUrl: new URL('http://app.test/api/pilot-kpi-json?days=30&org=org-1&pilotId=pilot-1&lane=icu&geo=CA'),
    } as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/internal/pilot/kpis?days=30&orgContextId=org-1&pilotId=pilot-1&workflowLane=icu&geographyTag=CA',
      expect.objectContaining({
        headers: { 'x-monitoring-secret': 'monitoring-secret' },
        cache: 'no-store',
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      appliedFilter: {
        orgContextId: 'org-1',
        pilotId: 'pilot-1',
        workflowLane: 'icu',
        geographyTag: 'CA',
      },
    });
  });

  it('forwards ROI export requests with the same scoped filter contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('<html>roi</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/pilot-roi-export/route');
    const response = await GET({
      nextUrl: new URL('http://app.test/api/pilot-roi-export?days=30&org=org-1&pilotId=pilot-1&lane=icu&geo=CA'),
    } as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/internal/pilot/roi-report/html?days=30&orgContextId=org-1&pilotId=pilot-1&workflowLane=icu&geographyTag=CA',
      expect.objectContaining({
        headers: { 'x-monitoring-secret': 'monitoring-secret' },
        cache: 'no-store',
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('roi');
  });
});
