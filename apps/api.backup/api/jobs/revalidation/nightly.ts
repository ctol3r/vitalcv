import { PrismaClient } from '@prisma/client';
import { calculateRevalidationTasks } from '../../services/revalidation/calc.js';
import { RevalidationTask } from '../../services/revalidation/models/RevalidationTask.js';
import {
  recordTaskNotification,
  shouldNotify,
  upsertRevalidationTask,
} from '../../services/revalidation/revalidationTaskService.js';
import { createNotification } from '../../services/notifications/notificationService.js';

const prisma = new PrismaClient();

export interface NightlyRevalidationJobResult {
  cliniciansProcessed: number;
  tasksComputed: number;
  tasksUpserted: number;
  notificationsSent: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function runNightlyRevalidationJob(referenceDate = new Date()): Promise<NightlyRevalidationJobResult> {
  const startedAt = new Date();
  const stats: NightlyRevalidationJobResult = {
    cliniciansProcessed: 0,
    tasksComputed: 0,
    tasksUpserted: 0,
    notificationsSent: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  try {
    const clinicians = await prisma.clinicianProfile.findMany({
      select: {
        id: true,
        userId: true,
        npi: true,
        specialty: true,
      },
    });

    if (clinicians.length === 0) {
      stats.finishedAt = new Date();
      return stats;
    }

    const clinicianIds = clinicians.map((c) => c.id);
    const userIdToClinicianId = new Map<string, string>(clinicians.map((c) => [c.userId, c.id]));

    const [pecosProviders, pecosEnrollments, licenseVerifications, credentials] = await Promise.all([
      prisma.pECOSProvider.findMany({
        where: { clinicianId: { in: clinicianIds } },
      }),
      prisma.pECOSEnrollment.findMany({
        where: { clinicianId: { in: clinicianIds } },
      }),
      prisma.stateLicenseVerification.findMany({
        where: { clinicianId: { in: clinicianIds } },
      }),
      prisma.credential.findMany({
        where: {
          userId: { in: Array.from(userIdToClinicianId.keys()) },
          type: { in: ['DEARegistration', 'BoardCertification'] },
        },
      }),
    ]);

    const pecosByClinician = groupBy(clinicianIds, pecosProviders, 'clinicianId');
    const pecosLifecycleByClinician = groupBy(clinicianIds, pecosEnrollments, 'clinicianId');
    const licensesByClinician = groupBy(clinicianIds, licenseVerifications, 'clinicianId');

    const deaByClinician = new Map<string, any[]>();
    const boardByClinician = new Map<string, any[]>();
    credentials.forEach((cred) => {
      const clinicianId = userIdToClinicianId.get(cred.userId);
      if (!clinicianId) return;

      const targetMap = cred.type === 'DEARegistration' ? deaByClinician : boardByClinician;
      const entry = targetMap.get(clinicianId) ?? [];
      entry.push(cred);
      targetMap.set(clinicianId, entry);
    });

    for (const clinician of clinicians) {
      try {
        const tasks = calculateRevalidationTasks({
          clinicianId: clinician.id,
          npi: clinician.npi,
          clinicianName: clinician.id,
          pecos: buildPecosTaskInput(
            pecosLifecycleByClinician.get(clinician.id) ?? [],
            pecosByClinician.get(clinician.id) ?? []
          ),
          licenses: (licensesByClinician.get(clinician.id) ?? []).map((verification: any) => ({
            state: verification.state,
            licenseNumber: verification.licenseNumber,
            expiresAt: verification.expiryDate ?? undefined,
            status: verification.status,
            evidenceUrl: verification.sourceMetadata?.evidenceUrl,
          })),
          dea: (deaByClinician.get(clinician.id) ?? []).map((cred: any) => ({
            registrationNumber: cred.name || cred.id,
            expiresAt: cred.expiresAt ?? undefined,
            status: cred.status?.toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED',
            evidenceUrl: undefined,
          })),
          boardCerts: (boardByClinician.get(clinician.id) ?? []).map((cred: any) => ({
            board: cred.issuer || 'Board Certification',
            specialty: cred.name || clinician.specialty,
            expiresAt: cred.expiresAt ?? undefined,
            status: cred.status?.toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'LAPSED',
            evidenceUrl: undefined,
          })),
          referenceDate,
        });

        stats.cliniciansProcessed += 1;
        stats.tasksComputed += tasks.length;

        for (const task of tasks) {
          try {
            const persisted = await upsertRevalidationTask(task);
            stats.tasksUpserted += 1;

            if (isDueWithinThirtyDays(task.dueDate, referenceDate) && shouldNotify(persisted, referenceDate)) {
              await createNotification(clinician.userId, 'revalidation.task.due', buildNotificationPayload(persisted));
              await recordTaskNotification(persisted.id);
              stats.notificationsSent += 1;
            }
          } catch (taskError) {
            stats.errors.push(
              `[clinician:${clinician.id}] Failed to upsert task ${task.metadata?.referenceId || task.type}: ${
                taskError instanceof Error ? taskError.message : String(taskError)
              }`
            );
          }
        }
      } catch (error) {
        stats.errors.push(
          `[clinician:${clinician.id}] Failed to compute tasks: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  } catch (error) {
    stats.errors.push(`Nightly job failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    stats.finishedAt = new Date();
  }

  return stats;
}

function buildPecosTaskInput(lifecycleEntries: any[], providerEntries: any[]) {
  if (lifecycleEntries.length === 0) {
    return providerEntries.map((record: any) => ({
      enrollmentId: record.id,
      payerName: record.metadata?.payerName ?? record.enrollmentType,
      revalidationDueDate: record.revalidationDate ?? undefined,
      cycle: record.metadata?.cycle,
      status: mapProviderStatusValue(record.status),
    }));
  }

  return lifecycleEntries.map((entry: any) => {
    const provider = providerEntries.find(
      (record: any) => record.enrollmentType === entry.enrollmentType
    );
    return {
      enrollmentId: entry.id,
      payerName:
        provider?.metadata?.payerName ?? provider?.enrollmentType ?? entry.enrollmentType,
      revalidationDueDate: entry.revalidationDueAt ?? undefined,
      cycle: provider?.metadata?.cycle,
      status: mapLifecycleStatusValue(entry.currentStatus),
    };
  });
}

function mapLifecycleStatusValue(status: string): 'APPROVED' | 'PENDING' | 'DENIED' {
  switch (status) {
    case 'PENDING':
      return 'PENDING';
    case 'DEACTIVATED':
      return 'DENIED';
    case 'REVALIDATION_DUE':
      return 'PENDING';
    default:
      return 'APPROVED';
  }
}

function mapProviderStatusValue(status: string): 'APPROVED' | 'PENDING' | 'DENIED' {
  switch (status) {
    case 'PENDING':
      return 'PENDING';
    case 'REJECTED':
    case 'DEACTIVATED':
      return 'DENIED';
    default:
      return 'APPROVED';
  }
}

function isDueWithinThirtyDays(dueDate: Date, referenceDate: Date) {
  const diff = dueDate.getTime() - referenceDate.getTime();
  return diff <= THIRTY_DAYS_MS;
}

function buildNotificationPayload(task: RevalidationTask) {
  return {
    taskId: task.id,
    type: task.type,
    status: task.status,
    dueDate: task.dueDate,
    notes: task.notes,
    metadata: task.metadata,
  };
}

function groupBy<T extends Record<string, any>>(keys: string[], items: T[], key: keyof T) {
  const map = new Map<string, T[]>();
  keys.forEach((k) => map.set(k, []));
  items.forEach((item) => {
    const value = item[key];
    if (typeof value === 'string' && map.has(value)) {
      map.get(value)!.push(item);
    }
  });
  return map;
}

if (require.main === module) {
  runNightlyRevalidationJob()
    .then((result) => {
      console.log('[RevalidationNightly] Job complete', result);
      process.exit(result.errors.length ? 1 : 0);
    })
    .catch((error) => {
      console.error('[RevalidationNightly] Job failed', error);
      process.exit(1);
    });
}
