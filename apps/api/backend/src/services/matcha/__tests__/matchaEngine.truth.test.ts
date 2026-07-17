/**
 * MATCHA engine — source-coverage honesty contract.
 *
 * Fit reasons are copy the clinician reads on /holder/matcha and the MATCHA
 * Discover deck. They may only assert what the claim level supports. These
 * tests pin the boundary: licensure is a credential fact, never inferred from
 * a practice address and never implied by a remote posting, and nothing below
 * L3 may be called checked.
 *
 * Regression origin: the engine asserted `Licensed in ${opp.state}` whenever
 * `stateEligible` was true — which any remote posting made true — so a
 * California clinician saw "Licensed in NY" on a remote New York role.
 */
import { scoreOpportunity } from '../matchaEngine';
import type { ClinicianProfile, Opportunity } from '../matchaModels';

function clinician(overrides: Partial<ClinicianProfile> = {}): ClinicianProfile {
  return {
    npi: '1234567890',
    name: 'Test Clinician',
    specialty: 'Internal Medicine',
    states: ['CA'],
    credentials: [
      { key: 'npi', status: 'active', claimLevel: 'L3', issuer: 'CMS NPPES' },
      {
        key: 'state_license',
        status: 'active',
        claimLevel: 'L2',
        issuer: 'CA Medical Board',
        state: 'CA',
      },
    ],
    ...overrides,
  } as ClinicianProfile;
}

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp-1',
    title: 'Hospitalist',
    specialty: 'Internal Medicine',
    state: 'CA',
    hiringType: 'permanent',
    remote: false,
    requirementLevel: 'L1',
    organizationId: 'org-1',
    organizationName: 'Test Health',
    requirements: [],
    ...overrides,
  } as Opportunity;
}

const stateReasons = (c: ClinicianProfile, o: Opportunity) =>
  scoreOpportunity(c, null, o).fitReasons.filter(r => r.dimension === 'state');

describe('MATCHA engine — licensure is never fabricated', () => {
  it('a remote posting never implies a license in the posting state', () => {
    const reasons = stateReasons(
      clinician(), // CA only
      opportunity({ state: 'NY', remote: true, hiringType: 'telehealth' }),
    );
    for (const reason of reasons) {
      expect(reason.label).not.toMatch(/Licensed in NY/i);
    }
    expect(reasons).toContainEqual({
      dimension: 'state',
      label: 'Remote role — needs NY license (telehealth is practiced where the patient is)',
      positive: false,
    });
  });
});

/**
 * Telehealth is practised where the patient is, so a remote posting relocates
 * the licensure requirement rather than removing it (CCHP; FSMB). Remote must
 * never buy state eligibility. Compacts, telehealth registries, and
 * episodic-care exceptions are pathways we cannot see, so the gap stays SOFT.
 */
describe('MATCHA engine — remote is not a licensure exemption', () => {
  const remoteNY = opportunity({ state: 'NY', remote: true, hiringType: 'telehealth' });

  it('does not score an unlicensed clinician as state-eligible just because a role is remote', () => {
    const remoteScore = scoreOpportunity(clinician(), null, remoteNY).matchScore;
    const onsiteScore = scoreOpportunity(
      clinician(),
      null,
      opportunity({ state: 'NY', remote: false }),
    ).matchScore;
    // Remote must earn no more state credit than the same unlicensed onsite role.
    expect(remoteScore).toBeLessThanOrEqual(onsiteScore);
  });

  it('a missing license is a soft blocker with an action, never INELIGIBLE', () => {
    const result = scoreOpportunity(clinician(), null, remoteNY);
    expect(result.matchBand).not.toBe('INELIGIBLE');
    const blocker = result.blockers.find(b => b.credentialKey === 'state_license');
    expect(blocker).toMatchObject({ severity: 'soft', actionLabel: 'Apply for NY license' });
  });

  it('a license in the remote role’s state still earns state eligibility', () => {
    const nyLicensed = clinician({
      states: ['CA'], // practises in CA, licensed in NY — telehealth into NY is the point
      credentials: [
        { key: 'npi', status: 'active', claimLevel: 'L3', issuer: 'CMS NPPES' },
        {
          key: 'state_license',
          status: 'active',
          claimLevel: 'L3',
          issuer: 'NY Medical Board',
          state: 'NY',
        },
      ],
    });
    expect(stateReasons(nyLicensed, remoteNY)).toContainEqual({
      dimension: 'state',
      label: 'NY license checked',
      positive: true,
    });
    expect(scoreOpportunity(nyLicensed, null, remoteNY).matchScore).toBeGreaterThan(
      scoreOpportunity(clinician(), null, remoteNY).matchScore,
    );
  });
});

