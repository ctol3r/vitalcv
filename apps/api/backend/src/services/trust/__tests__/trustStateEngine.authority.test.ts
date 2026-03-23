jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: {
      findMany: jest.fn(),
    },
    vcvEntity: {
      findFirst: jest.fn(),
    },
    vcvCredential: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../credentials/credentialIngestionConfig', () => ({
  isCredentialIngestionEnabled: jest.fn(() => true),
}));

jest.mock('../../psv/oigLeieChecker', () => ({
  checkExclusion: jest.fn(),
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { computeClinicianTrustState } from '../trustStateEngine';

const prismaMock = prisma as unknown as {
  verificationArtifact: {
    findMany: jest.Mock;
  };
  vcvEntity: {
    findFirst: jest.Mock;
  };
  vcvCredential: {
    findMany: jest.Mock;
  };
};

function baseArtifacts() {
  return [
    {
      source: 'NPPES_API',
      status: 'ACTIVE',
      verifiedAt: new Date('2026-03-22T12:00:00.000Z'),
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      psvWindowDeadline: new Date('2099-01-01T00:00:00.000Z'),
      rawPayload: { provider_name: 'Jane Doe' },
    },
    {
      source: 'OIG_LEIE',
      status: 'CLEAR',
      verifiedAt: new Date('2026-03-22T12:00:00.000Z'),
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      psvWindowDeadline: new Date('2099-01-01T00:00:00.000Z'),
      rawPayload: { verdict: 'CLEAR' },
    },
    {
      source: 'PECOS_PUBLIC',
      status: 'VERIFIED',
      verifiedAt: new Date('2026-03-22T12:00:00.000Z'),
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      psvWindowDeadline: new Date('2099-01-01T00:00:00.000Z'),
      rawPayload: {
        _claims: [
          {
            claimType: 'ENROLLMENT_STATUS',
            value: { enrolled: true },
          },
        ],
      },
    },
  ];
}

describe('computeClinicianTrustState authority readiness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.verificationArtifact.findMany.mockResolvedValue(baseArtifacts());
    prismaMock.vcvEntity.findFirst.mockResolvedValue({ id: 'entity-1' });
    prismaMock.vcvCredential.findMany.mockResolvedValue([]);
  });

  it('hard-blocks readiness for disciplined license authority results', async () => {
    prismaMock.vcvCredential.findMany.mockResolvedValue([
      {
        id: 'cred-rn-discipline',
        domain: 'LICENSURE',
        status: 'SUSPENDED',
        credentialType: 'RN_LICENSE_TX',
        verifiedAt: new Date('2026-03-23T12:00:00.000Z'),
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        observedAt: new Date('2026-03-23T12:00:00.000Z'),
        metadata: {
          authorityClaimCode: 'RN_LICENSE_DISCIPLINED',
          sourceScope: 'NURSYS_AUTHORIZED_PATH',
          sourceId: 'NURSYS',
        },
        claimValue: {
          authorityClaimCode: 'RN_LICENSE_DISCIPLINED',
          sourceScope: 'NURSYS_AUTHORIZED_PATH',
        },
      },
    ]);

    const state = await computeClinicianTrustState('1234567890');

    expect(state.readiness_level).toBe('L0');
    expect(state.blockers).toContain('LICENSE_DISCIPLINED');
    expect(state.readiness_status).toBe('Blocked — license discipline requires resolution');
  });

  it('downgrades readiness to review when a board order is present', async () => {
    prismaMock.vcvCredential.findMany.mockResolvedValue([
      {
        id: 'cred-md-license',
        domain: 'LICENSURE',
        status: 'ACTIVE',
        credentialType: 'STATE_LICENSE_CA',
        verifiedAt: new Date('2026-03-23T12:00:00.000Z'),
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        observedAt: new Date('2026-03-23T12:00:00.000Z'),
        metadata: {
          authorityClaimCode: 'PHYSICIAN_LICENSE_ACTIVE',
          sourceScope: 'FSMB_MED_API',
          sourceId: 'FSMB',
        },
        claimValue: {
          authorityClaimCode: 'PHYSICIAN_LICENSE_ACTIVE',
          sourceScope: 'FSMB_MED_API',
        },
      },
      {
        id: 'cred-board-order',
        domain: 'LICENSURE',
        status: 'REVIEW_REQUIRED',
        credentialType: 'STATE_LICENSE_CA',
        verifiedAt: new Date('2026-03-23T12:00:00.000Z'),
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        observedAt: new Date('2026-03-23T12:00:00.000Z'),
        metadata: {
          authorityClaimCode: 'BOARD_ORDER_PRESENT',
          sourceScope: 'FSMB_PDC',
          sourceId: 'FSMB',
          boardOrderSeverity: 'MEDIUM',
        },
        claimValue: {
          authorityClaimCode: 'BOARD_ORDER_PRESENT',
          sourceScope: 'FSMB_PDC',
          boardOrderSeverity: 'MEDIUM',
        },
      },
    ]);

    const state = await computeClinicianTrustState('1234567890');

    expect(state.readiness_level).toBe('L1');
    expect(state.reviewRequired).toBe(true);
    expect(state.blockers).toContain('BOARD_ORDER_REVIEW');
    expect(state.readiness_status).toBe('Review required — board order requires adjudication');
    expect(state.readiness_score).toBeLessThanOrEqual(59);
  });

  it('keeps unavailable authority licensure unresolved with no fake positive contribution', async () => {
    prismaMock.vcvCredential.findMany.mockResolvedValue([
      {
        id: 'cred-authority-unavailable',
        domain: 'LICENSURE',
        status: 'UNRESOLVED',
        credentialType: 'AUTHORITY_UNAVAILABLE_FSMB_MED_API',
        verifiedAt: new Date('2026-03-23T12:00:00.000Z'),
        expiresAt: null,
        observedAt: new Date('2026-03-23T12:00:00.000Z'),
        metadata: {
          authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
          sourceScope: 'FSMB_MED_API',
          sourceId: 'FSMB',
        },
        claimValue: {
          authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
          sourceScope: 'FSMB_MED_API',
        },
      },
    ]);

    const state = await computeClinicianTrustState('1234567890');

    expect(state.licensureStatus).toBe('unknown');
    expect(state.readiness_level).toBe('L1');
    expect(state.readiness_status).toBe('Unresolved — authority source unavailable for licensure');
    expect(state.gap_summary).toContain('Authority source unavailable: FSMB_MED_API licensure unresolved');
    expect(state.readiness_score).toBeLessThanOrEqual(59);
  });
});
