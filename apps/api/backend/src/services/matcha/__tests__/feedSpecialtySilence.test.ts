/**
 * A feed listing's specialty placeholder is a record of SILENCE, never a
 * requirement.
 *
 * Production shipped this on all 454 ingested rows:
 *
 *   "Specialty mismatch (Not stated required)"
 *
 * The runner writes `SPECIALTY_NOT_STATED` when a public feed published no
 * specialty. The engine compared the clinician against that literal string,
 * found no match, and told the clinician the employer requires a specialty
 * called "Not stated" — an employer statement invented for an employer who has
 * no relationship with VitalCV and has said nothing at all. That is precisely
 * what `listingSource='public_feed'` exists to prevent.
 */
import { scoreOpportunity } from '../matchaEngine';
import { SPECIALTY_NOT_STATED } from '../../ingestion/types';
import type { ClinicianProfile, Opportunity } from '../matchaModels';

function clinician(): ClinicianProfile {
  return {
    npi: '1234567890',
    name: 'Test Clinician',
    specialty: 'Internal Medicine',
    states: ['CA'],
    credentials: [
      { key: 'npi', status: 'active', claimLevel: 'L3', issuer: 'CMS NPPES' },
      { key: 'state_license', status: 'active', claimLevel: 'L2', issuer: 'CA Medical Board', state: 'CA' },
    ],
  } as unknown as ClinicianProfile;
}

function opportunity(specialty: string): Opportunity {
  return {
    id: 'opp-1',
    title: 'Family Nurse Practitioner',
    specialty,
    state: 'CA',
    hiringType: 'permanent',
    remote: false,
    requirementLevel: 'L1',
    organizationId: 'org-1',
    organizationName: 'onemedical',
    requirements: [],
  } as unknown as Opportunity;
}

const explain = (specialty: string) => scoreOpportunity(clinician(), null, opportunity(specialty));
const labels = (specialty: string) => explain(specialty).fitReasons.map((r) => r.label);

describe('an unstated specialty is not a requirement', () => {
  it('never tells a clinician the placeholder is required', () => {
    const text = labels(SPECIALTY_NOT_STATED).join(' | ');
    expect(text).not.toContain(`${SPECIALTY_NOT_STATED} required`);
    expect(text).not.toMatch(/Specialty mismatch/);
  });

  it('says the LISTING is silent, attributing nothing to the employer', () => {
    expect(labels(SPECIALTY_NOT_STATED)).toContain('This listing does not state a specialty');
  });

  it('does not penalise the clinician for the source’s silence', () => {
    // Silence is not evidence of unfit, so it must not score below a real mismatch.
    expect(explain(SPECIALTY_NOT_STATED).matchScore)
      .toBeGreaterThanOrEqual(explain('Dermatology').matchScore);
  });

  it('still reports a REAL mismatch when the feed did state a specialty', () => {
    expect(labels('Dermatology').join(' | ')).toContain('Specialty mismatch (Dermatology required)');
  });

  it('still credits a real match', () => {
    expect(labels('Internal Medicine').join(' | ')).toMatch(/Internal Medicine specialty/);
  });
});
