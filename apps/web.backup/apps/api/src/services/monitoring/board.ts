import type { PrismaClient } from '@prisma/client';
import { PrismaClient as PrismaDelegate } from '@prisma/client';
import { differenceInCalendarDays } from 'date-fns';
import type { MonitorRunContext, MonitorRunOutput, MonitoringResult } from './types';
import { persistMonitoringResult, scheduleNextCheck } from './types';

const prisma = new PrismaDelegate();

export async function runBoardCertificationMonitor(
  context: MonitorRunContext,
): Promise<MonitorRunOutput> {
  const client = context.prisma ?? prisma;
  const now = context.now ?? new Date();

  if (!context.userId) {
    const result: MonitoringResult = {
      clinicianId: context.id,
      itemType: 'board',
      status: 'warning',
      summary: 'No wallet user bound; board credentials unavailable',
      lastCheck: now,
      nextCheck: scheduleNextCheck('warning', now, { clear: 60, warning: 14, critical: 3 }),
      details: {
        reason: 'missing_user_link',
      },
      source: 'board_registry',
    };
    const persisted = await persistMonitoringResult(result, client);
    return {
      ...result,
      record: persisted.current,
      previous: persisted.previous,
    };
  }

  const credentials = await client.credential.findMany({
    where: { userId: context.userId, type: 'BoardCertification' },
    orderBy: { updatedAt: 'desc' },
    take: 15,
  });

  const evaluation = evaluateBoardCredentials(credentials, now);
  const result: MonitoringResult = {
    clinicianId: context.id,
    itemType: 'board',
    status: evaluation.status,
    summary: evaluation.summary,
    lastCheck: evaluation.lastCheck ?? now,
    nextCheck: scheduleNextCheck(evaluation.status, now, {
      clear: 90,
      warning: 21,
      critical: 5,
    }),
    details: evaluation.details,
    source: 'board_registry',
  };

  const persisted = await persistMonitoringResult(result, client);
  return {
    ...result,
    record: persisted.current,
    previous: persisted.previous,
  };
}

function evaluateBoardCredentials(
  credentials: Array<{
    id: string;
    updatedAt: Date;
    expiresAt: Date | null;
    status?: string | null;
    issuer?: string | null;
  }>,
  now: Date,
) {
  if (!credentials.length) {
    return {
      status: 'warning' as const,
      summary: 'Board credentials missing',
      lastCheck: null,
      details: {
        reason: 'no_board_credentials',
      },
    };
  }

  const expired = credentials.filter(
    (credential) => credential.expiresAt && credential.expiresAt < now,
  );
  const expiringSoon = credentials
    .filter((credential) => credential.expiresAt)
    .map((credential) => ({
      credential,
      days: differenceInCalendarDays(credential.expiresAt as Date, now),
    }))
    .filter((entry) => entry.days <= 120)
    .sort((a, b) => a.days - b.days);

  const lastCheck = credentials[0]?.updatedAt ?? now;
  let status: MonitoringResult['status'] = 'clear';
  let summary = 'Board certifications appear current';

  if (expired.length > 0) {
    status = 'critical';
    const sample = expired[0];
    summary = `Board credential ${sample.id} expired ${
      sample.expiresAt ? differenceInCalendarDays(now, sample.expiresAt) : 0
    } days ago`;
  } else if (expiringSoon.length > 0 && expiringSoon[0].days <= 45) {
    status = 'warning';
    summary = `Board credential due in ${expiringSoon[0].days} days`;
  }

  return {
    status,
    summary,
    lastCheck,
    details: {
      expiredCount: expired.length,
      expiringSoon: expiringSoon.slice(0, 3).map((entry) => ({
        credentialId: entry.credential.id,
        daysRemaining: entry.days,
        expiresAt: entry.credential.expiresAt?.toISOString(),
        issuer: entry.credential.issuer ?? 'ABMS/AOA',
      })),
    },
  };
}










