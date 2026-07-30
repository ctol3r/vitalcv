/**
 * /apply/[requestUri] — legacy bundle compatibility and invalid-id 404 gate.
 *
 * The route is now a dispatcher: `vai_...` identifiers use Apply Intent while
 * UUID identifiers preserve the historical bundle contract. Malformed or
 * unresolvable bundle ids call notFound() and never leak backend errors.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
}));

// This suite exercises the retained UUID bundle branch only. Isolate the
// server-only clinician-intent loader that the unified dispatcher imports for
// `vai_...` identifiers so Vitest does not execute Next's server-only sentinel.
vi.mock('@/lib/server/applyIntent', () => ({
  loadApplyIntent: vi.fn(),
}));

vi.mock('@/components/apply/ApplyBundleView', () => ({
  ApplyBundleView: ({ bundle }: { bundle: { bundleId: string } }) => (
    <div data-testid="apply-bundle-view">{bundle.bundleId}</div>
  ),
}));

import ApplyPage from '../app/apply/[requestUri]/page';
import ApplyLinkNotFound from '../app/apply/[requestUri]/not-found';
import { isValidBundleId } from '../lib/apply/bundle-id';

const VALID_ID = '123e4567-e89b-42d3-a456-426614174000';

function renderPage(requestUri: string) {
  return ApplyPage({ params: Promise.resolve({ requestUri }) });
}

describe('isValidBundleId', () => {
  it('accepts randomUUID-shaped ids', () => {
    expect(isValidBundleId(VALID_ID)).toBe(true);
    expect(isValidBundleId(VALID_ID.toUpperCase())).toBe(true);
  });

  it('rejects everything else', () => {
    for (const bad of ['x', '', 'demo-001', '123e4567', `${VALID_ID}/extra`, '../../etc/passwd']) {
      expect(isValidBundleId(bad)).toBe(false);
    }
  });
});

describe('/apply/[requestUri] — legacy bundle path', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    notFoundMock.mockClear();
  });

  it('404s a malformed bundle identifier without hitting the backend', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(renderPage('x')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('404s a well-formed bundle identifier the backend does not know', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));

    await expect(renderPage(VALID_ID)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('renders the expired state without a 404 or server-component event handler', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 410 })));

    const html = renderToStaticMarkup((await renderPage(VALID_ID)) as React.ReactElement);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(html).toContain('This link has expired');
  });

  it('renders the anchor-only error state when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('backend down')));

    const html = renderToStaticMarkup((await renderPage(VALID_ID)) as React.ReactElement);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(html).toContain('Connection interrupted');
    expect(html).toContain(`href="/apply/${VALID_ID}"`);
    expect(html).not.toContain('<button');
  });

  it('renders the bundle view for a resolvable historical bundle', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ bundleId: VALID_ID, expiresAt: '2999-01-01T00:00:00.000Z' }),
          { status: 200 },
        ),
      ),
    );

    const html = renderToStaticMarkup((await renderPage(VALID_ID)) as React.ReactElement);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(html).toContain('data-testid="apply-bundle-view"');
    expect(html).toContain(VALID_ID);
  });
});

describe('/apply/[requestUri] — not-found boundary', () => {
  it('renders contextual copy with a recovery path and no application data', () => {
    const html = renderToStaticMarkup(<ApplyLinkNotFound />);
    expect(html).toContain('Link not found');
    expect(html).toContain('This link is invalid or has been revoked.');
    expect(html).toContain('href="/passport"');
  });
});
