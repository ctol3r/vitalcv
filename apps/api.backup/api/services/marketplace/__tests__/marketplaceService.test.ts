/**
 * B223A-MARKET-003: MarketplaceService Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PrismaClient, ApprovalStatus, LicenseType, KYCStatus } from '@prisma/client';
import { MarketplaceService } from '../marketplaceService';
import * as VendorProfile from '../models/VendorProfile';
import * as MarketplaceModule from '../models/MarketplaceModule';

// Mock Prisma client
const mockPrisma = {
  marketplaceModule: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  vendorProfile: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('MarketplaceService', () => {
  let service: MarketplaceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketplaceService(mockPrisma);
  });

  describe('listModules', () => {
    it('should list modules with filters', async () => {
      const mockModules = [
        {
          id: 'module-1',
          name: 'Test Module',
          vendorId: 'vendor-1',
          approvalStatus: ApprovalStatus.APPROVED,
          vendor: {
            id: 'profile-1',
            vendorId: 'vendor-1',
            name: 'Test Vendor',
            kycStatus: KYCStatus.VERIFIED,
            reputationScore: 85,
          },
        },
      ];

      (mockPrisma.marketplaceModule.findMany as jest.Mock).mockResolvedValue(mockModules);
      (mockPrisma.marketplaceModule.count as jest.Mock).mockResolvedValue(1);

      const result = await service.listModules(
        { approvalStatus: ApprovalStatus.APPROVED },
        { limit: 10, offset: 0 }
      );

      expect(result.modules).toEqual(mockModules);
      expect(result.total).toBe(1);
      expect(mockPrisma.marketplaceModule.findMany).toHaveBeenCalled();
    });
  });

  describe('searchModules', () => {
    it('should search modules by query', async () => {
      const mockModules = [
        {
          id: 'module-1',
          name: 'Test Module',
          description: 'A test module',
          vendorId: 'vendor-1',
          vendor: {
            id: 'profile-1',
            vendorId: 'vendor-1',
            name: 'Test Vendor',
            kycStatus: KYCStatus.VERIFIED,
            reputationScore: 85,
          },
        },
      ];

      (mockPrisma.marketplaceModule.findMany as jest.Mock).mockResolvedValue(mockModules);
      (mockPrisma.marketplaceModule.count as jest.Mock).mockResolvedValue(1);

      const result = await service.searchModules('test');

      expect(result.modules).toEqual(mockModules);
      expect(result.total).toBe(1);
    });
  });

  describe('registerVendor', () => {
    it('should register a new vendor', async () => {
      const input = {
        vendorId: 'vendor-1',
        name: 'Test Vendor',
        did: 'did:example:123',
      };

      const mockVendor = {
        id: 'profile-1',
        ...input,
        contactInfo: null,
        kycStatus: KYCStatus.PENDING,
        reputationScore: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(VendorProfile, 'getVendorProfile').mockResolvedValue(null);
      jest.spyOn(VendorProfile, 'createVendorProfile').mockResolvedValue(mockVendor as any);

      const result = await service.registerVendor(input);

      expect(result).toEqual(mockVendor);
      expect(VendorProfile.createVendorProfile).toHaveBeenCalledWith(mockPrisma, input);
    });

    it('should reject duplicate vendor', async () => {
      const input = {
        vendorId: 'vendor-1',
        name: 'Test Vendor',
      };

      const existingVendor = {
        id: 'profile-1',
        vendorId: 'vendor-1',
      };

      jest.spyOn(VendorProfile, 'getVendorProfile').mockResolvedValue(existingVendor as any);

      await expect(service.registerVendor(input)).rejects.toThrow('already exists');
    });
  });

  describe('submitModuleForApproval', () => {
    it('should submit module for approval', async () => {
      const input = {
        name: 'Test Module',
        version: '1.0.0',
        description: 'Test description',
        vendorId: 'vendor-1',
        capabilities: ['cap1'],
        price: 99.99,
        licenseType: LicenseType.SUBSCRIPTION,
      };

      const mockVendor = {
        id: 'profile-1',
        vendorId: 'vendor-1',
        kycStatus: KYCStatus.VERIFIED,
      };

      const mockModule = {
        id: 'module-1',
        ...input,
        approvalStatus: ApprovalStatus.PENDING,
      };

      jest.spyOn(VendorProfile, 'getVendorProfile').mockResolvedValue(mockVendor as any);
      jest.spyOn(MarketplaceModule, 'createModule').mockResolvedValue(mockModule as any);

      const result = await service.submitModuleForApproval(input);

      expect(result).toEqual(mockModule);
      expect(MarketplaceModule.createModule).toHaveBeenCalled();
    });

    it('should reject if vendor KYC not verified', async () => {
      const input = {
        name: 'Test Module',
        version: '1.0.0',
        description: 'Test description',
        vendorId: 'vendor-1',
        capabilities: ['cap1'],
        price: 99.99,
        licenseType: LicenseType.SUBSCRIPTION,
      };

      const mockVendor = {
        id: 'profile-1',
        vendorId: 'vendor-1',
        kycStatus: KYCStatus.PENDING,
      };

      jest.spyOn(VendorProfile, 'getVendorProfile').mockResolvedValue(mockVendor as any);

      await expect(service.submitModuleForApproval(input)).rejects.toThrow('KYC status must be VERIFIED');
    });
  });

  describe('fetchVendorModules', () => {
    it('should fetch modules for a vendor', async () => {
      const vendorId = 'vendor-1';
      const mockVendor = {
        id: 'profile-1',
        vendorId,
      };

      const mockModules = [
        {
          id: 'module-1',
          name: 'Test Module',
          vendorId,
          vendor: {
            id: 'profile-1',
            vendorId,
            name: 'Test Vendor',
            kycStatus: KYCStatus.VERIFIED,
            reputationScore: 85,
          },
        },
      ];

      jest.spyOn(VendorProfile, 'getVendorProfile').mockResolvedValue(mockVendor as any);
      (mockPrisma.marketplaceModule.findMany as jest.Mock).mockResolvedValue(mockModules);

      const result = await service.fetchVendorModules(vendorId);

      expect(result).toEqual(mockModules);
      expect(mockPrisma.marketplaceModule.findMany).toHaveBeenCalled();
    });

    it('should reject if vendor not found', async () => {
      jest.spyOn(VendorProfile, 'getVendorProfile').mockResolvedValue(null);

      await expect(service.fetchVendorModules('vendor-1')).rejects.toThrow('not found');
    });
  });
});

