/**
 * B134A-PRIV-009: Monthly OPPE Monitor Job
 *
 * Scheduled job that runs monthly to:
 * - Find clinicians with OPPE reviews due
 * - Create review tasks for organizations
 * - Send notifications to relevant parties
 *
 * Usage: node jobs/oppeMonitor.ts
 * Or via cron: 0 0 1 * * (monthly on the 1st at midnight)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface OppeReviewTask {
  id: string;
  clinicianDid: string;
  orgId: string;
  privilegeSetName: string;
  dueDate: Date;
  monthsOverdue: number;
}

/**
 * Main OPPE monitoring function
 */
export async function runOppeMonitor(): Promise<{
  reviewsFound: number;
  tasksCreated: number;
  notificationsSent: number;
  errors: string[];
}> {
  console.log(`[OPPE Monitor] Starting monthly OPPE review check - ${new Date().toISOString()}`);

  const results = {
    reviewsFound: 0,
    tasksCreated: 0,
    notificationsSent: 0,
    errors: [] as string[],
  };

  try {
    // Find all OPPE records that are due for review
    const now = new Date();

    const oppeDue = await prisma.fppeOppe.findMany({
      where: {
        oppeStatus: 'ACTIVE',
        oppeNextReviewDue: {
          lte: now, // Due date has passed
        },
      },
      include: {
        privilegeRequest: {
          include: {
            privilegeSet: true,
          },
        },
      },
    });

    results.reviewsFound = oppeDue.length;
    console.log(`[OPPE Monitor] Found ${oppeDue.length} OPPE reviews due`);

    // Process each overdue OPPE
    for (const oppe of oppeDue) {
      try {
        const reviewTask = await createReviewTask(oppe);
        results.tasksCreated++;

        // Send notification to organization
        const notificationSent = await sendOrgNotification(oppe, reviewTask);
        if (notificationSent) {
          results.notificationsSent++;
        }

        // Update OPPE record to mark notification sent
        await prisma.fppeOppe.update({
          where: { id: oppe.id },
          data: {
            notes: `OPPE review task created: ${reviewTask.id} on ${new Date().toISOString()}`,
          },
        });

        // Create audit event
        await prisma.auditEvent.create({
          data: {
            type: 'OPPE_REVIEW_DUE',
            data: {
              oppeId: oppe.id,
              clinicianDid: oppe.clinicianDid,
              orgId: oppe.orgId,
              reviewTaskId: reviewTask.id,
              dueDate: oppe.oppeNextReviewDue,
              monthsOverdue: calculateMonthsOverdue(oppe.oppeNextReviewDue!, now),
            },
          },
        });
      } catch (error) {
        const errorMsg = `Failed to process OPPE ${oppe.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        console.error(`[OPPE Monitor] ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }

    // Check for upcoming reviews (30 days out) and send reminders
    const upcomingDate = new Date();
    upcomingDate.setDate(upcomingDate.getDate() + 30);

    const oppeUpcoming = await prisma.fppeOppe.findMany({
      where: {
        oppeStatus: 'ACTIVE',
        oppeNextReviewDue: {
          gte: now,
          lte: upcomingDate,
        },
      },
      include: {
        privilegeRequest: {
          include: {
            privilegeSet: true,
          },
        },
      },
    });

    console.log(`[OPPE Monitor] Found ${oppeUpcoming.length} OPPE reviews due within 30 days`);

    for (const oppe of oppeUpcoming) {
      try {
        await sendReminderNotification(oppe);
        results.notificationsSent++;
      } catch (error) {
        console.error(`[OPPE Monitor] Failed to send reminder for OPPE ${oppe.id}:`, error);
      }
    }

    console.log(`[OPPE Monitor] Completed - Results:`, results);

    return results;
  } catch (error) {
    console.error('[OPPE Monitor] Fatal error:', error);
    results.errors.push(error instanceof Error ? error.message : 'Unknown fatal error');
    return results;
  }
}

/**
 * Create a review task for an OPPE
 */
async function createReviewTask(oppe: any): Promise<OppeReviewTask> {
  const monthsOverdue = calculateMonthsOverdue(oppe.oppeNextReviewDue, new Date());

  // In production, this would create a task in your task management system
  // For now, we'll store it as an audit event
  const task: OppeReviewTask = {
    id: `oppe_task_${oppe.id}_${Date.now()}`,
    clinicianDid: oppe.clinicianDid,
    orgId: oppe.orgId,
    privilegeSetName: oppe.privilegeRequest.privilegeSet.name,
    dueDate: oppe.oppeNextReviewDue,
    monthsOverdue,
  };

  console.log(`[OPPE Monitor] Created review task: ${task.id} for clinician ${oppe.clinicianDid}`);

  return task;
}

/**
 * Send notification to organization about due OPPE review
 */
async function sendOrgNotification(oppe: any, reviewTask: OppeReviewTask): Promise<boolean> {
  // In production, this would send actual notifications:
  // - Email to org admins
  // - In-app notifications
  // - Webhook to org's system
  // - Slack/Teams notification

  const notification = {
    type: 'OPPE_REVIEW_DUE',
    orgId: oppe.orgId,
    clinicianDid: oppe.clinicianDid,
    privilegeSet: oppe.privilegeRequest.privilegeSet.name,
    dueDate: oppe.oppeNextReviewDue,
    monthsOverdue: reviewTask.monthsOverdue,
    taskId: reviewTask.id,
    message: `OPPE review is due for clinician ${oppe.clinicianDid}. Privilege set: ${oppe.privilegeRequest.privilegeSet.name}`,
    priority: reviewTask.monthsOverdue > 1 ? 'HIGH' : 'NORMAL',
  };

  console.log(`[OPPE Monitor] Notification sent to org ${oppe.orgId}:`, notification);

  // TODO: Implement actual notification delivery
  // await emailService.send(...)
  // await webhookService.post(...)
  // await slackService.notify(...)

  return true;
}

/**
 * Send reminder notification for upcoming OPPE
 */
async function sendReminderNotification(oppe: any): Promise<void> {
  const daysUntilDue = Math.floor(
    (new Date(oppe.oppeNextReviewDue).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  const reminder = {
    type: 'OPPE_REVIEW_REMINDER',
    orgId: oppe.orgId,
    clinicianDid: oppe.clinicianDid,
    privilegeSet: oppe.privilegeRequest.privilegeSet.name,
    dueDate: oppe.oppeNextReviewDue,
    daysUntilDue,
    message: `OPPE review is due in ${daysUntilDue} days for clinician ${oppe.clinicianDid}`,
  };

  console.log(`[OPPE Monitor] Reminder sent to org ${oppe.orgId}:`, reminder);

  // TODO: Implement actual reminder delivery
}

/**
 * Calculate months overdue
 */
function calculateMonthsOverdue(dueDate: Date, currentDate: Date): number {
  const diffMs = currentDate.getTime() - dueDate.getTime();
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44); // Average month length
  return Math.max(0, Math.floor(diffMonths));
}

/**
 * Get OPPE statistics for monitoring dashboard
 */
export async function getOppeStatistics(): Promise<{
  totalActive: number;
  overdue: number;
  dueThisMonth: number;
  upcomingThreeMonths: number;
}> {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const threeMonthsOut = new Date(now.getFullYear(), now.getMonth() + 3, 0);

  const [totalActive, overdue, dueThisMonth, upcomingThreeMonths] = await Promise.all([
    prisma.fppeOppe.count({
      where: { oppeStatus: 'ACTIVE' },
    }),
    prisma.fppeOppe.count({
      where: {
        oppeStatus: 'ACTIVE',
        oppeNextReviewDue: { lt: now },
      },
    }),
    prisma.fppeOppe.count({
      where: {
        oppeStatus: 'ACTIVE',
        oppeNextReviewDue: {
          gte: now,
          lte: endOfMonth,
        },
      },
    }),
    prisma.fppeOppe.count({
      where: {
        oppeStatus: 'ACTIVE',
        oppeNextReviewDue: {
          gte: now,
          lte: threeMonthsOut,
        },
      },
    }),
  ]);

  return {
    totalActive,
    overdue,
    dueThisMonth,
    upcomingThreeMonths,
  };
}

/**
 * Manual OPPE review completion
 */
export async function completeOppeReview(
  oppeId: string,
  reviewData: {
    reviewerDid: string;
    passed: boolean;
    metrics: any;
    notes?: string;
  }
): Promise<void> {
  const oppe = await prisma.fppeOppe.findUnique({
    where: { id: oppeId },
  });

  if (!oppe) {
    throw new Error(`OPPE record ${oppeId} not found`);
  }

  // Calculate next review date
  const nextReviewDue = new Date();
  nextReviewDue.setMonth(nextReviewDue.getMonth() + oppe.oppeIntervalMonths);

  // Update OPPE record
  await prisma.fppeOppe.update({
    where: { id: oppeId },
    data: {
      oppeLastReviewDate: new Date(),
      oppeNextReviewDue: nextReviewDue,
      oppeMetrics: reviewData.metrics,
      oppeStatus: reviewData.passed ? 'ACTIVE' : 'HOLD',
      notes: reviewData.notes,
    },
  });

  // If failed, update privilege request status
  if (!reviewData.passed) {
    await prisma.privilegeRequest.update({
      where: { id: oppe.privilegeRequestId },
      data: {
        status: 'DENIED', // Or create a SUSPENDED status
        reviewNotes: `OPPE review failed: ${reviewData.notes}`,
        reviewedAt: new Date(),
      },
    });
  }

  // Create audit event
  await prisma.auditEvent.create({
    data: {
      type: 'OPPE_REVIEW_COMPLETED',
      data: {
        oppeId,
        reviewerDid: reviewData.reviewerDid,
        passed: reviewData.passed,
        nextReviewDue,
        clinicianDid: oppe.clinicianDid,
        orgId: oppe.orgId,
      },
    },
  });

  console.log(`[OPPE Monitor] Review completed for OPPE ${oppeId}, status: ${reviewData.passed ? 'PASSED' : 'FAILED'}`);
}

// If running as a standalone script
if (require.main === module) {
  runOppeMonitor()
    .then((results) => {
      console.log('OPPE Monitor completed successfully:', results);
      process.exit(0);
    })
    .catch((error) => {
      console.error('OPPE Monitor failed:', error);
      process.exit(1);
    });
}

