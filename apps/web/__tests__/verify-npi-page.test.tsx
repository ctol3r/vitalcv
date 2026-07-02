/**
 * /verify/[npi] — invalid-id 404 gate (Wave 2F route-contract hardening,
 * public-route unvalidated-id audit).
 *
 * Mirrors apply-bundle-page.test.tsx: malformed public ids call notFound()
 * (→ 404) and never reach the backend. NPIs are 10-digit strings; anything
 * else cannot resolve. A well-formed NPI the backend does not know keeps its
 * existing in-page "NPI not found" state (recognition-share-verify.test.tsx
 * pins the resolvable-NPI states).
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

import VerifierPage from '../app/verify/[npi]/page';

function renderPage(npi: string) {
  return VerifierPage({ params: Promise.resolve({ npi }) });
}

describe('/verify/[npi] — invalid-id path', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    notFoundMock.mockClear();
  });

  it('404s a malformed NPI without hitting the backend', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    for (const bad of ['x', 'not-a-npi', '123', '12345678901', '../../etc/passwd']) {
      await expect(renderPage(bad)).rejects.toThrow('NEXT_NOT_FOUND');
    }
    expect(notFoundMock).toHaveBeenCalledTimes(5);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the in-page not-found state for a well-formed NPI the backend does not know', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 404 })),
    );

    const html = renderToStaticMarkup(
      (await renderPage('1234567890')) as React.ReactElement,
    );
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(html).toContain('NPI not found');
    expect(html).toContain('1234567890');
  });
});
