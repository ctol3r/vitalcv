/**
 * directory-claim-entry.test.tsx — the way in from a search result.
 *
 * /directory/[npi] renders for any NPI in the federal registry, which is ~5.5M
 * clinicians who have never heard of VitalCV. Until this entry existed, a
 * clinician who searched for themselves, found their own record, and wanted it
 * had nowhere to go: every path into the product started at the homepage.
 *
 * The share card matters for the same reason. Every provider page inherited one
 * site-wide OpenGraph title from app/layout.tsx, so a million distinct records
 * previewed identically anywhere a link was unfurled.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { NppesReading } from '@/lib/clinician-record/build';

const RETRIEVED_AT = '2026-08-10T12:00:00.000Z';
const NPI = '1558395516'; // sanctioned synthetic: check-digit-invalid, absent from NPPES
const ORG_NPI = '1558395511';

vi.mock('@/lib/clinician-record/nppes', () => ({
  fetchNppesRecord: vi.fn(),
}));
vi.mock('@/lib/clinician-record/cmsClinicians', async (importOriginal) => ({
  // Spread the real module: build.ts imports CMS_CLINICIANS_SOURCE from here
  // too, and a factory that returns only the fetch leaves that undefined —
  // which surfaces as a crash inside attachMedicareEnrollment, nowhere near
  // the mock.
  ...(await importOriginal<typeof import('@/lib/clinician-record/cmsClinicians')>()),
  // 'unavailable' is the honest default: this test is about the claim entry
  // and the share card, not about Medicare enrolment.
  // Literal, not RETRIEVED_AT: vi.mock factories hoist above the consts.
  fetchCmsClinicianRows: vi.fn(async () => ({
    state: 'unavailable' as const,
    rows: [],
    retrievedAt: '2026-08-10T12:00:00.000Z',
  })),
}));

import { fetchNppesRecord } from '@/lib/clinician-record/nppes';
import DirectoryPage, { generateMetadata } from '@/app/directory/[npi]/page';

function address(over: Record<string, unknown> = {}) {
  return {
    purpose: 'LOCATION',
    address_type: 'DOM',
    address_1: '1 EXAMPLE WAY',
    address_2: '',
    city: 'AUSTIN',
    state: 'TX',
    postal_code: '78701',
    country_code: 'US',
    country_name: 'United States',
    telephone_number: '',
    fax_number: '',
    ...over,
  };
}

function reading(over: Partial<NppesReading> = {}): NppesReading {
  return {
    npi: NPI,
    enumeration_type: 'NPI-1',
    status: 'A',
    first_name: 'EXAMPLE',
    last_name: 'CLINICIAN',
    middle_name: '',
    credential: 'PA-C',
    name_prefix: '',
    name_suffix: '',
    organization_name: '',
    display_name: 'EXAMPLE CLINICIAN, PA-C',
    sex: 'F',
    sole_proprietor: 'NO',
    primary_taxonomy: 'Physician Assistant',
    primary_taxonomy_code: '363A00000X',
    taxonomies: [
      {
        code: '363A00000X',
        taxonomy_group: '',
        desc: 'Physician Assistant',
        state: '',
        license: '',
        primary: true,
      },
    ],
    practice_address: address(),
    mailing_address: address({ purpose: 'MAILING' }),
    addresses: [address()],
    practice_locations: [],
    identifiers: [],
    other_names: [],
    endpoints: [],
    enumeration_date: '2020-01-01',
    last_updated: '2026-01-01',
    certification_date: '2020-01-01',
    ...over,
  } as NppesReading;
}

const mocked = vi.mocked(fetchNppesRecord);

function resolves(over: Partial<NppesReading> = {}) {
  mocked.mockResolvedValue({ reading: reading(over), retrievedAt: RETRIEVED_AT } as never);
}

async function render(npi = NPI) {
  return renderToStaticMarkup(await DirectoryPage({ params: Promise.resolve({ npi }) }));
}

beforeEach(() => {
  mocked.mockReset();
});

describe('claim entry', () => {
  it('offers the clinician a way in from their own record', async () => {
    resolves();
    const html = await render();

    expect(html).toContain('directory-claim-cta');
    expect(html).toContain(`/onboarding?npi=${NPI}`);
  });

  it('does not claim the record is verified by claiming it', async () => {
    // The whole risk of putting a CTA on a registry page is that "claim this"
    // reads as "this is confirmed". The copy has to say what claiming does not
    // do, on the page, not in a tooltip.
    resolves();
    const html = await render();

    expect(html).toMatch(/confirms nothing about your credentials/i);
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });

  it('does not invite an organization NPI to claim a career', async () => {
    // Type-2 NPIs are practices and facilities. There is no person to claim
    // one, and offering it is how an org NPI ends up with a clinician profile.
    resolves({
      npi: ORG_NPI,
      enumeration_type: 'NPI-2',
      first_name: '',
      last_name: '',
      credential: '',
      organization_name: 'EXAMPLE CLINIC INC',
      display_name: 'EXAMPLE CLINIC INC',
      primary_taxonomy: 'Clinic/Center',
      primary_taxonomy_code: '261Q00000X',
      taxonomies: [
        { code: '261Q00000X', taxonomy_group: '', desc: 'Clinic/Center', state: '', license: '', primary: true },
      ],
    });

    const html = await render(ORG_NPI);

    expect(html).not.toContain('directory-claim-cta');
  });
});

describe('share card', () => {
  it('names the record rather than inheriting the site-wide card', async () => {
    resolves();

    const meta = await generateMetadata({ params: Promise.resolve({ npi: NPI }) });

    expect(meta.openGraph?.title).toContain('EXAMPLE CLINICIAN');
    expect(meta.openGraph?.title).toContain(NPI);
    expect(String(meta.openGraph?.description)).toMatch(/registry record/i);
    // The card must not be the site-wide one it used to inherit.
    expect(String(meta.openGraph?.title)).not.toContain('ready before your next job');
  });

  it('carries no share card at all when the record is unreadable', async () => {
    // An unreadable record is noindex. A share card for it would be a preview
    // of a page that says nothing.
    mocked.mockResolvedValue(null as never);

    const meta = await generateMetadata({ params: Promise.resolve({ npi: NPI }) });

    expect(meta.robots).toMatchObject({ index: false, follow: false });
    expect(meta.openGraph).toBeUndefined();
  });
});
