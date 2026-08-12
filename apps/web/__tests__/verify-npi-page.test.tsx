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

  it('renders the employer review doorway on a resolvable NPI (share→accept seam)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/passport/npi/')) {
          return new Response(JSON.stringify({ identity: { displayName: 'Test Clinician' } }), { status: 200 });
        }
        return new Response('{}', { status: 404 });
      }),
    );

    const html = renderToStaticMarkup(
      (await renderPage('1234567890')) as React.ReactElement,
    );
    expect(html).toContain('data-testid="employer-review-cta"');
    expect(html).toContain('/review/1234567890');
    expect(html).toContain('Reviewing this clinician for a role?');
    expect(html).toContain('Requires a signed-in employer account');
    // the doorway never overclaims: decisions are recorded, not auto-approved
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });

  it('renders the two-half verdict with revocation as a visible step, and honest NPPES labelling', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/passport/npi/')) {
          return new Response(
            JSON.stringify({
              identity: { displayName: 'Test Clinician' },
              lastCheckedAt: '2026-07-14T09:12:00Z',
              sourceCoverage: {
                checks: [
                  {
                    sourceId: 'NPPES_API',
                    state: 'checked',
                    checkedAt: '2026-07-14T09:12:00Z',
                    reason: 'registry match',
                    proof: { receiptIds: ['rcpt-1'] },
                  },
                  { sourceId: 'STATE_BOARD', state: 'gated', reason: 'access required' },
                ],
              },
              practiceLocation: {
                addressLine: '100 Main St',
                city: 'Austin',
                state: 'TX',
                postalCode: '78701',
              },
            }),
            { status: 200 },
          );
        }
        return new Response('{}', { status: 404 });
      }),
    );

    const html = renderToStaticMarkup(
      (await renderPage('1234567890')) as React.ReactElement,
    );

    // The verdict is split — never one green banner.
    expect(html).toContain('Integrity');
    expect(html).toContain('Issuer legitimacy');
    // Renamed from 'Source checks recorded': "checks recorded" counts queries
    // we ran, but a reviewer reads it as sources that vouched for the provider.
    // The row counts confirmations only — do not restore the older wording.
    expect(html).toContain('Sources confirming this provider');
    expect(html).toContain('Issuer record published');
    // Revocation is a VISIBLE step even though this snapshot cannot check it.
    expect(html).toContain('Revocation');
    expect(html).toContain('Not checked');
    // NPPES practice address is self-reported to the registry — never a green
    // source-backed claim (beat-TopNPI honesty rule). (ProvenanceStrip's
    // per-lane "Source-backed" labels are legitimate and out of scope here.)
    expect(html).toContain('Self-reported to NPPES');
    // Truth contract holds.
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });

  it('renders a REAL clean revocation check ("None found") when the backend attaches the summary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/passport/npi/')) {
          return new Response(
            JSON.stringify({
              identity: { displayName: 'Test Clinician' },
              lastCheckedAt: '2026-07-19T12:00:00Z',
              revocation: { checked: true, revokedCount: 0, checkedAt: '2026-07-19T12:00:00Z' },
            }),
            { status: 200 },
          );
        }
        return new Response('{}', { status: 404 });
      }),
    );

    const html = renderToStaticMarkup(
      (await renderPage('1234567890')) as React.ReactElement,
    );
    // The step is now a real, dated check against the artifact ledger…
    expect(html).toContain('None found');
    expect(html).toContain('artifact ledger');
    expect(html).not.toContain('Not checked');
    // …and a clean ledger never renders the fail-closed verdict.
    expect(html).not.toContain('data-verdict="revoked"');
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });

  it('fails the verdict CLOSED when the ledger reports revoked artifacts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/passport/npi/')) {
          return new Response(
            JSON.stringify({
              identity: { displayName: 'Test Clinician' },
              lastCheckedAt: '2026-07-19T12:00:00Z',
              revocation: { checked: true, revokedCount: 2, checkedAt: '2026-07-19T12:00:00Z' },
            }),
            { status: 200 },
          );
        }
        return new Response('{}', { status: 404 });
      }),
    );

    const html = renderToStaticMarkup(
      (await renderPage('1234567890')) as React.ReactElement,
    );
    // Revoked artifacts are loud: the whole verdict fails closed, with the
    // canonical revoked register — never a silent omission, never "Unavailable".
    expect(html).toContain('data-verdict="revoked"');
    expect(html).toContain('Revoked — fails closed');
    expect(html).toContain('data-provenance-state="revoked"');
    expect(html).toContain('2 revoked');
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });

  it('keeps the in-page not-found state for a well-formed NPI the backend does not know', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 404 })),
    );

    const html = renderToStaticMarkup(
      (await renderPage('1234567890')) as React.ReactElement,
    );
    // The load-bearing assertion, unchanged: a well-formed NPI the backend does
    // not know renders an IN-PAGE state, never a Next 404.
    expect(notFoundMock).not.toHaveBeenCalled();
    // The headline used to read "NPI not found". That was false for every NPI
    // the federal registry does know — two enrolled pilot NPIs rendered it in
    // production while NPPES returned result_count 1. The absent thing is the
    // VitalCV profile, and the copy now says so. See
    // verify-no-profile-truth.test.tsx for the full contract.
    expect(html).toContain('No VitalCV profile');
    expect(html).not.toContain('NPI not found');
    expect(html).toContain('1234567890');
  });
});
