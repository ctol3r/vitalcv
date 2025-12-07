/**
 * B223A-MARKET-002: VendorProfile Model
 *
 * Model for vendor profiles with KYC status and reputation tracking
 */

import { PrismaClient, KYCStatus } from '@prisma/client';

export type KYCStatusType = KYCStatus;

export interface ContactInfo {
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
}

export interface VendorProfileInput {
  vendorId: string;
  did?: string;
  name: string;
  contactInfo?: ContactInfo;
  kycStatus?: KYCStatus;
  reputationScore?: number;
}

export interface VendorProfile {
  id: string;
  vendorId: string;
  did: string | null;
  name: string;
  contactInfo: ContactInfo | null;
  kycStatus: KYCStatus;
  reputationScore: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate vendor profile input
 */
export function validateVendorInput(input: VendorProfileInput): void {
  if (!input.vendorId || input.vendorId.trim().length === 0) {
    throw new Error('vendorId is required');
  }
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('name is required');
  }
  if (input.reputationScore !== undefined) {
    if (typeof input.reputationScore !== 'number' || input.reputationScore < 0 || input.reputationScore > 100) {
      throw new Error('reputationScore must be between 0 and 100');
    }
  }
}

/**
 * Create vendor profile
 */
export async function createVendorProfile(
  prisma: PrismaClient,
  input: VendorProfileInput
): Promise<VendorProfile> {
  validateVendorInput(input);

  return prisma.vendorProfile.create({
    data: {
      vendorId: input.vendorId,
      did: input.did ?? null,
      name: input.name,
      contactInfo: input.contactInfo ?? null,
      kycStatus: input.kycStatus || KYCStatus.PENDING,
      reputationScore: input.reputationScore ?? 0,
    },
  });
}

/**
 * Get vendor profile by ID
 */
export async function getVendorProfile(
  prisma: PrismaClient,
  vendorId: string
): Promise<VendorProfile | null> {
  return prisma.vendorProfile.findUnique({
    where: { vendorId },
  });
}

/**
 * Get vendor profile by DID
 */
export async function getVendorProfileByDid(
  prisma: PrismaClient,
  did: string
): Promise<VendorProfile | null> {
  return prisma.vendorProfile.findUnique({
    where: { did },
  });
}

/**
 * Update vendor profile
 */
export async function updateVendorProfile(
  prisma: PrismaClient,
  vendorId: string,
  updates: Partial<VendorProfileInput>
): Promise<VendorProfile> {
  if (updates.reputationScore !== undefined) {
    if (updates.reputationScore < 0 || updates.reputationScore > 100) {
      throw new Error('reputationScore must be between 0 and 100');
    }
  }

  return prisma.vendorProfile.update({
    where: { vendorId },
    data: {
      ...(updates.name && { name: updates.name }),
      ...(updates.did !== undefined && { did: updates.did ?? null }),
      ...(updates.contactInfo !== undefined && { contactInfo: updates.contactInfo ?? null }),
      ...(updates.kycStatus && { kycStatus: updates.kycStatus }),
      ...(updates.reputationScore !== undefined && { reputationScore: updates.reputationScore }),
    },
  });
}

/**
 * Update vendor KYC status
 */
export async function updateKYCStatus(
  prisma: PrismaClient,
  vendorId: string,
  kycStatus: KYCStatus
): Promise<VendorProfile> {
  return prisma.vendorProfile.update({
    where: { vendorId },
    data: { kycStatus },
  });
}

/**
 * Update vendor reputation score
 */
export async function updateReputationScore(
  prisma: PrismaClient,
  vendorId: string,
  reputationScore: number
): Promise<VendorProfile> {
  if (reputationScore < 0 || reputationScore > 100) {
    throw new Error('reputationScore must be between 0 and 100');
  }

  return prisma.vendorProfile.update({
    where: { vendorId },
    data: { reputationScore },
  });
}

