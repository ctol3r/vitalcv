import { PrismaClient, type MonitoringGrid } from '@prisma/client';
import { differenceInHours } from 'date-fns';

export type MonitoringItemType = 'license' | 'dea' | 'sanction' | 'board' | 'npdb';
export type MonitoringStatus = 'clear' | 'warning' | 'critical';

export interface MonitoringClinicianContext {
  id: string;
  userId?: string | null;
  npi?: string | null;
  did?: string | null;
  state?: string | null;
  specialty?: string | null;
  userName?: string | null;
}

export interface MonitoringResult {
  clinicianId: string;
  itemType: MonitoringItemType;
  status: MonitoringStatus;
  summary: string;
  lastCheck: Date;
  nextCheck: Date;
  details?: Record<string, unknown>;
  source?: string;
}

export interface MonitorRunOutput extends MonitoringResult {
  record: MonitoringGrid;
  previous?: MonitoringGrid | null;
}

export interface MonitorRunContext extends MonitoringClinicianContext {
  prisma?: PrismaClient;
  now?: Date;
}

export interface MonitoringAnomaly {
  type: 'sudden_revocation' | 'renewal_mismatch' | 'monitor_gap';
  severity: 'low' | 'medium' | 'high';
  summary: string;
  detectedAt: string;
  relatedItems: MonitoringItemType[];
}

const prisma = new PrismaClient();

export async function persistMonitoringResult(
  result: MonitoringResult,
  client: PrismaClient = prisma,
): Promise<{ current: MonitoringGrid; previous: MonitoringGrid | null }> {
  const previous = await client.monitoringGrid.findUnique({
    where: {
      clinicianId_itemType: {
        clinicianId: result.clinicianId,
        itemType: result.itemType,
      },
    },
  });

  const current = await client.monitoringGrid.upsert({
    where: {
      clinicianId_itemType: {
        clinicianId: result.clinicianId,
        itemType: result.itemType,
      },
    },
    update: {
      status: result.status,
      lastCheck: result.lastCheck,
      nextCheck: result.nextCheck,
    },
    create: {
      clinicianId: result.clinicianId,
      itemType: result.itemType,
      status: result.status,
      lastCheck: result.lastCheck,
      nextCheck: result.nextCheck,
    },
  });

  return { current, previous };
}

export function scheduleNextCheck(
  status: MonitoringStatus,
  now: Date,
  cadence: { clear: number; warning: number; critical: number },
): Date {
  const days =
    status === 'critical'
      ? cadence.critical
      : status === 'warning'
        ? cadence.warning
        : cadence.clear;
  const target = new Date(now);
  target.setDate(target.getDate() + Math.max(1, Math.round(days)));
  return target;
}

export function hoursSince(date: Date, now: Date): number {
  return differenceInHours(now, date);
}

export function statusRank(status: MonitoringStatus): number {
  switch (status) {
    case 'critical':
      return 3;
    case 'warning':
      return 2;
    case 'clear':
    default:
      return 1;
  }
}

export function serializeMonitoringResult(result: MonitoringResult) {
  return {
    itemType: result.itemType,
    status: result.status,
    summary: result.summary,
    lastCheck: result.lastCheck.toISOString(),
    nextCheck: result.nextCheck.toISOString(),
    details: result.details ?? {},
    source: result.source ?? 'system',
  };
}

export function buildSummaryFromCounts(label: string, counts: Record<string, number>): string {
  const parts = Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${value} ${key}`);
  if (!parts.length) {
    return `${label} monitoring looks healthy`;
  }
  return `${label} monitor flagged ${parts.join(', ')}`;
}


