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
      .mockResolvedValueOnce(jsonResponse({
        entityId: 'entity-1',
        readiness: {
          score: 88,
          blockers: ['DEA_REGISTRATION'],
        },
      }))
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
      .mockResolvedValueOnce(jsonResponse({
        entityId: 'entity-1',
        readiness: {
          score: 72,
          blockers: [],
        },
      }))
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
    // Wave L2: 'passport' retired — the /passport route was removed by #1096.
    expect(markup).toContain('This clinician record is not available for review yet');
    expect(markup).toContain('/review/entity-1?contextId=ctx-1&amp;bundleId=bundle-1&amp;from=Ada+Lovelace');
  });

  it('resolves share tokens before hydrating the employer review surface', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        entityId: 'entity-1',
        clinicianNpi: '1234567890',
        organizationContextId: 'ctx-from-token',
        bundleId: 'bundle-from-token',
        reviewHref: '/review/entity-1',
        shareEventAuditId: 'audit-share-1',
        sharedAt: '2026-03-23T18:00:00.000Z',
        expiresAt: '2099-03-24T18:00:00.000Z',
      }))
      .mockResolvedValueOnce(jsonResponse({
        entityId: 'entity-1',
        readiness: {
          score: 91,
          blockers: [],
        },
      }))
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
      params: Promise.resolve({ entityId: 'chk_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12' }),
      searchParams: Promise.resolve({}),
    }));

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      'http://backend.test/api/employer-review/share-token/chk_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12',
      'http://backend.test/api/passport/entity/entity-1',
      'http://backend.test/api/employer-review/entity-1/acceptance-history',
      'http://backend.test/api/employer-review/entity-1/view',
    ]);
    expect(reviewClientSpy).toHaveBeenCalledWith(expect.objectContaining({
      contextId: 'ctx-from-token',
      bundleId: 'bundle-from-token',
      sharedBy: 'VitalCV packet share',
    }));
  });

  it('renders a safe state for expired share tokens without fetching passport data', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      error: 'share_token_expired',
      error_description: 'This review link has expired. Ask the clinician to share a fresh packet.',
    }, 410));
    vi.stubGlobal('fetch', fetchMock);

    const ReviewPage = (await import('../app/review/[entityId]/page')).default;
    const markup = renderToStaticMarkup(await ReviewPage({
      params: Promise.resolve({ entityId: 'chk_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12' }),
      searchParams: Promise.resolve({}),
    }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reviewClientSpy).not.toHaveBeenCalled();
    expect(markup).toContain('Review link unavailable');
    expect(markup).toContain('This review link has expired');
  });
});
