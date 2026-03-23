import {
  createCanonicalSourceCoverage,
  summarizeCanonicalSourceCoverage,
} from '../../../../../../../packages/trust-state';
import { buildEmployerEvidencePacket } from '../employerPacket';
import { buildEmployerReviewSourceCoverage } from '../employerReviewPayload';
import type { TrustPassport } from '../passportService';

function buildPassport(): TrustPassport {
  const checks = [
    createCanonicalSourceCoverage({
      sourceId: 'NPPES_API',
      state: 'live',
      reason: 'NPPES identity checked',
      checkedAt: '2026-03-23T12:00:00.000Z',
      proof: { artifactIds: ['artifact-nppes'], receiptIds: ['receipt-nppes'] },
    }),
    createCanonicalSourceCoverage({
      sourceId: 'OIG_LEIE',
      state: 'live',
      reason: 'OIG LEIE check clear',
      checkedAt: '2026-03-23T12:00:00.000Z',
      proof: { artifactIds: ['artifact-oig'], receiptIds: ['receipt-oig'] },
    }),
    createCanonicalSourceCoverage({
      sourceId: 'STATE_BOARD',
      state: 'gated',
      reason: 'Institutional access required',
      checkedAt: '2026-03-23T12:00:00.000Z',
    }),
    createCanonicalSourceCoverage({
      sourceId: 'PECOS_PUBLIC',
      state: 'notDecisionGrade',
      reason: 'PECOS evidence is not decision-grade and excluded from decision-grade trust',
      checkedAt: '2026-03-23T12:00:00.000Z',
    }),
  ] as const;

  return {
    entityId: 'entity-1',
    npi: '1234567890',
    identity: {
      entityId: 'entity-1',
      displayName: 'Dr. Jane Doe',
      npi: '1234567890',
      specialty: 'Family Medicine',
      entityType: 'CLINICIAN',
      status: 'ACTIVE',
    },
    authority: {
      credentials: [
        {
          id: 'cred-1',
          domain: 'LICENSURE',
          type: 'STATE_LICENSE',
          status: 'ACTIVE',
          verificationLevel: 'SOURCE_VERIFIED',
          sourceId: 'STATE_BOARD',
          observedAt: '2026-03-23T12:00:00.000Z',
          stale: false,
          confidenceLabel: 'HIGH',
          claimConfidenceLabel: 'HIGH',
          dataFreshness: 'Weekly',
          dataFreshnessLabel: 'Weekly',
          reviewRequired: false,
        },
      ],
      summary: { active: 1, expired: 0, stale: 0, missing: [] },
    },
    training: {
      records: [],
      hasDegree: true,
      degreeVerified: true,
      hasResidency: true,
      fellowshipCount: 0,
    },
    standing: {
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      exclusionCheckedAt: '2026-03-23T12:00:00.000Z',
      exclusionConfidenceLabel: 'HIGH',
      licensureStatus: 'verified',
      deaStatus: 'registered',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentSourceLatency: 'QUARTERLY',
      enrollmentNote: 'Medicare enrolled',
      enrollmentObservedAt: '2026-03-23T12:00:00.000Z',
      enrollmentDataVersion: '2026-Q1',
      enrollmentStatusLabel: 'Enrolled',
      enrollmentFreshnessLabel: 'Quarterly',
      enrollmentConfidenceLabel: 'HIGH',
      negativeFindings: [],
    },
    readiness: {
      status: 'PARTIAL',
      score: 59,
      readiness_score: 59,
      level: 'L1',
      blockers: [],
      gaps: ['PECOS evidence is not decision-grade and excluded from decision-grade trust'],
      nextActions: [],
      estimatedStartDays: 14,
    },
    sources: {
      checked: ['NPPES_API', 'OIG_LEIE', 'STATE_BOARD', 'PECOS_PUBLIC'],
      lastFetch: {
        NPPES_API: '2026-03-23T12:00:00.000Z',
      },
    },
    sourceCoverage: {
      checks: [...checks],
      summary: summarizeCanonicalSourceCoverage(checks),
    },
    lastCheckedAt: '2026-03-23T12:00:00.000Z',
  };
}

describe('employer packet truth', () => {
  it('keeps packet export source coverage aligned with employer review payload coverage', () => {
    const passport = buildPassport();

    const packet = buildEmployerEvidencePacket({
      passport,
      employerId: 'employer-1',
      exportedAt: '2026-03-23T13:00:00.000Z',
    });
    const reviewCoverage = buildEmployerReviewSourceCoverage({
      passportSourceCoverage: passport.sourceCoverage,
      domains: ['LICENSURE'],
      credentialCount: 1,
    });

    expect(packet.sourceCoverage).toEqual(passport.sourceCoverage);
    expect(reviewCoverage.checks).toEqual(packet.sourceCoverage.checks);
    expect(reviewCoverage.summary).toEqual(packet.sourceCoverage.summary);
    expect(packet.identity.truthStatus).toBe('VERIFIED');
    expect(packet.safety.truthStatus).toBe('CLEAR');
    expect(packet.authority.truthStatus).toBe('ACCESS REQUIRED');
    expect(packet.eligibility.truthStatus).toBe('PENDING');
  });
});
