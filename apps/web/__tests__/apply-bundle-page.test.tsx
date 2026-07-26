/**
 * /apply/[bundleId] — invalid-id 404 gate (Wave 2F route-contract hardening).
 *
 * Production regression: /apply/x returned HTTP 500. Two causes:
 *   1. A non-uuid bundleId reached the backend, whose Postgres uuid column
 *      query throws → backend 500 → page fell into its 'error' branch.
 *   2. The 'error' branch rendered a <button onClick> inside a server
 *      component, crashing the RSC render into a 500 of its own.
 *
 * Contract: malformed or unresolvable bundle ids call notFound() (→ 404 via
 * not-found.tsx) and never fetch; expired/error states render anchors only.
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

vi.mock('@/components/apply/ApplyBundleView', () => ({
  ApplyBundleView: ({ bundle }: { bundle: { bundleId: string } }) => (
    <div data-testid="apply-bundle-view">{bundle.bundleId}</div>
  ),
}));

import ApplyBundlePage from '../app/apply/[bundleId]/page';
import ApplyBundleNotFound from '../app/apply/[bundleId]/not-found';
import { isValidBundleId } from '../lib/apply/bundle-id';

const VALID_ID = '123e4567-e89b-42d3-a456-426614174000';

function renderPage(bundleId: string) {
  return ApplyBundlePage({ params: Promise.resolve({ bundleId }) });
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

describe('/apply/[bundleId] — invalid-id path', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    notFoundMock.mockClear();
  });

  it('404s a malformed bundleId without hitting the backend', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(renderPage('x')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('404s a well-formed bundleId the backend does not know', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));

    await expect(renderPage(VALID_ID)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('renders the expired state (not a 404, not a crash) on backend 410', async () => {
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
    // Retry must be a plain anchor — a <button onClick> here is an RSC
    // render crash (the original production 500).
    expect(html).toContain(`href="/apply/${VALID_ID}"`);
    expect(html).not.toContain('<button');
  });

  it('renders the bundle view for a resolvable bundle', async () => {
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

describe('/apply/[bundleId] — not-found boundary', () => {
  it('renders contextual copy with a recovery path and no bundle data', () => {
    const html = renderToStaticMarkup(<ApplyBundleNotFound />);
    expect(html).toContain('Link not found');
    expect(html).toContain('This link is invalid or has been revoked.');
    expect(html).toContain('href="/passport"');
  });
});
