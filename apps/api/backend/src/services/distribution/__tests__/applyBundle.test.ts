jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../audit/auditLedger', () => ({
  appendAuditEvent: jest.fn(),
}));

jest.mock('../../entity/employerReviewPayload', () => ({
  buildEmployerReviewPayload: jest.fn(),
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

jest.mock('../../feedback/prismaEventStore', () => ({
  emitLearningEvent: jest.fn(),
}));

import type { EmployerReviewPayloadV1 } from '../../entity/employerReviewPayload';
import { deriveApplyBundleContract } from '../applyBundle';

function buildReviewPayload(
  overrides: Partial<EmployerReviewPayloadV1> = {},
): EmployerReviewPayloadV1 {
  return {
    schema: 'vitalcv.employer.review.v1',
    identitySummary: {
      entityId: 'entity-1',
      displayName: 'Ada Lovelace, MD',
      npi: '1234567890',
      specialty: 'Family Medicine',
      entityType: 'PERSON',
    },
    readinessSummary: {
      status: 'READY',
      score: 84,
      readiness_score: 84,
      level: 'L2',
      blockers: [],
      gaps: [],
      nextActions: [],
      estimatedStartDays: 14,
    },
    authorityStanding: {
      exclusionStatus: 'CLEAR',
      exclusionCheckedAt: '2026-04-21T00:00:00.000Z',
      exclusionConfidenceLabel: 'High confidence',
      licensureStatus: 'verified',
      deaStatus: 'unknown',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentSourceLatency: 'Quarterly snapshot',
      enrollmentNote: null,
      enrollmentObservedAt: '2026-04-21T00:00:00.000Z',
      enrollmentDataVersion: '2026-Q2',
      enrollmentStatusLabel: 'Enrolled',
      enrollmentFreshnessLabel: 'Current quarter',
      negativeFindings: [],
    },
    blockers: [],
    nextActions: [
      {
        id: 'next-1',
        title: 'Accept as head start',
        detail: 'Move the clinician into employer review.',
        priority: 'LOW',
      },
    ],
    credentialsIncluded: [
      {
        credentialId: 'claim-1',
        domain: 'IDENTITY',
        credentialType: 'NPPES_IDENTITY',
        status: 'VERIFIED',
        verificationLevel: 'PRIMARY_SOURCE',
        issuerName: 'CMS NPPES',
        observedAt: '2026-04-21T00:00:00.000Z',
        expiresAt: undefined,
        artifactIds: ['artifact-1'],
        receiptIds: ['receipt-1'],
      },
    ],
    receiptReferences: ['receipt-1'],
    proofReferences: ['receipt-1'],
    checkedAt: '2026-04-21T00:00:00.000Z',
    truth: undefined as never,
    sourceCoverage: {
      checks: [
        {
          sourceId: 'NPPES_API',
          state: 'checked',
          reason: 'Identity source checked',
        },
        {
          sourceId: 'OIG_LEIE',
          state: 'checked',
          reason: 'Safety source checked',
        },
      ],
      summary: {
        checked: ['NPPES_API', 'OIG_LEIE'],
        stale: [],
        pending: [],
        gated: [],
        unavailable: [],
        accessRequired: [],
        reviewRequired: [],
        notDecisionGrade: [],
        previewOnly: [],
      },
      sources: ['NPPES_API', 'OIG_LEIE'],
      domains: ['IDENTITY'],
      credentialCount: 1,
    },
    shareMetadata: {
      selectiveDomains: 'ALL',
    },
    ...overrides,
  };
}

describe('deriveApplyBundleContract', () => {
  it('does not mark the bundle blocked without explicit adverse evidence', () => {
    const contract = deriveApplyBundleContract(buildReviewPayload({
      readinessSummary: {
        ...buildReviewPayload().readinessSummary,
        status: 'BLOCKED',
        blockers: ['State board verification missing'],
      },
      blockers: ['State board verification missing'],
      sourceCoverage: {
        ...buildReviewPayload().sourceCoverage,
        summary: {
          ...buildReviewPayload().sourceCoverage.summary,
          accessRequired: ['STATE_BOARD'],
        },
      },
    }));

    expect(contract.status).toBe('partial');
  });

  it('removes the readiness score when zero verified sources are attached', () => {
    const contract = deriveApplyBundleContract(buildReviewPayload({
      readinessSummary: {
        ...buildReviewPayload().readinessSummary,
        score: 72,
        readiness_score: 72,
      },
      sourceCoverage: {
        ...buildReviewPayload().sourceCoverage,
        checks: [
          {
            sourceId: 'NPPES_API',
            state: 'pending',
            reason: 'Identity source queued',
          },
        ],
        summary: {
          checked: [],
          stale: [],
          pending: ['NPPES_API'],
          gated: [],
          unavailable: [],
          accessRequired: [],
          reviewRequired: [],
          notDecisionGrade: [],
          previewOnly: [],
        },
        sources: ['NPPES_API'],
        domains: [],
        credentialCount: 0,
      },
      credentialsIncluded: [],
      receiptReferences: [],
      proofReferences: [],
    }));

    expect(contract.readinessScore).toBeNull();
    expect(contract.readinessStatus).toBe('Not yet scored');
    expect(contract.status).toBe('unknown');
    expect(contract.proofTier).toBe('none');
  });

  it('keeps the snapshot hash deterministic for the same review payload', () => {
    const payload = buildReviewPayload();

    const first = deriveApplyBundleContract(payload);
    const second = deriveApplyBundleContract(payload);

    expect(first.snapshotHash).toBe(second.snapshotHash);
    expect(first.snapshot.rawHash).toBe(second.snapshot.rawHash);
  });

  it('returns a frozen snapshot contract so application state cannot be mutated after creation', () => {
    const contract = deriveApplyBundleContract(buildReviewPayload());

    expect(Object.isFrozen(contract.snapshot)).toBe(true);
    expect(Object.isFrozen(contract.snapshot.claims)).toBe(true);
    expect(Object.isFrozen(contract.snapshot.limitations)).toBe(true);
  });
});
