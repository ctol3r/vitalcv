/**
 * clinician-record-build.test.ts — the record builder.
 *
 * Fixtures are verbatim CMS NPPES payloads (captured 2026-07-26), normalized
 * the way the identity module normalizes them. Real payloads matter here:
 * the shapes that break this code are the ones CMS actually emits — an
 * organization with no first_name, a provider with four taxonomies across
 * three states, a record with no credential at all.
 */

import { describe, it, expect } from 'vitest';
import { buildClinicianRecord, type NppesReading } from '@/lib/clinician-record/build';

const RETRIEVED_AT = '2026-07-26T12:00:00.000Z';
const NOW = new Date('2026-07-26T12:00:00.000Z');

function emptyAddress(over: Partial<NppesReading['practice_address'] & object> = {}) {
  return {
    purpose: 'LOCATION',
    address_type: 'DOM',
    address_1: '',
    address_2: '',
    city: '',
    state: '',
    postal_code: '',
    country_code: 'US',
    country_name: 'United States',
    telephone_number: '',
    fax_number: '',
    ...over,
  };
}

function baseReading(over: Partial<NppesReading> = {}): NppesReading {
  return {
    npi: '1346053246',
    enumeration_type: 'NPI-1',
    status: 'A',
    first_name: 'MACIE',
    last_name: 'MILLER',
    middle_name: '',
    credential: 'PA-C',
    name_prefix: '',
    name_suffix: '',
    organization_name: '',
    display_name: 'MACIE MILLER, PA-C',
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
    practice_address: emptyAddress({
      address_1: '9401 JERONIMO RD',
      city: 'IRVINE',
      state: 'CA',
      postal_code: '926181908',
      telephone_number: '714-997-6815',
    }),
    mailing_address: emptyAddress({
      purpose: 'MAILING',
      address_1: '9401 JERONIMO RD',
      city: 'IRVINE',
      state: 'CA',
      postal_code: '926181908',
    }),
    addresses: [],
    practice_locations: [],
    identifiers: [],
    endpoints: [],
    other_names: [],
    organizational_subpart: '',
    parent_organization_legal_business_name: '',
    authorized_official: null,
    enumeration_date: '2025-01-27',
    last_updated: '2025-01-27',
    certification_date: '2025-01-27',
    deactivation_date: '',
    deactivation_reason_code: '',
    reactivation_date: '',
    created_epoch: '1738008306000',
    last_updated_epoch: '1738008306000',
    ...over,
  };
}

const build = (over: Partial<NppesReading> = {}) =>
  buildClinicianRecord(baseReading(over), { retrievedAt: RETRIEVED_AT, now: NOW });

describe('identity', () => {
  it('decodes the credential without asserting the provider holds it', () => {
    const r = build();
    expect(r.identity.data.credential.raw).toBe('PA-C');
    expect(r.identity.data.credential.tokens[0].expansion).toBe(
      'Physician Assistant-Certified',
    );
    // The confirmation level is what stops this reading as a certification.
    expect(r.identity.provenance.confirmation).toBe('registry_self_report');
  });

  it('decodes the CMS sex code and keeps the raw code alongside it', () => {
    const r = build();
    expect(r.identity.data.sexCode).toBe('F');
    expect(r.identity.data.sexLabel).toBe('Female');
  });

  it('leaves an unreported credential empty rather than inventing one', () => {
    const r = build({ credential: '', display_name: 'MACIE MILLER' });
    expect(r.identity.data.credential.tokens).toEqual([]);
  });
});

describe('status', () => {
  it('never labels an active NPI with the bare word Verified', () => {
    const r = build();
    expect(r.status.data.label).toBe('Active in NPPES');
    expect(r.status.data.label).not.toBe('Verified');
    expect(r.status.data.isActive).toBe(true);
  });

  it('surfaces deactivation detail when CMS reports it', () => {
    const r = build({ status: 'D', deactivation_date: '2025-06-01' });
    expect(r.status.data.isActive).toBe(false);
    expect(r.status.data.label).toBe('Deactivated in NPPES');
    expect(r.status.data.deactivationDate).toBe('2025-06-01');
  });

  it('does not silently swallow an unrecognised status code', () => {
    const r = build({ status: 'Z' });
    expect(r.status.data.label).toContain('Unrecognised');
    expect(r.status.data.isActive).toBe(false);
  });
});

describe('addresses', () => {
  it('renders a 9-digit CMS postal code as ZIP+4', () => {
    const r = build();
    expect(r.practiceAddress.data?.postalCode).toBe('926181908');
    expect(r.practiceAddress.data?.postalCodeFormatted).toBe('92618-1908');
  });

  it('passes through a postal code that is not 9 digits', () => {
    const r = build({
      practice_address: emptyAddress({ postal_code: '92618' }),
    });
    expect(r.practiceAddress.data?.postalCodeFormatted).toBe('92618');
  });

  it('captures secondary practice sites that addresses[] does not carry', () => {
    // NPI 1003000126 really has three of these. A mirror reading only
    // addresses[] reports one location for a provider who works at four.
    const r = build({
      practice_locations: [
        emptyAddress({ address_1: 'SITE TWO', city: 'ROCKVILLE', state: 'MD' }),
        emptyAddress({ address_1: 'SITE THREE', city: 'ARLINGTON', state: 'VA' }),
      ],
    });
    expect(r.secondaryLocations.data).toHaveLength(2);
    expect(r.secondaryLocations.data[0].purpose).toBe('SECONDARY');
    expect(r.secondaryLocations.data[1].city).toBe('ARLINGTON');
  });
});

