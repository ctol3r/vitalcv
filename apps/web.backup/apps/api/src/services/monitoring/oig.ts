import type { PrismaClient } from '@prisma/client';
import { PrismaClient as PrismaDelegate } from '@prisma/client';
import type { MonitorRunContext, MonitorRunOutput, MonitoringResult } from './types';
import { hoursSince, persistMonitoringResult, scheduleNextCheck } from './types';

const prisma = new PrismaDelegate();
const STALE_THRESHOLD_HOURS = Number(process.env.OIG_MONITOR_STALE_HOURS ?? 24 * 7);

export async function runOigMonitor(context: MonitorRunContext): Promise<MonitorRunOutput> {
  const client = context.prisma ?? prisma;
  const now = context.now ?? new Date();

  const record = await client.npdbOigMonitor.findFirst({
    where: {
      monitorType: 'OIG',
      OR: [
        ...(context.did
          ? [
              {
                clinicianDid: context.did,
              },
            ]
          : []),
        ...(context.npi
          ? [
              {
                npi: context.npi,
              },
            ]
          : []),
      ],
    },
    orderBy: { checkDate: 'desc' },
  });

  const evaluation = evaluateOigRecord(record, now);
  const result: MonitoringResult = {
    clinicianId: context.id,
    itemType: 'sanction',
    status: evaluation.status,
    summary: evaluation.summary,
    lastCheck: evaluation.lastCheck ?? now,
    nextCheck: scheduleNextCheck(evaluation.status, now, {
      clear: 30,
      warning: 5,
      critical: 1,
    }),
    details: evaluation.details,
    source: 'oig_feed',
  };

  const persisted = await persistMonitoringResult(result, client);
  return {
    ...result,
    record: persisted.current,
    previous: persisted.previous,
  };
}

function evaluateOigRecord(
  record: {
    status?: string | null;
    adverseActions?: unknown;
    checkDate?: Date | null;
    feedDigest?: string | null;
  } | null,
  now: Date,
) {
  if (!record) {
    return {
      status: 'warning' as const,
      summary: 'No OIG exclusion evidence yet ingested',
      lastCheck: null,
      details: {
        reason: 'missing_monitor_record',
      },
    };
  }

  const adverseActions = Array.isArray(record.adverseActions)
    ? (record.adverseActions as unknown[]).length
    : typeof record.adverseActions === 'number'
      ? (record.adverseActions as number)
      : 0;
  const monitorStatus = (record.status ?? 'UNKNOWN').toUpperCase();
  const lastCheck = record.checkDate ?? now;
  const stale = hoursSince(lastCheck, now) > STALE_THRESHOLD_HOURS;

  if (monitorStatus === 'ADVERSE_ACTION' || adverseActions > 0) {
    return {
      status: 'critical' as const,
      summary: 'OIG feed reports an exclusion hit',
      lastCheck,
      details: {
        adverseActionCount: adverseActions,
        monitorStatus,
        feedDigest: record.feedDigest ?? null,
      },
    };
  }

  if (stale) {
    return {
      status: 'warning' as const,
      summary: 'OIG feed stale; refresh recommended',
      lastCheck,
      details: {
        adverseActionCount: adverseActions,
        monitorStatus,
        staleHours: hoursSince(lastCheck, now),
      },
    };
  }

  return {
    status: 'clear' as const,
    summary: 'OIG exclusion list clear',
    lastCheck,
    details: {
      adverseActionCount: adverseActions,
      monitorStatus,
    },
  };
}










