import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadStartOutcomeRoute() {
  return import(new URL('../app/api/internal/pilot/start-outcome/route.ts', import.meta.url).href);
}

describe('/api/internal/pilot/start-outcome proxy', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.BACKEND_URL = 'http://backend.test';
    process.env.MONITORING_SECRET = 'monitoring-secret';
  });

  it('fails closed before proxying when entityId is not a valid UUID', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadStartOutcomeRoute();
    const { NextRequest } = await import('next/server');

    const response = await POST(new NextRequest('http://localhost/api/internal/pilot/start-outcome', {
      method: 'POST',
      body: JSON.stringify({
        entityId: 'not-a-uuid',
        startedAt: '2026-03-29T16:00:00.000Z',
      }),
      headers: { 'Content-Type': 'application/json' },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'entityId must be a valid UUID.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires MONITORING_SECRET before forwarding manual pilot start outcomes', async () => {
    process.env.MONITORING_SECRET = '';
    vi.stubGlobal('fetch', vi.fn());

    const { POST } = await loadStartOutcomeRoute();
    const { NextRequest } = await import('next/server');

    const response = await POST(new NextRequest('http://localhost/api/internal/pilot/start-outcome', {
      method: 'POST',
      body: JSON.stringify({
        entityId: '00000000-0000-0000-0000-000000000001',
        startedAt: '2026-03-29T16:00:00.000Z',
      }),
      headers: { 'Content-Type': 'application/json' },
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'MONITORING_SECRET not configured.',
    });
  });

  it('forwards scoped start outcome payloads with explicit status and deduped blockers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      queued: true,
      entityId: '00000000-0000-0000-0000-000000000001',
      startedAt: '2026-03-29T16:00:00.000Z',
    }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadStartOutcomeRoute();
    const { NextRequest } = await import('next/server');

    const response = await POST(new NextRequest('http://localhost/api/internal/pilot/start-outcome', {
      method: 'POST',
      body: JSON.stringify({
        entityId: '00000000-0000-0000-0000-000000000001',
        organizationContextId: 'ctx-1',
        pilotId: 'pilot-1',
        workflowLane: 'perm-md',
        geographyTag: 'CA',
        startedAt: '2026-03-29T16:00:00.000Z',
        readinessScoreAtStart: 91,
        blockers: ['DEA_REGISTRATION', 'DEA_REGISTRATION', '', 42],
        note: 'Manual pilot confirmation',
      }),
      headers: { 'Content-Type': 'application/json' },
    }));

    expect(fetchMock).toHaveBeenCalledOnce();
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
      entityId: '00000000-0000-0000-0000-000000000001',
      status: 'STARTED',
      organizationContextId: 'ctx-1',
      pilotId: 'pilot-1',
      workflowLane: 'perm-md',
      geographyTag: 'CA',
      startedAt: '2026-03-29T16:00:00.000Z',
      readinessScoreAtStart: 91,
      blockers: ['DEA_REGISTRATION'],
      note: 'Manual pilot confirmation',
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      queued: true,
      entityId: '00000000-0000-0000-0000-000000000001',
      startedAt: '2026-03-29T16:00:00.000Z',
    });
  });

  it('forwards did-not-start payloads without fabricating a startedAt timestamp', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      queued: true,
      entityId: '00000000-0000-0000-0000-000000000009',
      status: 'DID_NOT_START',
      nonStartReason: 'candidate_withdrew',
      recordedAt: '2026-03-29T18:00:00.000Z',
    }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadStartOutcomeRoute();
    const { NextRequest } = await import('next/server');

    const response = await POST(new NextRequest('http://localhost/api/internal/pilot/start-outcome', {
      method: 'POST',
      body: JSON.stringify({
        entityId: '00000000-0000-0000-0000-000000000009',
        organizationContextId: 'ctx-9',
        pilotId: 'pilot-9',
        workflowLane: 'travel-rn',
        geographyTag: 'NV',
        status: 'DID_NOT_START',
        nonStartReason: 'candidate_withdrew',
        nonStartCategory: 'candidate',
        note: 'Candidate withdrew after packet review',
        recordedAt: '2026-03-29T18:00:00.000Z',
      }),
      headers: { 'Content-Type': 'application/json' },
    }));

    expect(fetchMock).toHaveBeenCalledOnce();

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({
      entityId: '00000000-0000-0000-0000-000000000009',
      status: 'DID_NOT_START',
      organizationContextId: 'ctx-9',
      pilotId: 'pilot-9',
      workflowLane: 'travel-rn',
      geographyTag: 'NV',
      note: 'Candidate withdrew after packet review',
      nonStartReason: 'candidate_withdrew',
      nonStartCategory: 'candidate',
      recordedAt: '2026-03-29T18:00:00.000Z',
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      queued: true,
      entityId: '00000000-0000-0000-0000-000000000009',
      status: 'DID_NOT_START',
      nonStartReason: 'candidate_withdrew',
      recordedAt: '2026-03-29T18:00:00.000Z',
    });
  });
});