describe('taxonomies and licences', () => {
  const multiState = {
    taxonomies: [
      { code: '207R00000X', taxonomy_group: '', desc: 'Internal Medicine', state: 'MD', license: 'D0000290', primary: false },
      { code: '207R00000X', taxonomy_group: '', desc: 'Internal Medicine', state: 'VA', license: '0101254037', primary: false },
      { code: '208M00000X', taxonomy_group: '', desc: 'Hospitalist', state: 'DC', license: 'MD600003480', primary: true },
    ],
  };

  it('resolves the Medicare specialty code for the primary taxonomy', () => {
    const r = build();
    expect(r.taxonomies.data[0].medicareSpecialties).toEqual([
      { specialtyCode: '97', description: 'Physician Assistant' },
    ]);
  });

  it('puts the primary taxonomy first even when NPPES does not', () => {
    const r = build(multiState);
    expect(r.taxonomies.data[0].primary).toBe(true);
    expect(r.taxonomies.data[0].code).toBe('208M00000X');
  });

  it('reports self-reported licence states as self-reported', () => {
    const r = build(multiState);
    expect(r.selfReportedLicenseStates.data).toEqual(['DC', 'MD', 'VA']);
    // The name of the field and its confirmation level both have to say
    // "self-reported" — this is a licence NUMBER, not a licence CHECK.
    expect(r.selfReportedLicenseStates.provenance.confirmation).toBe(
      'registry_self_report',
    );
  });
});

describe('organizations', () => {
  const org: Partial<NppesReading> = {
    enumeration_type: 'NPI-2',
    first_name: '',
    last_name: '',
    credential: '',
    sex: '',
    sole_proprietor: '',
    organization_name: '100 CHIROPRACTIC LIVINGOOD STOBART PC INC APC',
    display_name: '100 CHIROPRACTIC LIVINGOOD STOBART PC INC APC',
    organizational_subpart: 'NO',
    authorized_official: {
      display_name: 'Dr. BRANDON LIVINGOOD',
      title_or_position: 'Owner',
      telephone_number: '7192170895',
      credential: '',
    },
  };

  it('classifies a Type-2 NPI as an organization', () => {
    const r = build(org);
    expect(r.entityType).toBe('organization');
    expect(r.entityTypeLabel).toBe('Organization (Type 2)');
  });

  it('surfaces the authorized official CMS holds accountable', () => {
    const r = build(org);
    expect(r.authorizedOfficial.data?.displayName).toBe('Dr. BRANDON LIVINGOOD');
    expect(r.authorizedOfficial.data?.titleOrPosition).toBe('Owner');
  });

  it('leaves the authorized official null for an individual', () => {
    expect(build().authorizedOfficial.data).toBeNull();
  });
});

describe('freshness', () => {
  it('computes the age of the reading in days', () => {
    // last_updated 2025-01-27, now 2026-07-26.
    const r = build();
    expect(r.identity.freshness.ageDays).toBeGreaterThan(500);
  });

  it('marks a record older than the NPPES refresh window as stale', () => {
    const r = build();
    expect(r.identity.freshness.status).toBe('stale');
  });

  it('marks a freshly-updated record current', () => {
    const r = build({ last_updated: '2026-07-25' });
    expect(r.identity.freshness.status).toBe('current');
    expect(r.identity.freshness.ageDays).toBe(1);
  });

  it('reports unknown rather than guessing when CMS gives no date', () => {
    const r = build({ last_updated: '' });
    expect(r.identity.freshness.observedAt).toBeNull();
  });
});

describe('gaps', () => {
  it('always states that licence status is not covered', () => {
    const r = build();
    const labels = r.gaps.map((g) => g.label);
    expect(labels).toContain('Licence status');
    expect(labels).toContain('Exclusion and sanction screening');
    expect(labels).toContain('Medicare enrollment');
  });

  it('explains that a Medicare specialty code is a mapping, not enrollment', () => {
    const r = build();
    const gap = r.gaps.find((g) => g.label === 'Medicare enrollment');
    expect(gap?.reason).toMatch(/not evidence of enrollment/i);
  });

  it('reports a missing specialty as a gap rather than rendering nothing', () => {
    const r = build({ taxonomies: [] });
    expect(r.gaps.map((g) => g.label)).toContain('Specialty');
  });

  it('reports a missing practice address as a gap', () => {
    const r = build({ practice_address: null });
    expect(r.gaps.map((g) => g.label)).toContain('Practice location');
  });
});

describe('cited sources', () => {
  it('cites the derived source when a Medicare code was computed', () => {
    const r = build();
    expect(r.citedSources.map((s) => s.id)).toEqual([
      'NPPES_API',
      'VITALCV_DERIVED',
    ]);
  });

  it('cites only NPPES when nothing was derived', () => {
    // 202D00000X is a real taxonomy with no Medicare crosswalk entry.
    const r = build({
      taxonomies: [
        { code: '202D00000X', taxonomy_group: '', desc: 'Integrative Medicine', state: '', license: '', primary: true },
      ],
    });
    expect(r.citedSources.map((s) => s.id)).toEqual(['NPPES_API']);
  });
});
