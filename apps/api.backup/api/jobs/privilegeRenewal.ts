/**
 * B135A-PRIV-002: Privilege Renewal Job
 *
 * Scheduled job that:
 * 1. Finds privileges expiring in 90, 60, or 30 days
 * 2. Creates or updates PrivilegeRenewal records
 * 3. Sends notifications to organizations and clinicians
 *
 * Run frequency: Daily (recommended 6 AM)
 */

import { PrismaClient } from '@prisma/client';
import {
  logRenewalCreated,
  logRenewalNotified,
  logRenewalOverdue
} from '../services/audit/privilegeRenewalEvents';

const prisma = new PrismaClient();

export interface RenewalJobResult {
  createdRenewals: number;
  notificationsSent: number;
  overdueRenewals: number;
  errors: string[];
}

// Notification thresholds (days before expiry)
const NOTIFICATION_DAYS = [90, 60, 30];

/**
 * Main renewal job execution
 */
export async function runPrivilegeRenewalJob(): Promise<RenewalJobResult> {
  console.info('[PrivilegeRenewalJob] Starting renewal job...');

  const result: RenewalJobResult = {
    createdRenewals: 0,
    notificationsSent: 0,
    overdueRenewals: 0,
    errors: []
  };

  try {
    // Step 1: Create renewals for expiring privileges
    result.createdRenewals = await createRenewalsForExpiringPrivileges();

    // Step 2: Send notifications for upcoming renewals
    result.notificationsSent = await sendRenewalNotifications();

    // Step 3: Mark overdue renewals
    result.overdueRenewals = await markOverdueRenewals();

    console.info('[PrivilegeRenewalJob] Job complete', result);
  } catch (error) {
    console.error('[PrivilegeRenewalJob] Job failed:', error);
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

/**
 * Create renewal records for privileges expiring in the next 90 days
 */
async function createRenewalsForExpiringPrivileges(): Promise<number> {
  const now = new Date();
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

  // Find active privileges expiring in next 90 days without renewal records
  const expiringPrivileges = await prisma.privilegeGranted.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: {
        gte: now,
        lte: ninetyDaysFromNow
      },
      renewals: {
        none: {
          status: {
            in: ['PENDING', 'COMPLETE']
          }
        }
      }
    },
    include: {
      privilegeRequest: {
        include: {
          privilegeSet: true
        }
      }
    }
  });

  console.info(`[PrivilegeRenewalJob] Found ${expiringPrivileges.length} privileges needing renewal records`);

  let created = 0;

  for (const privilege of expiringPrivileges) {
    try {
      // Create renewal record
      const renewal = await prisma.privilegeRenewal.create({
        data: {
          privilegeGrantedId: privilege.id,
          dueDate: privilege.expiresAt,
          status: 'PENDING',
          notificationsSent: 0
        }
      });

      // Log audit event
      await logRenewalCreated(
        renewal.id,
        privilege.id,
        privilege.clinicianDid,
        privilege.orgId,
        privilege.expiresAt
      );

      created++;
    } catch (error) {
      console.error(`[PrivilegeRenewalJob] Error creating renewal for ${privilege.id}:`, error);
    }
  }

  return created;
}

/**
 * Send renewal notifications for privileges at 90, 60, and 30 day thresholds
 */
async function sendRenewalNotifications(): Promise<number> {
  const now = new Date();
  let notificationsSent = 0;

  for (const daysUntilDue of NOTIFICATION_DAYS) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysUntilDue);

    // Find renewals due around this date that need notifications
    const renewalsToNotify = await prisma.privilegeRenewal.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          gte: new Date(targetDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
          lte: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)  // 1 day after
        },
        notificationsSent: {
          lt: getExpectedNotificationCount(daysUntilDue)
        }
      },
      include: {
        privilegeGranted: {
          include: {
            privilegeRequest: {
              include: {
                privilegeSet: true
              }
            }
          }
        }
      }
    });

    console.info(`[PrivilegeRenewalJob] Found ${renewalsToNotify.length} renewals needing ${daysUntilDue}-day notification`);

    for (const renewal of renewalsToNotify) {
      try {
        // Send notification to organization
        await sendOrganizationNotification(
          renewal.privilegeGranted.orgId,
          renewal.privilegeGranted.clinicianDid,
          renewal.id,
          renewal.privilegeGranted.id,
          daysUntilDue
        );

        // Send notification to clinician
        await sendClinicianNotification(
          renewal.privilegeGranted.clinicianDid,
          renewal.id,
          renewal.privilegeGranted.id,
          daysUntilDue
        );

        // Update notification count
        await prisma.privilegeRenewal.update({
          where: { id: renewal.id },
          data: {
            notificationsSent: {
              increment: 1
            },
            lastNotifiedAt: now
          }
        });

        // Log audit event
        await logRenewalNotified(
          renewal.id,
          renewal.privilegeGranted.id,
          renewal.privilegeGranted.clinicianDid,
          renewal.privilegeGranted.orgId,
          renewal.notificationsSent + 1,
          daysUntilDue
        );

        notificationsSent++;
      } catch (error) {
        console.error(`[PrivilegeRenewalJob] Error sending notification for renewal ${renewal.id}:`, error);
      }
    }
  }

  return notificationsSent;
}

