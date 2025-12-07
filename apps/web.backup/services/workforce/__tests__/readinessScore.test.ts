import { computeSupplyReadinessScore } from '../metrics/readinessScore.js';
import type { ClinicianSupplySummary } from '../graph/buildSupplyGraph.js';

describe('SupplyReadinessScore', () => {
  const summary: ClinicianSupplySummary = {
    clinicianId: 'clinician-ready',
    licenses: 3,
    privileges: 4,
    enrollments: 2,
    compacts: 1,
    ehrRoles: 1,
    statesLicensed: ['CA', 'NV'],
    statesViaCompacts: ['AZ'],
    orgsApproved: ['alpha', 'bravo'],
    payerCoverage: ['payer-1'],
    privilegeCodes: ['CORE', 'STRUCTURAL'],
  };

  it('produces high readiness score when risk low and signals clean', () => {
    const result = computeSupplyReadinessScore({
      clinicianId: summary.clinicianId,
      summary,
      averageLicenseDaysToExpire: 120,
      credentialRiskScore: 5,
      fusionScore: 0.9,
    });

    expect(result.score).toBeGreaterThan(80);
    expect(result.components.credentialFreshness).toBeGreaterThan(0.8);
    expect(result.components.fusionMultiplier).toBeGreaterThan(0.9);
  });

  it('penalizes score for drift, compliance findings, and risk', () => {
    const result = computeSupplyReadinessScore({
      clinicianId: summary.clinicianId,
      summary: { ...summary, privileges: 1 },
      averageLicenseDaysToExpire: 10,
      credentialRiskScore: 60,
      fusionScore: 0.4,
      openDriftSignals: 3,
      complianceFindings: 4,
      privilegeHoldCount: 1,
    });

    expect(result.score).toBeLessThan(60);
    expect(result.components.credentialFreshness).toBeLessThan(0.5);
    expect(result.components.privilegeReadiness).toBeLessThan(0.5);
    expect(result.components.drift).toBeLessThan(0.5);
    expect(result.rationale.length).toBeGreaterThan(1);
  });
});

