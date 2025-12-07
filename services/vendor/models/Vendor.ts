/**
 * B240A-VM-001: Vendor model
 *
 * Core vendor model with fields: id, name, orgId, categoryId, status,
 * description, website, primaryContactId, createdAt, updatedAt
 */

import { PrismaClient, VendorStatus } from '@prisma/client';

export interface VendorInput {
  name: string;
  orgId: string;
  categoryId: string;
  status?: VendorStatus;
  description?: string;
  website?: string;
  primaryContactId?: string;
}

export interface Vendor {
  id: string;
  name: string;
  orgId: string;
  categoryId: string;
  status: VendorStatus;
  description: string | null;
  website: string | null;
  primaryContactId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate vendor input
 */
export function validateVendorInput(input: VendorInput): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('name is required');
  }
  if (!input.orgId || input.orgId.trim().length === 0) {
    throw new Error('orgId is required');
  }
  if (!input.categoryId || input.categoryId.trim().length === 0) {
    throw new Error('categoryId is required');
  }
  if (input.website && !isValidUrl(input.website)) {
    throw new Error('website must be a valid URL');
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create vendor
 */
export async function createVendor(
  prisma: PrismaClient,
  input: VendorInput
): Promise<Vendor> {
  validateVendorInput(input);

  return prisma.vendor.create({
    data: {
      name: input.name,
      orgId: input.orgId,
      categoryId: input.categoryId,
      status: input.status || VendorStatus.PENDING,
      description: input.description ?? null,
      website: input.website ?? null,
      primaryContactId: input.primaryContactId ?? null,
    },
  });
}

/**
 * Get vendor by ID
 */
export async function getVendor(
  prisma: PrismaClient,
  id: string
): Promise<Vendor | null> {
  return prisma.vendor.findUnique({
    where: { id },
  });
}

/**
 * Get vendors by organization
 */
export async function getVendorsByOrg(
  prisma: PrismaClient,
  orgId: string,
  options?: {
    status?: VendorStatus;
    categoryId?: string;
  }
): Promise<Vendor[]> {
  return prisma.vendor.findMany({
    where: {
      orgId,
      ...(options?.status && { status: options.status }),
      ...(options?.categoryId && { categoryId: options.categoryId }),
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update vendor
 */
export async function updateVendor(
  prisma: PrismaClient,
  id: string,
  updates: Partial<VendorInput>
): Promise<Vendor> {
  if (updates.website && !isValidUrl(updates.website)) {
    throw new Error('website must be a valid URL');
  }

  return prisma.vendor.update({
    where: { id },
    data: {
      ...(updates.name && { name: updates.name }),
      ...(updates.categoryId && { categoryId: updates.categoryId }),
      ...(updates.status && { status: updates.status }),
      ...(updates.description !== undefined && { description: updates.description ?? null }),
      ...(updates.website !== undefined && { website: updates.website ?? null }),
      ...(updates.primaryContactId !== undefined && { primaryContactId: updates.primaryContactId ?? null }),
    },
  });
}

/**
 * Archive vendor (set status to INACTIVE)
 */
export async function archiveVendor(
  prisma: PrismaClient,
  id: string
): Promise<Vendor> {
  return prisma.vendor.update({
    where: { id },
    data: {
      status: VendorStatus.INACTIVE,
    },
  });
}

/**
 * Delete vendor (cascade deletes contacts, documents, etc.)
 */
export async function deleteVendor(
  prisma: PrismaClient,
  id: string
): Promise<void> {
  await prisma.vendor.delete({
    where: { id },
  });
}

