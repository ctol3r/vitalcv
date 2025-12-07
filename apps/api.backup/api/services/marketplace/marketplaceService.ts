/**
 * B223A-MARKET-003: MarketplaceService
 *
 * Service providing marketplace operations: listModules, searchModules,
 * registerVendor, submitModuleForApproval, fetchVendorModules
 */

import { PrismaClient, ApprovalStatus } from '@prisma/client';
import { createVendorProfile, getVendorProfile, VendorProfileInput } from './models/VendorProfile';
import {
  createModule,
  getModule,
  updateApprovalStatus,
  MarketplaceModuleInput,
  ApprovalStatusType,
} from './models/MarketplaceModule';

export interface SearchFilters {
  name?: string;
  vendorId?: string;
  approvalStatus?: ApprovalStatus;
  licenseType?: string;
  minPrice?: number;
  maxPrice?: number;
  capabilities?: string[];
  minRating?: number;
}

export interface ListModulesOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'name' | 'price' | 'averageRating' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
}

export class MarketplaceService {
  constructor(private prisma: PrismaClient) {}

  /**
   * List marketplace modules with optional filters and pagination
   */
  async listModules(filters?: SearchFilters, options?: ListModulesOptions) {
    const where: any = {};

    if (filters?.name) {
      where.name = { contains: filters.name, mode: 'insensitive' };
    }
    if (filters?.vendorId) {
      where.vendorId = filters.vendorId;
    }
    if (filters?.approvalStatus) {
      where.approvalStatus = filters.approvalStatus;
    }
    if (filters?.licenseType) {
      where.licenseType = filters.licenseType;
    }
    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) {
        where.price.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        where.price.lte = filters.maxPrice;
      }
    }
    if (filters?.capabilities && filters.capabilities.length > 0) {
      where.capabilities = { hasSome: filters.capabilities };
    }
    if (filters?.minRating !== undefined) {
      where.averageRating = { gte: filters.minRating };
    }

    const orderBy = options?.orderBy || 'createdAt';
    const orderDirection = options?.orderDirection || 'desc';

    const modules = await this.prisma.marketplaceModule.findMany({
      where,
      take: options?.limit,
      skip: options?.offset,
      orderBy: { [orderBy]: orderDirection },
      include: {
        vendor: {
          select: {
            id: true,
            vendorId: true,
            name: true,
            kycStatus: true,
            reputationScore: true,
          },
        },
      },
    });

    const total = await this.prisma.marketplaceModule.count({ where });

    return {
      modules,
      total,
      limit: options?.limit,
      offset: options?.offset,
    };
  }

  /**
   * Search modules with text search across name and description
   */
  async searchModules(query: string, filters?: SearchFilters, options?: ListModulesOptions) {
    const where: any = {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    };

    // Apply additional filters
    if (filters?.vendorId) {
      where.vendorId = filters.vendorId;
    }
    if (filters?.approvalStatus) {
      where.approvalStatus = filters.approvalStatus;
    }
    if (filters?.licenseType) {
      where.licenseType = filters.licenseType;
    }
    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) {
        where.price.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        where.price.lte = filters.maxPrice;
      }
    }
    if (filters?.capabilities && filters.capabilities.length > 0) {
      where.capabilities = { hasSome: filters.capabilities };
    }
    if (filters?.minRating !== undefined) {
      where.averageRating = { gte: filters.minRating };
    }

    const orderBy = options?.orderBy || 'createdAt';
    const orderDirection = options?.orderDirection || 'desc';

    const modules = await this.prisma.marketplaceModule.findMany({
      where,
      take: options?.limit,
      skip: options?.offset,
      orderBy: { [orderBy]: orderDirection },
      include: {
        vendor: {
          select: {
            id: true,
            vendorId: true,
            name: true,
            kycStatus: true,
            reputationScore: true,
          },
        },
      },
    });

    const total = await this.prisma.marketplaceModule.count({ where });

    return {
      modules,
      total,
      limit: options?.limit,
      offset: options?.offset,
    };
  }

  /**
   * Register a new vendor
   */
  async registerVendor(input: VendorProfileInput) {
    // Check if vendor already exists
    const existing = await getVendorProfile(this.prisma, input.vendorId);
    if (existing) {
      throw new Error(`Vendor with vendorId ${input.vendorId} already exists`);
    }

    return createVendorProfile(this.prisma, input);
  }

  /**
   * Submit a module for approval
   */
  async submitModuleForApproval(input: MarketplaceModuleInput) {
    // Verify vendor exists
    const vendor = await getVendorProfile(this.prisma, input.vendorId);
    if (!vendor) {
      throw new Error(`Vendor with vendorId ${input.vendorId} not found`);
    }

    // Check vendor KYC status
    if (vendor.kycStatus !== 'VERIFIED') {
      throw new Error(`Vendor KYC status must be VERIFIED to submit modules. Current status: ${vendor.kycStatus}`);
    }

    // Create module with PENDING approval status
    return createModule(this.prisma, {
      ...input,
      approvalStatus: ApprovalStatus.PENDING,
    });
  }

  /**
   * Fetch all modules for a specific vendor
   */
  async fetchVendorModules(vendorId: string, includeInactive = false) {
    // Verify vendor exists
    const vendor = await getVendorProfile(this.prisma, vendorId);
    if (!vendor) {
      throw new Error(`Vendor with vendorId ${vendorId} not found`);
    }

    const where: any = { vendorId };
    if (!includeInactive) {
      where.approvalStatus = { not: ApprovalStatus.REJECTED };
    }

    return this.prisma.marketplaceModule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: {
          select: {
            id: true,
            vendorId: true,
            name: true,
            kycStatus: true,
            reputationScore: true,
          },
        },
      },
    });
  }
}

