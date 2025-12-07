/**
 * B248A-PARTNER-001: PartnerProfile Model
 *
 * Defines schema for partners: id (UUID), name, type (clinic/hospital/payer/vendor),
 * industry, website, contactEmail, phone, address, status (draft/under_review/approved/active/suspended),
 * createdAt, updatedAt
 */

import { PrismaClient, PartnerStatus } from '@prisma/client';

export interface PartnerAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface PartnerProfileInput {
  name: string;
  type: 'clinic' | 'hospital' | 'payer' | 'vendor';
  industry?: string;
  website?: string;
  contactEmail?: string;
  phone?: string;
  address?: PartnerAddress;
  status?: PartnerStatus;
}

export interface PartnerProfile {
  id: string;
  name: string;
  type: string;
  industry: string | null;
  website: string | null;
  contactEmail: string | null;
  phone: string | null;
  address: PartnerAddress | null;
  status: PartnerStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate partner profile input
 */
export function validatePartnerProfileInput(input: PartnerProfileInput): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('name is required');
  }
  const validTypes = ['clinic', 'hospital', 'payer', 'vendor'];
  if (!validTypes.includes(input.type)) {
    throw new Error(`type must be one of: ${validTypes.join(', ')}`);
  }
  if (input.website && !isValidUrl(input.website)) {
    throw new Error('website must be a valid URL');
  }
  if (input.contactEmail && !isValidEmail(input.contactEmail)) {
    throw new Error('contactEmail must be a valid email address');
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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Create partner profile
 */
export async function createPartnerProfile(
  prisma: PrismaClient,
  input: PartnerProfileInput
): Promise<PartnerProfile> {
  validatePartnerProfileInput(input);

  return prisma.partnerProfile.create({
    data: {
      name: input.name,
      type: input.type,
      industry: input.industry ?? null,
      website: input.website ?? null,
      contactEmail: input.contactEmail ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      status: input.status ?? PartnerStatus.draft,
    },
  });
}

/**
 * Get partner profile by ID
 */
export async function getPartnerProfile(
  prisma: PrismaClient,
  id: string
): Promise<PartnerProfile | null> {
  return prisma.partnerProfile.findUnique({
    where: { id },
  });
}

/**
 * Get partner profiles with filtering and pagination
 */
export async function getPartnerProfiles(
  prisma: PrismaClient,
  options?: {
    type?: string;
    status?: PartnerStatus;
    skip?: number;
    take?: number;
  }
): Promise<PartnerProfile[]> {
  const where: any = {};
  if (options?.type) {
    where.type = options.type;
  }
  if (options?.status) {
    where.status = options.status;
  }

  return prisma.partnerProfile.findMany({
    where,
    skip: options?.skip,
    take: options?.take,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update partner profile
 */
export async function updatePartnerProfile(
  prisma: PrismaClient,
  id: string,
  updates: Partial<PartnerProfileInput>
): Promise<PartnerProfile> {
  if (updates.website && !isValidUrl(updates.website)) {
    throw new Error('website must be a valid URL');
  }
  if (updates.contactEmail && !isValidEmail(updates.contactEmail)) {
    throw new Error('contactEmail must be a valid email address');
  }
  if (updates.type) {
    const validTypes = ['clinic', 'hospital', 'payer', 'vendor'];
    if (!validTypes.includes(updates.type)) {
      throw new Error(`type must be one of: ${validTypes.join(', ')}`);
    }
  }

  return prisma.partnerProfile.update({
    where: { id },
    data: {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.type !== undefined && { type: updates.type }),
      ...(updates.industry !== undefined && { industry: updates.industry ?? null }),
      ...(updates.website !== undefined && { website: updates.website ?? null }),
      ...(updates.contactEmail !== undefined && { contactEmail: updates.contactEmail ?? null }),
      ...(updates.phone !== undefined && { phone: updates.phone ?? null }),
      ...(updates.address !== undefined && { address: updates.address ?? null }),
      ...(updates.status !== undefined && { status: updates.status }),
    },
  });
}

/**
 * Delete partner profile
 */
export async function deletePartnerProfile(
  prisma: PrismaClient,
  id: string
): Promise<PartnerProfile> {
  return prisma.partnerProfile.delete({
    where: { id },
  });
}

