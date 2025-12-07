import { OrgMembership, OrgMembershipRole, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface UpsertOrgMembershipInput {
  userId: string;
  orgId: string;
  role: OrgMembershipRole;
}

export async function upsertOrgMembership(
  input: UpsertOrgMembershipInput
): Promise<OrgMembership> {
  return prisma.orgMembership.upsert({
    where: {
      userId_orgId: {
        userId: input.userId,
        orgId: input.orgId,
      },
    },
    update: {
      role: input.role,
    },
    create: {
      userId: input.userId,
      orgId: input.orgId,
      role: input.role,
    },
  });
}

export function getOrgMembership(userId: string, orgId: string) {
  return prisma.orgMembership.findUnique({
    where: {
      userId_orgId: {
        userId,
        orgId,
      },
    },
  });
}

