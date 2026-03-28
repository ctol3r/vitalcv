import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

describe('/api/employer-review/[entityId]/[action] proxy', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    authMock.mockReset();
    process.env.BACKEND_URL = 'http://backend.test';
  });

  it('rejects unauthenticated action writes', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { POST } = await import('../app/api/employer-review/[entityId]/[action]/route');

    const response = await POST(new Request('http://localhost/api/employer-review/entity-1/accept', {
      method: 'POST',
      body: JSON.stringify({}),
    }) as never, {
      params: Promise.resolve({ entityId: 'entity-1', action: 'accept' }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'unauthorized',
      error_description: 'Sign in with an employer workspace to continue.',
    });
  });

  it('forwards authenticated action writes with the backend contract intact', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        ok: true,
        state: {
          action: 'refresh',
          entityId: 'entity-1',
          clinicianNpi: '1234567890',
          auditEventId: 'audit-1',
          timestamp: '2026-03-23T19:00:00.000Z',
          persistence: {
            mode: 'audit_only',
            target: 'audit_event',
            acceptanceId: null,
            reviewItemId: null,
            reviewItemCreated: false,
          },
          summary: {
            title: 'Refresh request recorded',
            description: 'The refresh request was persisted in the audit trail. No clinician notification is persisted here yet.',
          },
          details: {
            staleSources: ['CMS PECOS'],
            missingDomains: ['LICENSURE'],
            reason: null,
            priority: null,
          },
        },
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../app/api/employer-review/[entityId]/[action]/route');
    const response = await POST(new Request('http://localhost/api/employer-review/entity-1/request-refresh', {
      method: 'POST',
      body: JSON.stringify({ staleSources: ['CMS PECOS'] }),
      headers: { 'Content-Type': 'application/json' },
    }) as never, {
      params: Promise.resolve({ entityId: 'entity-1', action: 'request-refresh' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/employer-review/entity-1/request-refresh',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Object),
        body: JSON.stringify({ staleSources: ['CMS PECOS'] }),
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers['x-clerk-user-id']).toBe('clerk-user-1');

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      state: expect.objectContaining({
        action: 'refresh',
        auditEventId: 'audit-1',
      }),
    });
  });

  it('forwards authenticated persisted-status reads', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        ok: true,
        state: {
          action: 'accept',
          entityId: 'entity-1',
          clinicianNpi: '1234567890',
          auditEventId: 'audit-accept-1',
          timestamp: '2026-03-23T20:00:00.000Z',
          persistence: {
            mode: 'durable_record',
            target: 'employer_acceptance',
            acceptanceId: 'accept-1',
            reviewItemId: null,
            reviewItemCreated: false,
          },
          summary: {
            title: 'Head start accepted',
            description: 'The employer acceptance was persisted and linked to an audit event.',
          },
          details: {
            staleSources: [],
            missingDomains: [],
            reason: null,
            priority: null,
          },
          trustSnapshot: {
            snapshotHash: 'snap_hash_1234567890abcdef',
            capturedAt: '2026-03-23T20:00:00.000Z',
            npi: '1234567890',
            readinessStatus: 'PARTIAL',
            readinessScore: 88,
            readinessLevel: 'L2',
            trustBand: 'L2',
            trustBandLabel: 'Moderate trust',
            trustScore: 88,
            trustScoreConfidence: 0.91,
            exclusionStatus: 'CLEAR',
            exclusionCheckedAt: '2026-03-23T19:30:00.000Z',
            pecosEnrollmentStatus: 'ENROLLED',
            verifiedCredentialCount: 2,
            staleCredentialCount: 0,
            reviewRequiredCount: 0,
            blockerCount: 0,
            topBlockers: [],
            missingDomains: [],
            gatedDomains: [],
            lastCheckedAt: '2026-03-23T19:30:00.000Z',
          },
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/employer-review/[entityId]/[action]/route');
    const response = await GET(new Request('http://localhost/api/employer-review/entity-1/status', {
      headers: { Accept: 'application/json' },
    }) as never, {
      params: Promise.resolve({ entityId: 'entity-1', action: 'status' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/employer-review/entity-1/status',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          'x-clerk-user-id': 'clerk-user-1',
        },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      state: expect.objectContaining({
        action: 'accept',
        auditEventId: 'audit-accept-1',
        trustSnapshot: expect.objectContaining({
          snapshotHash: 'snap_hash_1234567890abcdef',
        }),
      }),
    });
  });
});
