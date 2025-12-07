/**
 * B150A-DSAR-004: Unit tests for erasure engine
 */

import { PrismaClient } from '@prisma/client';
import { ErasureEngine, ErasureScope } from '../erasureEngine';

// Mock Prisma client
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    npiClaim: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    credential: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    job: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    application: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    privilegeRequest: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    auditEvent: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    payerEnrollment: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

describe('ErasureEngine', () => {
  let prisma: jest.Mocked<PrismaClient>;
  let erasureEngine: ErasureEngine;

  beforeEach(() => {
    prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    erasureEngine = new ErasureEngine(prisma);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('executeErasure', () => {
    const mockUser = {
      id: 'user123',
      email: 'john@example.com',
      name: 'John Doe',
      phone: '555-1234',
      did: 'did:key:123',
    };

    beforeEach(() => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        npiClaims: [],
        credentials: [],
        jobs: [],
      });
    });

    it('should handle IDENTIFIERS scope', async () => {
      const result = await erasureEngine.executeErasure('user123', 'IDENTIFIERS');

      expect(result.scope).toBe('IDENTIFIERS');
      expect(result.subjectId).toBe('user123');
      expect(result.tablesProcessed).toContain('User');
      expect(result.recordsAnonymized).toBeGreaterThan(0);
    });

    it('should handle ACCOUNT scope', async () => {
      (prisma.credential.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.job.findMany as jest.Mock).mockResolvedValue([]);

      const result = await erasureEngine.executeErasure('user123', 'ACCOUNT');

      expect(result.scope).toBe('ACCOUNT');
      expect(result.tablesProcessed.length).toBeGreaterThan(0);
    });

    it('should handle ALL scope', async () => {
      (prisma.credential.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.job.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.application.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.privilegeRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.payerEnrollment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);

      const result = await erasureEngine.executeErasure('user123', 'ALL');

      expect(result.scope).toBe('ALL');
      expect(result.tablesProcessed.length).toBeGreaterThan(0);
    });

    it('should throw error if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        erasureEngine.executeErasure('nonexistent', 'IDENTIFIERS')
      ).rejects.toThrow('User not found');
    });

    it('should process NPI claims', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        npiClaims: [{ id: 'claim1', npi: '1234567890', userId: 'user123' }],
        credentials: [],
        jobs: [],
      });
      (prisma.npiClaim.update as jest.Mock).mockResolvedValue({});

      const result = await erasureEngine.executeErasure('user123', 'IDENTIFIERS');

      expect(prisma.npiClaim.update).toHaveBeenCalled();
      expect(result.tablesProcessed).toContain('NpiClaim');
    });

    it('should handle errors gracefully', async () => {
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        erasureEngine.executeErasure('user123', 'IDENTIFIERS')
      ).rejects.toThrow();

      // Result should include errors
      try {
        await erasureEngine.executeErasure('user123', 'IDENTIFIERS');
      } catch (error) {
        // Error is expected
      }
    });
  });
});

