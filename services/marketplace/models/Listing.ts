/**
 * S72-STRETCH-E-004: Marketplace Listing Model
 *
 * Stores marketplace offerings with orgId, productType, fiatPrice, and vitaPrice
 */

import { PrismaClient } from '@prisma/client';

export type ProductType = 'jobSlot' | 'FPPEBundle' | 'analyticsUpgrade' | string;

export interface MarketplaceListingInput {
  orgId: string;
  productType: ProductType;
  fiatPrice?: number; // in cents
  vitaPrice?: number; // in VITA tokens
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface MarketplaceListing {
  id: string;
  orgId: string;
  productType: string;
  fiatPrice: number | null;
  vitaPrice: number | null;
  isActive: boolean;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate listing input
 */
export function validateListingInput(input: MarketplaceListingInput): void {
  if (!input.orgId) {
    throw new Error('orgId is required');
  }
  if (!input.productType) {
    throw new Error('productType is required');
  }
  if (input.fiatPrice !== undefined && input.fiatPrice < 0) {
    throw new Error(`fiatPrice must be non-negative, got ${input.fiatPrice}`);
  }
  if (input.vitaPrice !== undefined && input.vitaPrice < 0) {
    throw new Error(`vitaPrice must be non-negative, got ${input.vitaPrice}`);
  }
  if (input.fiatPrice === undefined && input.vitaPrice === undefined) {
    throw new Error('Either fiatPrice or vitaPrice must be provided');
  }
}

/**
 * Create marketplace listing
 */
export async function createListing(
  prisma: PrismaClient,
  input: MarketplaceListingInput
): Promise<MarketplaceListing> {
  validateListingInput(input);

  return prisma.marketplaceListing.create({
    data: {
      orgId: input.orgId,
      productType: input.productType,
      fiatPrice: input.fiatPrice ?? null,
      vitaPrice: input.vitaPrice ?? null,
      isActive: input.isActive ?? true,
      metadata: input.metadata ?? {},
    },
  });
}

/**
 * Get marketplace listing by ID
 */
export async function getListing(
  prisma: PrismaClient,
  listingId: string
): Promise<MarketplaceListing | null> {
  return prisma.marketplaceListing.findUnique({
    where: { id: listingId },
  });
}

/**
 * List active marketplace listings with optional filters
 */
export async function listActiveListings(
  prisma: PrismaClient,
  options?: {
    orgId?: string;
    productType?: string;
  }
): Promise<MarketplaceListing[]> {
  return prisma.marketplaceListing.findMany({
    where: {
      isActive: true,
      ...(options?.orgId && { orgId: options.orgId }),
      ...(options?.productType && { productType: options.productType }),
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update marketplace listing
 */
export async function updateListing(
  prisma: PrismaClient,
  listingId: string,
  updates: Partial<MarketplaceListingInput>
): Promise<MarketplaceListing> {
  if (updates.fiatPrice !== undefined && updates.fiatPrice < 0) {
    throw new Error(`fiatPrice must be non-negative, got ${updates.fiatPrice}`);
  }
  if (updates.vitaPrice !== undefined && updates.vitaPrice < 0) {
    throw new Error(`vitaPrice must be non-negative, got ${updates.vitaPrice}`);
  }

  return prisma.marketplaceListing.update({
    where: { id: listingId },
    data: {
      ...(updates.productType && { productType: updates.productType }),
      ...(updates.fiatPrice !== undefined && { fiatPrice: updates.fiatPrice ?? null }),
      ...(updates.vitaPrice !== undefined && { vitaPrice: updates.vitaPrice ?? null }),
      ...(updates.isActive !== undefined && { isActive: updates.isActive }),
      ...(updates.metadata && { metadata: updates.metadata }),
      updatedAt: new Date(),
    },
  });
}

/**
 * Deactivate marketplace listing
 */
export async function deactivateListing(
  prisma: PrismaClient,
  listingId: string
): Promise<MarketplaceListing> {
  return prisma.marketplaceListing.update({
    where: { id: listingId },
    data: {
      isActive: false,
      updatedAt: new Date(),
    },
  });
}

