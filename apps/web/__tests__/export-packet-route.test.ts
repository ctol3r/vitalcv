import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();
const renderEmployerProofPacketPdfMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

vi.mock('@/lib/export/employer-proof-packet', () => ({
  employerProofPacketFilename: (npi: string) => `vitalcv-employer-packet-${npi}.pdf`,
}));

vi.mock('@/lib/export/employer-proof-packet-pdf', () => ({
  renderEmployerProofPacketPdf: renderEmployerProofPacketPdfMock,
}));

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
      credentials: [],
      summary: {
        active: 0,
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
      status: 'DECISION_GRADE',
      score: 92,
      level: 'L3',
      blockers: [],
      gaps: [],
      estimatedStartDays: 10,
      nextActions: [],
    },
    sources: {
      checked: ['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC', 'STATE_BOARD'],
      lastFetch: {
        NPPES_API: '2026-03-23T12:00:00.000Z',
        OIG_LEIE: '2026-03-23T12:00:00.000Z',
        PECOS_PUBLIC: '2026-03-20T00:00:00.000Z',
        STATE_BOARD: '2026-03-22T00:00:00.000Z',
      },
    },
    sourceCoverage: {
      checks: [
        {
          sourceId: 'NPPES_API',
          state: 'checked',
          reason: 'NPPES identity checked',
          checkedAt: '2026-03-23T12:00:00.000Z',
        },
        {
          sourceId: 'OIG_LEIE',
          state: 'checked',
          reason: 'OIG LEIE check clear',
          checkedAt: '2026-03-23T12:00:00.000Z',
        },
        {
          sourceId: 'PECOS_PUBLIC',
          state: 'checked',
          reason: 'PECOS quarterly enrollment checked',
          checkedAt: '2026-03-20T00:00:00.000Z',
        },
        {
          sourceId: 'STATE_BOARD',
          state: 'checked',
          reason: 'State board authority checked',
          checkedAt: '2026-03-22T00:00:00.000Z',
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
      blockers: [],
    },
    lastCheckedAt: '2026-03-23T12:00:00.000Z',
    ...overrides,
  };
}

describe('/api/export/packet', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    authMock.mockReset();
    renderEmployerProofPacketPdfMock.mockReset();
    process.env.BACKEND_URL = 'http://backend.test';
  });

  it('rejects unauthenticated exports', async () => {
    authMock.mockResolvedValue({ userId: null });

    const { GET } = await import('../app/api/export/packet/route');
    const response = await GET(new NextRequest('http://localhost/api/export/packet?npi=1234567890'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'unauthorized',
      error_description: 'Sign in with an employer workspace to continue.',
    });
  });

  it('requires a valid NPI query', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });

    const { GET } = await import('../app/api/export/packet/route');
    const response = await GET(new NextRequest('http://localhost/api/export/packet?npi=123'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'invalid_request',
      error_description: 'A valid 10-digit NPI is required.',
    });
  });

  it('renders a pdf from the canonical passport payload', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    renderEmployerProofPacketPdfMock.mockResolvedValue(Buffer.from('%PDF-1.4 employer packet'));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(buildPassportPayload()));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/export/packet/route');
    const response = await GET(new NextRequest('http://localhost/api/export/packet?npi=1234567890'));

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/passport/npi/1234567890',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'x-clerk-user-id': 'clerk-user-1',
        }),
      }),
    );
    expect(renderEmployerProofPacketPdfMock).toHaveBeenCalledWith(expect.objectContaining({
      identity: expect.objectContaining({
        displayName: 'Ada Lovelace',
      }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('vitalcv-employer-packet-1234567890.pdf');
    expect(response.headers.get('x-vitalcv-export-gate')).toBe('allowed');
    expect(response.headers.get('x-vitalcv-export-gate-score')).toBe('100');
    expect(response.headers.get('x-vitalcv-replay-attribution')).toContain('vitalcv.export-gating.v1');
    const body = Buffer.from(await response.arrayBuffer()).toString('utf8');
    expect(body).toContain('%PDF-1.4 employer packet');
  });

  it('fails closed when readiness is not export-grade', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    renderEmployerProofPacketPdfMock.mockResolvedValue(Buffer.from('%PDF-1.4 employer packet'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(buildPassportPayload({
      readiness: {
        status: 'PARTIAL',
        score: 82,
        level: 'L2',
        blockers: [],
        gaps: ['State board authority is pending.'],
        estimatedStartDays: 10,
        nextActions: [],
      },
      sourceCoverage: {
        checks: [
          {
            sourceId: 'NPPES_API',
            state: 'checked',
            reason: 'NPPES identity checked',
            checkedAt: '2026-03-23T12:00:00.000Z',
          },
          {
            sourceId: 'OIG_LEIE',
            state: 'checked',
            reason: 'OIG LEIE check clear',
            checkedAt: '2026-03-23T12:00:00.000Z',
          },
          {
            sourceId: 'PECOS_PUBLIC',
            state: 'checked',
            reason: 'PECOS quarterly enrollment checked',
            checkedAt: '2026-03-20T00:00:00.000Z',
          },
          {
            sourceId: 'STATE_BOARD',
            state: 'pending',
            reason: 'State board authority pending',
            checkedAt: null,
          },
        ],
      },
    }))));

    const { GET } = await import('../app/api/export/packet/route');
    const response = await GET(new NextRequest('http://localhost/api/export/packet?npi=1234567890'));

    expect(response.status).toBe(409);
    expect(response.headers.get('x-vitalcv-export-gate')).toBe('blocked');
    expect(renderEmployerProofPacketPdfMock).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error).toBe('export_not_ready');
    expect(body.exportGating.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SOURCE_NOT_DECISION_GRADE', sourceId: 'STATE_BOARD' }),
      expect.objectContaining({ code: 'READINESS_NOT_DECISION_GRADE' }),
    ]));
    expect(body.exportGating.replayAttribution.lineageKey).toContain('STATE_BOARD:pending');
  });

  it('blocks preview-only evidence instead of exporting fake readiness', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(buildPassportPayload({
      sourceCoverage: {
        checks: [
          {
            sourceId: 'NPPES_API',
            state: 'previewOnly',
            reason: 'Synthetic preview source',
            checkedAt: null,
          },
          {
            sourceId: 'OIG_LEIE',
            state: 'checked',
            reason: 'OIG LEIE check clear',
            checkedAt: '2026-03-23T12:00:00.000Z',
          },
          {
            sourceId: 'PECOS_PUBLIC',
            state: 'checked',
            reason: 'PECOS quarterly enrollment checked',
            checkedAt: '2026-03-20T00:00:00.000Z',
          },
          {
            sourceId: 'STATE_BOARD',
            state: 'checked',
            reason: 'State board authority checked',
            checkedAt: '2026-03-22T00:00:00.000Z',
          },
        ],
      },
    }))));

    const { GET } = await import('../app/api/export/packet/route');
    const response = await GET(new NextRequest('http://localhost/api/export/packet?npi=1234567890'));

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe('export_not_ready');
    expect(body.exportGating.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SOURCE_PREVIEW_ONLY', sourceId: 'NPPES_API' }),
    ]));
  });

  it('surfaces upstream passport failures instead of returning a broken pdf', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      error: 'not_found',
      detail: 'Passport unavailable',
    }, 404)));

    const { GET } = await import('../app/api/export/packet/route');
    const response = await GET(new NextRequest('http://localhost/api/export/packet?npi=1234567890'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'not_found',
      error_description: 'Passport unavailable',
    });
  });
});