describe('MATCHA engine — claim-level honesty', () => {

  it('a practice address in the state is a location signal, not a license', () => {
    const noLicense = clinician({
      credentials: [{ key: 'npi', status: 'active', claimLevel: 'L3', issuer: 'CMS NPPES' }],
    });
    const reasons = stateReasons(noLicense, opportunity({ state: 'CA' }));
    expect(reasons).toContainEqual({
      dimension: 'state',
      label: 'Practice address in CA — license not checked',
      positive: false,
    });
  });

  it('an L2 license claim is reported as on file, never as checked', () => {
    const reasons = stateReasons(clinician(), opportunity({ state: 'CA' }));
    expect(reasons).toContainEqual({
      dimension: 'state',
      label: 'CA license on file, not source-checked',
      positive: true,
    });
  });

  it('only an L3 license claim may be called checked', () => {
    const confirmed = clinician({
      credentials: [
        { key: 'npi', status: 'active', claimLevel: 'L3', issuer: 'CMS NPPES' },
        {
          key: 'state_license',
          status: 'active',
          claimLevel: 'L3',
          issuer: 'CA Medical Board',
          state: 'CA',
        },
      ],
    });
    const reasons = stateReasons(confirmed, opportunity({ state: 'CA' }));
    expect(reasons).toContainEqual({
      dimension: 'state',
      label: 'CA license checked',
      positive: true,
    });
  });

  it('no state reason ever uses the banned word "verified"', () => {
    const cases: Array<[ClinicianProfile, Opportunity]> = [
      [clinician(), opportunity({ state: 'CA' })],
      [clinician(), opportunity({ state: 'NY', remote: true })],
      [clinician(), opportunity({ state: 'TX' })],
    ];
    for (const [c, o] of cases) {
      for (const reason of stateReasons(c, o)) {
        expect(reason.label.toLowerCase()).not.toContain('verified');
      }
    }
  });
});

describe('MATCHA engine — credential coverage labels', () => {
  const requirement = {
    key: 'state_license' as const,
    label: 'State license',
    level: 'L2' as const,
    priority: 'required' as const,
    state: 'CA',
  };

  const credentialReasons = (claimLevel: 'L2' | 'L3') =>
    scoreOpportunity(
      clinician({
        credentials: [
          { key: 'npi', status: 'active', claimLevel: 'L3', issuer: 'CMS NPPES' },
          {
            key: 'state_license',
            status: 'active',
            claimLevel,
            issuer: 'CA Medical Board',
            state: 'CA',
          },
        ],
      }),
      null,
      opportunity({ requirements: [requirement] } as Partial<Opportunity>),
    ).fitReasons.filter(r => r.dimension === 'credentials');

  it('an L2 credential is on file, not checked — and never "verified"', () => {
    const reasons = credentialReasons('L2');
    expect(reasons).toContainEqual({
      dimension: 'credentials',
      label: 'State license on file, not source-checked',
      positive: true,
    });
    for (const reason of reasons) {
      expect(reason.label.toLowerCase()).not.toContain('verified');
    }
  });

  it('an L3 credential is checked', () => {
    expect(credentialReasons('L3')).toContainEqual({
      dimension: 'credentials',
      label: 'State license checked',
      positive: true,
    });
  });
});
