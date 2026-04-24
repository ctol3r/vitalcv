import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildActionResponse(action: 'accept' | 'refresh' | 'review') {
  return {
    ok: true,
    state: {
      action,
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
      auditEventId: `audit-${action}-1`,
      timestamp: '2026-03-23T19:00:00.000Z',
      persistence: {
        mode: 'durable_record',
        target: action === 'accept' ? 'employer_acceptance' : 'outbox_event',
        acceptanceId: action === 'accept' ? 'acceptance-1' : null,
        reviewItemId: null,
        outboxEventId: `outbox-${action}-1`,
        reviewItemCreated: false,
      },
      summary: {
        title: `${action} recorded`,
        description: `${action} persisted`,
      },
      details: {
        staleSources: action === 'refresh' ? ['CMS PECOS'] : [],
        missingDomains: [],
        reason: null,
        priority: null,
      },
      trustSnapshot: {
        snapshotHash: 'snap_hash_1234567890abcdef',
        capturedAt: '2026-03-23T19:00:00.000Z',
        npi: '1234567890',
        readinessStatus: 'PARTIAL',
        readinessScore: 88,
        readinessLevel: 'L2',
        trustBand: 'L2',
        trustBandLabel: 'Moderate trust',
        trustScore: 88,
        trustScoreConfidence: 0.91,
        exclusionStatus: 'CLEAR',
        exclusionCheckedAt: '2026-03-23T19:00:00.000Z',
        pecosEnrollmentStatus: 'ENROLLED',
        verifiedCredentialCount: 2,
        staleCredentialCount: 0,
        reviewRequiredCount: 0,
        blockerCount: 0,
        topBlockers: [],
        missingDomains: [],
        gatedDomains: [],
        truthStatuses: {
          identity: 'VERIFIED',
          safety: 'CLEAR',
          authority: 'ACCESS REQUIRED',
          eligibility: 'ENROLLED',
        },
        sourceCoverageSummary: {
          checked: ['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC'],
          stale: [],
          pending: [],
          gated: [],
          unavailable: [],
          accessRequired: ['STATE_BOARD'],
          reviewRequired: [],
          notDecisionGrade: [],
          previewOnly: [],
        },
        lastCheckedAt: '2026-03-23T19:00:00.000Z',
      },
    },
  };
}

function buildPacketPayload() {
  return {
    schema: 'vitalcv.employer.packet.v1',
    exportedAt: '2026-03-23T19:00:00.000Z',
    exportedBy: 'clerk-user-1',
    entityId: 'entity-1',
    clinicianNpi: '1234567890',
    displayName: 'Ada Lovelace',
    receiptReferences: [{ sourceId: 'STATE_BOARD', receiptId: 'receipt-1' }],
    artifactReferences: [{ sourceId: 'STATE_BOARD', artifactId: 'artifact-1' }],
    sourceCoverage: {
      checks: [
        {
          sourceId: 'STATE_BOARD',
          state: 'accessRequired',
          reason: 'Institutional state board access is required.',
        },
      ],
    },
    truth: {
      identity: { status: 'VERIFIED' },
      safety: { status: 'CLEAR' },
      authority: { status: 'ACCESS_REQUIRED' },
      eligibility: { status: 'ENROLLED' },
    },
    freshness: {},
    identity: {},
    safety: {},
    authority: {},
    eligibility: {},
    readiness: {},
    manifest: {
      schema: 'vitalcv.employer.packet-manifest.v1',
      packetSchema: 'vitalcv.employer.packet.v1',
      exportedAt: '2026-03-23T19:00:00.000Z',
      exportedBy: 'clerk-user-1',
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
      bundleFiles: ['packet.json'],
      receiptReferences: [{ sourceId: 'STATE_BOARD', receiptId: 'receipt-1' }],
      artifactReferences: [{ sourceId: 'STATE_BOARD', artifactId: 'artifact-1' }],
      sourceCoverage: {
        checks: [
          {
            sourceId: 'STATE_BOARD',
            state: 'accessRequired',
            reason: 'Institutional state board access is required.',
          },
        ],
      },
      freshness: {},
      status: {},
      sources: [
        {
          sourceId: 'STATE_BOARD',
          truthStatus: 'ACCESS REQUIRED',
          state: 'accessRequired',
          reason: 'Institutional state board access is required.',
          checkedAt: null,
          observedAt: null,
          expiresAt: null,
          freshness: {
            status: 'unknown',
            checkedAt: null,
            observedAt: null,
            expiresAt: null,
            freshnessWindowHours: null,
          },
          provenance: {
            artifactId: null,
            artifactIds: ['artifact-1'],
            receiptIds: ['receipt-1'],
            sourceUrl: null,
            rawArtifactRef: null,
            checksum: null,
            parserVersion: null,
          },
          parserVersion: null,
          checksum: null,
          sourceUrl: null,
          rawArtifactRef: null,
          freshnessWindowHours: null,
          confidenceLabel: null,
          reviewRequired: false,
          artifactId: null,
          artifactIds: ['artifact-1'],
          receiptIds: ['receipt-1'],
        },
      ],
      sources: [
        {
          sourceId: 'STATE_BOARD',
          truthStatus: 'ACCESS_REQUIRED',
          state: 'accessRequired',
          reason: 'Institutional state board access is required.',
          checkedAt: null,
          observedAt: null,
          expiresAt: null,
          freshness: {
            status: 'unknown',
            checkedAt: null,
            observedAt: null,
            expiresAt: null,
            freshnessWindowHours: null,
          },
          provenance: {
            artifactId: null,
            artifactIds: ['artifact-1'],
            receiptIds: ['receipt-1'],
            sourceUrl: null,
            rawArtifactRef: null,
            checksum: null,
            parserVersion: null,
          },
          parserVersion: null,
          checksum: null,
          sourceUrl: null,
          rawArtifactRef: null,
          freshnessWindowHours: null,
          confidenceLabel: null,
          reviewRequired: false,
          artifactId: null,
          artifactIds: ['artifact-1'],
          receiptIds: ['receipt-1'],
        },
      ],
    },
  };
}

