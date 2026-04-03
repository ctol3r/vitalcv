jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    vcvOrganizationContext: {
      findUnique: jest.fn(),
    },
    vcvCredential: {
      findMany: jest.fn(),
    },
    verificationArtifact: {
      findMany: jest.fn(),
    },
    verificationReceiptRecord: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../passportService', () => ({
  buildPassport: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import {
  createCanonicalSourceCoverage,
  createCanonicalTruth,
  summarizeCanonicalSourceCoverage,
} from '@vitalcv/trust-state';
import { buildEmployerReviewPayload } from '../employerReviewPayload';
import { buildPassport, type TrustPassport } from '../passportService';

const prismaMock = prisma as unknown as {
  vcvOrganizationContext: { findUnique: jest.Mock };
  vcvCredential: { findMany: jest.Mock };
  verificationArtifact: { findMany: jest.Mock };
  verificationReceiptRecord: { findMany: jest.Mock };
};

const buildPassportMock = buildPassport as jest.MockedFunction<typeof buildPassport>;

describe('employerReviewPayload', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const checks = [
      createCanonicalSourceCoverage({
        sourceId: 'STATE_BOARD',
        state: 'checked',
        reason: 'Licensure checked',
        checkedAt: '2026-03-20T12:20:00.000Z',
        proof: {
          artifactIds: ['11111111-1111-4111-8111-111111111111'],
          receiptIds: ['receipt-license'],
        },
      }),
    ];

    const passport: TrustPassport = {
      entityId: 'entity-1',
      npi: '1558302470',
      identity: {
        entityId: 'entity-1',
        displayName: 'Ada Lovelace',
        npi: '1558302470',
        specialty: 'Family Medicine',
        entityType: 'PERSON',
        status: 'ACTIVE',
      },
      authority: {
        credentials: [
          {
            id: 'cred-license',
            domain: 'LICENSURE',
            type: 'STATE_LICENSE',
            status: 'ACTIVE',
            verificationLevel: 'SOURCE_VERIFIED',
            issuerEntityId: 'issuer-1',
            issuerName: 'Medical Board of California',
            sourceId: 'STATE_BOARD',
            jurisdiction: 'CA',
            verifiedAt: '2026-03-20T12:20:00.000Z',
            observedAt: '2026-03-20T12:20:00.000Z',
            stale: false,
            confidenceLabel: 'High confidence',
            claimConfidenceLabel: 'High confidence',
            dataFreshness: 'current',
            dataFreshnessLabel: 'Current attached record',
            reviewRequired: false,
          },
        ],
        summary: {
          active: 1,
          expired: 0,
          stale: 0,
          missing: [],
        },
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
        exclusionCheckedAt: '2026-03-20T12:20:00.000Z',
        exclusionConfidenceLabel: 'High confidence',
        licensureStatus: 'verified',
        deaStatus: 'unknown',
        pecosStatus: 'enrolled',
        pecosEnrollmentStatus: 'ENROLLED',
        enrollmentSourceLabel: 'CMS PECOS',
        enrollmentDataFreshness: 'Quarterly',
        enrollmentSourceLatency: 'Quarterly release',
        enrollmentNote: null,
        enrollmentObservedAt: '2026-03-01T00:00:00.000Z',
        enrollmentDataVersion: '2026-Q1',
        enrollmentStatusLabel: 'Enrolled',
        enrollmentFreshnessLabel: 'Current quarterly release',
        enrollmentConfidenceLabel: 'High confidence',
        negativeFindings: [],
      },
      readiness: {
        status: 'READY',
        score: 100,
        readiness_score: 100,
        level: 'L3',
        blockers: [],
        gaps: [],
        nextActions: [],
        estimatedStartDays: 0,
      },
      sources: {
        checked: ['STATE_BOARD'],
        lastFetch: {
          STATE_BOARD: '2026-03-20T12:20:00.000Z',
        },
      },
      sourceCoverage: {
        checks,
        summary: summarizeCanonicalSourceCoverage(checks),
      },
      truth: {
        identity: createCanonicalTruth({
          kind: 'verification',
          satisfied: true,
          coverage: checks[0],
        }),
        authority: createCanonicalTruth({
          kind: 'verification',
          satisfied: true,
          coverage: checks[0],
        }),
        safety: createCanonicalTruth({
          kind: 'clearance',
          satisfied: true,
          coverage: checks[0],
        }),
        eligibility: createCanonicalTruth({
          kind: 'enrollment',
          satisfied: true,
          coverage: checks[0],
        }),
      },
      trustPosture: {
        band: 'L3',
        bandLabel: 'High trust',
        score: 100,
        dimensions: [],
        freshness: {
          state: 'current',
          label: 'Current',
          items: [],
        },
        safeToRelyOnNow: [],
        missingItems: [],
        gatedItems: [],
        reviewRequiredItems: [],
        staleItems: [],
        blockers: [],
      },
      lastCheckedAt: '2026-03-20T12:30:00.000Z',
    };

    buildPassportMock.mockResolvedValue(passport);
    prismaMock.vcvOrganizationContext.findUnique.mockResolvedValue(null);
    prismaMock.vcvCredential.findMany.mockResolvedValue([
      {
        id: 'cred-license',
        subjectId: 'entity-1',
        issuerId: 'issuer-1',
        domain: 'LICENSURE',
        credentialType: 'STATE_LICENSE',
        status: 'ACTIVE',
        verificationLevel: 'SOURCE_VERIFIED',
        jurisdiction: 'CA',
        observedAt: new Date('2026-03-20T12:20:00.000Z'),
        expiresAt: new Date('2028-03-20T12:20:00.000Z'),
        artifactIds: ['11111111-1111-4111-8111-111111111111'],
        receiptIds: ['receipt-license'],
        issuer: {
          id: 'issuer-1',
          displayName: 'Medical Board of California',
        },
      },
    ]);
    prismaMock.verificationArtifact.findMany.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        source: 'STATE_BOARD',
      },
    ]);
    prismaMock.verificationReceiptRecord.findMany.mockResolvedValue([
      {
        receiptId: 'receipt-license',
        sourceArtifactId: '11111111-1111-4111-8111-111111111111',
        verificationArtifactId: null,
      },
    ]);
  });

  it('keeps string receipt ids public-safe when they link to a valid artifact', async () => {
    const payload = await buildEmployerReviewPayload({
      entityId: 'entity-1',
    });

    expect(payload.credentialsIncluded).toHaveLength(1);
    expect(payload.credentialsIncluded[0]).toEqual(expect.objectContaining({
      credentialId: 'cred-license',
      receiptIds: ['receipt-license'],
      artifactIds: ['11111111-1111-4111-8111-111111111111'],
    }));
    expect(payload.receiptReferences).toEqual(['receipt-license']);
    expect(payload.sourceCoverage.credentialCount).toBe(1);
  });
});
