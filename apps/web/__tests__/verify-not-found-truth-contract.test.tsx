/**
 * /verify/[npi] — a source that found NOTHING must never read as source-backed.
 *
 * Verified in production 2026-07-27 at b99127e3: https://vitalcv.com/verify/1234567893
 * rendered "NPPES Identity … SOURCE-BACKED" and "PECOS Enrollment … SOURCE-BACKED"
 * for an NPI that does not exist — npiregistry.cms.hhs.gov returns result_count 0
 * and VitalCV's own trust-state reported identityVerified:false / NOT_FOUND.
 *
 * Two independent faults produced it, and both are pinned here:
 *   1. The backend set the lane from "an artifact row exists", not "the source
 *      affirmed the subject", so a stored NOT_FOUND answer became state 'checked'
 *      → 'verified' → the Source-backed tier.
 *   2. This page dropped the per-check `reason`, so the one honest sentence the
 *      backend already wrote ("NPPES checked but did not return an active
 *      identity record") never reached the employer.
 *
 * These assert the RENDERED surface, not the mechanism — a different fix that
 * keeps the surface honest should keep these green.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

import VerifierPage from '../app/verify/[npi]/page';

/** The shape the backend serves for an NPI no source affirms. */
const NOT_FOUND_CHECKS = [
  {
    sourceId: 'NPPES_API',
    state: 'notFound',
    checkedAt: '2026-07-27T14:46:16Z',
    reason: 'NPPES checked but did not return an active identity record',
    sourceUrl: 'https://npiregistry.cms.hhs.gov/api/?number=1234567893&version=2.1',
  },
  { sourceId: 'OIG_LEIE', state: 'pending', reason: 'OIG LEIE source not yet checked' },
  { sourceId: 'STATE_BOARD', state: 'pending', reason: 'Licensure source not yet checked' },
  {
    sourceId: 'PECOS_PUBLIC',
    state: 'notFound',
    checkedAt: '2026-07-27T04:28:58Z',
    reason: 'PECOS quarterly release does not show Medicare enrollment for this NPI',
  },
];

function stubPassport(checks: unknown[], extra: Record<string, unknown> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/passport/npi/')) {
        return new Response(
          JSON.stringify({
            identity: { displayName: 'Clinician 1234567893' },
            lastCheckedAt: '2026-07-27T14:46:16Z',
            sourceCoverage: { checks },
            ...extra,
          }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 404 });
    }),
  );
}

function render(npi = '1234567893') {
  return VerifierPage({ params: Promise.resolve({ npi }) }) as Promise<React.ReactElement>;
}

describe('/verify/[npi] — not-found lanes never render as source-confirmed', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders no source-backed tier anywhere when every checked source found nothing', async () => {
    stubPassport(NOT_FOUND_CHECKS);
    const html = renderToStaticMarkup(await render());

    // The exact production symptom.
    expect(html).not.toContain('Source-backed');
    expect(html).not.toContain('SOURCE-BACKED');
    // ...and the tier that replaced it.
    expect(html).toContain('No active record');
  });

  it('never tags a not-found lane with the verified status', async () => {
    stubPassport(NOT_FOUND_CHECKS);
    const html = renderToStaticMarkup(await render());

    expect(html).toContain('data-lane-status="not_found"');
    expect(html).not.toContain('data-lane-status="verified"');
  });

  it("shows the source's own sentence so the reviewer can tell why a lane failed", async () => {
    stubPassport(NOT_FOUND_CHECKS);
    const html = renderToStaticMarkup(await render());

    expect(html).toContain('NPPES checked but did not return an active identity record');
    expect(html).toContain('PECOS quarterly release does not show Medicare enrollment for this NPI');
  });

  it('counts zero confirmations and says how many lanes came back empty', async () => {
    stubPassport(NOT_FOUND_CHECKS);
    const html = renderToStaticMarkup(await render());

    // Production read "2 of 4 lanes checked" with a green pass for an NPI that
    // does not exist.
    expect(html).not.toContain('2 of 4 lanes');
    expect(html).toContain('0 of 4 lanes confirmed');
    expect(html).toContain('2 found no active record');
  });

  it('keeps a not-found lane out of the replay chronology as a T3 event', async () => {
    stubPassport(NOT_FOUND_CHECKS);
    const html = renderToStaticMarkup(await render());

    // The read happened, so the event belongs in the timeline — but as its own
    // outcome, never at the source-backed tier.
    expect(html).not.toContain('T3 ·');
    expect(html).toContain('NO ACTIVE RECORD');
  });

  it('distinguishes PECOS not-enrolled from PECOS enrolled on the rendered surface', async () => {
    const pecosLane = (state: string, reason: string) => [
      { sourceId: 'PECOS_PUBLIC', state, checkedAt: '2026-07-27T04:28:58Z', reason },
    ];

    stubPassport(pecosLane('notFound', 'PECOS quarterly release does not show Medicare enrollment for this NPI'));
    const notEnrolled = renderToStaticMarkup(await render());

    vi.unstubAllGlobals();
    stubPassport(pecosLane('checked', 'PECOS quarterly enrollment checked'));
    const enrolled = renderToStaticMarkup(await render());

    // Same lane, same timestamp — the two outcomes must not render alike.
    expect(notEnrolled).not.toEqual(enrolled);
    expect(enrolled).toContain('Source-backed');
    expect(notEnrolled).not.toContain('Source-backed');
    expect(notEnrolled).toContain('does not show Medicare enrollment');
  });

  it('still renders source-backed when the sources DO affirm the provider', async () => {
    // Guards the other direction: 1003000126 is a real NPI (identityVerified
    // true, pecosStatus ENROLLED) and must be unaffected by this fix.
    stubPassport([
      {
        sourceId: 'NPPES_API',
        state: 'checked',
        checkedAt: '2026-07-27T14:46:16Z',
        reason: 'NPPES identity checked',
        proof: { receiptIds: ['rcpt-1'] },
      },
      {
        sourceId: 'PECOS_PUBLIC',
        state: 'checked',
        checkedAt: '2026-07-27T04:28:58Z',
        reason: 'PECOS quarterly enrollment checked',
      },
    ]);
    const html = renderToStaticMarkup(await render('1003000126'));

    expect(html).toContain('Source-backed');
    expect(html).toContain('2 of 2 lanes confirmed');
    expect(html).not.toContain('No active record');
  });
});
