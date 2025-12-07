import type { DEACredential, PrismaClient } from '@prisma/client';
import { PrismaClient as PrismaDelegate } from '@prisma/client';
import { differenceInCalendarDays } from 'date-fns';
import type { MonitorRunContext, MonitorRunOutput, MonitoringResult } from './types';
import { persistMonitoringResult, scheduleNextCheck } from './types';

const prisma = new PrismaDelegate();
const REQUIRED_MATE_HOURS = Number(process.env.MATE_HOURS_THRESHOLD ?? 8);

export async function runDeaMateMonitor(
  context: MonitorRunContext,
): Promise<MonitorRunOutput> {
  const client = context.prisma ?? prisma;
  const now = context.now ?? new Date();

  const record = await client.dEACredential.findFirst({
    where: { clinicianId: context.id },
    orderBy: { updatedAt: 'desc' },
  });

  const evaluation = evaluateDeaRecord(record, now);
  const result: MonitoringResult = {
    clinicianId: context.id,
    itemType: 'dea',
    status: evaluation.status,
    summary: evaluation.summary,
    lastCheck: record?.updatedAt ?? now,
    nextCheck: scheduleNextCheck(evaluation.status, now, {
      clear: 45,
      warning: 14,
      critical: 3,
    }),
    details: evaluation.details,
    source: 'dea_registry',
  };

  const persisted = await persistMonitoringResult(result, client);
  return {
    ...result,
    record: persisted.current,
    previous: persisted.previous,
  };
}

function evaluateDeaRecord(record: DEACredential | null, now: Date) {
  if (!record) {
    return {
      status: 'warning' as const,
      summary: 'DEA credential not on file',
      details: {
        reason: 'missing_dea_record',
        mateHoursRecorded: 0,
      },
    };
  }

  const daysRemaining = differenceInCalendarDays(record.expiration, now);
  const mateHours = record.mateHours ?? 0;
  const details = {
    deaNumber: record.deaNumber,
    expiration: record.expiration.toISOString(),
    expiringInDays: daysRemaining,
    mateHours,
  };

  if (daysRemaining < 0) {
    return {
      status: 'critical' as const,
      summary: `DEA credential expired ${Math.abs(daysRemaining)} days ago`,
      details: {
        ...details,
        reason: 'expiration',
      },
    };
  }

  if (mateHours < REQUIRED_MATE_HOURS / 2) {
    return {
      status: 'critical' as const,
      summary: 'MATE training hours missing',
      details: {
        ...details,
        reason: 'mate_training',
        threshold: REQUIRED_MATE_HOURS,
      },
    };
  }

  if (daysRemaining < 45 || mateHours < REQUIRED_MATE_HOURS) {
    return {
      status: 'warning' as const,
      summary:
        daysRemaining < 45
          ? `DEA credential expires in ${daysRemaining} days`
          : `MATE hours (${mateHours}) below threshold (${REQUIRED_MATE_HOURS})`,
      details: {
        ...details,
        reason: daysRemaining < 45 ? 'renewal_window' : 'mate_training',
        threshold: REQUIRED_MATE_HOURS,
      },
    };
  }

  return {
    status: 'clear' as const,
    summary: 'DEA credential and MATE hours look current',
    details,
  };
}










