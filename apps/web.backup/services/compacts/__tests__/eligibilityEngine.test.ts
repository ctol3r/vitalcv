import { describe, expect, it } from '@jest/globals';

import {
  evaluatePracticeEligibility,
  listAuthorizedStatesForCompact,
  type ClinicianCompactProfile,
  type PracticeEligibilityResult,
} from '../eligibilityEngine.js';

function assertEligible(result: PracticeEligibilityResult) {
  expect(result.eligible).toBe(true);
  expect(result.reason).toMatch(/allows practice/i);
  expect(result.conditions.every((condition) => condition.passed)).toBe(true);
}

describe('PracticeEligibilityEngine', () => {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const basePhysicianProfile: ClinicianCompactProfile = {
    did: 'did:example:physician',
    homeState: 'TX',
    licenses: [
      {
        state: 'TX',
        type: 'MD',
        status: 'active',
        issueDate: twoYearsAgo.toISOString(),
        isPrimary: true,
      },
    ],
    metadata: {
      hasDisciplinaryActions: false,
    },
    compacts: {
      imlc: {
        status: 'LICENSED',
        homeState: 'TX',
        compactStates: ['WA', 'UT', 'CO'],
      },
    },
  };

  it('approves physicians with active IMLC coverage for the target state', () => {
    const result = evaluatePracticeEligibility('IMLC', basePhysicianProfile, 'WA');
    assertEligible(result);
  });

  it('blocks IMLC eligibility when disciplinary actions exist', () => {
    const profile: ClinicianCompactProfile = {
      ...basePhysicianProfile,
      metadata: { hasDisciplinaryActions: true },
    };
    const result = evaluatePracticeEligibility('IMLC', profile, 'WA');
    expect(result.eligible).toBe(false);
    expect(result.conditions.find((condition) => condition.code === 'discipline_check')?.passed).toBe(false);
  });

  const nurseProfile: ClinicianCompactProfile = {
    did: 'did:example:nurse',
    homeState: 'TX',
    licenses: [
      {
        state: 'TX',
        type: 'RN',
        status: 'active',
        issueDate: twoYearsAgo.toISOString(),
        isPrimary: true,
        isMultiState: true,
      },
    ],
    metadata: {
      residencyDaysInCurrentState: 120,
    },
    compacts: {
      nlc: {
        status: 'ACTIVE',
        homeState: 'TX',
        multistate: true,
        privilegeStates: ['FL', 'GA', 'TN'],
        residencyDaysInCurrentState: 120,
      },
    },
  };

  it('grants NLC coverage to nurses with multistate privileges', () => {
    const result = evaluatePracticeEligibility('NLC', nurseProfile, 'FL');
    assertEligible(result);
  });

  it('blocks NLC coverage when 60-day residency requirement is not satisfied', () => {
    const profile: ClinicianCompactProfile = {
      ...nurseProfile,
      metadata: { residencyDaysInCurrentState: 10 },
      compacts: {
        nlc: {
          ...nurseProfile.compacts?.nlc!,
          residencyDaysInCurrentState: 10,
        },
      },
    };
    const result = evaluatePracticeEligibility('NLC', profile, 'FL');
    expect(result.eligible).toBe(false);
    expect(result.conditions.find((condition) => condition.code === 'residency_60_day_rule')?.passed).toBe(false);
  });

  const psychologistProfile: ClinicianCompactProfile = {
    did: 'did:example:psypact',
    homeState: 'AZ',
    licenses: [
      {
        state: 'AZ',
        type: 'Clinical Psychologist',
        status: 'active',
        issueDate: twoYearsAgo.toISOString(),
        isPrimary: true,
      },
    ],
    compacts: {
      psypact: {
        status: 'ACTIVE',
        authorities: ['APIT'],
        ePassport: true,
        participatingStates: ['AZ', 'WA', 'UT'],
      },
    },
  };

  it('approves PSYPACT coverage when APIT and e.Passport are active', () => {
    const result = evaluatePracticeEligibility('PSYPACT', psychologistProfile, 'WA');
    assertEligible(result);
  });

  it('blocks PSYPACT coverage when e.Passport is missing', () => {
    const profile: ClinicianCompactProfile = {
      ...psychologistProfile,
      compacts: {
        psypact: {
          ...psychologistProfile.compacts?.psypact!,
          ePassport: false,
        },
      },
    };
    const result = evaluatePracticeEligibility('PSYPACT', profile, 'WA');
    expect(result.eligible).toBe(false);
    expect(result.conditions.find((condition) => condition.code === 'epassport')?.passed).toBe(false);
  });

  const aprnProfile: ClinicianCompactProfile = {
    did: 'did:example:aprn',
    homeState: 'ND',
    licenses: [
      {
        state: 'ND',
        type: 'APRN',
        status: 'active',
        issueDate: twoYearsAgo.toISOString(),
        isPrimary: true,
      },
    ],
    compacts: {
      aprn: {
        status: 'ACTIVE',
        homeState: 'ND',
        privilegeStates: ['UT', 'CO'],
      },
    },
  };

  it('grants APRN compact coverage in participating states', () => {
    const result = evaluatePracticeEligibility('APRN', aprnProfile, 'UT');
    assertEligible(result);
  });

  it('blocks APRN coverage when target is not a compact state', () => {
    const result = evaluatePracticeEligibility('APRN', aprnProfile, 'CA');
    expect(result.eligible).toBe(false);
    expect(result.conditions.find((condition) => condition.code === 'target_participating')?.passed).toBe(false);
  });

  const ptProfile: ClinicianCompactProfile = {
    did: 'did:example:pt',
    homeState: 'WA',
    licenses: [
      {
        state: 'WA',
        type: 'PT',
        status: 'active',
        issueDate: twoYearsAgo.toISOString(),
        isPrimary: true,
      },
    ],
    compacts: {
      pt: {
        status: 'ACTIVE',
        privilegeStates: ['WA', 'OR'],
      },
    },
  };

  it('grants PT compact coverage when privilege lists the target state', () => {
    const result = evaluatePracticeEligibility('PT', ptProfile, 'WA');
    assertEligible(result);
  });

  it('flags PT compact coverage when the target state has an active issue', () => {
    const result = evaluatePracticeEligibility('PT', ptProfile, 'OR');
    expect(result.eligible).toBe(false);
    expect(result.conditions.find((condition) => condition.code === 'active_issue')?.passed).toBe(false);
  });

  it('returns union of authorized states for IMLC', () => {
    const states = listAuthorizedStatesForCompact('IMLC', basePhysicianProfile);
    expect(states).toEqual(expect.arrayContaining(['TX', 'WA']));
  });

  it('falls back to compact matrix when APRN privilege states are unspecified', () => {
    const profileWithoutPrivileges: ClinicianCompactProfile = {
      ...aprnProfile,
      compacts: {
        aprn: {
          ...aprnProfile.compacts?.aprn!,
          privilegeStates: undefined,
        },
      },
    };
    const states = listAuthorizedStatesForCompact('APRN', profileWithoutPrivileges);
    expect(states.length).toBeGreaterThan(5);
    expect(states).toContain('CO');
  });

  it('rejects target states that are not participants for the specified compact', () => {
    const result = evaluatePracticeEligibility('IMLC', basePhysicianProfile, 'CA');
    expect(result.eligible).toBe(false);
    expect(result.conditions.find((condition) => condition.code === 'target_participating')?.passed).toBe(false);
  });
});