/**
 * Mark renewals as overdue if past due date
 */
async function markOverdueRenewals(): Promise<number> {
  const now = new Date();

  const overdueRenewals = await prisma.privilegeRenewal.findMany({
    where: {
      status: 'PENDING',
      dueDate: {
        lt: now
      }
    },
    include: {
      privilegeGranted: true
    }
  });

  console.info(`[PrivilegeRenewalJob] Found ${overdueRenewals.length} overdue renewals`);

  for (const renewal of overdueRenewals) {
    try {
      // Update status to OVERDUE
      await prisma.privilegeRenewal.update({
        where: { id: renewal.id },
        data: {
          status: 'OVERDUE'
        }
      });

      // Log audit event
      await logRenewalOverdue(
        renewal.id,
        renewal.privilegeGranted.id,
        renewal.privilegeGranted.clinicianDid,
        renewal.privilegeGranted.orgId,
        renewal.dueDate
      );

      // Send overdue alert
      await sendOverdueAlert(
        renewal.privilegeGranted.orgId,
        renewal.privilegeGranted.clinicianDid,
        renewal.id,
        renewal.dueDate
      );
    } catch (error) {
      console.error(`[PrivilegeRenewalJob] Error marking renewal ${renewal.id} overdue:`, error);
    }
  }

  return overdueRenewals.length;
}

/**
 * Get expected notification count based on days until due
 */
function getExpectedNotificationCount(daysUntilDue: number): number {
  if (daysUntilDue >= 90) return 1;
  if (daysUntilDue >= 60) return 2;
  if (daysUntilDue >= 30) return 3;
  return 4;
}

/**
 * Send renewal notification to organization
 */
async function sendOrganizationNotification(
  orgId: string,
  clinicianDid: string,
  renewalId: string,
  privilegeGrantedId: string,
  daysUntilDue: number
): Promise<void> {
  // TODO: Integrate with notification service (email, Slack, etc.)
  console.info(`[PrivilegeRenewalJob] NOTIFICATION TO ORG ${orgId}:`, {
    message: `Privilege renewal due in ${daysUntilDue} days`,
    renewalId,
    privilegeGrantedId,
    clinicianDid,
    daysUntilDue,
    action: 'Review renewal requirements and approve/deny'
  });

  // Mock: In production, send actual email/notification
}

/**
 * Send renewal notification to clinician
 */
async function sendClinicianNotification(
  clinicianDid: string,
  renewalId: string,
  privilegeGrantedId: string,
  daysUntilDue: number
): Promise<void> {
  // TODO: Integrate with clinician notification service
  console.info(`[PrivilegeRenewalJob] NOTIFICATION TO CLINICIAN ${clinicianDid}:`, {
    message: `Your privilege renewal is due in ${daysUntilDue} days`,
    renewalId,
    privilegeGrantedId,
    daysUntilDue,
    action: 'Submit updated evidence for renewal review'
  });

  // Mock: In production, send actual email/notification
}

/**
 * Send overdue alert
 */
async function sendOverdueAlert(
  orgId: string,
  clinicianDid: string,
  renewalId: string,
  dueDate: Date
): Promise<void> {
  const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

  console.warn(`[PrivilegeRenewalJob] OVERDUE ALERT TO ORG ${orgId}:`, {
    message: `Privilege renewal is ${daysOverdue} days overdue`,
    renewalId,
    clinicianDid,
    dueDate,
    daysOverdue,
    urgentAction: 'Immediate review required'
  });

  // TODO: Send high-priority alert (email + PagerDuty for critical overdue)
}

/**
 * Cron schedule helper - returns cron expression for daily 6 AM
 */
export function getRenewalJobCronSchedule(): string {
  return '0 6 * * *'; // Run at 6:00 AM every day
}

