/**
 * clinician-record-detail-render.test.tsx
 *
 * Renders the full record component from a VERBATIM CMS NPPES payload and
 * asserts the output actually contains the provider detail. The point of this
 * wave was completeness, and completeness is only demonstrable at the render
 * layer — a builder can produce a perfect record that the component then
 * silently drops half of.
 *
 * The payload below is the exact CMS response for NPI 1346053246, captured
 * 2026-07-26. That NPI is the reference record used to scope this work.
 *
 * Server component rendered via renderToStaticMarkup, per the pattern in
 * issuer-receipt-candidate.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClinicianRecordDetail } from '@/components/clinician-record/ClinicianRecordDetail';
import { buildClinicianRecord } from '@/lib/clinician-record/build';
import { mapNppesResult } from '@/lib/clinician-record/nppes';

/** Verbatim CMS NPPES v2.1 result for NPI 1346053246. */
const CMS_PAYLOAD = {
  addresses: [
    {
      address_1: '9401 JERONIMO RD',
      address_purpose: 'LOCATION',
      address_type: 'DOM',
      city: 'IRVINE',
      country_code: 'US',
      country_name: 'United States',
      postal_code: '926181908',
      state: 'CA',
      telephone_number: '714-997-6815',
    },
    {
      address_1: '9401 JERONIMO RD',
      address_purpose: 'MAILING',
      address_type: 'DOM',
      city: 'IRVINE',
      country_code: 'US',
      country_name: 'United States',
      postal_code: '926181908',
      state: 'CA',
      telephone_number: '714-997-6815',
    },
  ],
  basic: {
    certification_date: '2025-01-27',
    credential: 'PA-C',
    enumeration_date: '2025-01-27',
    first_name: 'MACIE',
    last_name: 'MILLER',
    last_updated: '2025-01-27',
    sex: 'F',
    sole_proprietor: 'NO',
    status: 'A',
  },
  created_epoch: '1738008306000',
  endpoints: [],
  enumeration_type: 'NPI-1',
  identifiers: [],
  last_updated_epoch: '1738008306000',
  number: '1346053246',
  other_names: [],
  practiceLocations: [],
  taxonomies: [
    {
      code: '363A00000X',
      desc: 'Physician Assistant',
      license: null,
      primary: true,
      state: null,
      taxonomy_group: '',
    },
  ],
};

function render(mode: 'public' | 'owner' = 'public'): string {
  const reading = mapNppesResult(CMS_PAYLOAD as unknown as Record<string, unknown>);
  const record = buildClinicianRecord(reading, {
    retrievedAt: '2026-07-26T12:00:00.000Z',
    now: new Date('2026-07-26T12:00:00.000Z'),
  });
  return renderToStaticMarkup(
    <ClinicianRecordDetail record={record} mode={mode} />,
  );
}

describe('parity with what a public registry mirror shows', () => {
  const html = render();

  // Each assertion below corresponds to a field the reference npidb.org page
  // displays for this same NPI. If any regress, the record has become less
  // complete than a plain registry mirror.

  it('shows the name and credential', () => {
    expect(html).toContain('MACIE MILLER, PA-C');
  });

  it('expands the credential', () => {
    expect(html).toContain('Physician Assistant-Certified');
  });

  it('shows the practice address with a formatted ZIP+4', () => {
    expect(html).toContain('9401 JERONIMO RD');
    expect(html).toContain('IRVINE');
    expect(html).toContain('92618-1908');
  });

  it('shows the telephone number', () => {
    expect(html).toContain('714-997-6815');
  });

  it('shows the taxonomy code and description', () => {
    expect(html).toContain('363A00000X');
    expect(html).toContain('Physician Assistant');
  });

  it('shows the CMS Medicare specialty code', () => {
    // npidb renders this as "Specialty Code 97".
    expect(html).toContain('97 — Physician Assistant');
  });

  it('shows entity type, enumeration date and last-updated date', () => {
    expect(html).toContain('Individual (Type 1)');
    expect(html).toContain('2025-01-27');
  });

  it('shows sole proprietor and the CMS sex field', () => {
    expect(html).toContain('Sole proprietor');
    expect(html).toContain('Female');
  });

  it('shows the NPPES status without using the bare word Verified', () => {
    expect(html).toContain('Active in NPPES');
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });
});

describe('beyond what a registry mirror shows', () => {
  const html = render();

  it('places the specialty in the NUCC hierarchy', () => {
    expect(html).toContain(
      'Physician Assistants &amp; Advanced Practice Nursing Providers',
    );
  });

  it('includes the formal NUCC definition of the taxonomy', () => {
    expect(html).toContain('accredited education program');
  });

  it('states how old the reading is in reader-facing terms', () => {
    expect(html).toMatch(/over 1 year ago/);
  });
});

describe('honesty guardrails in the rendered output', () => {
  const html = render();

  it('labels registry data as self-reported at the point of display', () => {
    expect(html).toContain('Self-reported to CMS');
  });

  it('states that CMS does not check the credential', () => {
    expect(html).toMatch(/not checked against a certifying board/i);
  });

  it('renders the not-covered section rather than hiding gaps', () => {
    expect(html).toContain('Not covered by this record');
    expect(html).toContain('Licence status');
    expect(html).toContain('Exclusion and sanction screening');
  });

  it('says a Medicare specialty code is not evidence of enrollment', () => {
    expect(html).toMatch(/[Nn]ot evidence of Medicare enrollment/);
  });

  it('flags a reading older than the refresh window rather than showing it as fresh', () => {
    expect(html).toContain('Older than refresh window');
    expect(html).not.toContain('Within refresh window');
  });

  it('cites its sources with their limitations', () => {
    expect(html).toContain('CMS NPI Registry (NPPES)');
    expect(html).toMatch(/does not check these details against a licensing board/i);
  });

  it('contains none of the banned truth-contract phrases', () => {
    const banned = [
      'automatically verified',
      'guaranteed verification',
      'complete credentialing',
      'instant credentialing',
      'legally accepted',
      'risk transferred',
      'final verification without review',
      'source confirmed before response',
      'certified compliant',
      'HIPAA compliant',
      'SOC2 certified',
    ];
    const lower = html.toLowerCase();
    for (const phrase of banned) {
      expect(lower).not.toContain(phrase.toLowerCase());
    }
  });
});

describe('absent values', () => {
  const html = render();

  it('states that an unreported field was not reported, rather than leaving a blank', () => {
    // This record has no middle name, prefix or suffix. A blank cell reads as
    // "nothing to report"; the explicit phrasing does not.
    expect(html).toContain('Not reported to CMS');
  });
});

describe('owner mode', () => {
  it('tells the clinician that employers see the same gaps', () => {
    const html = render('owner');
    expect(html).toMatch(/Employers reviewing your profile will see these gaps/);
  });
});
