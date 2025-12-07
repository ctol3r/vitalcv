/**
 * B170C-OPPE-002: OPPE monthly case generator
 *
 * Runs on a monthly cadence (cron) to translate due OPPEScheduleV2 rows into
 * OPPECase entries per privilege code. Each OPPECase is later automatically
 * populated with metrics from analytics events.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  calculateNextDueAt,
  getEvaluationWindow,
  mergeMetricsConfig,
  normalizeMetricsConfig,
} from '../../services/privileging/models/OPPEScheduleV2';
import {
  OPPECaseMetrics,
  initializeMetricsFromTargets,
  normalizeMetrics,
} from '../../services/privileging/models/OPPECase';
import type { Procedure } from '../../services/privileging/models/PrivilegeSet';

const prisma = new PrismaClient();

export interface MonthlyGeneratorStats {
  success: boolean;
  schedulesProcessed: number;
  casesCreated: number;
  privilegesEvaluated: number;
  cliniciansTouched: number;
  errors: string[];
  executedAt: Date;
}

export async function runMonthlyOppeGenerator(asOf = new Date()): Promise<MonthlyGeneratorStats> {
  const errors: string[] = [];
  let casesCreated = 0;
  let privilegesEvaluated = 0;
  const cliniciansTouched = new Set<string>();

  try {
    const schedules = await prisma.oPPEScheduleV2.findMany({
      where: {
        nextDueAt: {
          lte: asOf,
        },
      },
    });

    for (const schedule of schedules) {
      try {
        const window = getEvaluationWindow(schedule.nextDueAt ?? asOf, schedule.frequencyMonths);
        const targets = mergeMetricsConfig(normalizeMetricsConfig(schedule.metricsConfig), {});
        const privileges = await prisma.privilegeGranted.findMany({
          where: {
            orgId: schedule.orgId,
            clinicianDid: schedule.clinicianId,
            status: 'ACTIVE',
          },
          include: {
            privilegeSet: true,
          },
        });

        if (privileges.length === 0) {
          continue;
        }

        privilegesEvaluated += privileges.length;
        cliniciansTouched.add(schedule.clinicianId);

        for (const privilege of privileges) {
          const privilegeCodes = extractPrivilegeCodes(privilege.privilegeSet?.procedures ?? []);

          for (const code of privilegeCodes) {
            const existing = await prisma.oPPECase.findFirst({
              where: {
                scheduleId: schedule.id,
                privilegeCode: code,
                periodStart: window.periodStart,
              },
            });

            if (existing) {
              continue;
            }

            const baseMetrics = initializeMetricsFromTargets(targets);

            await prisma.oPPECase.create({
              data: {
                scheduleId: schedule.id,
                clinicianId: schedule.clinicianId,
                orgId: schedule.orgId,
                privilegeGrantedId: privilege.id,
                privilegeCode: code,
                periodStart: window.periodStart,
                periodEnd: window.periodEnd,
                metrics: baseMetrics as Prisma.InputJsonValue,
              },
            });

            casesCreated += 1;
          }
        }

        await prisma.oPPEScheduleV2.update({
          where: { id: schedule.id },
          data: {
            nextDueAt: calculateNextDueAt(window.periodEnd, schedule.frequencyMonths),
            lastCaseGeneratedAt: asOf,
          },
        });
      } catch (error) {
        errors.push(
          `Failed to process schedule ${schedule.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return {
      success: errors.length === 0,
      schedulesProcessed: schedules.length,
      casesCreated,
      privilegesEvaluated,
      cliniciansTouched: cliniciansTouched.size,
      errors,
      executedAt: asOf,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown fatal error');
    return {
      success: false,
      schedulesProcessed: 0,
      casesCreated,
      privilegesEvaluated,
      cliniciansTouched: cliniciansTouched.size,
      errors,
      executedAt: asOf,
    };
  }
}

function extractPrivilegeCodes(rawProcedures: unknown): string[] {
  if (!Array.isArray(rawProcedures)) {
    return [];
  }

  const codes = new Set<string>();
  for (const entry of rawProcedures) {
    if (typeof entry === 'string') {
      codes.add(entry);
      continue;
    }

    const procedure = entry as Procedure;
    if (procedure?.code) {
      codes.add(procedure.code);
    } else if (procedure?.name) {
      codes.add(procedure.name);
    }
  }

  return Array.from(codes);
}

export async function getOppeGenerationPreview() {
  const schedules = await prisma.oPPEScheduleV2.count();
  const dueSoon = await prisma.oPPEScheduleV2.count({
    where: {
      nextDueAt: {
        lte: calculateNextDueAt(new Date(), 1),
      },
    },
  });

  return {
    totalSchedules: schedules,
    dueWithinNextMonth: dueSoon,
  };
}

if (require.main === module) {
  runMonthlyOppeGenerator()
    .then((result) => {
      console.log('[OPPE Monthly Generator] Completed:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('[OPPE Monthly Generator] Failed:', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
