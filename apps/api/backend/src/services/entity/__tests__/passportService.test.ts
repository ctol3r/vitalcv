jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    vcvCredential: {
      findMany: jest.fn(),
    },
    vcvEducationRecord: {
      findMany: jest.fn(),
    },
    verificationArtifact: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../entityResolutionService', () => ({
  getEntityById: jest.fn(),
  resolveEntityFromNpi: jest.fn(),
}));

jest.mock('../../trust/trustStateEngine', () => ({
  getCachedTrustState: jest.fn(),
}));

jest.mock('../evidenceIntegrity', () => ({
  resolveCredentialEvidence: jest.fn(),
}));

jest.mock('../readinessActions', () => ({
  buildReadinessNextActions: jest.fn(() => []),
}));

jest.mock('../../seal/sealEventCapture', () => ({
  syncBlockerEvents: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import {
  createCanonicalSourceCoverage,
  summarizeCanonicalSourceCoverage,
} from '../../../../../../../packages/trust-state';
import prisma from '../../../graphql/prisma_client';
import { getEntityById } from '../entityResolutionService';
import { getCachedTrustState } from '../../trust/trustStateEngine';
import { resolveCredentialEvidence } from '../evidenceIntegrity';
import { buildPassport } from '../passportService';

const prismaMock = prisma as unknown as {
  vcvCredential: { findMany: jest.Mock };
  vcvEducationRecord: { findMany: jest.Mock };
  verificationArtifact: { findMany: jest.Mock };
};

function buildCredential(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cred-1',
    subjectId: 'entity-1',
    issuerId: null,
    domain: 'LICENSURE',
    status: 'ACTIVE',
    credentialType: 'STATE_LICENSE',
    verificationLevel: 'SOURCE_VERIFIED',
    jurisdiction: 'CA',
    issuedAt: null,
    expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    verifiedAt: new Date('2026-03-23T12:00:00.000Z'),
    observedAt: new Date('2026-03-23T12:00:00.000Z'),
    nextReverifyAt: null,
    metadata: {
      sourceId: 'STATE_BOARD',
      authorityClaimCode: 'PHYSICIAN_LICENSE_ACTIVE',
      claimConfidenceLabel: 'HIGH',
      dataFreshnessLabel: 'Weekly',
      sourceScope: 'STATE_BOARD_CA_API',
    },
    claimValue: {
      authorityClaimCode: 'PHYSICIAN_LICENSE_ACTIVE',
    },
    artifactIds: [],
    receiptIds: [],
    issuer: null,
    ...overrides,
  };
}

describe('passportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getEntityById as jest.Mock).mockResolvedValue({
      entity: {
        id: 'entity-1',
        displayName: 'Dr. Ada Lovelace',
        npi: '1234567890',
        entityType: 'PERSON',
        sourceIds: ['NPPES_API'],
        verifiedAt: new Date('2026-03-23T12:00:00.000Z'),
        metadata: {
          specialty: 'Family Medicine',
          status: 'ACTIVE',
        },
      },
      roles: [],
      relationships: [],
      credentials: [],
      routingEntry: '/get-ready',
      subjectLabel: 'Provider',
    });
    prismaMock.vcvCredential.findMany.mockResolvedValue([
      buildCredential(),
      buildCredential({
        id: 'cred-exclusion',
        domain: 'EXCLUSION_CHECK',
        credentialType: 'OIG_LEIE_CHECK',
        metadata: {
          sourceId: 'OIG_LEIE',
          claimState: 'CLEAR',
          claimConfidenceLabel: 'HIGH',
          dataFreshnessLabel: 'Daily',
        },
        claimValue: {
          claimState: 'CLEAR',
        },
      }),
      buildCredential({
        id: 'cred-pecos',
        domain: 'MEDICARE_ENROLLMENT',
        credentialType: 'PECOS_ENROLLMENT',
        metadata: {
          sourceId: 'PECOS_PUBLIC',
          claimState: 'ENROLLED',
          dataVersion: '2026-Q1',
          claimConfidenceLabel: 'HIGH',
          dataFreshnessLabel: 'Quarterly',
        },
        claimValue: {
          claimState: 'ENROLLED',
        },
      }),
    ]);
    prismaMock.vcvEducationRecord.findMany.mockResolvedValue([]);
    prismaMock.verificationArtifact.findMany.mockResolvedValue([]);
    (resolveCredentialEvidence as jest.Mock).mockReturnValue({
      publicSafe: true,
      validArtifactIds: [],
      validReceiptIds: [],
      issues: [],
    });
  });

  it('inherits trust-state source coverage and omits the old passport enrichment field', async () => {
    const checks = [
      createCanonicalSourceCoverage({
        sourceId: 'NPPES_API',
        state: 'live',
        reason: 'NPPES identity checked',
      }),
      createCanonicalSourceCoverage({
        sourceId: 'OIG_LEIE',
        state: 'live',
        reason: 'OIG LEIE check clear',
      }),
      createCanonicalSourceCoverage({
        sourceId: 'STATE_BOARD',
        state: 'accessRequired',
        reason: 'CA physician licensure lane requires live state-board or FSMB access',
      }),
      createCanonicalSourceCoverage({
        sourceId: 'PECOS_PUBLIC',
        state: 'stale',
        reason: 'PECOS evidence is stale and must be refreshed',
      }),
    ];
    (getCachedTrustState as jest.Mock).mockResolvedValue({
      licensureStatus: 'pending',
      exclusionStatus: 'CLEAR',
      pecosStatus: 'UNKNOWN',
      readiness_level: 'L1',
      readiness_score: 59,
      gap_summary: ['PECOS enrollment verification stale'],
      blockers: [],
      sourceCoverage: checks,
    });

    const passport = await buildPassport('entity-1');

    expect(passport).not.toBeNull();
    expect(passport?.sourceCoverage.summary).toEqual(summarizeCanonicalSourceCoverage(checks));
    expect(passport?.sourceCoverage.checks).toEqual(
      expect.arrayContaining(
        checks.map((check) => expect.objectContaining({
          sourceId: check.sourceId,
          state: check.state,
          reason: check.reason,
        })),
      ),
    );
    expect(passport?.readiness.gaps).toContain('PECOS enrollment verification stale');
    expect('enrichment' in (passport ?? {})).toBe(false);
  });

  it('builds explicit fallback source coverage with freshness windows when trust state is missing', async () => {
    prismaMock.vcvCredential.findMany.mockResolvedValue([
      buildCredential({
        id: 'cred-licensure-manual',
        status: 'UNRESOLVED',
        metadata: {
          sourceId: 'STATE_BOARD',
          authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
          participationStatus: 'manual_verification_required',
          claimConfidenceLabel: 'MEDIUM',
          dataFreshnessLabel: 'Weekly',
          sourceScope: 'STATE_BOARD_MANUAL',
        },
        claimValue: {
          authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
          participationStatus: 'manual_verification_required',
        },
      }),
    ]);
    (getCachedTrustState as jest.Mock).mockResolvedValue(null);

    const passport = await buildPassport('entity-1');
    const stateBoard = passport?.sourceCoverage.checks.find((check) => check.sourceId === 'STATE_BOARD');
    const nppes = passport?.sourceCoverage.checks.find((check) => check.sourceId === 'NPPES_API');
    const pecos = passport?.sourceCoverage.checks.find((check) => check.sourceId === 'PECOS_PUBLIC');

    expect(passport).not.toBeNull();
    expect(stateBoard).toEqual(expect.objectContaining({
      state: 'notDecisionGrade',
      freshnessWindowHours: 168,
    }));
    expect(nppes).toEqual(expect.objectContaining({
      state: 'live',
      freshnessWindowHours: 168,
    }));
    expect(pecos).toEqual(expect.objectContaining({
      state: 'notChecked',
      freshnessWindowHours: 2160,
    }));
  });
});
