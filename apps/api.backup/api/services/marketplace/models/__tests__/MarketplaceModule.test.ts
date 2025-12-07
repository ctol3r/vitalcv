/**
 * B223A-MARKET-001: MarketplaceModule Model Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PrismaClient, ApprovalStatus, LicenseType } from '@prisma/client';
import {
  createModule,
  getModule,
  updateModule,
  updateApprovalStatus,
  updateRating,
  validateModuleInput,
} from '../MarketplaceModule';

// Mock Prisma client
const mockPrisma = {
  marketplaceModule: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

describe('MarketplaceModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateModuleInput', () => {
    it('should accept valid module input', () => {
      expect(() =>
        validateModuleInput({
          name: 'Test Module',
          version: '1.0.0',
          description: 'Test description',
          vendorId: 'vendor-1',
          capabilities: ['cap1', 'cap2'],
          price: 99.99,
          currency: 'USD',
          licenseType: LicenseType.SUBSCRIPTION,
        })
      ).not.toThrow();
    });

    it('should reject missing name', () => {
      expect(() =>
        validateModuleInput({
          name: '',
          version: '1.0.0',
          description: 'Test description',
          vendorId: 'vendor-1',
          capabilities: ['cap1'],
          price: 99.99,
          licenseType: LicenseType.SUBSCRIPTION,
        })
      ).toThrow('name is required');
    });

    it('should reject missing version', () => {
      expect(() =>
        validateModuleInput({
          name: 'Test Module',
          version: '',
          description: 'Test description',
          vendorId: 'vendor-1',
          capabilities: ['cap1'],
          price: 99.99,
          licenseType: LicenseType.SUBSCRIPTION,
        })
      ).toThrow('version is required');
    });

    it('should reject negative price', () => {
      expect(() =>
        validateModuleInput({
          name: 'Test Module',
          version: '1.0.0',
          description: 'Test description',
          vendorId: 'vendor-1',
          capabilities: ['cap1'],
          price: -10,
          licenseType: LicenseType.SUBSCRIPTION,
        })
      ).toThrow('price must be a non-negative number');
    });

    it('should reject invalid averageRating', () => {
      expect(() =>
        validateModuleInput({
          name: 'Test Module',
          version: '1.0.0',
          description: 'Test description',
          vendorId: 'vendor-1',
          capabilities: ['cap1'],
          price: 99.99,
          licenseType: LicenseType.SUBSCRIPTION,
          averageRating: 6,
        })
      ).toThrow('averageRating must be between 0 and 5');
    });
  });

  describe('createModule', () => {
    it('should create module with all fields', async () => {
      const input = {
        name: 'Test Module',
        version: '1.0.0',
        description: 'Test description',
        vendorId: 'vendor-1',
        capabilities: ['cap1', 'cap2'],
        price: 99.99,
        currency: 'USD',
        licenseType: LicenseType.SUBSCRIPTION,
      };

      const mockResult = {
        id: 'module-1',
        ...input,
        approvalStatus: ApprovalStatus.PENDING,
        averageRating: null,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.marketplaceModule.create as jest.Mock).mockResolvedValue(mockResult);

      const result = await createModule(mockPrisma, input);

      expect(result).toEqual(mockResult);
      expect(mockPrisma.marketplaceModule.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          version: input.version,
          description: input.description,
          vendorId: input.vendorId,
          capabilities: input.capabilities,
          price: input.price,
          currency: 'USD',
          licenseType: input.licenseType,
          approvalStatus: ApprovalStatus.PENDING,
          averageRating: null,
          ratingCount: 0,
        },
      });
    });
  });

  describe('getModule', () => {
    it('should get module by ID', async () => {
      const mockResult = {
        id: 'module-1',
        name: 'Test Module',
        version: '1.0.0',
        description: 'Test description',
        vendorId: 'vendor-1',
        capabilities: ['cap1'],
        price: 99.99,
        currency: 'USD',
        licenseType: LicenseType.SUBSCRIPTION,
        approvalStatus: ApprovalStatus.PENDING,
        averageRating: null,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.marketplaceModule.findUnique as jest.Mock).mockResolvedValue(mockResult);

      const result = await getModule(mockPrisma, 'module-1');

      expect(result).toEqual(mockResult);
      expect(mockPrisma.marketplaceModule.findUnique).toHaveBeenCalledWith({
        where: { id: 'module-1' },
      });
    });
  });

  describe('updateApprovalStatus', () => {
    it('should update approval status', async () => {
      const mockResult = {
        id: 'module-1',
        approvalStatus: ApprovalStatus.APPROVED,
      } as any;

      (mockPrisma.marketplaceModule.update as jest.Mock).mockResolvedValue(mockResult);

      const result = await updateApprovalStatus(mockPrisma, 'module-1', ApprovalStatus.APPROVED);

      expect(result).toEqual(mockResult);
      expect(mockPrisma.marketplaceModule.update).toHaveBeenCalledWith({
        where: { id: 'module-1' },
        data: { approvalStatus: ApprovalStatus.APPROVED },
      });
    });
  });

  describe('updateRating', () => {
    it('should update rating correctly', async () => {
      const existingModule = {
        id: 'module-1',
        averageRating: 4.0,
        ratingCount: 2,
      };

      const mockResult = {
        ...existingModule,
        averageRating: 4.33, // (4.0 * 2 + 5) / 3
        ratingCount: 3,
      };

      (mockPrisma.marketplaceModule.findUnique as jest.Mock).mockResolvedValue(existingModule);
      (mockPrisma.marketplaceModule.update as jest.Mock).mockResolvedValue(mockResult);

      const result = await updateRating(mockPrisma, 'module-1', 5);

      expect(result.averageRating).toBeCloseTo(4.33, 2);
      expect(result.ratingCount).toBe(3);
    });
  });
});

