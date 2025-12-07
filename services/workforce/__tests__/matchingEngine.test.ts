import { describe, expect, it } from '@jest/globals';
import { WorkforceMatchingEngine } from '../matching/engine';
import { NegativeConstraintEngine } from '../matching/negativeConstraints';
import { InMemoryMobilityAdapter, MobilityIntegration } from '../matching/mobilityIntegration';
import type { ClinicianProfile, DemandSignal } from '../matching/types';

const baseDemand: DemandSignal = {
  id: 'demand-icu-night',
  orgId: 'org-b',
  department: 'ICU',
  role: 'Night Intensivist',
  locationState: 'WA',
  requiredPrivileges: ['ICU-VENT', 'ICU-CENTRAL-LINE'],
  preferredPayers: ['payer-a', 'payer-b'],
  ehrVendor: 'Epic',
  riskTolerance: {
    maxRiskScore: 0.35,
    allowComplianceAtRisk: false,
    allowDrift: 'MEDIUM',
  },
  shift: {
    day: 'MON',
    start: '19:00',
    end: '07:00',
    timezone: 'America/Los_Angeles',
  },
  minExperienceYears: 5,
  mobilityPolicy: 'ALLOW_CROSS_ORG',
  demandPerWeek: 4,
};

function buildClinician(overrides: Partial<ClinicianProfile> = {}): ClinicianProfile {
  return {
    id: 'clin-1',
    name: 'Dr. Cross Cover',
    orgId: 'org-a',
    specialties: ['Critical Care'],
    stateLicenses: ['WA'],
    compactEligibleStates: ['WA', 'OR'],
    privileges: [
      { code: 'ICU-VENT', status: 'ACTIVE' },
      { code: 'ICU-CENTRAL-LINE', status: 'ACTIVE' },
    ],
    payerCoverage: [
      { payerId: 'payer-a', status: 'ENROLLED', coverage: 'FULL' },
      { payerId: 'payer-c', status: 'ENROLLED', coverage: 'LIMITED' },
    ],
    ehrReadiness: [{ vendor: 'Epic', ready: true, trained: true }],
    availability: [
      { day: 'MON', start: '18:00', end: '08:00', mode: 'IN_PERSON' },
      { day: 'TUE', start: '18:00', end: '08:00', mode: 'IN_PERSON' },
    ],
    risk: {
      overall: 0.2,
      complianceStatus: 'PASS',
      driftSignal: 'LOW',
      qualityHazard: false,
    },
    yearsExperience: 11,
    rating: 0.92,
    burnoutRisk: 0.2,
    mobility: {
      status: 'portable',
      supportedOrgIds: ['org-a'],
    },
    ...overrides,
  } satisfies ClinicianProfile;
}

describe('WorkforceMatchingEngine', () => {
  const mobilityAdapter = new InMemoryMobilityAdapter({
    'clin-1': {
      'org-b': { status: 'instantly_onboardable', reason: 'All onboarding artifacts pre-verified' },
    },
  });
  const engine = new WorkforceMatchingEngine(
    new NegativeConstraintEngine(),
    new MobilityIntegration(mobilityAdapter)
  );

  it('returns ranked candidates when all constraints pass', async () => {
    const clinician = buildClinician();

    const results = await engine.matchDemand(baseDemand, [clinician]);

    expect(results).toHaveLength(1);
    expect(results[0].clinicianId).toBe('clin-1');
    expect(results[0].score).toBeGreaterThan(0.7);
    expect(results[0].coverage.privileges).toBe(1);
    expect(results[0].mobilityContext?.reason).toMatch(/instantly onboardable/i);
  });

  it('rejects clinicians with restricted privileges via negative constraint engine', async () => {
    const clinician = buildClinician({
      privileges: [
        { code: 'ICU-VENT', status: 'ACTIVE' },
        { code: 'ICU-CENTRAL-LINE', status: 'RESTRICTED' },
      ],
    });

    const results = await engine.matchDemand(baseDemand, [clinician]);

    expect(results).toHaveLength(0);
  });

  it('blocks cross-org matches when mobility engine is not instantly onboardable', async () => {
    const adapter = new InMemoryMobilityAdapter({
      'clin-2': {
        'org-b': { status: 'portable', readyInHours: 120, reason: 'Needs onboarding packet' },
      },
    });
    const localEngine = new WorkforceMatchingEngine(
      new NegativeConstraintEngine(),
      new MobilityIntegration(adapter)
    );

    const clinician = buildClinician({
      id: 'clin-2',
      name: 'Dr. Traveler',
      mobility: { status: 'portable' },
    });

    const results = await localEngine.matchDemand(baseDemand, [clinician]);

    expect(results).toHaveLength(0);
  });
});
