/**
 * S72-STRETCH-B-003: OPPE Scheduler Job
 *
 * Cron job that creates OPPE review tasks for clinicians whose nextReviewAt has passed.
 * Runs daily to identify clinicians due for OPPE review based on their OPPESchedule.
 * Logs counts of tasks created for monitoring.
 *
 * Usage: node jobs/oppeScheduler.ts
 * Or via cron: 0 0 * * * (daily at midnight)
 */

import { PrismaClient } from '@prisma/client';
import { calculateNextReviewDate } from '../services/privileging/models/OPPESchedule';

const prisma = new PrismaClient();

export interface OPPETask {
  id: string;
  clinicianId: string;
  orgId: string;
  privilegeGrantedId: string;
  nextReviewAt: Date;
  frequencyMonths: number;
}

export interface OPPESchedulerResult {
  success: boolean;
  tasksCreated: number;
  cliniciansProcessed: number;
  errors: string[];
  executedAt: Date;
}

/**
 * Main OPPE scheduler function
 * Finds clinicians with nextReviewAt <= now and creates OPPE review tasks
 */
export async function runOPPEScheduler(): Promise<OPPESchedulerResult> {
  const errors: string[] = [];
  let tasksCreated = 0;
  let cliniciansProcessed = 0;
  const now = new Date();

  try {
    console.log(`[OPPE Scheduler] Starting OPPE review task creation - ${now.toISOString()}`);

    // Find all OPPE schedules where nextReviewAt has passed
    const schedulesDue = await prisma.oPPESchedule.findMany({
      where: {
        nextReviewAt: {
          lte: now, // Due date has passed
        },
      },
      include: {
        // Note: We'll need to find PrivilegeGranted records for this clinician/org
      },
    });

    cliniciansProcessed = schedulesDue.length;
    console.log(`[OPPE Scheduler] Found ${schedulesDue.length} clinicians due for OPPE review`);

    // Process each schedule
    for (const schedule of schedulesDue) {
      try {
        // Find active PrivilegeGranted records for this clinician/org
        const activePrivileges = await prisma.privilegeGranted.findMany({
          where: {
            clinicianDid: schedule.clinicianId,
            orgId: schedule.orgId,
            status: 'ACTIVE',
          },
        });

        if (activePrivileges.length === 0) {
          console.log(
            `[OPPE Scheduler] No active privileges found for clinician ${schedule.clinicianId} in org ${schedule.orgId}`
          );
          continue;
        }

        // Create OPPE review task for each active privilege
        for (const privilege of activePrivileges) {
          const task = await createOPPETask(schedule, privilege.id, privilege.clinicianDid);
          tasksCreated++;

          // Update FppeOppe record if it exists, or create one
          await updateOrCreateFppeOppe(privilege.id, schedule);

          // Log audit event
          await prisma.auditEvent.create({
            data: {
              type: 'OPPE_TASK_CREATED',
              subjectNpi: schedule.clinicianId, // May need to map to NPI
              data: {
                clinicianId: schedule.clinicianId,
                orgId: schedule.orgId,
                privilegeGrantedId: privilege.id,
                taskId: task.id,
                nextReviewAt: schedule.nextReviewAt,
                frequencyMonths: schedule.frequencyMonths,
              },
            },
          });

          // Update schedule with next review date
          const nextReviewDate = calculateNextReviewDate(
            schedule.nextReviewAt || now,
            schedule.frequencyMonths
          );

          await prisma.oPPESchedule.update({
            where: { id: schedule.id },
            data: {
              nextReviewAt: nextReviewDate,
            },
          });
        }
      } catch (error) {
        const errorMsg = `Failed to process schedule ${schedule.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        console.error(`[OPPE Scheduler] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`[OPPE Scheduler] Completed - Created ${tasksCreated} tasks for ${cliniciansProcessed} clinicians`);

    return {
      success: errors.length === 0,
      tasksCreated,
      cliniciansProcessed,
      errors,
      executedAt: now,
    };
  } catch (error) {
    console.error('[OPPE Scheduler] Fatal error:', error);
    errors.push(error instanceof Error ? error.message : 'Unknown fatal error');
    return {
      success: false,
      tasksCreated,
      cliniciansProcessed,
      errors,
      executedAt: now,
    };
  }
}

/**
 * Create an OPPE review task
 * In production, this would create a task in your task management system
 * For now, we'll store it as structured data that can be retrieved
 */
async function createOPPETask(
  schedule: any,
  privilegeGrantedId: string,
  clinicianDid: string
): Promise<OPPETask> {
  const task: OPPETask = {
    id: `oppe_task_${schedule.id}_${privilegeGrantedId}_${Date.now()}`,
    clinicianId: schedule.clinicianId,
    orgId: schedule.orgId,
    privilegeGrantedId,
    nextReviewAt: schedule.nextReviewAt || new Date(),
    frequencyMonths: schedule.frequencyMonths,
  };

  console.log(
    `[OPPE Scheduler] Created task ${task.id} for clinician ${clinicianDid}, privilege ${privilegeGrantedId}`
  );

  // TODO: In production, create task in task management system
  // await taskService.create({...})

  return task;
}

/**
 * Update or create FppeOppe record to track OPPE status
 */
async function updateOrCreateFppeOppe(privilegeGrantedId: string, schedule: any): Promise<void> {
  // Find the PrivilegeRequest associated with this PrivilegeGranted
  const privilegeGranted = await prisma.privilegeGranted.findUnique({
    where: { id: privilegeGrantedId },
    include: {
      privilegeRequest: true,
    },
  });

  if (!privilegeGranted) {
    throw new Error(`PrivilegeGranted ${privilegeGrantedId} not found`);
  }

  // Check if FppeOppe record exists
  const existingFppeOppe = await prisma.fppeOppe.findUnique({
    where: { privilegeRequestId: privilegeGranted.privilegeRequestId },
  });

  const nextReviewDate = calculateNextReviewDate(
    schedule.nextReviewAt || new Date(),
    schedule.frequencyMonths
  );

  if (existingFppeOppe) {
    // Update existing record
    await prisma.fppeOppe.update({
      where: { id: existingFppeOppe.id },
      data: {
        oppeNextReviewDue: nextReviewDate,
        oppeStatus: 'ACTIVE',
        oppeIntervalMonths: schedule.frequencyMonths,
      },
    });
  } else {
    // Create new record
    await prisma.fppeOppe.create({
      data: {
        privilegeRequestId: privilegeGranted.privilegeRequestId,
        clinicianDid: schedule.clinicianId,
        orgId: schedule.orgId,
        oppeStatus: 'ACTIVE',
        oppeNextReviewDue: nextReviewDate,
        oppeIntervalMonths: schedule.frequencyMonths,
      },
    });
  }
}

/**
 * Get OPPE scheduler statistics
 */
export async function getOPPESchedulerStats(): Promise<{
  totalSchedules: number;
  dueNow: number;
  dueWithin30Days: number;
  dueWithin90Days: number;
}> {
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

  const [totalSchedules, dueNow, dueWithin30Days, dueWithin90Days] = await Promise.all([
    prisma.oPPESchedule.count(),
    prisma.oPPESchedule.count({
      where: {
        nextReviewAt: {
          lte: now,
        },
      },
    }),
    prisma.oPPESchedule.count({
      where: {
        nextReviewAt: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
      },
    }),
    prisma.oPPESchedule.count({
      where: {
        nextReviewAt: {
          gte: now,
          lte: ninetyDaysFromNow,
        },
      },
    }),
  ]);

  return {
    totalSchedules,
    dueNow,
    dueWithin30Days,
    dueWithin90Days,
  };
}

// If running as a standalone script
if (require.main === module) {
  runOPPEScheduler()
    .then((result) => {
      console.log('OPPE Scheduler completed:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('OPPE Scheduler failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

