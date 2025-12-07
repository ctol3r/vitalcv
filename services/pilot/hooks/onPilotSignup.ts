const log = getServiceLogger('pilot/hooks/onPilotSignup');
/**
 * Hook: Notify internal admins about inbound pilot signups.
 * B162B-PILOT-006
 */

import { PilotSignup, PrismaClient, UserRole } from '@prisma/client';
import { createNotification } from 'services/notifications/notificationService';
import { enqueueEmail } from 'services/notifications/emailEnqueue';
import { getServiceLogger } from '../../logging/serviceLogger';

const prisma = new PrismaClient();

export async function onPilotSignup(signup: PilotSignup): Promise<void> {
  try {
    const internalAdmins = await prisma.user.findMany({
      where: {
        OR: [
          { role: UserRole.INTERNAL_ADMIN },
          { roles: { has: 'internal_admin' } },
          { roles: { has: 'admin' } },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
      take: 25,
    });

    await prisma.auditEvent.create({
      data: {
        type: 'PILOT_SIGNUP_CREATED',
        data: {
          signupId: signup.id,
          orgName: signup.orgName,
          contactName: signup.contactName,
          email: signup.email,
        },
      },
    });

    if (internalAdmins.length === 0) {
      log.warn('[onPilotSignup] No INTERNAL_ADMIN users available for alert fan-out');
      return;
    }

    await Promise.all(
      internalAdmins.map(async (admin) => {
        await createNotification(admin.id, 'PILOT_SIGNUP_NEW', {
          signupId: signup.id,
          orgName: signup.orgName,
          contactName: signup.contactName,
          email: signup.email,
        });

        if (admin.email) {
          await enqueueEmail(admin.email, 'pilot_signup_internal_alert', {
            subject: `New pilot signup: ${signup.orgName}`,
            orgName: signup.orgName,
            contactName: signup.contactName,
            email: signup.email,
            notes: signup.notes,
            signupId: signup.id,
          });
        }
      })
    );
  } catch (error) {
    log.error('[onPilotSignup] Failed to notify admins', error);
  }
}

