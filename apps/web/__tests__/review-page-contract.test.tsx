import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PUBLIC_WEDGE_ROUTE_TARGETS } from '@/lib/trust/public-wedge-parity';

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
    }));

    const [, viewEventInit] = fetchMock.mock.calls[1] as [string, { body: string }];
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
    }));

    const [, viewEventInit] = fetchMock.mock.calls[1] as [string, { body: string }];
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
    expect(markup).toContain('Passport hydration missing.');
    expect(markup).toContain('/review/entity-1?contextId=ctx-1&amp;bundleId=bundle-1&amp;from=Ada+Lovelace');
  });

  it('keeps buyer CTA routing on the review and request-review paths without inflating the promise', async () => {
    const ReviewLandingPage = (await import('../app/review/page')).default;
    const markup = renderToStaticMarkup(<ReviewLandingPage />);

    expect(markup).toContain('Employer review opens from a real passport share link.');
    expect(markup).toContain(`href="${PUBLIC_WEDGE_ROUTE_TARGETS.homepageLookup}"`);
    expect(markup).toContain(`href="${PUBLIC_WEDGE_ROUTE_TARGETS.passportEntry}"`);
    expect(markup).toContain('href="/review/request"');
    expect(markup).toContain('Request a passport review');
    expect(markup).not.toMatch(/verified review/i);
    expect(markup).not.toMatch(/instant/i);
  });
});
