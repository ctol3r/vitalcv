/**
 * search-surface-contract.test.ts — what VitalCV lets a crawler index.
 *
 * Three separate failures live here, and they share a shape: each one is
 * invisible in the app, green in CI, and only observable to a search engine.
 *
 *   1. /verify/[npi] answered HTTP 200 with a one-sentence "NPI not found"
 *      body for every NPI VitalCV has never touched. Its URL space is every
 *      10-digit number, so that is a thin-page generator pointed at ~5.5M
 *      clinicians, none of whom have a record here.
 *
 *   2. /verify/[npi] and /directory/[npi] render the same record component
 *      for the same clinician. Only /directory declared a canonical, so a
 *      crawler resolving both saw two competing URLs for one person — and the
 *      one with the unbounded URL space was the one without the descriptive
 *      title or the JSON-LD.
 *
 *   3. /p/[slug] published a real, active registrant's name and NPI, fully
 *      indexable, under the root marketing title. Verified against NPPES on
 *      2026-08-10: result_count 1, status A, an individual (NPI-1).
 *
 * These assert the metadata objects the routes actually return, not the text
 * of their source. A source grep for `index: false` passes just as happily
 * when the branch that produces it has become unreachable.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import { generateMetadata as verifyMetadata } from '@/app/verify/[npi]/page';
import PilotProofPage, { metadata as pilotMetadata } from '@/app/p/[slug]/page';

const VALID_NPI = '1558395516'; // sanctioned synthetic: check-digit-invalid, absent from NPPES

/** Minimal shape — the route only branches on truthiness of the parsed body. */
function passportResponse() {
  return {
    ok: true,
    json: async () => ({ npi: VALID_NPI, checks: [] }),
  } as unknown as Response;
}

function notFoundResponse() {
  return { ok: false, json: async () => ({}) } as unknown as Response;
}

describe('/verify/[npi] indexing posture', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('keeps a soft-404 out of the index', async () => {
    fetchSpy.mockResolvedValue(notFoundResponse());

    const meta = await verifyMetadata({ params: Promise.resolve({ npi: VALID_NPI }) });

    expect(meta.robots).toMatchObject({ index: false, follow: false });
  });

  it('does not pair that noindex with a canonical', async () => {
    // A page that says "don't index me" and "index this other URL instead" is
    // sending two different instructions. app/sitemap.ts refuses the same
    // contradiction in the other direction, by declining to list /docs while
    // /docs is noindexed.
    fetchSpy.mockResolvedValue(notFoundResponse());

    const meta = await verifyMetadata({ params: Promise.resolve({ npi: VALID_NPI }) });

    expect(meta.alternates?.canonical).toBeUndefined();
  });

  it('points a real record at the directory page as the canonical URL', async () => {
    fetchSpy.mockResolvedValue(passportResponse());

    const meta = await verifyMetadata({ params: Promise.resolve({ npi: VALID_NPI }) });

    expect(meta.alternates?.canonical).toBe(`/directory/${VALID_NPI}`);
    // Consolidating to /directory is the point; suppressing this page is not.
    expect(meta.robots).toBeUndefined();
  });

  it('refuses to index a malformed NPI without asking the backend', async () => {
    fetchSpy.mockResolvedValue(passportResponse());

    const meta = await verifyMetadata({ params: Promise.resolve({ npi: 'not-an-npi' }) });

    expect(meta.robots).toMatchObject({ index: false, follow: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('/p/[slug] pilot evidence', () => {
  it('is not a search surface', async () => {
    expect(pilotMetadata.robots).toMatchObject({ index: false, follow: false });
  });

  it('publishes no clinician identity', async () => {
    // The pilot's evidentiary claim is the event chain and its timings, which
    // the loop id anchors. The subject's name and number were only ever
    // exposure.
    //
    // This renders the page. The first version of this test stringified the
    // module namespace instead, which serializes exports — a page function and
    // a metadata object — and never touches the pilot record the component
    // closes over. It passed with the real name and NPI put straight back.
    const html = renderToStaticMarkup(
      await PilotProofPage({ params: Promise.resolve({ slug: 'norcal-pa-pilot-1' }) }),
    );

    expect(html).not.toContain('1457128589');
    expect(html.toUpperCase()).not.toContain('MACIE');
    expect(html.toUpperCase()).not.toContain('MILLER');
    // Any bare 10-digit token on this page is NPI-shaped. The loop id's 13-digit
    // suffix is not matched by the word boundaries.
    expect(html).not.toMatch(/\b\d{10}\b/);
  });
});

describe('metadata routes are not shadowed by static files', () => {
  // app/robots.ts gates crawling on canonical production and app/sitemap.ts
  // derives every lastModified from git. A static file in public/ wins over
  // both silently — the route stops executing and nothing fails.
  it.each(['robots.txt', 'sitemap.xml'])('has no public/%s', (file) => {
    expect(existsSync(resolve(process.cwd(), 'public', file))).toBe(false);
  });
});
