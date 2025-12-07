/**
 * S72-STRETCH-E-001: OrgRevenueShare Model Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  upsertOrgRevenueShare,
  getOrgRevenueShare,
  deleteOrgRevenueShare,
  validateBasisPoints,
  validateGuarantees,
} from '../OrgRevenueShare';

// Mock Prisma client
const mockPrisma = {
  orgRevenueShare: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
} as unknown as PrismaClient;

describe('OrgRevenueShare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateBasisPoints', () => {
    it('should accept valid basisPoints (0-10000)', () => {
      expect(() => validateBasisPoints(0)).not.toThrow();
      expect(() => validateBasisPoints(5000)).not.toThrow();
      expect(() => validateBasisPoints(10000)).not.toThrow();
    });

    it('should reject negative basisPoints', () => {
      expect(() => validateBasisPoints(-1)).toThrow('basisPoints must be between 0 and 10000');
    });

    it('should reject basisPoints > 10000', () => {
      expect(() => validateBasisPoints(10001)).toThrow('basisPoints must be between 0 and 10000');
    });
  });

  describe('validateGuarantees', () => {
    it('should accept valid guarantees', () => {
      expect(() => validateGuarantees(1000, 2000)).not.toThrow();
      expect(() => validateGuarantees(undefined, 2000)).not.toThrow();
      expect(() => validateGuarantees(1000, undefined)).not.toThrow();
    });

    it('should reject negative minGuarantee', () => {
      expect(() => validateGuarantees(-1, undefined)).toThrow('minGuarantee must be non-negative');
    });

    it('should reject negative maxCap', () => {
      expect(() => validateGuarantees(undefined, -1)).toThrow('maxCap must be non-negative');
    });

    it('should reject minGuarantee > maxCap', () => {
      expect(() => validateGuarantees(2000, 1000)).toThrow('minGuarantee (2000) cannot exceed maxCap (1000)');
    });
  });

  describe('upsertOrgRevenueShare', () => {
    it('should create new revenue share config', async () => {
      const input = {
        orgId: 'org-1',
        basisPoints: 5000,
        minGuarantee: 1000,
        maxCap: 50000,
      };

      const mockResult = {
        id: 'rs-1',
        ...input,
        minGuarantee: 1000,
        maxCap: 50000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.orgRevenueShare.upsert as jest.Mock).mockResolvedValue(mockResult);

      const result = await upsertOrgRevenueShare(mockPrisma, input);

      expect(result).toEqual(mockResult);
      expect(mockPrisma.orgRevenueShare.upsert).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
        update: {
          basisPoints: 5000,
          minGuarantee: 1000,
          maxCap: 50000,
          updatedAt: expect.any(Date),
        },
        create: {
          orgId: 'org-1',
          basisPoints: 5000,
          minGuarantee: 1000,
          maxCap: 50000,
        },
      });
    });

    it('should reject invalid basisPoints', async () => {
      const input = {
        orgId: 'org-1',
        basisPoints: 10001,
      };

      await expect(upsertOrgRevenueShare(mockPrisma, input)).rejects.toThrow();
    });
  });

  describe('getOrgRevenueShare', () => {
    it('should return revenue share config', async () => {
      const mockResult = {
        id: 'rs-1',
        orgId: 'org-1',
        basisPoints: 5000,
        minGuarantee: 1000,
        maxCap: 50000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.orgRevenueShare.findUnique as jest.Mock).mockResolvedValue(mockResult);

      const result = await getOrgRevenueShare(mockPrisma, 'org-1');

      expect(result).toEqual(mockResult);
      expect(mockPrisma.orgRevenueShare.findUnique).toHaveBeenCalledWith({
        where: { orgId: 'org-1' },
      });
    });

    it('should return null if not found', async () => {
      (mockPrisma.orgRevenueShare.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await getOrgRevenueShare(mockPrisma, 'org-1');

      expect(result).toBeNull();
    });
  });
});

