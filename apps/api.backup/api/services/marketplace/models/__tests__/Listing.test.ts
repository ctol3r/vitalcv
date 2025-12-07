/**
 * S72-STRETCH-E-004: Marketplace Listing Model Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  createListing,
  getListing,
  listActiveListings,
  updateListing,
  validateListingInput,
} from '../Listing';

// Mock Prisma client
const mockPrisma = {
  marketplaceListing: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Marketplace Listing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateListingInput', () => {
    it('should accept valid listing input', () => {
      expect(() =>
        validateListingInput({
          orgId: 'org-1',
          productType: 'jobSlot',
          fiatPrice: 10000,
        })
      ).not.toThrow();

      expect(() =>
        validateListingInput({
          orgId: 'org-1',
          productType: 'jobSlot',
          vitaPrice: 1000,
        })
      ).not.toThrow();
    });

    it('should reject missing orgId', () => {
      expect(() =>
        validateListingInput({
          orgId: '',
          productType: 'jobSlot',
          fiatPrice: 10000,
        })
      ).toThrow('orgId is required');
    });

    it('should reject missing productType', () => {
      expect(() =>
        validateListingInput({
          orgId: 'org-1',
          productType: '',
          fiatPrice: 10000,
        })
      ).toThrow('productType is required');
    });

    it('should reject negative fiatPrice', () => {
      expect(() =>
        validateListingInput({
          orgId: 'org-1',
          productType: 'jobSlot',
          fiatPrice: -100,
        })
      ).toThrow('fiatPrice must be non-negative');
    });

    it('should reject negative vitaPrice', () => {
      expect(() =>
        validateListingInput({
          orgId: 'org-1',
          productType: 'jobSlot',
          vitaPrice: -100,
        })
      ).toThrow('vitaPrice must be non-negative');
    });

    it('should reject when both prices are missing', () => {
      expect(() =>
        validateListingInput({
          orgId: 'org-1',
          productType: 'jobSlot',
        })
      ).toThrow('Either fiatPrice or vitaPrice must be provided');
    });
  });

  describe('createListing', () => {
    it('should create listing with fiat price', async () => {
      const input = {
        orgId: 'org-1',
        productType: 'jobSlot',
        fiatPrice: 10000,
      };

      const mockResult = {
        id: 'listing-1',
        ...input,
        fiatPrice: 10000,
        vitaPrice: null,
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.marketplaceListing.create as jest.Mock).mockResolvedValue(mockResult);

      const result = await createListing(mockPrisma, input);

      expect(result).toEqual(mockResult);
      expect(mockPrisma.marketplaceListing.create).toHaveBeenCalledWith({
        data: {
          orgId: 'org-1',
          productType: 'jobSlot',
          fiatPrice: 10000,
          vitaPrice: null,
          isActive: true,
          metadata: {},
        },
      });
    });

    it('should create listing with VITA price', async () => {
      const input = {
        orgId: 'org-1',
        productType: 'FPPEBundle',
        vitaPrice: 1000,
      };

      const mockResult = {
        id: 'listing-1',
        ...input,
        fiatPrice: null,
        vitaPrice: 1000,
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.marketplaceListing.create as jest.Mock).mockResolvedValue(mockResult);

      const result = await createListing(mockPrisma, input);

      expect(result).toEqual(mockResult);
    });
  });

  describe('listActiveListings', () => {
    it('should list active listings with filters', async () => {
      const mockResults = [
        {
          id: 'listing-1',
          orgId: 'org-1',
          productType: 'jobSlot',
          fiatPrice: 10000,
          vitaPrice: null,
          isActive: true,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockPrisma.marketplaceListing.findMany as jest.Mock).mockResolvedValue(mockResults);

      const result = await listActiveListings(mockPrisma, {
        productType: 'jobSlot',
      });

      expect(result).toEqual(mockResults);
      expect(mockPrisma.marketplaceListing.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          productType: 'jobSlot',
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});

