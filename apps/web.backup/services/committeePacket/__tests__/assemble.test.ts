import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('@prisma/client', () => {
  const mockData: Record<string, any> = {
    clinicianProfile: {
      id: 'clin-1',
      userId: 'user-1',
      npi: '1234567890',
      specialty: 'Internal Medicine',
      state: 'CA',
      user: { id: 'user-1', name: 'Dr. Example', roles: ['CLINICIAN'], did: 'did:example:123' },
      caqhProfiles: [{ caqhId: 'CAQH123', fields: {} }],
    },
    npiClaim: [{ level: 2, tags: { signals: ['verified'] } }],
    stateLicenseVerification: [
      {
        state: 'CA',
        licenseNumber: 'A12345',
        status: 'ACTIVE',
        issueDate: new Date('2020-01-01'),
        expiryDate: new Date('2025-01-01'),
        disciplinaryFlag: false,
        updatedAt: new Date(),
      },
    ],
    credential: [
      {
        id: 'cred-board',
        type: 'BoardCertification',
        status: 'ACTIVE',
        issuedAt: new Date('2021-01-01'),
        expiresAt: new Date('2026-01-01'),
        issuer: 'ABIM',
        name: 'Internal Medicine',
        createdAt: new Date('2021-01-01'),
      },
      {
        id: 'cred-dea',
        type: 'DEARegistration',
        status: 'ACTIVE',
        issuedAt: new Date('2022-01-01'),
        expiresAt: new Date('2025-01-01'),
        issuer: 'DEA',
        name: 'DEA',
        createdAt: new Date('2022-01-01'),
      },
    ],
    payerEnrollmentV2: [
      {
        id: 'enroll-1',
        clinicianId: 'clin-1',
        payerId: 'AETNA',
        payer: { id: 'payer-1', name: 'Aetna', payerId: 'AETNA', requiresCaqh: true, specialty: [], states: ['CA'] },
        status: 'PENDING',
        panelType: 'OPEN',
        effectiveDate: new Date('2024-01-01'),
        metadata: null,
        updatedAt: new Date('2024-05-01'),
        lastStatusChange: null,
        notes: null,
        createdAt: new Date('2024-01-01'),
      },
    ],
    privilegeRequest: [
      {
        id: 'priv-req-1',
        clinicianDid: 'did:example:123',
        privilegeSetId: 'set-1',
        privilegeSet: { name: 'Core Privileges' },
        status: 'PENDING',
        reviewerDid: null,
        createdAt: new Date('2024-02-01'),
        reviewedAt: null,
      },
    ],
    privilegeGranted: [
      {
        id: 'priv-grant-1',
        clinicianDid: 'did:example:123',
        privilegeSetId: 'set-1',
        status: 'ACTIVE',
        grantedAt: new Date('2024-03-01'),
        expiresAt: new Date('2025-03-01'),
        renewalDue: new Date('2025-02-01'),
        updatedAt: new Date('2024-03-15'),
        renewals: [],
      },
    ],
    fppeOppe: [
      {
        id: 'fppe-1',
        clinicianDid: 'did:example:123',
        fppeStatus: 'IN_PROGRESS',
        oppeStatus: 'ACTIVE',
        notes: 'Reviewing cases',
        oppeNextReviewDue: new Date('2024-12-01'),
        fppeEndDate: null,
        fppeStartDate: new Date('2024-01-15'),
        updatedAt: new Date('2024-05-01'),
      },
    ],
  };

  class MockPrismaClient {
    clinicianProfile = {
      findUnique: jest.fn().mockResolvedValue(mockData.clinicianProfile),
    };
    npiClaim = {
      findMany: jest.fn().mockResolvedValue(mockData.npiClaim),
    };
    stateLicenseVerification = {
      findMany: jest.fn().mockResolvedValue(mockData.stateLicenseVerification),
    };
    credential = {
      findMany: jest.fn(({ where }: any) => {
        if (where.type?.contains?.toLowerCase().includes('dea')) {
          return Promise.resolve([mockData.credential[1]]);
        }
        return Promise.resolve([mockData.credential[0]]);
      }),
    };
    payerEnrollmentV2 = {
      findMany: jest.fn().mockResolvedValue(mockData.payerEnrollmentV2),
    };
    privilegeRequest = {
      findMany: jest.fn().mockResolvedValue(mockData.privilegeRequest),
    };
    privilegeGranted = {
      findMany: jest.fn().mockResolvedValue(mockData.privilegeGranted),
    };
    fppeOppe = {
      findMany: jest.fn().mockResolvedValue(mockData.fppeOppe),
    };
    committeePacket = {
      create: jest.fn(),
    };
  }

  return {
    PrismaClient: MockPrismaClient,
    PayerEnrollmentV2Status: {
      PENDING: 'PENDING',
      ATTEMPTING: 'ATTEMPTING',
      ENROLLED: 'ENROLLED',
      PANEL_FULL: 'PANEL_FULL',
      REJECTED: 'REJECTED',
      REVALIDATION_DUE: 'REVALIDATION_DUE',
    },
    CommitteePacketStatus: {
      GENERATED: 'GENERATED',
      REGENERATED: 'REGENERATED',
      EXPORTED: 'EXPORTED',
      SUBMITTED: 'SUBMITTED',
    },
  };
});

jest.mock('../../timeline/getClinicianTimeline', () => ({
  loadClinicianWithUser: jest.fn().mockResolvedValue({
    id: 'clin-1',
    npi: '1234567890',
    user: { id: 'user-1', did: 'did:example:123', roles: ['CLINICIAN'], name: 'Dr. Example' },
  }),
  buildClinicianTimeline: jest.fn().mockResolvedValue({
    events: [
      {
        id: 'event-1',
        phase: 'identity',
        title: 'Identity verified',
        timestamp: new Date('2024-01-01'),
        status: 'completed',
        metadata: {},
      },
    ],
    phaseGroups: [
      {
        phase: 'identity',
        events: [
          {
            id: 'event-1',
            timestamp: new Date('2024-01-01'),
          },
        ],
      },
    ],
  }),
}));

jest.mock('../../psv/evidenceBundle', () => ({
  getPecosSummaryForClinician: jest.fn().mockResolvedValue({
    clinicianId: 'clin-1',
    provider: { providerId: 'pecos-1', status: 'ENROLLED' },
    documents: [],
    enrollments: [],
  }),
  getCredentialRiskSummary: jest.fn().mockResolvedValue({
    clinicianId: 'clin-1',
    score: 12,
    factors: ['LICENSE_EXPIRED'],
    updatedAt: new Date('2024-05-01').toISOString(),
  }),
}));

import { assembleCommitteePacket } from '../assemble';

describe('CommitteePacketAssembler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aggregates clinician sections into packet document', async () => {
    const document = await assembleCommitteePacket({ clinicianId: 'clin-1', includeTimeline: true });
    expect(document.clinicianId).toBe('clin-1');
    expect(document.sections.identity.fullName).toBe('Dr. Example');
    expect(document.sections.licensure).toHaveLength(1);
    expect(document.sections.boardCertifications[0].issuer).toBe('ABIM');
    expect(document.sections.dea[0].issuer).toBe('DEA');
    expect(document.sections.payerEnrollments[0].payerName).toBe('Aetna');
    expect(document.sections.privileges.requests).toHaveLength(1);
    expect(document.sections.timeline.events[0].title).toContain('Identity');
  });
});

