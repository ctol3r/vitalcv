/**
 * B240A-VM-002: VendorContact model
 *
 * Supports multiple contacts per vendor with fields: id, vendorId, name,
 * role, email, phone, createdAt, updatedAt
 */

import { PrismaClient } from '@prisma/client';

export interface VendorContactInput {
  vendorId: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
}

export interface VendorContact {
  id: string;
  vendorId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate vendor contact input
 */
export function validateVendorContactInput(input: VendorContactInput): void {
  if (!input.vendorId || input.vendorId.trim().length === 0) {
    throw new Error('vendorId is required');
  }
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('name is required');
  }
  if (input.email && !isValidEmail(input.email)) {
    throw new Error('email must be a valid email address');
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Create vendor contact
 */
export async function createVendorContact(
  prisma: PrismaClient,
  input: VendorContactInput
): Promise<VendorContact> {
  validateVendorContactInput(input);

  // Verify vendor exists
  const vendor = await prisma.vendor.findUnique({
    where: { id: input.vendorId },
  });
  if (!vendor) {
    throw new Error(`Vendor with id ${input.vendorId} not found`);
  }

  return prisma.vendorContact.create({
    data: {
      vendorId: input.vendorId,
      name: input.name,
      role: input.role ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
    },
  });
}

/**
 * Get vendor contact by ID
 */
export async function getVendorContact(
  prisma: PrismaClient,
  id: string
): Promise<VendorContact | null> {
  return prisma.vendorContact.findUnique({
    where: { id },
  });
}

/**
 * Get all contacts for a vendor
 */
export async function getVendorContacts(
  prisma: PrismaClient,
  vendorId: string
): Promise<VendorContact[]> {
  return prisma.vendorContact.findMany({
    where: { vendorId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update vendor contact
 */
export async function updateVendorContact(
  prisma: PrismaClient,
  id: string,
  updates: Partial<VendorContactInput>
): Promise<VendorContact> {
  if (updates.email && !isValidEmail(updates.email)) {
    throw new Error('email must be a valid email address');
  }

  return prisma.vendorContact.update({
    where: { id },
    data: {
      ...(updates.name && { name: updates.name }),
      ...(updates.role !== undefined && { role: updates.role ?? null }),
      ...(updates.email !== undefined && { email: updates.email ?? null }),
      ...(updates.phone !== undefined && { phone: updates.phone ?? null }),
    },
  });
}

/**
 * Delete vendor contact
 */
export async function deleteVendorContact(
  prisma: PrismaClient,
  id: string
): Promise<void> {
  await prisma.vendorContact.delete({
    where: { id },
  });
}

