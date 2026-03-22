jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {},
}));

import {
  buildOpportunityTruth,
  matchesOpportunityTruthFilters,
  type ClinicianOpportunityProfile,
  type OpportunityTruthRecord,
} from '../opportunityTruth';

function makeOpportunityRecord(): OpportunityTruthRecord {
  return {
    id: 'opp-1',
    organizationId: 'org-1',
    title: 'Family Medicine Physician - Rural Washington Coverage',
    specialty: 'Family Medicine',
    hiringType: 'locums',
    state: 'WA',
    payRange: '$180-$220/hr',
    requirementLevel: 'L2',
    description: 'Rural access clinic assignment with housing stipend and a pre-cleared onboarding packet.',
    remote: false,
    status: 'ACTIVE',
    createdAt: new Date('2026-03-10T00:00:00.000Z'),
    updatedAt: new Date('2026-03-18T00:00:00.000Z'),
    organization: {
      name: 'Northwest Locums Alliance',
      slug: 'northwest-locums-alliance',
      organizationProfile: {
        facilityType: 'staffing_agency',
        hiringStatus: 'ACTIVELY_HIRING',
        timeToStart: '7-10 days',
        timeToOnboard: '4-6 business days',
        clearToStartThreshold: 'Active state license, recent references, and current malpractice coverage.',
        payTransparency: true,
        payRange: '$180-$220/hr',
        description: 'Pacific Northwest locums coverage with clean credential packets.',
        tagline: 'Connecting credentialed clinicians with Pacific Northwest opportunities.',
        requirements: [
          {
            label: 'WA or OR Medical License',
            level: 'L3',
            key: 'state_license',
            priority: 'required',
          },
          {
            label: 'Current Malpractice Coverage',
            level: 'L2',
            key: 'malpractice',
            priority: 'required',
          },
        ],
        verifiedSince: new Date('2026-03-01T00:00:00.000Z'),
        verified: true,
        updatedAt: new Date('2026-03-18T00:00:00.000Z'),
      },
    },
  };
}

function makeClinician(states: string[]): ClinicianOpportunityProfile {
  return {
    npi: '1234567890',
    specialty: 'Family Medicine',
    stateOfPractice: states[0] ?? null,
    states,
    workAuthStatus: 'authorized',
    credentials: [
      {
        key: 'npi',
        level: 'L3',
        status: 'active',
        state: null,
        specialty: null,
        source: 'CMS NPPES',
      },
      {
        key: 'state_license',
        level: 'L3',
        status: 'active',
        state: states[0] ?? null,
        specialty: 'Family Medicine',
        source: 'State board',
      },
    ],
  };
}

describe('opportunityTruth', () => {
  it('builds a canonical truth record with compensation, support, and transparency signals', () => {
    const truth = buildOpportunityTruth({
      opportunity: makeOpportunityRecord(),
      clinicianProfile: makeClinician(['WA']),
      now: new Date('2026-03-20T00:00:00.000Z'),
    });

    expect(truth.organizationName).toBe('Northwest Locums Alliance');
    expect(truth.payModel).toBe('locums');
    expect(truth.payRangeMin).toBe(180);
    expect(truth.payRangeMax).toBe(220);
    expect(truth.benefitsAvailability).toBe('limited');
    expect(truth.benefitsItems).toContain('Housing stipend');
    expect(truth.freshness.listingStatus).toBe('fresh');
    expect(truth.transparency.speedToStartEstimate).toContain('7-10 days');
    expect(truth.credentialRequirements).toHaveLength(2);
  });

  it('marks state mismatch as a confirmed blocker and filters by readiness fit', () => {
    const truth = buildOpportunityTruth({
      opportunity: makeOpportunityRecord(),
      clinicianProfile: makeClinician(['CA']),
      now: new Date('2026-03-20T00:00:00.000Z'),
    });

    expect(truth.comparison?.status).toBe('requirements_missing');
    expect(truth.comparison?.missing[0]?.label).toContain('WA or OR Medical License');

    expect(matchesOpportunityTruthFilters(truth, { readinessStatus: 'requirements_missing' })).toBe(true);
    expect(matchesOpportunityTruthFilters(truth, { readinessStatus: 'ready_now' })).toBe(false);
    expect(matchesOpportunityTruthFilters(truth, { payModel: 'locums', payMin: 200 })).toBe(true);
    expect(matchesOpportunityTruthFilters(truth, { missingRequirement: 'state_license' })).toBe(true);
  });
});
