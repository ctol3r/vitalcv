/**
 * B240A-VM-007: VendorCategory model
 *
 * Fields: id, name (e.g., Lab, IT Supplier), description,
 * complianceRequirements (JSON), createdAt, updatedAt
 * Used to group vendors
 */

import { PrismaClient } from '@prisma/client';

export interface ComplianceRequirements {
  certifications?: string[];
  insurance?: {
    minCoverage?: number;
    types?: string[];
  };
  backgroundChecks?: boolean;
  dataSecurity?: {
    required?: boolean;
    standards?: string[];
  };
  [key: string]: any;
}

export interface VendorCategoryInput {
  name: string;
  description?: string;
  complianceRequirements?: ComplianceRequirements;
}

export interface VendorCategory {
  id: string;
  name: string;
  description: string | null;
  complianceRequirements: ComplianceRequirements | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate vendor category input
 */
export function validateVendorCategoryInput(input: VendorCategoryInput): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('name is required');
  }
}

/**
 * Create vendor category
 */
export async function createVendorCategory(
  prisma: PrismaClient,
  input: VendorCategoryInput
): Promise<VendorCategory> {
  validateVendorCategoryInput(input);

  return prisma.vendorCategory.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      complianceRequirements: input.complianceRequirements ? (input.complianceRequirements as any) : null,
    },
  });
}

/**
 * Get vendor category by ID
 */
export async function getVendorCategory(
  prisma: PrismaClient,
  id: string
): Promise<VendorCategory | null> {
  return prisma.vendorCategory.findUnique({
    where: { id },
  });
}

/**
 * Get vendor category by name
 */
export async function getVendorCategoryByName(
  prisma: PrismaClient,
  name: string
): Promise<VendorCategory | null> {
  return prisma.vendorCategory.findUnique({
    where: { name },
  });
}

/**
 * List all vendor categories
 */
export async function listVendorCategories(
  prisma: PrismaClient
): Promise<VendorCategory[]> {
  return prisma.vendorCategory.findMany({
    orderBy: { name: 'asc' },
  });
}

/**
 * Update vendor category
 */
export async function updateVendorCategory(
  prisma: PrismaClient,
  id: string,
  updates: Partial<VendorCategoryInput>
): Promise<VendorCategory> {
  return prisma.vendorCategory.update({
    where: { id },
    data: {
      ...(updates.name && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description ?? null }),
      ...(updates.complianceRequirements !== undefined && {
        complianceRequirements: updates.complianceRequirements ? (updates.complianceRequirements as any) : null,
      }),
    },
  });
}

/**
 * Delete vendor category (only if no vendors use it)
 */
export async function deleteVendorCategory(
  prisma: PrismaClient,
  id: string
): Promise<void> {
  // Check if any vendors use this category
  const vendors = await prisma.vendor.findMany({
    where: { categoryId: id },
    take: 1,
  });

  if (vendors.length > 0) {
    throw new Error('Cannot delete category: vendors are still using it');
  }

  await prisma.vendorCategory.delete({
    where: { id },
  });
}

