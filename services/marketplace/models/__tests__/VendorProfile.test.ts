/**
 * B223A-MARKET-002: VendorProfile Model Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PrismaClient, KYCStatus } from '@prisma/client';
import {
  createVendorProfile,
  getVendorProfile,
  getVendorProfileByDid,
  updateVendorProfile,
  updateKYCStatus,
  updateReputationScore,
  validateVendorInput,
} from '../VendorProfile';

// Mock Prisma client
const mockPrisma = {
  vendorProfile: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

describe('VendorProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateVendorInput', () => {
    it('should accept valid vendor input', () => {
      expect(() =>
        validateVendorInput({
          vendorId: 'vendor-1',
          name: 'Test Vendor',
          contactInfo: { email: 'test@example.com' },
        })
      ).not.toThrow();
    });

    it('should reject missing vendorId', () => {
      expect(() =>
        validateVendorInput({
          vendorId: '',
          name: 'Test Vendor',
        })
      ).toThrow('vendorId is required');
    });

    it('should reject missing name', () => {
      expect(() =>
        validateVendorInput({
          vendorId: 'vendor-1',
          name: '',
        })
      ).toThrow('name is required');
    });

    it('should reject invalid reputationScore', () => {
      expect(() =>
        validateVendorInput({
          vendorId: 'vendor-1',
          name: 'Test Vendor',
          reputationScore: 150,
        })
      ).toThrow('reputationScore must be between 0 and 100');
    });
  });

  describe('createVendorProfile', () => {
    it('should create vendor profile with all fields', async () => {
      const input = {
        vendorId: 'vendor-1',
        did: 'did:example:123',
        name: 'Test Vendor',
        contactInfo: { email: 'test@example.com', phone: '123-456-7890' },
        kycStatus: KYCStatus.VERIFIED,
        reputationScore: 85,
      };

      const mockResult = {
        id: 'profile-1',
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.vendorProfile.create as jest.Mock).mockResolvedValue(mockResult);

      const result = await createVendorProfile(mockPrisma, input);

      expect(result).toEqual(mockResult);
      expect(mockPrisma.vendorProfile.create).toHaveBeenCalledWith({
        data: {
          vendorId: input.vendorId,
          did: input.did,
          name: input.name,
          contactInfo: input.contactInfo,
          kycStatus: KYCStatus.VERIFIED,
          reputationScore: 85,
        },
      });
    });

    it('should create vendor profile with defaults', async () => {
      const input = {
        vendorId: 'vendor-1',
        name: 'Test Vendor',
      };

      const mockResult = {
        id: 'profile-1',
        ...input,
        did: null,
        contactInfo: null,
        kycStatus: KYCStatus.PENDING,
        reputationScore: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.vendorProfile.create as jest.Mock).mockResolvedValue(mockResult);

      const result = await createVendorProfile(mockPrisma, input);

      expect(result).toEqual(mockResult);
      expect(mockPrisma.vendorProfile.create).toHaveBeenCalledWith({
        data: {
          vendorId: input.vendorId,
          did: null,
          name: input.name,
          contactInfo: null,
          kycStatus: KYCStatus.PENDING,
          reputationScore: 0,
        },
      });
    });
  });

  describe('getVendorProfile', () => {
    it('should get vendor profile by vendorId', async () => {
      const mockResult = {
        id: 'profile-1',
        vendorId: 'vendor-1',
        name: 'Test Vendor',
        did: 'did:example:123',
        contactInfo: { email: 'test@example.com' },
        kycStatus: KYCStatus.VERIFIED,
        reputationScore: 85,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue(mockResult);

      const result = await getVendorProfile(mockPrisma, 'vendor-1');

      expect(result).toEqual(mockResult);
      expect(mockPrisma.vendorProfile.findUnique).toHaveBeenCalledWith({
        where: { vendorId: 'vendor-1' },
      });
    });
  });

  describe('updateKYCStatus', () => {
    it('should update KYC status', async () => {
      const mockResult = {
        id: 'profile-1',
        kycStatus: KYCStatus.VERIFIED,
      } as any;

      (mockPrisma.vendorProfile.update as jest.Mock).mockResolvedValue(mockResult);

      const result = await updateKYCStatus(mockPrisma, 'vendor-1', KYCStatus.VERIFIED);

      expect(result).toEqual(mockResult);
      expect(mockPrisma.vendorProfile.update).toHaveBeenCalledWith({
        where: { vendorId: 'vendor-1' },
        data: { kycStatus: KYCStatus.VERIFIED },
      });
    });
  });

  describe('updateReputationScore', () => {
    it('should update reputation score', async () => {
      const mockResult = {
        id: 'profile-1',
        reputationScore: 90,
      } as any;

      (mockPrisma.vendorProfile.update as jest.Mock).mockResolvedValue(mockResult);

      const result = await updateReputationScore(mockPrisma, 'vendor-1', 90);

      expect(result).toEqual(mockResult);
      expect(mockPrisma.vendorProfile.update).toHaveBeenCalledWith({
        where: { vendorId: 'vendor-1' },
        data: { reputationScore: 90 },
      });
    });

    it('should reject invalid reputation score', async () => {
      await expect(updateReputationScore(mockPrisma, 'vendor-1', 150)).rejects.toThrow(
        'reputationScore must be between 0 and 100'
      );
    });
  });
});

