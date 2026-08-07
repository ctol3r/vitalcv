/**
 * cms-clinicians-connector.test.ts — CMS Doctors & Clinicians.
 *
 * The failure that matters for this source is not a crash, it is a wrong
 * inference. Three distinct answers must never be collapsed:
 *
 *   enrolled     — CMS lists this clinician
 *   not_listed   — CMS answered, with nothing. NOT a negative finding.
 *   unavailable  — we could not ask
 *
 * Reading a network failure as "not enrolled" would manufacture a finding
 * about a real person out of an outage. Reading "not listed" as a problem
 * would do the same out of a business model — plenty of clinicians simply do
 * not bill Medicare.
 */

import { describe, it, expect } from 'vitest';
import {
  distinctAffiliations,
  trainingFromRows,
  acceptsMedicareAssignment,
  surnameAgreesWithNppes,
  type CmsClinicianRow,
} from '@/lib/clinician-record/cmsClinicians';
import { attachMedicareEnrollment, buildClinicianRecord } from '@/lib/clinician-record/build';
import { mapNppesResult } from '@/lib/clinician-record/nppes';

function row(over: Partial<CmsClinicianRow> = {}): CmsClinicianRow {
  return {
    npi: '1003000126',
    individualPacId: '7517003643',
    individualEnrollmentId: 'I20130530000085',
    lastName: 'ENKESHAFI',
    firstName: 'ARDALAN',
    credential: 'MD',
    medicalSchool: 'OTHER',
    graduationYear: '1994',
    primarySpecialty: 'HOSPITALIST',
    secondarySpecialties: ['INTERNAL MEDICINE'],
    facilityName: 'MEDICAL FACULTY ASSOCIATES, INC',
    organizationPacId: '4082528898',
    organizationMemberCount: '681',
    city: 'WASHINGTON',
    state: 'DC',
    individualAcceptsAssignment: 'Y',
    groupAcceptsAssignment: 'Y',
    telehealth: '',
    ...over,
  };
}

describe('distinctAffiliations', () => {
  it('collapses one group repeated across practice addresses', () => {
    // The file emits one row per clinician-per-address, so a physician at a
    // single group with six sites appears six times. Rendering that raw would
    // claim six affiliations for one job.
    const rows = [row({ city: 'WASHINGTON' }), row({ city: 'BETHESDA' }), row({ city: 'ARLINGTON' })];
    const affiliations = distinctAffiliations(rows);
    expect(affiliations).toHaveLength(1);
    expect(affiliations[0].facilityName).toBe('MEDICAL FACULTY ASSOCIATES, INC');
    expect(affiliations[0].locations).toBe(3);
  });

  it('keeps genuinely different groups apart', () => {
    const rows = [
      row(),
      row({ facilityName: 'OTHER GROUP LLC', organizationPacId: '999' }),
    ];
    expect(distinctAffiliations(rows)).toHaveLength(2);
  });

  it('ignores rows with no facility name', () => {
    expect(distinctAffiliations([row({ facilityName: '' })])).toEqual([]);
  });
});

describe('trainingFromRows', () => {
  it('normalizes the CMS placeholder school away instead of rendering it', () => {
    // CMS writes "OTHER" when the school is outside its coded list. Showing
    // that as a medical school would be worse than showing nothing.
    expect(trainingFromRows([row()]).medicalSchool).toBe('');
    expect(trainingFromRows([row()]).graduationYear).toBe('1994');
  });

  it('keeps a real school name', () => {
    const t = trainingFromRows([row({ medicalSchool: 'GEORGETOWN UNIVERSITY' })]);
    expect(t.medicalSchool).toBe('GEORGETOWN UNIVERSITY');
  });

  it('returns empties rather than throwing on no rows', () => {
    expect(trainingFromRows([])).toEqual({ medicalSchool: '', graduationYear: '' });
  });
});

describe('acceptsMedicareAssignment', () => {
  it('is null when CMS reported no flag either way', () => {
    // Null and false mean different things to a reader; null must not
    // collapse into "does not accept assignment".
    expect(acceptsMedicareAssignment([row({ individualAcceptsAssignment: '' })])).toBeNull();
    expect(acceptsMedicareAssignment([])).toBeNull();
  });

  it('is true when any location reports acceptance', () => {
    expect(
      acceptsMedicareAssignment([row({ individualAcceptsAssignment: 'N' }), row()]),
    ).toBe(true);
  });

  it('is false only when every reported flag says no', () => {
    expect(acceptsMedicareAssignment([row({ individualAcceptsAssignment: 'N' })])).toBe(false);
  });
});

