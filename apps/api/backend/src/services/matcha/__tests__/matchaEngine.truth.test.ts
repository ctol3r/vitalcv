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
      label: 'Remote role — NY license requirements not checked',
      positive: false,
    });
  });

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
