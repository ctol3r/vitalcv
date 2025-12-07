import type { PrismaClient, StateLicenseVerification } from '@prisma/client';
import { PrismaClient as PrismaDelegate } from '@prisma/client';
import { differenceInCalendarDays } from 'date-fns';
import type { MonitorRunContext, MonitorRunOutput, MonitoringResult } from './types';
import { persistMonitoringResult, scheduleNextCheck } from './types';

const prisma = new PrismaDelegate();

export async function runStateBoardLicenseMonitor(
  context: MonitorRunContext,
): Promise<MonitorRunOutput> {
  const client = context.prisma ?? prisma;
  const clinicianId = context.id;
  const now = context.now ?? new Date();

  const records = await client.stateLicenseVerification.findMany({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  if (!records.length) {
    const result: MonitoringResult = {
      clinicianId,
      itemType: 'license',
      status: 'critical',
      summary: 'No verified state license records detected',
      lastCheck: now,
      nextCheck: scheduleNextCheck('critical', now, { clear: 30, warning: 10, critical: 1 }),
      details: {
        reason: 'missing_license_records',
      },
      source: 'state_license_cache',
    };
    const persisted = await persistMonitoringResult(result, client);
    return {
      ...result,
      record: persisted.current,
      previous: persisted.previous,
    };
  }

  const latest = records[0];
  const lastCheck =
    latest.lastCheckedAt ?? latest.updatedAt ?? latest.createdAt ?? now;
  const statusSummary = analyzeLicenseSet(records, now);

  const result: MonitoringResult = {
    clinicianId,
    itemType: 'license',
    status: statusSummary.status,
    summary: statusSummary.summary,
    lastCheck,
    nextCheck: scheduleNextCheck(statusSummary.status, now, {
      clear: 30,
      warning: 7,
      critical: 1,
    }),
    details: {
      totalLicenses: records.length,
      expiringSoon: statusSummary.expiringSoon,
      expiredCount: statusSummary.expired.length,
      revoked: statusSummary.revoked,
      sample: {
        state: latest.state,
        licenseNumber: latest.licenseNumber,
        expiryDate: latest.expiryDate?.toISOString() ?? null,
        boardStatus: latest.status ?? null,
      },
    },
    source: latest.source ?? 'state_license_cache',
  };

  const persisted = await persistMonitoringResult(result, client);
  return {
    ...result,
    record: persisted.current,
    previous: persisted.previous,
  };
}

function analyzeLicenseSet(records: StateLicenseVerification[], now: Date) {
  const expired = records.filter(
    (license) => license.expiryDate && license.expiryDate < now,
  );
  const revoked = records.filter((license) =>
    isRevokedStatus(license.status),
  ).length;

  const soonest = records
    .filter((license) => license.expiryDate)
    .map((license) => ({
      license,
      days: differenceInCalendarDays(license.expiryDate as Date, now),
    }))
    .sort((a, b) => a.days - b.days)[0];

  const expiringSoon = typeof soonest?.days === 'number' ? Math.max(0, soonest.days) : null;

  let status: MonitoringResult['status'] = 'clear';
  let summary = 'All monitored licenses align with board data';

  if (revoked > 0) {
    status = 'critical';
    summary = 'Board registry shows revoked or suspended status';
  } else if (expired.length > 0) {
    status = 'critical';
    const sample = expired[0];
    summary = `License ${sample.licenseNumber ?? ''} expired ${formatDaysAgo(
      sample.expiryDate as Date,
      now,
    )}`;
  } else if (expiringSoon !== null && expiringSoon < 45) {
    status = 'warning';
    summary =
      expiringSoon <= 0
        ? 'License expiration date reached'
        : `Next renewal due in ${expiringSoon} days`;
  }

  return {
    status,
    summary,
    expired,
    expiringSoon,
    revoked: revoked > 0,
  };
}

function formatDaysAgo(date: Date, now: Date): string {
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) {
    return 'today';
  }
  if (days === 1) {
    return '1 day ago';
  }
  return `${days} days ago`;
}

function isRevokedStatus(status?: string | null): boolean {
  if (!status) {
    return false;
  }
  const normalized = status.toUpperCase();
  return normalized.includes('REVOKED') || normalized.includes('SUSPENDED');
}










