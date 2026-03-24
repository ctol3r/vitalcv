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

type PecosEnrollmentClaimValue = {
  claimState: string;
  enrolled: boolean | null;
};

function baseArtifacts(): Array<{
  source: string;
  status: string;
  verifiedAt: Date;
  expiresAt: Date;
  psvWindowDeadline: Date;
  rawPayload: Record<string, unknown>;
}> {
  const pecosClaimValue: PecosEnrollmentClaimValue = {
    claimState: 'ENROLLED',
    enrolled: true,
  };

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
            value: pecosClaimValue,
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
          jurisdiction: 'CA',
        },
        claimValue: {
          authorityClaimCode: 'PHYSICIAN_LICENSE_ACTIVE',
          sourceScope: 'FSMB_MED_API',
          state: 'CA',
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
          jurisdiction: 'CA',
        },
        claimValue: {
          authorityClaimCode: 'BOARD_ORDER_PRESENT',
          sourceScope: 'FSMB_PDC',
          boardOrderSeverity: 'MEDIUM',
          state: 'CA',
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
          jurisdiction: 'CA',
        },
        claimValue: {
          authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
          sourceScope: 'FSMB_MED_API',
          jurisdiction: 'CA',
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

  it('only lets the CA physician licensure lane affect readiness when access is unavailable', async () => {
    prismaMock.vcvCredential.findMany.mockResolvedValue([
      {
        id: 'cred-ca-manual',
        domain: 'LICENSURE',
        status: 'UNRESOLVED',
        credentialType: 'AUTHORITY_UNAVAILABLE_STATE_BOARD_MANUAL',
        verifiedAt: new Date('2026-03-23T12:00:00.000Z'),
        expiresAt: null,
        observedAt: new Date('2026-03-23T12:00:00.000Z'),
        metadata: {
          authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
          sourceScope: 'STATE_BOARD_MANUAL',
          sourceId: 'STATE_BOARD',
          participationStatus: 'institution_access_unavailable',
        },
        claimValue: {
          authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
          sourceScope: 'STATE_BOARD_MANUAL',
          jurisdiction: 'CA',
          participationStatus: 'institution_access_unavailable',
        },
      },
    ]);

    const state = await computeClinicianTrustState('1234567890');

    expect(state.readiness_status).toBe('Unresolved — authority source unavailable for licensure');
    expect(state.gap_summary).toContain('Authority source unavailable: STATE_BOARD_MANUAL licensure unresolved');
  });

  it('does not let unsupported physician states drag readiness into the launch lane', async () => {
    prismaMock.vcvCredential.findMany.mockResolvedValue([
      {
        id: 'cred-tx-manual',
        domain: 'LICENSURE',
        status: 'UNRESOLVED',
        credentialType: 'AUTHORITY_UNAVAILABLE_STATE_BOARD_MANUAL',
        verifiedAt: new Date('2026-03-23T12:00:00.000Z'),
        expiresAt: null,
        observedAt: new Date('2026-03-23T12:00:00.000Z'),
        metadata: {
          authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
          sourceScope: 'STATE_BOARD_MANUAL',
          sourceId: 'STATE_BOARD',
          participationStatus: 'manual_verification_required',
        },
        claimValue: {
          authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
          sourceScope: 'STATE_BOARD_MANUAL',
          jurisdiction: 'TX',
          participationStatus: 'manual_verification_required',
        },
      },
    ]);

    const state = await computeClinicianTrustState('1234567890');

    expect(state.readiness_status).not.toBe('Unresolved — authority source unavailable for licensure');
    expect(state.gap_summary).not.toContain('Authority source unavailable: STATE_BOARD_MANUAL licensure unresolved');
  });

  it('treats PECOS not-found as a blocker without implying real-time disenrollment', async () => {
    const artifacts = baseArtifacts();
    artifacts[2] = {
      ...artifacts[2],
      status: 'NOT_FOUND',
      rawPayload: {
        _claims: [
          {
            claimType: 'ENROLLMENT_STATUS',
            value: { claimState: 'NOT_FOUND', enrolled: false },
          },
        ],
      },
    };
    prismaMock.verificationArtifact.findMany.mockResolvedValue(artifacts);

    const state = await computeClinicianTrustState('1234567890');

    expect(state.pecosStatus).toBe('NOT_FOUND');
    expect(state.readiness_status).toBe('Blocked — PECOS quarterly enrollment not found');
    expect(state.blockers).toContain('PECOS quarterly enrollment not found');
    expect(state.readiness_score).toBeLessThanOrEqual(59);
  });

  it('treats PECOS unknown as unresolved instead of not-found', async () => {
    const artifacts = baseArtifacts();
    artifacts[2] = {
      ...artifacts[2],
      status: 'ACTIVE',
      rawPayload: {
        _claims: [
          {
            claimType: 'ENROLLMENT_STATUS',
            value: { claimState: 'UNKNOWN', enrolled: null },
          },
        ],
      },
    };
    prismaMock.verificationArtifact.findMany.mockResolvedValue(artifacts);

    const state = await computeClinicianTrustState('1234567890');

    expect(state.pecosStatus).toBe('UNKNOWN');
    expect(state.readiness_status).toBe('Unresolved — PECOS enrollment outcome is unknown');
    expect(state.blockers).not.toContain('PECOS quarterly enrollment not found');
    expect(state.gap_summary).toContain('PECOS enrollment outcome unresolved');
    expect(state.readiness_score).toBeLessThanOrEqual(59);
  });

  it('treats stale PECOS snapshots as refresh-required instead of a fresh enrolled truth', async () => {
    const artifacts = baseArtifacts();
    artifacts[2] = {
      ...artifacts[2],
      rawPayload: {
        revalidationDue: '2000-01-01T00:00:00.000Z',
        _claims: [
          {
            claimType: 'ENROLLMENT_STATUS',
            value: {
              claimState: 'ENROLLED',
              enrolled: true,
              observedAt: '2025-01-01T00:00:00.000Z',
            },
          },
        ],
      },
    };
    prismaMock.verificationArtifact.findMany.mockResolvedValue(artifacts);

    const state = await computeClinicianTrustState('1234567890');

    expect(state.pecosStatus).toBe('UNKNOWN');
    expect(state.readiness_status).toBe('Unresolved — PECOS enrollment outcome is unknown');
    expect(state.gap_summary).toContain('PECOS enrollment verification stale');
    expect(state.sourceCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'PECOS_PUBLIC',
          state: 'stale',
          reason: 'PECOS evidence is stale and must be refreshed',
        }),
      ]),
    );
  });

  it('excludes mock PECOS coverage from decision-grade trust', async () => {
    const artifacts = baseArtifacts();
    artifacts[2] = {
      ...artifacts[2],
      status: 'VERIFIED',
      rawPayload: {
        source: 'mock-pecos-provider',
        _claims: [
          {
            claimType: 'ENROLLMENT_STATUS',
            value: { claimState: 'ENROLLED', enrolled: true },
          },
        ],
      },
    };
    prismaMock.verificationArtifact.findMany.mockResolvedValue(artifacts);

    const state = await computeClinicianTrustState('1234567890');

    expect(state.pecosStatus).toBe('ENROLLED');
    expect(state.readiness_level).toBe('L1');
    expect(state.gap_summary).toContain('PECOS evidence is mock and excluded from decision-grade trust');
    expect(state.readiness_score).toBeLessThanOrEqual(59);
  });
});
