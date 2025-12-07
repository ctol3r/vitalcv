import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { respondToPrivilegeDrift } from '../driftIntegration.js';

const mockPrisma = {
  privilegeGranted: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  fPPECase: {
    updateMany: jest.fn(),
    create: jest.fn(),
  },
  privilegeRenewal: {
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
} as any;

const basePrivilege = {
  id: 'priv-1',
  clinicianDid: 'did:key:abc',
  orgId: 'org-1',
  privilegeSetId: 'cardio-core',
};

describe('respondToPrivilegeDrift', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.privilegeGranted.findFirst.mockResolvedValue(basePrivilege);
  });

  it('holds privilege when expiration drift detected', async () => {
    const result = await respondToPrivilegeDrift(
      {
        type: 'PRIVILEGE_EXPIRED',
        severity: 'critical',
        clinicianDid: 'did:key:abc',
      },
      { prisma: mockPrisma }
    );

    expect(mockPrisma.privilegeGranted.update).toHaveBeenCalledWith({
      where: { id: 'priv-1' },
      data: expect.objectContaining({ status: 'HOLD' }),
    });
    expect(result?.actions).toContain('privilege_hold');
  });

  it('restarts FPPE case on FPPE failure drift', async () => {
    await respondToPrivilegeDrift(
      {
        type: 'PRIVILEGE_FPPE_FAILED',
        severity: 'critical',
        clinicianDid: 'did:key:abc',
      },
      { prisma: mockPrisma }
    );

    expect(mockPrisma.fPPECase.updateMany).toHaveBeenCalled();
    expect(mockPrisma.fPPECase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          privilegeGrantedId: 'priv-1',
          clinicianId: 'did:key:abc',
        }),
      })
    );
    expect(mockPrisma.privilegeGranted.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'priv-1' },
        data: expect.objectContaining({ fppeStatus: 'IN_REVIEW' }),
      })
    );
  });

  it('flags renewal as overdue when drift detected', async () => {
    mockPrisma.privilegeRenewal.findFirst.mockResolvedValue(null);

    await respondToPrivilegeDrift(
      {
        type: 'PRIVILEGE_RENEWAL_OVERDUE',
        severity: 'critical',
        clinicianDid: 'did:key:abc',
      },
      { prisma: mockPrisma }
    );

    expect(mockPrisma.privilegeRenewal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          privilegeGrantedId: 'priv-1',
          status: 'OVERDUE',
        }),
      })
    );
  });
});