describe('surnameAgreesWithNppes', () => {
  it('confirms a match across the two federal sources', () => {
    expect(surnameAgreesWithNppes([row()], { last_name: 'ENKESHAFI' })).toBe(true);
  });

  it('flags a genuine disagreement', () => {
    expect(surnameAgreesWithNppes([row()], { last_name: 'SMITH' })).toBe(false);
  });

  it('ignores first-name differences, which are legitimate noise', () => {
    // Nicknames and initials differ between these files constantly. Flagging
    // that would train a reader to ignore the check entirely.
    expect(
      surnameAgreesWithNppes([row({ firstName: 'ARDY' })], { last_name: 'ENKESHAFI' }),
    ).toBe(true);
  });

  it('returns null rather than guessing when either side has no surname', () => {
    expect(surnameAgreesWithNppes([], { last_name: 'ENKESHAFI' })).toBeNull();
    expect(surnameAgreesWithNppes([row()], { last_name: '' })).toBeNull();
  });
});

describe('attachMedicareEnrollment', () => {
  const reading = mapNppesResult({
    number: '1003000126',
    enumeration_type: 'NPI-1',
    basic: { first_name: 'ARDALAN', last_name: 'ENKESHAFI', status: 'A', last_updated: '2025-05-28' },
    addresses: [],
    taxonomies: [],
  } as unknown as Record<string, unknown>);

  const base = () =>
    buildClinicianRecord(reading, {
      retrievedAt: '2026-07-26T12:00:00.000Z',
      now: new Date('2026-07-26T12:00:00.000Z'),
    });

  it('clears the Medicare-enrollment gap only on a definitive answer', () => {
    const enrolled = attachMedicareEnrollment(
      base(),
      { state: 'enrolled', rows: [row()], retrievedAt: '2026-07-26T12:00:00.000Z' },
      reading,
    );
    expect(enrolled.gaps.map((g) => g.label)).not.toContain('Medicare enrollment');
  });

  it('keeps the gap when CMS could not be reached', () => {
    // 'unavailable' is not coverage. Clearing the gap here would present an
    // outage as a completed check.
    const unavailable = attachMedicareEnrollment(
      base(),
      { state: 'unavailable', rows: [], retrievedAt: '2026-07-26T12:00:00.000Z' },
      reading,
    );
    expect(unavailable.gaps.map((g) => g.label)).toContain('Medicare enrollment');
  });

  it('keeps the gap when the clinician is simply not listed', () => {
    const notListed = attachMedicareEnrollment(
      base(),
      { state: 'not_listed', rows: [], retrievedAt: '2026-07-26T12:00:00.000Z' },
      reading,
    );
    expect(notListed.gaps.map((g) => g.label)).toContain('Medicare enrollment');
    expect(notListed.medicareEnrollment?.data.state).toBe('not_listed');
  });

  it('marks this source as confirmed rather than self-reported', () => {
    // The one section on the record CMS asserts from its own records. If this
    // ever reads self-reported, the distinction the record exists to draw is
    // gone.
    const enrolled = attachMedicareEnrollment(
      base(),
      { state: 'enrolled', rows: [row()], retrievedAt: '2026-07-26T12:00:00.000Z' },
      reading,
    );
    expect(enrolled.medicareEnrollment?.provenance.confirmation).toBe('source_confirmed');
    // ...but still not decision grade, per the source catalog.
    expect(enrolled.medicareEnrollment?.provenance.source.decisionGrade).toBe(false);
  });

  it('cites the new source in the provenance footer', () => {
    const enrolled = attachMedicareEnrollment(
      base(),
      { state: 'enrolled', rows: [row()], retrievedAt: '2026-07-26T12:00:00.000Z' },
      reading,
    );
    expect(enrolled.citedSources.map((s) => s.id)).toContain('DOCTORS_CLINICIANS');
  });

  it('leaves the base record intact rather than mutating it', () => {
    const original = base();
    attachMedicareEnrollment(
      original,
      { state: 'enrolled', rows: [row()], retrievedAt: '2026-07-26T12:00:00.000Z' },
      reading,
    );
    expect(original.medicareEnrollment).toBeNull();
  });
});
