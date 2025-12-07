/**
 * B248A-PARTNER-002: ContactPerson Model
 *
 * Defines schema: id, partnerId (FK), name, title, email, phone, role (admin/technical/commercial),
 * createdAt, updatedAt; ensures partnerId relationship
 */

import { PrismaClient } from '@prisma/client';

export interface ContactPersonInput {
  partnerId: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'technical' | 'commercial';
}

export interface ContactPerson {
  id: string;
  partnerId: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate contact person input
 */
export function validateContactPersonInput(input: ContactPersonInput): void {
  if (!input.partnerId || input.partnerId.trim().length === 0) {
    throw new Error('partnerId is required');
  }
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('name is required');
  }
  const validRoles = ['admin', 'technical', 'commercial'];
  if (!validRoles.includes(input.role)) {
    throw new Error(`role must be one of: ${validRoles.join(', ')}`);
  }
  if (input.email && !isValidEmail(input.email)) {
    throw new Error('email must be a valid email address');
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Verify partner exists
 */
async function verifyPartnerExists(prisma: PrismaClient, partnerId: string): Promise<void> {
  const partner = await prisma.partnerProfile.findUnique({
    where: { id: partnerId },
  });
  if (!partner) {
    throw new Error(`Partner not found: ${partnerId}`);
  }
}

/**
 * Create contact person
 */
export async function createContactPerson(
  prisma: PrismaClient,
  input: ContactPersonInput
): Promise<ContactPerson> {
  validateContactPersonInput(input);
  await verifyPartnerExists(prisma, input.partnerId);

  return prisma.contactPerson.create({
    data: {
      partnerId: input.partnerId,
      name: input.name,
      title: input.title ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      role: input.role,
    },
  });
}

/**
 * Get contact person by ID
 */
export async function getContactPerson(
  prisma: PrismaClient,
  id: string
): Promise<ContactPerson | null> {
  return prisma.contactPerson.findUnique({
    where: { id },
  });
}

/**
 * Get contact persons by partner ID
 */
export async function getContactPersonsByPartner(
  prisma: PrismaClient,
  partnerId: string
): Promise<ContactPerson[]> {
  return prisma.contactPerson.findMany({
    where: { partnerId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get contact persons by role
 */
export async function getContactPersonsByRole(
  prisma: PrismaClient,
  role: string
): Promise<ContactPerson[]> {
  return prisma.contactPerson.findMany({
    where: { role },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update contact person
 */
export async function updateContactPerson(
  prisma: PrismaClient,
  id: string,
  updates: Partial<ContactPersonInput>
): Promise<ContactPerson> {
  if (updates.email && !isValidEmail(updates.email)) {
    throw new Error('email must be a valid email address');
  }
  if (updates.role) {
    const validRoles = ['admin', 'technical', 'commercial'];
    if (!validRoles.includes(updates.role)) {
      throw new Error(`role must be one of: ${validRoles.join(', ')}`);
    }
  }
  if (updates.partnerId) {
    await verifyPartnerExists(prisma, updates.partnerId);
  }

  return prisma.contactPerson.update({
    where: { id },
    data: {
      ...(updates.partnerId !== undefined && { partnerId: updates.partnerId }),
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.title !== undefined && { title: updates.title ?? null }),
      ...(updates.email !== undefined && { email: updates.email ?? null }),
      ...(updates.phone !== undefined && { phone: updates.phone ?? null }),
      ...(updates.role !== undefined && { role: updates.role }),
    },
  });
}

/**
 * Delete contact person
 */
export async function deleteContactPerson(
  prisma: PrismaClient,
  id: string
): Promise<ContactPerson> {
  return prisma.contactPerson.delete({
    where: { id },
  });
}

