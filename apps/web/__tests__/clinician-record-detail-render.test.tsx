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

const RETRIEVED_AT = '2026-07-26T12:00:00.000Z';
const NOW = new Date('2026-07-26T12:00:00.000Z');

/** Build the record straight from the captured CMS payload. */
function buildFromPayload(overrides: Record<string, unknown> = {}) {
  const reading = mapNppesResult(CMS_PAYLOAD as unknown as Record<string, unknown>);
  return buildClinicianRecord(
    { ...reading, ...overrides } as typeof reading,
    { retrievedAt: RETRIEVED_AT, now: NOW },
  );
}

function render(mode: 'public' | 'owner' = 'public'): string {
  return renderToStaticMarkup(
    <ClinicianRecordDetail record={buildFromPayload()} mode={mode} />,
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

  it('states that a decision-relevant field was not reported', () => {
    // This record files no licence number or state. A blank cell reads as
    // "nothing to report"; the explicit phrasing does not. A reviewer acts on
    // this, so it must never be silently omitted.
    expect(html).toContain('Not reported to CMS');
    expect(html).toContain('Licence number as filed');
  });

  it('omits optional name parts instead of announcing their absence', () => {
    // A missing middle name says nothing about a provider. Announcing it four
    // times turns the honest-absence signal into noise, which is how the
    // signal stops being read at all.
    expect(html).not.toContain('Middle name');
    expect(html).not.toContain('Name prefix');
    expect(html).not.toContain('Name suffix');
  });

  it('still shows an optional name part when it is present', () => {
    const withMiddle = renderToStaticMarkup(
      <ClinicianRecordDetail
        record={buildFromPayload({ middle_name: 'RENEE' })}
      />,
    );
    expect(withMiddle).toContain('Middle name');
    expect(withMiddle).toContain('RENEE');
  });
});

describe('provenance strip placement', () => {
  it('hoists to one banner while every section shares a provenance', () => {
    const html = render();
    // All of this record is one NPPES read, so the strip must not repeat
    // verbatim above each section — a badge shown five identical times stops
    // being read, and this is the one badge that must not become wallpaper.
    const occurrences = html.split('Self-reported to CMS').length - 1;
    expect(occurrences).toBe(1);
    expect(html).toContain('Every field below comes from this one reading');
  });

  it('falls back to per-section strips once a section disagrees', () => {
    // Simulate what happens when a federal connector attaches a section with
    // different freshness: the differences become the informative thing, so
    // the labels move back down to the sections.
    const record = buildFromPayload();
    const diverged = {
      ...record,
      taxonomies: {
        ...record.taxonomies,
        freshness: { ...record.taxonomies.freshness, status: 'current' as const },
      },
    };
    const html = renderToStaticMarkup(<ClinicianRecordDetail record={diverged} />);
    expect(html).not.toContain('Every field below comes from this one reading');
    expect(html.split('Self-reported to CMS').length - 1).toBeGreaterThan(1);
  });
});

describe('owner mode', () => {
  it('tells the clinician that employers see the same gaps', () => {
    const html = render('owner');
    expect(html).toMatch(/Employers reviewing your profile will see these gaps/);
  });
});

describe('repeated taxonomy codes', () => {
  /**
   * A physician licensed in several states files one taxonomy row per
   * licence. NPI 1003000126 files Internal Medicine three times (MD, MD, VA).
   */
  const multiLicence = buildFromPayload({
    taxonomies: [
      { code: '208M00000X', taxonomy_group: '', desc: 'Hospitalist', state: 'DC', license: 'MD600003480', primary: true },
      { code: '207R00000X', taxonomy_group: '', desc: 'Internal Medicine', state: 'MD', license: 'D0000290', primary: false },
      { code: '207R00000X', taxonomy_group: '', desc: 'Internal Medicine', state: 'VA', license: '0101254037', primary: false },
    ],
  });
  const html = renderToStaticMarkup(<ClinicianRecordDetail record={multiLicence} />);

  it('shows every licence row, since that is what differs between them', () => {
    expect(html).toContain('D0000290');
    expect(html).toContain('0101254037');
    expect(html).toContain('MD600003480');
  });

  it('prints a repeated code’s definition once, not once per licence', () => {
    const definitionOpening = 'A physician who provides long-term, comprehensive care';
    expect(html.split(definitionOpening).length - 1).toBe(1);
  });
});
