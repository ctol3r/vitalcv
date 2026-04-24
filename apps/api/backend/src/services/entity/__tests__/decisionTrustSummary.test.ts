jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../passportService', () => ({
  buildPassportByNpi: jest.fn(),
}));

jest.mock('../../trust/trustScoreV1', () => ({
  computeTrustScoreV1: jest.fn(),
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import { summarizeDeterministicDecision } from '@vitalcv/trust-state';
import { buildPassportByNpi } from '../passportService';
import { computeTrustScoreV1 } from '../../trust/trustScoreV1';
import {
  buildDecisionTrustSnapshot,
  summarizeDecisionTrustSnapshot,
} from '../employerReviewActions';

const buildPassportByNpiMock = buildPassportByNpi as jest.MockedFunction<typeof buildPassportByNpi>;
const computeTrustScoreV1Mock = computeTrustScoreV1 as jest.MockedFunction<typeof computeTrustScoreV1>;

describe('decision trust summary', () => {
  beforeEach(() => {
    buildPassportByNpiMock.mockReset();
    computeTrustScoreV1Mock.mockReset();
  });

  it('matches the shared deterministic decision contract for the same snapshot input', () => {
    const backend = summarizeDecisionTrustSnapshot({
      snapshotHash: 'hash-1',
      capturedAt: '2026-04-22T12:00:00.000Z',
      npi: '1234567890',
      readinessStatus: 'PARTIAL',
      readinessScore: 72,
      readinessLevel: 'L2',
      trustBand: 'L2',
      trustBandLabel: 'PARTIAL',
      trustScore: 72,
      trustScoreConfidence: 0.9,
      exclusionStatus: 'CLEAR',
      exclusionCheckedAt: '2026-04-22T11:00:00.000Z',
      deaStatus: 'registered',
      licenseStatus: 'pending',
      pecosEnrollmentStatus: 'NOT_FOUND',
      verifiedCredentialCount: 1,
      staleCredentialCount: 0,
      reviewRequiredCount: 0,
      blockerCount: 0,
      topBlockers: [],
      missingDomains: ['Medicare enrollment still pending'],
      gatedDomains: [],
      truthStatuses: {
        identity: 'VERIFIED',
        safety: 'CLEAR',
        authority: 'PENDING',
        eligibility: 'PENDING',
      },
      sourceCoverageSummary: {
        checked: ['NPPES_API', 'OIG_LEIE'],
        stale: [],
        pending: ['PECOS_PUBLIC'],
        gated: [],
        unavailable: [],
        accessRequired: [],
        reviewRequired: [],
        notDecisionGrade: [],
        previewOnly: [],
      },
      lastCheckedAt: '2026-04-22T12:00:00.000Z',
    });

    const shared = summarizeDeterministicDecision({
      verifiedEvidenceCount: 1,
      limitationLabels: ['Medicare enrollment still pending'],
      explicitBlockers: [],
      deaStatus: 'registered',
      licenseStatus: 'pending',
      exclusionStatus: 'CLEAR',
    });

    expect(backend).toEqual(shared);
  });

  it('captures explicit blocker lists and standing blockers from the passport', async () => {
    buildPassportByNpiMock.mockResolvedValue({
      authority: {
        credentials: [
          { stale: false, reviewRequired: false },
          { stale: true, reviewRequired: false },
          { stale: false, reviewRequired: true },
        ],
        summary: { missing: ['STATE_LICENSE'] },
      },
      readiness: {
        status: 'BLOCKED',
        score: 55,
        level: 'L1',
        blockers: ['DEA registration expired'],
        nextActions: [
          {
            id: 'na-1',
            title: 'This should not become a blocker',
            detail: 'Not a blocker',
            priority: 'HIGH',
          },
        ],
      },
      truth: {
        identity: { status: 'VERIFIED' },
        safety: { status: 'CLEAR' },
        authority: { status: 'VERIFIED' },
        eligibility: { status: 'PENDING' },
      },
      standing: {
        exclusionStatus: 'CLEAR',
        exclusionCheckedAt: '2026-04-22T11:00:00.000Z',
        pecosEnrollmentStatus: 'UNKNOWN',
        deaStatus: 'expired',
        licensureStatus: 'verified',
      },
      sourceCoverage: {
        summary: {
          checked: ['NPPES_API'],
          stale: [],
          pending: [],
          gated: [],
          unavailable: [],
          accessRequired: [],
          reviewRequired: [],
          notDecisionGrade: [],
          previewOnly: [],
        },
      },
      lastCheckedAt: '2026-04-22T12:00:00.000Z',
    } as never);
    computeTrustScoreV1Mock.mockResolvedValue({
      band: 'L1',
      bandLabel: 'PARTIAL',
      score: 55,
      confidence: 0.8,
    } as never);

    const snapshot = await buildDecisionTrustSnapshot('1234567890');

    expect(snapshot.topBlockers).toEqual(['DEA registration expired']);
    expect(snapshot.deaStatus).toBe('expired');
    expect(snapshot.licenseStatus).toBe('verified');
    expect(summarizeDecisionTrustSnapshot(snapshot).state).toBe('blocked');
    expect(summarizeDecisionTrustSnapshot(snapshot).blockers).toContain('DEA registration expired');
  });
});
