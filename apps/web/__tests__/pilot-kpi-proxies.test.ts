import { beforeEach, describe, expect, it, vi } from 'vitest';

const SAMPLE_ENTITY_ID = '00000000-0000-0000-0000-000000000123';

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
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="vitalcv-pilot-kpis-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
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
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="vitalcv-pilot-kpis-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    await expect(response.json()).resolves.toEqual({
      appliedFilter: {
        orgContextId: 'org-1',
        pilotId: 'pilot-1',
        workflowLane: 'icu',
        geographyTag: 'CA',
      },
    });
  });

  it('forwards started outcome capture with the normalized launch-gate payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      entityId: SAMPLE_ENTITY_ID,
      outcomeStatus: 'started',
      actualStartDate: '2026-03-28T12:00:00.000Z',
      outcomeRecordedAt: null,
    }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../app/api/internal/pilot/start-outcome/route');
    const response = await POST(new Request('http://app.test/api/internal/pilot/start-outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityId: SAMPLE_ENTITY_ID,
        startedAt: '2026-03-28T12:00:00.000Z',
        organizationContextId: 'org-1',
        pilotId: 'pilot-1',
        workflowLane: 'icu',
        geographyTag: 'CA',
        readinessScoreAtStart: 91,
        baselineProcessDurationDays: 45,
        blockers: ['LICENSURE', ' DEA '],
        note: 'Operator-confirmed start.',
      }),
    }) as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/internal/pilot/start-outcome',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-monitoring-secret': 'monitoring-secret',
        },
        cache: 'no-store',
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({
      entityId: SAMPLE_ENTITY_ID,
      outcomeStatus: 'started',
      organizationContextId: 'org-1',
      pilotId: 'pilot-1',
      workflowLane: 'icu',
      geographyTag: 'CA',
      readinessScoreAtStart: 91,
      baselineProcessDurationDays: 45,
      blockers: ['LICENSURE', 'DEA'],
      note: 'Operator-confirmed start.',
      startedAt: '2026-03-28T12:00:00.000Z',
      actualStartDate: '2026-03-28T12:00:00.000Z',
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      entityId: SAMPLE_ENTITY_ID,
      outcomeStatus: 'started',
      actualStartDate: '2026-03-28T12:00:00.000Z',
      outcomeRecordedAt: null,
    });
  });

  it('forwards not-started outcomes with reason and correction metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      entityId: SAMPLE_ENTITY_ID,
      outcomeStatus: 'not_started',
      actualStartDate: null,
      outcomeRecordedAt: '2026-03-28T13:00:00.000Z',
    }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../app/api/internal/pilot/start-outcome/route');
    const response = await POST(new Request('http://app.test/api/internal/pilot/start-outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityId: SAMPLE_ENTITY_ID,
        outcomeStatus: 'not_started',
        outcomeRecordedAt: '2026-03-28T13:00:00.000Z',
        nonStartReason: 'Credentialing hold remained unresolved',
        manualCorrection: true,
        correctionGroupKey: 'pilot-1:entity-1',
        blockers: ['LICENSURE', '', 'BOARD_CERTIFICATION'],
      }),
    }) as never);

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({
      entityId: SAMPLE_ENTITY_ID,
      outcomeStatus: 'not_started',
      blockers: ['LICENSURE', 'BOARD_CERTIFICATION'],
      manualCorrection: true,
      correctionGroupKey: 'pilot-1:entity-1',
      startedAt: '2026-03-28T13:00:00.000Z',
      outcomeRecordedAt: '2026-03-28T13:00:00.000Z',
      nonStartReason: 'Credentialing hold remained unresolved',
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      entityId: SAMPLE_ENTITY_ID,
      outcomeStatus: 'not_started',
      actualStartDate: null,
      outcomeRecordedAt: '2026-03-28T13:00:00.000Z',
    });
  });

  it('fails closed on invalid start-outcome payloads before hitting the backend', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../app/api/internal/pilot/start-outcome/route');
    const response = await POST(new Request('http://app.test/api/internal/pilot/start-outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityId: 'not-a-uuid',
        startedAt: '2026-03-28T12:00:00.000Z',
      }),
    }) as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'entityId must be a valid UUID.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
