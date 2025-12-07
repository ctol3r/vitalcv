/**
 * B223A-MARKET-001: MarketplaceModule Model
 *
 * Model for marketplace modules with all required fields
 */

import { PrismaClient, ApprovalStatus, LicenseType } from '@prisma/client';

export type ApprovalStatusType = ApprovalStatus;
export type LicenseTypeType = LicenseType;

export interface MarketplaceModuleInput {
  name: string;
  version: string;
  description: string;
  vendorId: string;
  capabilities: string[];
  price: number;
  currency?: string;
  licenseType: LicenseType;
  approvalStatus?: ApprovalStatus;
  averageRating?: number;
}

export interface MarketplaceModule {
  id: string;
  name: string;
  version: string;
  description: string;
  vendorId: string;
  capabilities: string[];
  price: number;
  currency: string;
  licenseType: LicenseType;
  approvalStatus: ApprovalStatus;
  averageRating: number | null;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate module input
 */
export function validateModuleInput(input: MarketplaceModuleInput): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('name is required');
  }
  if (!input.version || input.version.trim().length === 0) {
    throw new Error('version is required');
  }
  if (!input.description || input.description.trim().length === 0) {
    throw new Error('description is required');
  }
  if (!input.vendorId) {
    throw new Error('vendorId is required');
  }
  if (!Array.isArray(input.capabilities)) {
    throw new Error('capabilities must be an array');
  }
  if (typeof input.price !== 'number' || input.price < 0) {
    throw new Error('price must be a non-negative number');
  }
  if (input.averageRating !== undefined) {
    if (typeof input.averageRating !== 'number' || input.averageRating < 0 || input.averageRating > 5) {
      throw new Error('averageRating must be between 0 and 5');
    }
  }
}

/**
 * Create marketplace module
 */
export async function createModule(
  prisma: PrismaClient,
  input: MarketplaceModuleInput
): Promise<MarketplaceModule> {
  validateModuleInput(input);

  return prisma.marketplaceModule.create({
    data: {
      name: input.name,
      version: input.version,
      description: input.description,
      vendorId: input.vendorId,
      capabilities: input.capabilities,
      price: input.price,
      currency: input.currency || 'USD',
      licenseType: input.licenseType,
      approvalStatus: input.approvalStatus || ApprovalStatus.PENDING,
      averageRating: input.averageRating ?? null,
      ratingCount: 0,
    },
  });
}

/**
 * Get marketplace module by ID
 */
export async function getModule(
  prisma: PrismaClient,
  moduleId: string
): Promise<MarketplaceModule | null> {
  return prisma.marketplaceModule.findUnique({
    where: { id: moduleId },
  });
}

/**
 * Update marketplace module
 */
export async function updateModule(
  prisma: PrismaClient,
  moduleId: string,
  updates: Partial<MarketplaceModuleInput>
): Promise<MarketplaceModule> {
  if (updates.price !== undefined && updates.price < 0) {
    throw new Error('price must be non-negative');
  }
  if (updates.averageRating !== undefined) {
    if (updates.averageRating < 0 || updates.averageRating > 5) {
      throw new Error('averageRating must be between 0 and 5');
    }
  }

  return prisma.marketplaceModule.update({
    where: { id: moduleId },
    data: {
      ...(updates.name && { name: updates.name }),
      ...(updates.version && { version: updates.version }),
      ...(updates.description && { description: updates.description }),
      ...(updates.capabilities && { capabilities: updates.capabilities }),
      ...(updates.price !== undefined && { price: updates.price }),
      ...(updates.currency && { currency: updates.currency }),
      ...(updates.licenseType && { licenseType: updates.licenseType }),
      ...(updates.approvalStatus && { approvalStatus: updates.approvalStatus }),
      ...(updates.averageRating !== undefined && { averageRating: updates.averageRating }),
    },
  });
}

/**
 * Update module approval status
 */
export async function updateApprovalStatus(
  prisma: PrismaClient,
  moduleId: string,
  status: ApprovalStatus
): Promise<MarketplaceModule> {
  return prisma.marketplaceModule.update({
    where: { id: moduleId },
    data: { approvalStatus: status },
  });
}

/**
 * Update module rating
 */
export async function updateRating(
  prisma: PrismaClient,
  moduleId: string,
  rating: number
): Promise<MarketplaceModule> {
  if (rating < 0 || rating > 5) {
    throw new Error('rating must be between 0 and 5');
  }

  const module = await prisma.marketplaceModule.findUnique({
    where: { id: moduleId },
  });

  if (!module) {
    throw new Error('Module not found');
  }

  const currentTotal = (module.averageRating ?? 0) * module.ratingCount;
  const newRatingCount = module.ratingCount + 1;
  const newAverageRating = (currentTotal + rating) / newRatingCount;

  return prisma.marketplaceModule.update({
    where: { id: moduleId },
    data: {
      averageRating: newAverageRating,
      ratingCount: newRatingCount,
    },
  });
}

