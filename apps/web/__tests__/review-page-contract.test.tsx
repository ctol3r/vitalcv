import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reviewClientSpy = vi.fn();

vi.mock('@/components/review/ReviewClient', () => ({
  default: (props: Record<string, unknown>) => {
    reviewClientSpy(props);
    return <div data-review-client>{JSON.stringify(props)}</div>;
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/trust/TrustStateCard', () => ({
  TrustStateCard: ({
    title,
    description,
    actions,
  }: {
    title: string;
    description: React.ReactNode;
    actions?: React.ReactNode;
  }) => (
    <section>
      <h1>{title}</h1>
      <div>{description}</div>
      <div>{actions}</div>
    </section>
  ),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
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
      score: 88,
      level: 'L2',
      blockers: ['DEA_REGISTRATION'],
      gaps: [],
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
      ],
    },
    trustPosture: {
      band: 'L2',
      bandLabel: 'Moderate trust',
      score: 88,
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
      blockers: ['DEA_REGISTRATION'],
    },
    lastCheckedAt: '2026-03-23T12:00:00.000Z',
    ...overrides,
  };
}

describe('review page contract', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    reviewClientSpy.mockReset();
    process.env.BACKEND_URL = 'http://backend.test';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes explicit context, bundle fallback, and sharer attribution into the review surface', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(buildPassportPayload()))
      .mockResolvedValueOnce(jsonResponse({
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
      }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 202));
    vi.stubGlobal('fetch', fetchMock);

    const ReviewPage = (await import('../app/review/[entityId]/page')).default;
    renderToStaticMarkup(await ReviewPage({
      params: Promise.resolve({ entityId: 'entity-1' }),
      searchParams: Promise.resolve({
        contextId: 'ctx-1',
        bundleId: 'bundle-1',
        from: 'Ada Lovelace',
      }),
    }));

    expect(reviewClientSpy).toHaveBeenCalledOnce();
    expect(reviewClientSpy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      contextId: 'ctx-1',
      bundleId: 'bundle-1',
      sharedBy: 'Ada Lovelace',
      acceptanceHistory: expect.objectContaining({
        summary: expect.objectContaining({
          headline: 'Accepted by 1 organization',
        }),
      }),
    }));

    const [, viewEventInit] = fetchMock.mock.calls[2] as [string, { body: string }];
    expect(JSON.parse(viewEventInit.body)).toEqual({
      organizationContextId: 'ctx-1',
      bundleId: 'bundle-1',
      readinessScore: 88,
      blockers: ['DEA_REGISTRATION'],
    });
  });

  it('keeps the direct review path unscoped when no review context is present', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(buildPassportPayload({
        readiness: {
          status: 'PARTIAL',
          score: 72,
          level: 'L2',
          blockers: [],
          gaps: [],
          estimatedStartDays: 10,
          nextActions: [],
        },
      })))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        summary: {
          acceptedOrganizationCount: 0,
          hasPriorAcceptances: false,
          headline: 'No prior acceptances',
          trustCopy: null,
        },
        history: [],
      }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 202));
    vi.stubGlobal('fetch', fetchMock);

    const ReviewPage = (await import('../app/review/[entityId]/page')).default;
    renderToStaticMarkup(await ReviewPage({
      params: Promise.resolve({ entityId: 'entity-1' }),
      searchParams: Promise.resolve({}),
    }));

    expect(reviewClientSpy).toHaveBeenCalledOnce();
    expect(reviewClientSpy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      contextId: undefined,
      bundleId: undefined,
      sharedBy: undefined,
      acceptanceHistory: expect.objectContaining({
        summary: expect.objectContaining({
          headline: 'No prior acceptances',
        }),
      }),
    }));

    const [, viewEventInit] = fetchMock.mock.calls[2] as [string, { body: string }];
    expect(JSON.parse(viewEventInit.body)).toEqual({
      organizationContextId: null,
      bundleId: null,
      readinessScore: 72,
      blockers: [],
    });
  });

  it('preserves review context query params on the unavailable-state retry link', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        error_description: 'Passport hydration missing.',
      }, 404));
    vi.stubGlobal('fetch', fetchMock);

    const ReviewPage = (await import('../app/review/[entityId]/page')).default;
    const markup = renderToStaticMarkup(await ReviewPage({
      params: Promise.resolve({ entityId: 'entity-1' }),
      searchParams: Promise.resolve({
        contextId: 'ctx-1',
        bundleId: 'bundle-1',
        from: 'Ada Lovelace',
      }),
    }));

    expect(reviewClientSpy).not.toHaveBeenCalled();
    expect(markup).toContain('Employer review unavailable');
    expect(markup).toContain('This clinician passport is not available for review yet');
    expect(markup).toContain('/review/entity-1?contextId=ctx-1&amp;bundleId=bundle-1&amp;from=Ada+Lovelace');
  });
});
