import { PrismaClient } from '@prisma/client';
import { sanitizeUserFields } from '../../security/sanitizeUserFields';

const prisma = new PrismaClient();

export interface UpsertOrgProfileInput {
  orgId: string;
  name: string;
  contactEmail: string;
  address?: Record<string, unknown> | null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function upsertOrgProfile(input: UpsertOrgProfileInput) {
  const { name } = sanitizeUserFields({ name: input.name });

  if (!name) {
    throw new Error('Organization name cannot be empty');
  }

  return prisma.orgProfile.upsert({
    where: { orgId: input.orgId },
    update: {
      name,
      contactEmail: normalizeEmail(input.contactEmail),
      address: input.address ?? null,
    },
    create: {
      orgId: input.orgId,
      name,
      contactEmail: normalizeEmail(input.contactEmail),
      address: input.address ?? null,
    },
  });
}

export function getOrgProfile(orgId: string) {
  return prisma.orgProfile.findUnique({ where: { orgId } });
}

export function listOrgProfiles(limit = 50) {
  return prisma.orgProfile.findMany({
    orderBy: { updatedAt: 'desc' },
    take: Math.min(limit, 200),
  });
}

