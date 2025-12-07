/**
 * Pilot signup conversion helper.
 * Once a signup is approved we provision an Org + Org Admin stub.
 * B162B-PILOT-007
 */

import { PilotSignup, PilotSignupStatus, PrismaClient, UserRole } from '@prisma/client';
import crypto from 'crypto';
import { enqueueEmail } from 'services/notifications/emailEnqueue';

const prisma = new PrismaClient();

export interface PilotSignupConversionResult {
  signupId: string;
  orgId: string;
  orgName: string;
  adminUserId: string;
  adminEmail: string;
  inviteCode: string;
  wasExistingOrg: boolean;
  wasExistingUser: boolean;
}

export async function convertApprovedSignup(
  signupOrId: PilotSignup | string,
  options?: { actorId?: string }
): Promise<PilotSignupConversionResult> {
  const signup =
    typeof signupOrId === 'string'
      ? await prisma.pilotSignup.findUnique({ where: { id: signupOrId } })
      : signupOrId;

  if (!signup) {
    throw new Error('Pilot signup not found');
  }

  if (signup.status !== PilotSignupStatus.APPROVED) {
    throw new Error('Pilot signup must be approved before conversion');
  }

  const inviteCode = crypto.randomBytes(8).toString('hex');

  const org = signup.convertedOrgId
    ? await prisma.organization.findUnique({ where: { id: signup.convertedOrgId } })
    : await prisma.organization.create({
        data: {
          name: signup.orgName,
        },
      });

  let wasExistingUser = false;
  let adminUser =
    signup.convertedUserId &&
    (await prisma.user.findUnique({
      where: { id: signup.convertedUserId },
    }));

  if (!adminUser) {
    adminUser = await prisma.user.findUnique({ where: { email: signup.email } });
    wasExistingUser = Boolean(adminUser);
  } else {
    wasExistingUser = true;
  }

  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: signup.email,
        name: signup.contactName,
        roles: ['org_admin', 'pilot_contact'],
        role: UserRole.ORG_ADMIN,
        demoUser: true,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        name: signup.contactName,
        roles: Array.from(new Set([...(adminUser.roles || []), 'org_admin'])),
        role: UserRole.ORG_ADMIN,
      },
    });
  }

  await prisma.userOrgLink.upsert({
    where: {
      userId_orgId: {
        userId: adminUser.id,
        orgId: org.id,
      },
    },
    update: {
      isOrgAdmin: true,
    },
    create: {
      userId: adminUser.id,
      orgId: org.id,
      isOrgAdmin: true,
    },
  });

  const updatedSignup = await prisma.pilotSignup.update({
    where: { id: signup.id },
    data: {
      convertedOrgId: org.id,
      convertedUserId: adminUser.id,
      convertedAt: signup.convertedAt ?? new Date(),
      statusChangedAt: new Date(),
    },
  });

  await prisma.auditEvent.create({
    data: {
      type: 'PILOT_SIGNUP_CONVERTED',
      userId: options?.actorId,
      data: {
        signupId: updatedSignup.id,
        orgId: org.id,
        adminUserId: adminUser.id,
      },
    },
  });

  await enqueueEmail(adminUser.email, 'pilot_signup_approved', {
    subject: `You're approved for the Vital pilot`,
    orgName: org.name,
    contactName: signup.contactName,
    inviteCode,
    adminEmail: adminUser.email,
  });

  return {
    signupId: updatedSignup.id,
    orgId: org.id,
    orgName: org.name,
    adminUserId: adminUser.id,
    adminEmail: adminUser.email,
    inviteCode,
    wasExistingOrg: Boolean(signup.convertedOrgId),
    wasExistingUser,
  };
}

