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
import { getDecisionSummary } from '../../../../../../web/lib/apply/decision-summary';
import { summarizeDecisionTrustSnapshot } from '../employerReviewActions';

describe('decision reproducibility', () => {
  it('returns the same state, blockers, and next action across shared, backend, and UI layers', () => {
    const shared = summarizeDeterministicDecision({
      verifiedEvidenceCount: 1,
      limitationLabels: ['Medicare enrollment still pending'],
      explicitBlockers: [],
      deaStatus: 'registered',
      licenseStatus: 'pending',
      exclusionStatus: 'CLEAR',
    });

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

    const ui = getDecisionSummary({
      status: 'partial',
      blockers: [],
      nextAction: null,
      standing: {
        deaStatus: 'registered',
        licenseStatus: 'pending',
        exclusionStatus: 'CLEAR',
      },
      snapshot: {
        claims: [
          {
            credentialType: 'STATE_LICENSE',
            issuer: 'California Medical Board',
            status: 'VERIFIED',
          },
        ],
        limitations: [
          {
            state: 'pending',
            label: 'Medicare enrollment still pending',
            detail: 'PECOS is still pending.',
          },
        ],
      },
    });

    expect(backend).toEqual(shared);
    expect(ui.state).toBe(shared.state);
    expect(ui.blockers).toEqual(shared.blockers);
    expect(ui.nextAction).toBe(shared.nextAction);
  });
});
