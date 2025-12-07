/**
 * B137A-REMIND-013: Revalidation reminder job
 *
 * Identifies enrollments nearing PECOS revalidation (5-year or 3-year DMEPOS intervals).
 * Creates reminder tasks and sends notifications at 90, 60, 30, 14, and 7 days before due date.
 * Logs all reminder events for audit trail.
 */

import { PrismaClient } from '@prisma/client';
import { needsPecosRevalidation } from '../services/payer/pecosClient.js';

const prisma = new PrismaClient();

export interface RevalidationReminder {
  enrollmentId: string;
  clinicianDid: string;
  orgId: string;
  payerId: string;
  payerName: string;
  revalidationDueAt: Date;
  daysUntilDue: number;
  reminderType: '90-day' | '60-day' | '30-day' | '14-day' | '7-day' | 'overdue';
  pecosEnrollmentId?: string;
  pecosStatus?: string;
}

export interface RevalidationJobResult {
  success: boolean;
  remindersCreated: number;
  reminders: RevalidationReminder[];
  errors: string[];
  executedAt: Date;
}

/**
 * Runs the revalidation reminder job
 *
 * Checks all APPROVED enrollments with revalidation dates and creates reminders
 * for those approaching the due date.
 */
export async function runRevalidationReminderJob(): Promise<RevalidationJobResult> {
  const errors: string[] = [];
  const reminders: RevalidationReminder[] = [];
  const now = new Date();

  try {
    console.log('[PayerRevalidation] Starting revalidation reminder job...');

    // Get all approved enrollments with revalidation dates
    const enrollments = await prisma.payerEnrollment.findMany({
      where: {
        status: 'APPROVED',
        revalidationDueAt: {
          not: null,
        },
      },
      include: {
        payer: {
          select: {
            id: true,
            payerId: true,
            name: true,
          },
        },
      },
    });

    console.log(`[PayerRevalidation] Found ${enrollments.length} enrollments with revalidation dates`);

    for (const enrollment of enrollments) {
      if (!enrollment.revalidationDueAt) continue;

      const daysUntilDue = Math.ceil(
        (enrollment.revalidationDueAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determine reminder type based on days until due
      let reminderType: RevalidationReminder['reminderType'] | null = null;

      if (daysUntilDue <= 0) {
        reminderType = 'overdue';
      } else if (daysUntilDue <= 7) {
        reminderType = '7-day';
      } else if (daysUntilDue <= 14) {
        reminderType = '14-day';
      } else if (daysUntilDue <= 30) {
        reminderType = '30-day';
      } else if (daysUntilDue <= 60) {
        reminderType = '60-day';
      } else if (daysUntilDue <= 90) {
        reminderType = '90-day';
      }

      // Only create reminders for specific thresholds
      if (reminderType) {
        // Check if reminder already sent for this threshold
        const existingReminder = await prisma.payerEnrollmentEvent.findFirst({
          where: {
            enrollmentId: enrollment.id,
            eventType: 'status_change',
            metadata: {
              path: ['reminderType'],
              equals: reminderType,
            },
            createdAt: {
              // Only send one reminder per threshold per day
              gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            },
          },
        });

        if (existingReminder) {
          console.log(
            `[PayerRevalidation] Reminder already sent for enrollment ${enrollment.id} (${reminderType})`
          );
          continue;
        }

        const reminder: RevalidationReminder = {
          enrollmentId: enrollment.id,
          clinicianDid: enrollment.clinicianDid,
          orgId: enrollment.orgId,
          payerId: enrollment.payer.id,
          payerName: enrollment.payer.name,
          revalidationDueAt: enrollment.revalidationDueAt,
          daysUntilDue,
          reminderType,
          pecosEnrollmentId: enrollment.pecosEnrollmentId || undefined,
          pecosStatus: enrollment.pecosStatus || undefined,
        };

        reminders.push(reminder);

        try {
          // Log reminder event
          await prisma.payerEnrollmentEvent.create({
            data: {
              enrollmentId: enrollment.id,
              eventType: 'status_change',
              source: 'SYSTEM',
              result: 'PASS',
              metadata: {
                action: 'revalidation_reminder',
                reminderType,
                daysUntilDue,
                revalidationDueAt: enrollment.revalidationDueAt.toISOString(),
              },
            },
          });

          // TODO: Send actual notifications
          // - Email to clinician
          // - Slack notification to org admin
          // - Dashboard notification
          console.log(
            `[PayerRevalidation] Created ${reminderType} reminder for enrollment ${enrollment.id} (due in ${daysUntilDue} days)`
          );
        } catch (error) {
          const errorMsg = `Failed to create reminder for enrollment ${enrollment.id}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
          console.error(`[PayerRevalidation] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }

    console.log(`[PayerRevalidation] Job completed. Created ${reminders.length} reminders`);

    return {
      success: errors.length === 0,
      remindersCreated: reminders.length,
      reminders,
      errors,
      executedAt: now,
    };
  } catch (error) {
    const errorMsg = `Revalidation reminder job failed: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`;
    console.error(`[PayerRevalidation] ${errorMsg}`);
    errors.push(errorMsg);

    return {
      success: false,
      remindersCreated: reminders.length,
      reminders,
      errors,
      executedAt: now,
    };
  }
}

/**
 * Gets upcoming revalidations (next 90 days)
 */
export async function getUpcomingRevalidations(
  daysAhead: number = 90
): Promise<RevalidationReminder[]> {
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const enrollments = await prisma.payerEnrollment.findMany({
    where: {
      status: 'APPROVED',
      revalidationDueAt: {
        gte: now,
        lte: futureDate,
      },
    },
    include: {
      payer: {
        select: {
          id: true,
          payerId: true,
          name: true,
        },
      },
    },
    orderBy: {
      revalidationDueAt: 'asc',
    },
  });

  return enrollments.map((enrollment) => {
    const daysUntilDue = Math.ceil(
      (enrollment.revalidationDueAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    let reminderType: RevalidationReminder['reminderType'] = '90-day';
    if (daysUntilDue <= 7) reminderType = '7-day';
    else if (daysUntilDue <= 14) reminderType = '14-day';
    else if (daysUntilDue <= 30) reminderType = '30-day';
    else if (daysUntilDue <= 60) reminderType = '60-day';

    return {
      enrollmentId: enrollment.id,
      clinicianDid: enrollment.clinicianDid,
      orgId: enrollment.orgId,
      payerId: enrollment.payer.id,
      payerName: enrollment.payer.name,
      revalidationDueAt: enrollment.revalidationDueAt!,
      daysUntilDue,
      reminderType,
      pecosEnrollmentId: enrollment.pecosEnrollmentId || undefined,
      pecosStatus: enrollment.pecosStatus || undefined,
    };
  });
}

/**
 * Gets overdue revalidations
 */
export async function getOverdueRevalidations(): Promise<RevalidationReminder[]> {
  const now = new Date();

  const enrollments = await prisma.payerEnrollment.findMany({
    where: {
      status: 'APPROVED',
      revalidationDueAt: {
        lt: now,
      },
    },
    include: {
      payer: {
        select: {
          id: true,
          payerId: true,
          name: true,
        },
      },
    },
    orderBy: {
      revalidationDueAt: 'asc',
    },
  });

  return enrollments.map((enrollment) => {
    const daysUntilDue = Math.floor(
      (enrollment.revalidationDueAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      enrollmentId: enrollment.id,
      clinicianDid: enrollment.clinicianDid,
      orgId: enrollment.orgId,
      payerId: enrollment.payer.id,
      payerName: enrollment.payer.name,
      revalidationDueAt: enrollment.revalidationDueAt!,
      daysUntilDue,
      reminderType: 'overdue',
      pecosEnrollmentId: enrollment.pecosEnrollmentId || undefined,
      pecosStatus: enrollment.pecosStatus || undefined,
    };
  });
}

/**
 * CLI entry point for running the job manually
 */
if (require.main === module) {
  runRevalidationReminderJob()
    .then((result) => {
      console.log('\n=== Revalidation Reminder Job Results ===');
      console.log(`Success: ${result.success}`);
      console.log(`Reminders Created: ${result.remindersCreated}`);
      console.log(`Errors: ${result.errors.length}`);
      if (result.errors.length > 0) {
        console.log('\nErrors:', result.errors);
      }
      if (result.reminders.length > 0) {
        console.log('\nReminders:');
        result.reminders.forEach((r) => {
          console.log(
            `- ${r.payerName}: ${r.clinicianDid} (${r.reminderType}, ${r.daysUntilDue} days)`
          );
        });
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

