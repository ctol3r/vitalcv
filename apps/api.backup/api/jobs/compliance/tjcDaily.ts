import { randomUUID } from 'node:crypto';
import { PrismaClient as DefaultPrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../services/logging/serviceLogger.js';
import { evaluateAndPersistTJCCompliance } from '../../services/compliance/tjc/calcTJC.js';
import { detectTJCComplianceDrift } from '../../services/compliance/detectComplianceDrift.js';
import { resolveClinicianContext } from '../../services/common/clinicianContext.js';

const prisma = new DefaultPrismaClient();
const log = getServiceLogger('jobs/compliance/tjcDaily');

export interface TJCDailyJobResult {
  jobRunId: string;
  evaluated: number;
  skipped: number;
  driftEvents: number;
  notificationsSent: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

interface TJCDailyJobOptions {
  evaluationDate?: Date;
  jobRunId?: string;
  orgId?: string;
}

export async function runTJCDailyJob(options: TJCDailyJobOptions = {}): Promise<TJCDailyJobResult> {
  const startedAt = new Date();
  const evaluationDate = options.evaluationDate ?? startedAt;
  const jobRunId = options.jobRunId ?? randomUUID();

  const result: TJCDailyJobResult = {
    jobRunId,
    evaluated: 0,
    skipped: 0,
    driftEvents: 0,
    notificationsSent: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  const privileges = await prisma.privilegeGranted.findMany({
    where: {
      status: { in: ['ACTIVE', 'HOLD', 'SUSPENDED'] },
      ...(options.orgId ? { orgId: options.orgId } : {}),
    },
    select: { clinicianDid: true, orgId: true },
  });

  const targets = new Map<string, { clinicianDid: string; orgId: string | null }>();
  for (const privilege of privileges) {
    if (!privilege.clinicianDid) {
      continue;
    }
    const key = `${privilege.clinicianDid}:${privilege.orgId ?? 'none'}`;
    if (!targets.has(key)) {
      targets.set(key, { clinicianDid: privilege.clinicianDid, orgId: privilege.orgId ?? null });
    }
  }

  if (!targets.size) {
    log.info('[TJCDailyJob] No privileged clinicians found for evaluation');
    result.finishedAt = new Date();
    return result;
  }

  for (const target of targets.values()) {
    try {
      const context = await resolveClinicianContext({ clinicianDid: target.clinicianDid });
      if (!context) {
        result.skipped += 1;
        continue;
      }

      const computation = await evaluateAndPersistTJCCompliance(
        {
          clinicianId: context.clinicianId,
          clinicianDid: context.clinicianDid,
          orgId: target.orgId,
          jobRunId,
        },
        { evaluationDate, prisma }
      );
      result.evaluated += 1;

      const drift = await detectTJCComplianceDrift({
        record: computation.record,
        previousRecord: computation.previousRecord,
        clinicianDid: context.clinicianDid,
        prisma,
      });

      if (drift) {
        result.driftEvents += 1;
        result.notificationsSent += drift.notificationsSent;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('[TJCDailyJob] Failed to evaluate target', {
        clinicianDid: target.clinicianDid,
        orgId: target.orgId,
        error: message,
      });
      result.errors.push(
        `[clinician:${target.clinicianDid} org:${target.orgId ?? 'none'}] ${message}`
      );
    }
  }

  result.finishedAt = new Date();
  return result;
}

if (require.main === module) {
  runTJCDailyJob()
    .then((res) => {
      console.log('[TJCDailyJob] Completed', res);
      process.exit(res.errors.length ? 1 : 0);
    })
    .catch((error) => {
      console.error('[TJCDailyJob] Failed', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