function buildSharePacketPayload() {
  return {
    ok: true,
    shareUrl: 'https://app.vitalcv.test/review/chk_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12',
    auditEventId: 'audit-share-1',
    expiresAt: '2099-03-24T18:00:00.000Z',
  };
}

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

    const response = await POST(new NextRequest('http://localhost/api/employer-review/entity-1/accept', {
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
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(buildActionResponse('refresh'), 201));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../app/api/employer-review/[entityId]/[action]/route');
    const response = await POST(new NextRequest('http://localhost/api/employer-review/entity-1/request-refresh', {
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
        auditEventId: 'audit-refresh-1',
      }),
    });
  });

  it('rejects malformed request-refresh bodies before proxying', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../app/api/employer-review/[entityId]/[action]/route');
    const response = await POST(new Request('http://localhost/api/employer-review/entity-1/request-refresh', {
      method: 'POST',
      body: JSON.stringify({ staleSources: 'CMS PECOS' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never, {
      params: Promise.resolve({ entityId: 'entity-1', action: 'request-refresh' }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'invalid_request',
      error_description: 'Malformed request-refresh request body.',
    });
  });

  it('forwards authenticated share-packet writes and validates the response contract', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(buildSharePacketPayload(), 201));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../app/api/employer-review/[entityId]/[action]/route');
    const response = await POST(new NextRequest('http://localhost/api/employer-review/entity-1/share-packet', {
      method: 'POST',
      body: JSON.stringify({ npi: '1234567890', organizationContextId: 'ctx-1', bundleId: 'bundle-1' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never, {
      params: Promise.resolve({ entityId: 'entity-1', action: 'share-packet' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/employer-review/entity-1/share-packet',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-clerk-user-id': 'clerk-user-1',
        }),
        body: JSON.stringify({ npi: '1234567890', organizationContextId: 'ctx-1', bundleId: 'bundle-1' }),
      }),
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(buildSharePacketPayload());
  });

  it('rejects malformed share-packet bodies before proxying', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../app/api/employer-review/[entityId]/[action]/route');
    const response = await POST(new NextRequest('http://localhost/api/employer-review/entity-1/share-packet', {
      method: 'POST',
      body: JSON.stringify({ npi: 'not-an-npi' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never, {
      params: Promise.resolve({ entityId: 'entity-1', action: 'share-packet' }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'invalid_request',
      error_description: 'Malformed share-packet request body.',
    });
  });

  it('returns 503 when the backend write path is unreachable', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const { POST } = await import('../app/api/employer-review/[entityId]/[action]/route');
    const response = await POST(new Request('http://localhost/api/employer-review/entity-1/accept', {
      method: 'POST',
      body: JSON.stringify({ acceptanceScope: 'pilot' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never, {
      params: Promise.resolve({ entityId: 'entity-1', action: 'accept' }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'backend_unavailable',
      error_description: 'network down',
    });
  });

  it('forwards authenticated persisted-status reads', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(buildActionResponse('accept')));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/employer-review/[entityId]/[action]/route');
    const response = await GET(new NextRequest('http://localhost/api/employer-review/entity-1/status?organizationContextId=org-1&bundleId=bundle-1', {
      headers: { Accept: 'application/json' },
    }) as never, {
      params: Promise.resolve({ entityId: 'entity-1', action: 'status' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/employer-review/entity-1/status?organizationContextId=org-1&bundleId=bundle-1',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          'x-clerk-user-id': 'clerk-user-1',
        },
        cache: 'no-store',
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
          truthStatuses: expect.objectContaining({
            identity: 'VERIFIED',
          }),
        }),
      }),
    });
  });

  it('forwards public acceptance-history reads without requiring auth headers', async () => {
    authMock.mockResolvedValue({ userId: null });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        ok: true,
        summary: {
          acceptedOrganizationCount: 1,
          hasPriorAcceptances: true,
          headline: 'Accepted by 1 organization',
          trustCopy: 'This clinician has already been accepted using VitalCV verification. Each acceptance remains scoped to the organization and scope shown below.',
        },
        history: [
          {
            acceptanceId: 'accept-1',
            orgLabel: 'Pilot organization 1',
            isAnonymized: true,
            acceptedByOrgId: 'org-1',
            acceptedAt: '2026-03-23T18:00:00.000Z',
            acceptanceScope: 'pilot',
            acceptanceReason: 'Accepted as head start using VitalCV verification.',
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/employer-review/[entityId]/[action]/route');
    const response = await GET(new Request('http://localhost/api/employer-review/entity-1/acceptance-history', {
      headers: { Accept: 'application/json' },
    }) as never, {
      params: Promise.resolve({ entityId: 'entity-1', action: 'acceptance-history' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/employer-review/entity-1/acceptance-history',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
        },
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers['x-clerk-user-id']).toBeUndefined();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      summary: expect.objectContaining({
        headline: 'Accepted by 1 organization',
      }),
      history: expect.any(Array),
    });
  });

  it('fails closed when acceptance-history is unavailable upstream', async () => {
    authMock.mockResolvedValue({ userId: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      error: 'history_unavailable',
      error_description: 'Audit stream offline.',
    }, 503)));

    const { GET } = await import('../app/api/employer-review/[entityId]/[action]/route');
    const response = await GET(new Request('http://localhost/api/employer-review/entity-1/acceptance-history') as never, {
      params: Promise.resolve({ entityId: 'entity-1', action: 'acceptance-history' }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'history_unavailable',
      error_description: 'Audit stream offline.',
    });
  });

  it('forwards scoped status queries to the backend', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(buildActionResponse('accept')));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/employer-review/[entityId]/[action]/route');
    await GET(new Request('http://localhost/api/employer-review/entity-1/status?organizationContextId=ctx-1&bundleId=bundle-1', {
      headers: { Accept: 'application/json' },
    }) as never, {
      params: Promise.resolve({ entityId: 'entity-1', action: 'status' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/employer-review/entity-1/status?organizationContextId=ctx-1&bundleId=bundle-1',
      expect.any(Object),
    );
  });

  it('rejects packet JSON when manifest proof fields are incomplete', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    const invalidPacket = buildPacketPayload();
    delete (invalidPacket.manifest.sources[0] as Record<string, unknown>).provenance;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(invalidPacket)));

    const { GET } = await import('../app/api/employer-review/[entityId]/[action]/route');
    const response = await GET(new Request('http://localhost/api/employer-review/entity-1/packet', {
      headers: { Accept: 'application/json' },
    }) as never, {
      params: Promise.resolve({ entityId: 'entity-1', action: 'packet' }),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'invalid_upstream_payload',
      error_description: 'Invalid employer evidence packet.',
    });
  });

  it('passes through valid packet JSON after manifest validation', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(buildPacketPayload())));

    const { GET } = await import('../app/api/employer-review/[entityId]/[action]/route');
    const response = await GET(new Request('http://localhost/api/employer-review/entity-1/packet', {
      headers: { Accept: 'application/json' },
    }) as never, {
      params: Promise.resolve({ entityId: 'entity-1', action: 'packet' }),
    });

    if (response.status !== 200) {
      console.log('Error payload:', await response.clone().json());
    }

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      manifest: expect.objectContaining({
        sources: expect.any(Array),
      }),
      sourceCoverageSummary: expect.objectContaining({
        accessRequired: ['STATE_BOARD'],
      }),
    }));
  });
});
