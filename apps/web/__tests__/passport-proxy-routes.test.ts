import { beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildPassportPayload(overrides: Record<string, unknown> = {}) {
  return {
    entityId: 'entity-1',
    npi: '1234567890',
    identity: {
      displayName: 'Ada Lovelace',
      specialty: 'Cardiology',
      entityType: 'PERSON',
      status: 'ACTIVE',
      npi: '1234567890',
    },
    authority: {
      credentials: [
        {
          id: 'cred-1',
          domain: 'LICENSURE',
          type: 'STATE_LICENSE',
          status: 'ACTIVE',
          verificationLevel: 'SOURCE_VERIFIED',
          issuerName: 'California Medical Board',
          sourceId: 'STATE_BOARD',
          jurisdiction: 'CA',
          issuedAt: '2026-03-01T00:00:00.000Z',
          expiresAt: '2027-03-01T00:00:00.000Z',
          verifiedAt: '2026-03-23T12:00:00.000Z',
          observedAt: '2026-03-23T12:00:00.000Z',
          stale: false,
          confidenceLabel: 'HIGH',
          claimConfidenceLabel: 'HIGH',
          matchConfidence: 'HIGH',
          sourceLatency: 'Live',
          dataFreshness: 'Daily',
          dataFreshnessLabel: 'Daily',
          dataFreshnessCadence: 'Daily',
          claimState: 'ACTIVE',
          statusLabel: 'Active',
          dataVersion: '2026-03-23',
          revalidationDue: '2026-03-30T00:00:00.000Z',
          identityOnly: false,
          sourceDisclaimer: null,
          nextReverifyAt: '2026-03-30T00:00:00.000Z',
          reviewRequired: false,
          authorityClaimCode: 'PHYSICIAN_LICENSE_ACTIVE',
          boardOrderSeverity: null,
          connectorState: 'configured',
          participationStatus: 'verified_result',
          sourceScope: 'STATE_BOARD_CA_API',
        },
      ],
      summary: {
        active: 1,
        expired: 0,
        stale: 0,
        missing: [],
      },
    },
    training: {
      records: [],
      hasDegree: true,
      degreeVerified: true,
      hasResidency: true,
      fellowshipCount: 0,
    },
    standing: {
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      exclusionCheckedAt: '2026-03-23T12:00:00.000Z',
      exclusionConfidenceLabel: 'HIGH',
      licensureStatus: 'verified',
      deaStatus: 'unknown',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentSourceLatency: 'Quarterly snapshot',
      enrollmentNote: 'Current PECOS enrollment found.',
      enrollmentObservedAt: '2026-03-20T00:00:00.000Z',
      enrollmentDataVersion: '2026-Q1',
      enrollmentStatusLabel: 'Enrolled',
      enrollmentFreshnessLabel: 'Quarterly',
      enrollmentConfidenceLabel: 'Quarterly release',
      negativeFindings: [],
    },
    readiness: {
      status: 'PARTIAL',
      score: 82,
      level: 'L2',
      blockers: ['DEA registration missing'],
      gaps: ['Controlled substance verification missing'],
      estimatedStartDays: 10,
      nextActions: [
        {
          id: 'next-1',
          title: 'Attach DEA evidence',
          detail: 'Upload DEA registration evidence.',
          priority: 'HIGH',
        },
      ],
    },
    sources: {
      checked: ['NPPES_API', 'OIG_LEIE', 'STATE_BOARD', 'PECOS_PUBLIC'],
      lastFetch: {
        NPPES_API: '2026-03-23T12:00:00.000Z',
      },
    },
    sourceCoverage: {
      checks: [
        {
          sourceId: 'NPPES_API',
          state: 'checked',
          reason: 'Identity verified in CMS NPPES.',
          checkedAt: '2026-03-23T12:00:00.000Z',
        },
        {
          sourceId: 'OIG_LEIE',
          state: 'checked',
          reason: 'OIG LEIE check returned clear.',
          checkedAt: '2026-03-23T12:00:00.000Z',
        },
        {
          sourceId: 'STATE_BOARD',
          state: 'checked',
          reason: 'State licensure verified.',
          checkedAt: '2026-03-23T12:00:00.000Z',
        },
        {
          sourceId: 'PECOS_PUBLIC',
          state: 'checked',
          reason: 'PECOS quarterly enrollment snapshot confirms enrollment.',
          checkedAt: '2026-03-20T00:00:00.000Z',
        },
      ],
    },
    trustPosture: {
      band: 'L2',
      bandLabel: 'Moderate trust',
      score: 82,
      dimensions: [],
      freshness: {
        state: 'current',
        label: 'Current source coverage',
        items: [],
      },
      safeToRelyOnNow: ['Identity confirmed'],
      missingItems: [],
      gatedItems: [],
      reviewRequiredItems: [],
      staleItems: [],
      blockers: ['DEA registration missing'],
    },
    lastCheckedAt: '2026-03-23T12:00:00.000Z',
    ...overrides,
  };
}

describe('passport proxy routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.BACKEND_URL = 'http://backend.test';
  });

  it('normalizes /api/passport/npi/[npi] responses onto the canonical truth contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(buildPassportPayload())));

    const { GET } = await import('../app/api/passport/npi/[npi]/route');
    const response = await GET(new Request('http://localhost/api/passport/npi/1234567890') as never, {
      params: Promise.resolve({ npi: '1234567890' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      readiness: expect.objectContaining({
        status: 'PARTIAL',
        readiness_score: 82,
      }),
      truth: expect.objectContaining({
        identity: expect.objectContaining({
          status: 'VERIFIED',
        }),
        authority: expect.objectContaining({
          status: 'VERIFIED',
        }),
      }),
      sourceCoverage: expect.objectContaining({
        summary: expect.objectContaining({
          checked: ['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC', 'STATE_BOARD'],
        }),
      }),
    }));
  });

  it('/api/passport/[npi] proxies to the entity-shape backend route (/api/passport/npi/:npi)', async () => {
    // Pins the upstream URL so a regression that re-routes back to
    // /api/passport/:npi (NPI-shape) can't silently reintroduce the
    // `invalid_upstream_payload` 502.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(buildPassportPayload()));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/passport/[npi]/route');
    const response = await GET(new Request('http://localhost/api/passport/1234567890') as never, {
      params: Promise.resolve({ npi: '1234567890' }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = (fetchMock.mock.calls[0]?.[0] as string) ?? '';
    expect(calledUrl).toBe('http://backend.test/api/passport/npi/1234567890');
  });

  it('rejects invalid readiness posture instead of proxying synthetic completeness', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(buildPassportPayload({
      readiness: {
        status: 'READY_NOW',
        score: 90,
        level: 'L3',
        blockers: [],
        gaps: [],
        estimatedStartDays: 1,
        nextActions: [],
      },
    }))));

    const { GET } = await import('../app/api/passport/[npi]/route');
    const response = await GET(new Request('http://localhost/api/passport/1234567890') as never, {
      params: Promise.resolve({ npi: '1234567890' }),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'invalid_upstream_payload',
      detail: 'Error: Invalid passport payload.',
    });
  });

  it('normalizes /api/passport/entity/[id] responses and preserves explicit gated truth states', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(buildPassportPayload({
      authority: {
        credentials: [
          {
            id: 'cred-1',
            domain: 'LICENSURE',
            type: 'STATE_LICENSE',
            status: 'UNRESOLVED',
            verificationLevel: 'SOURCE_VERIFIED',
            issuerName: 'California Medical Board',
            sourceId: 'STATE_BOARD',
            jurisdiction: 'CA',
            issuedAt: '2026-03-01T00:00:00.000Z',
            expiresAt: '2027-03-01T00:00:00.000Z',
            verifiedAt: '2026-03-23T12:00:00.000Z',
            observedAt: '2026-03-23T12:00:00.000Z',
            stale: false,
            confidenceLabel: 'HIGH',
            claimConfidenceLabel: 'HIGH',
            matchConfidence: 'HIGH',
            sourceLatency: 'Live',
            dataFreshness: 'Daily',
            dataFreshnessLabel: 'Daily',
            dataFreshnessCadence: 'Daily',
            claimState: 'UNAVAILABLE',
            statusLabel: 'Access required',
            dataVersion: '2026-03-23',
            revalidationDue: '2026-03-30T00:00:00.000Z',
            identityOnly: false,
            sourceDisclaimer: null,
            nextReverifyAt: '2026-03-30T00:00:00.000Z',
            reviewRequired: false,
            authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
            boardOrderSeverity: null,
            connectorState: 'unavailable',
            participationStatus: 'institution_access_unavailable',
            sourceScope: 'FSMB_MED_API',
          },
        ],
        summary: {
          active: 0,
          expired: 0,
          stale: 0,
          missing: ['LICENSURE'],
        },
      },
      sourceCoverage: {
        checks: [
          {
            sourceId: 'NPPES_API',
            state: 'checked',
            reason: 'Identity verified in CMS NPPES.',
            checkedAt: '2026-03-23T12:00:00.000Z',
          },
          {
            sourceId: 'OIG_LEIE',
            state: 'checked',
            reason: 'OIG LEIE check returned clear.',
            checkedAt: '2026-03-23T12:00:00.000Z',
          },
          {
            sourceId: 'STATE_BOARD',
            state: 'accessRequired',
            reason: 'Institutional state board access is required.',
            checkedAt: '2026-03-23T12:00:00.000Z',
          },
          {
            sourceId: 'PECOS_PUBLIC',
            state: 'checked',
            reason: 'PECOS quarterly enrollment snapshot confirms enrollment.',
            checkedAt: '2026-03-20T00:00:00.000Z',
          },
        ],
      },
    }))));

    const { GET } = await import('../app/api/passport/entity/[id]/route');
    const response = await GET(new Request('http://localhost/api/passport/entity/entity-1') as never, {
      params: Promise.resolve({ id: 'entity-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      truth: expect.objectContaining({
        authority: expect.objectContaining({
          status: 'ACCESS_REQUIRED',
        }),
      }),
      sourceCoverage: expect.objectContaining({
        summary: expect.objectContaining({
          accessRequired: ['STATE_BOARD'],
        }),
      }),
    }));
  });
});
