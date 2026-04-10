jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    vcvEntity: {
      findFirst: jest.fn(),
    },
    trustedIssuer: {
      findMany: jest.fn(),
    },
    verificationArtifact: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../entity/employerReviewPayload', () => ({
  buildEmployerReviewPayload: jest.fn(),
}));

jest.mock('../../revenue/revenueValidationService', () => ({
  recordValidationEvent: jest.fn(),
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { buildEmployerReviewPayload } from '../../entity/employerReviewPayload';
import { recordValidationEvent } from '../../revenue/revenueValidationService';
import { generateApplyBundle } from '../applyBundle';

const prismaMock = prisma as unknown as {
  vcvEntity: { findFirst: jest.Mock };
  trustedIssuer: { findMany: jest.Mock };
  verificationArtifact: { create: jest.Mock };
};

const buildEmployerReviewPayloadMock = buildEmployerReviewPayload as jest.MockedFunction<typeof buildEmployerReviewPayload>;
const recordValidationEventMock = recordValidationEvent as jest.MockedFunction<typeof recordValidationEvent>;

describe('generateApplyBundle', () => {
  beforeEach(() => {
    prismaMock.vcvEntity.findFirst.mockReset();
    prismaMock.trustedIssuer.findMany.mockReset();
    prismaMock.verificationArtifact.create.mockReset();
    buildEmployerReviewPayloadMock.mockReset();
    recordValidationEventMock.mockReset();

    prismaMock.vcvEntity.findFirst.mockResolvedValue({
      id: 'entity-1',
      displayName: 'Dr. Ada Lovelace',
    });

    prismaMock.trustedIssuer.findMany.mockResolvedValue([
      { id: 'issuer-1', name: 'California Medical Board', trustScore: 96 },
    ]);

    prismaMock.verificationArtifact.create.mockResolvedValue({ id: 'artifact-1' });

    buildEmployerReviewPayloadMock.mockResolvedValue({
      identitySummary: {
        entityId: 'entity-1',
        displayName: 'Dr. Ada Lovelace',
        entityType: 'INDIVIDUAL',
      },
      credentialsIncluded: [
        {
          credentialId: 'cred-1',
          credentialType: 'LICENSE',
          domain: 'LICENSURE',
          issuerName: 'California Medical Board',
          status: 'ACTIVE',
          verificationLevel: 'PRIMARY_SOURCE',
          artifactIds: ['artifact-1'],
          receiptIds: ['receipt-1'],
          observedAt: '2026-04-10T00:00:00.000Z',
          expiresAt: '2027-04-10T00:00:00.000Z',
        },
      ],
      readinessSummary: {
        level: 'L3',
        score: 88,
        readiness_score: 88,
        status: 'READY',
        blockers: [],
        gaps: [],
        nextActions: [],
        estimatedStartDays: 5,
      },
      checkedAt: '2026-04-10T00:00:00.000Z',
      sourceCoverage: {
        summary: {
          checked: ['NPPES', 'OIG', 'STATE_BOARD'],
          pending: [],
          stale: [],
          unavailable: [],
          reviewRequired: [],
          gated: [],
          accessRequired: [],
          notDecisionGrade: [],
          previewOnly: [],
        },
      },
    } as unknown as Awaited<ReturnType<typeof buildEmployerReviewPayload>>);

    recordValidationEventMock.mockResolvedValue({
      id: 'validation-1',
      eventName: 'bundle_generated',
      bundleId: 'bundle-placeholder',
      npi: '1234567890',
      organizationId: null,
      orgName: null,
      contact: null,
      notes: null,
      value: null,
      time_saved_days: null,
      metadata: {},
      createdAt: '2026-04-10T00:00:00.000Z',
    });
  });

  test('bundle triggers validation event', async () => {
    const bundle = await generateApplyBundle('1234567890');

    expect(recordValidationEventMock).toHaveBeenCalledTimes(1);
    expect(recordValidationEventMock).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'bundle_generated',
      bundleId: bundle.bundleId,
      npi: '1234567890',
      metadata: expect.objectContaining({
        credentialCount: 1,
        readiness_score: 88,
      }),
    }));
  });
});
