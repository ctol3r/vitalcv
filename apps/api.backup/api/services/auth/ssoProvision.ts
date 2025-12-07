import {
  OrgMembership,
  OrgMembershipRole,
  PrismaClient,
  User,
  UserRole,
} from '@prisma/client';
import { sanitizeUserFields } from '../security/sanitizeUserFields';

const prisma = new PrismaClient();

export interface SsoProfile {
  email: string;
  name?: string | null;
}

export interface SsoProvisionRequest {
  orgId: string;
  providerId: string;
  role: OrgMembershipRole;
  profile: SsoProfile;
}

export interface SsoProvisionResult {
  user: User;
  membership: OrgMembership;
  createdUser: boolean;
  createdMembership: boolean;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function fallbackNameFromEmail(email: string): string {
  return email.split('@')[0] || 'SSO User';
}

function mapToUserRole(role: OrgMembershipRole): UserRole {
  return role === OrgMembershipRole.ADMIN ? UserRole.ORG_ADMIN : UserRole.CLINICIAN;
}

export async function provisionSsoUser(
  input: SsoProvisionRequest
): Promise<SsoProvisionResult> {
  const email = normalizeEmail(input.profile.email);
  const sanitized = sanitizeUserFields({ name: input.profile.name || '' });
  const desiredName = sanitized.name || fallbackNameFromEmail(email);
  const desiredUserRole = mapToUserRole(input.role);

  return prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { email } });
    let createdUser = false;

    if (!user) {
      user = await tx.user.create({
        data: {
          email,
          name: desiredName,
          role: desiredUserRole,
          roles: [desiredUserRole],
        },
      });
      createdUser = true;
    } else {
      const updates: Record<string, unknown> = {};
      if (desiredName && user.name !== desiredName) {
        updates.name = desiredName;
      }
      if (desiredUserRole === UserRole.ORG_ADMIN && user.role !== UserRole.ORG_ADMIN) {
        updates.role = desiredUserRole;
        updates.roles = Array.from(new Set([...(user.roles || []), desiredUserRole]));
      }

      if (Object.keys(updates).length > 0) {
        user = await tx.user.update({
          where: { id: user.id },
          data: updates,
        });
      }
    }

    const existingMembership = await tx.orgMembership.findUnique({
      where: {
        userId_orgId: { userId: user.id, orgId: input.orgId },
      },
    });

    let createdMembership = false;
    let membership: OrgMembership;

    if (!existingMembership) {
      membership = await tx.orgMembership.create({
        data: {
          userId: user.id,
          orgId: input.orgId,
          role: input.role,
        },
      });
      createdMembership = true;
    } else if (existingMembership.role !== input.role) {
      membership = await tx.orgMembership.update({
        where: {
          userId_orgId: {
            userId: user.id,
            orgId: input.orgId,
          },
        },
        data: {
          role: input.role,
        },
      });
    } else {
      membership = existingMembership;
    }

    return {
      user,
      membership,
      createdUser,
      createdMembership,
    };
  });
}
