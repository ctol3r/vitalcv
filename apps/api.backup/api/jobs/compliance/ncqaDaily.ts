import { PrismaClient } from '@prisma/client';
import { calculateNCQAComplianceRecords, summarizeCompliance } from '../../services/compliance/ncqa/calcNCQA';
import { shouldAlertOnCompliance } from '../../services/compliance/models/NCQAComplianceRecord';
import { getServiceLogger } from '../../services/logging/serviceLogger';

const prisma = new PrismaClient();
const log = getServiceLogger('jobs/compliance/ncqaDaily');

export interface NCQADailyJobOptions {
  clinicianIds?: string[];
  limit?: number;
  asOf?: Date;
}

export interface NCQADailyJobResult {
  processed: number;
  recordsWritten: number;
  alerts: Array<{
    clinicianId: string;
    ruleCode: string;
    status: string;
    notes?: string | null;
  }>;
  summary: ReturnType<typeof summarizeCompliance>;
}

export async function runNCQADailyJob(options: NCQADailyJobOptions = {}): Promise<NCQADailyJobResult> {
  const asOf = options.asOf ?? new Date();
  const clinicianFilter = options.clinicianIds?.length
    ? { where: { id: { in: options.clinicianIds } } }
    : {};

  const clinicians = await prisma.clinicianProfile.findMany({
    ...clinicianFilter,
    select: { id: true, npi: true },
    orderBy: { createdAt: 'asc' },
    take: options.limit,
  });

  let recordsWritten = 0;
  const aggregatedAlerts: NCQADailyJobResult['alerts'] = [];
  const allRecords = [];

  for (const clinician of clinicians) {
    const records = await calculateNCQAComplianceRecords(clinician.id, {
      prisma,
      asOf,
    });

    for (const record of records) {
      await prisma.nCQAComplianceRecord.upsert({
        where: {
          clinicianId_ruleCode: {
            clinicianId: clinician.id,
            ruleCode: record.ruleCode,
          },
        },
        update: {
          status: record.status,
          lastVerifiedAt: record.lastVerifiedAt,
          nextDueAt: record.nextDueAt,
          evidenceRefs: record.evidenceRefs,
          notes: record.notes,
          metadata: record.metadata ?? undefined,
        },
        create: {
          clinicianId: clinician.id,
          ruleCode: record.ruleCode,
          status: record.status,
          lastVerifiedAt: record.lastVerifiedAt,
          nextDueAt: record.nextDueAt,
          evidenceRefs: record.evidenceRefs,
          notes: record.notes,
          metadata: record.metadata ?? undefined,
        },
      });

      recordsWritten += 1;
      if (shouldAlertOnCompliance(record)) {
        aggregatedAlerts.push({
          clinicianId: clinician.id,
          ruleCode: record.ruleCode,
          status: record.status,
          notes: record.notes ?? null,
        });
      }
    }

    allRecords.push(...records);
  }

  const summary = summarizeCompliance(allRecords);

  aggregatedAlerts.forEach((alert) => {
    log.warn('NCQA compliance alert', {
      clinicianId: alert.clinicianId,
      ruleCode: alert.ruleCode,
      status: alert.status,
      notes: alert.notes,
      asOf: asOf.toISOString(),
    });
  });

  log.info('NCQA daily job completed', {
    processed: clinicians.length,
    recordsWritten,
    alerts: aggregatedAlerts.length,
    asOf: asOf.toISOString(),
  });

  return {
    processed: clinicians.length,
    recordsWritten,
    alerts: aggregatedAlerts,
    summary,
  };
}

export async function handler() {
  return runNCQADailyJob();
}

if (require.main === module) {
  runNCQADailyJob()
    .then((result) => {
      log.info('NCQA daily job run complete', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('[ncqaDaily] job failed', error);
      process.exit(1);
    });
}
