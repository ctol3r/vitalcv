/**
 * /verify/[npi] with no VitalCV passport — "not found" must name the RIGHT absence.
 *
 * Measured in production 2026-08-10. Two of the five enrolled pilot NPIs —
 * 1952388852 and 1417246141 — rendered "NPI not found / No verification data
 * available", while:
 *   - the federal NPPES registry returned `result_count: 1` for both, and
 *   - this page had already fetched that NPPES record in its own Promise.all
 *     and was discarding it, and
 *   - /api/entities/clinician/<npi>/relationships resolved identity `checked`
 *     for both on the same deploy.
 *
 * The NPI was found. The VitalCV profile was not. A reviewer reading "NPI not
 * found" would reasonably conclude the number was wrong or the clinician not
 * real — a false statement about a real person, on the public proof surface.
 *
 * These assert the RENDERED surface, not the mechanism. They also pin the
 * disclosure boundary: this branch must NOT publish the clinician's identity,
 * because whether VitalCV shows the public record for someone who never
 * enrolled is a consent decision, not a rendering detail.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

const fetchNppesRecord = vi.fn();
const fetchCmsClinicianRows = vi.fn();

vi.mock('@/lib/clinician-record/nppes', () => ({
  fetchNppesRecord: (npi: string) => fetchNppesRecord(npi),
}));
vi.mock('@/lib/clinician-record/cmsClinicians', () => ({
  fetchCmsClinicianRows: (npi: string) => fetchCmsClinicianRows(npi),
}));

import VerifierPage, { generateMetadata } from '../app/verify/[npi]/page';

/** A real NPPES shape, carrying the identity this branch must not publish. */
const NPPES_RECORD = {
  npi: '1952388852',
  basic: { first_name: 'REALFIRST', last_name: 'REALLAST', credential: 'M.D.' },
  addresses: [{ address_1: '100 REAL ST', city: 'BETHESDA', state: 'MD' }],
};

/** No passport: the backend 404s, which fetchPassport turns into null. */
function stubNoPassport() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 404 })),
  );
}

async function render(npi: string): Promise<string> {
  const ui = await VerifierPage({ params: Promise.resolve({ npi }) });
  return renderToStaticMarkup(ui as React.ReactElement);
}

describe('/verify/[npi] with no VitalCV profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubNoPassport();
    fetchCmsClinicianRows.mockResolvedValue(null);
  });

  it('never claims the NPI was not found when NPPES knows it', async () => {
    fetchNppesRecord.mockResolvedValue(NPPES_RECORD);
    const html = await render('1952388852');

    // The exact false sentence this page shipped.
    expect(html).not.toContain('NPI not found');
    expect(html).not.toContain('No verification data available');
  });

  it('names the real absence — the VitalCV profile', async () => {
    fetchNppesRecord.mockResolvedValue(NPPES_RECORD);
    const html = await render('1952388852');

    expect(html).toContain('No VitalCV profile');
    expect(html).toContain('1952388852');
    // States plainly that this is a fact about VitalCV, not the clinician.
    expect(html).toMatch(/not about the clinician/i);
  });

  it('does NOT publish the clinician identity NPPES returned', async () => {
    fetchNppesRecord.mockResolvedValue(NPPES_RECORD);
    const html = await render('1952388852');

    // The consent boundary. NPPES answered with a name and address; this
    // branch may say the registry knows the NPI, and nothing more.
    expect(html).not.toContain('REALFIRST');
    expect(html).not.toContain('REALLAST');
    expect(html).not.toContain('100 REAL ST');
    expect(html).not.toContain('BETHESDA');
  });

  it('distinguishes an NPI NPPES does not know', async () => {
    fetchNppesRecord.mockResolvedValue(null);
    const html = await render('1234567893');

    expect(html).not.toContain('NPI not found');
    expect(html).toContain('No VitalCV profile');
    // The other finding: the registry itself returned nothing.
    expect(html).toMatch(/did not return a record/i);
    // And it must not assert NPPES registration it never got.
    expect(html).not.toMatch(/is registered in the federal NPPES registry/i);
  });

  it('is not indexable — the page names a real clinician', async () => {
    // This page renders legal name, practice address, licence number as filed,
    // and CMS administrative fields. Each fact is public at its own source, but
    // a crawlable VitalCV page per NPI is a different artifact from a reviewer's
    // lookup. It defaulted to `index, follow`, and is reachable for any NPI with
    // a passport row — including QA fixtures seeded on real physicians' NPIs.
    const meta = await generateMetadata({ params: Promise.resolve({ npi: '1003000126' }) });
    expect(meta.robots).toMatchObject({ index: false, follow: false });
  });

  it('keeps the two findings mutually exclusive', async () => {
    fetchNppesRecord.mockResolvedValue(NPPES_RECORD);
    const known = await render('1952388852');
    fetchNppesRecord.mockResolvedValue(null);
    const unknown = await render('1234567893');

    expect(known).toMatch(/is registered in the federal NPPES registry/i);
    expect(known).not.toMatch(/did not return a record/i);
    expect(unknown).not.toMatch(/is registered in the federal NPPES registry/i);
  });
});
