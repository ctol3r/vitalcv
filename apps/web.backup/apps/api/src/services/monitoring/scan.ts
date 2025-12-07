import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { PrismaClient as PrismaDelegate } from '@prisma/client';
import { anchorEvent, type AnchorRecord } from '../audit/anchor';
import { getServiceLogger } from '../../../../services/logging/serviceLogger';
import { detectMonitoringAnomalies } from './anomaly';
import { runStateBoardLicenseMonitor } from './license';
import { runBoardCertificationMonitor } from './board';
import { runDeaMateMonitor } from './dea';
import { runOigMonitor } from './oig';
import { runNpdbMonitor } from './npdb';
import type {
  MonitorRunContext,
  MonitorRunOutput,
  MonitoringAnomaly,
  MonitoringItemType,
} from './types';
import { serializeMonitoringResult } from './types';

const prisma = new PrismaDelegate();
const log = getServiceLogger('api/services/monitoring/scan');

export interface MonitoringScanOptions {
  prisma?: PrismaClient;
  now?: Date;
  anchor?: boolean;
}

export interface MonitoringScanResult {
  clinicianId: string;
  clinicianName: string | null;
  refreshedAt: string;
  items: ReturnType<typeof serializeMonitoringResult>[];
  anomalies: MonitoringAnomaly[];
  anchor?: AnchorRecord | null;
}

export async function runMonitoringScan(
  clinicianId: string,
  options: MonitoringScanOptions = {},
): Promise<MonitoringScanResult> {
  if (!clinicianId) {
    throw new Error('clinicianId is required for monitoring scan');
  }

  const client = options.prisma ?? prisma;
  const now = options.now ?? new Date();
  const clinician = await client.clinicianProfile.findUnique({
    where: { id: clinicianId },
    select: {
      id: true,
      userId: true,
      npi: true,
      state: true,
      specialty: true,
      user: {
        select: {
          id: true,
          name: true,
          did: true,
        },
      },
    },
  });

  if (!clinician) {
    throw new Error(`Clinician ${clinicianId} not found`);
  }

  const context: MonitorRunContext = {
    id: clinician.id,
    userId: clinician.userId,
    npi: clinician.npi,
    state: clinician.state,
    specialty: clinician.specialty,
    did: clinician.user?.did,
    userName: clinician.user?.name,
    prisma: client,
    now,
  };

  const previousEntries = await client.monitoringGrid.findMany({
    where: { clinicianId },
  });
  const previousMap = new Map<MonitoringItemType, typeof previousEntries[number] | null>(
    previousEntries.map((entry) => [entry.itemType as MonitoringItemType, entry]),
  );

  const outputs = await runAllMonitors(context, previousMap);
  const anomalies = detectMonitoringAnomalies(outputs, previousMap);

  const items = outputs.map((output) => serializeMonitoringResult(output));
  const shouldAnchor = options.anchor !== false;
  let anchor: AnchorRecord | null = null;
  if (shouldAnchor) {
    anchor = anchorEvent('monitoringScanAnchored', {
      clinicianId,
      runId: randomUUID(),
      refreshedAt: now.toISOString(),
      itemCount: items.length,
      items: items.map((item) => ({
        itemType: item.itemType,
        status: item.status,
        summary: item.summary,
        lastCheck: item.lastCheck,
        nextCheck: item.nextCheck,
      })),
      anomalies,
    });
  }

  return {
    clinicianId,
    clinicianName: clinician.user?.name ?? null,
    refreshedAt: now.toISOString(),
    items,
    anomalies,
    anchor,
  };
}

async function runAllMonitors(
  context: MonitorRunContext,
  previousMap: Map<MonitoringItemType, any>,
): Promise<MonitorRunOutput[]> {
  const monitorFns = [
    runStateBoardLicenseMonitor,
    runBoardCertificationMonitor,
    runDeaMateMonitor,
    runOigMonitor,
    runNpdbMonitor,
  ];

  const outputs: MonitorRunOutput[] = [];
  for (const fn of monitorFns) {
    try {
      const output = await fn(context);
      outputs.push(output);
      previousMap.set(output.itemType, output.record);
    } catch (error) {
      log.warn('monitor execution failed', {
        monitor: fn.name,
        clinicianId: context.id,
        error,
      });
    }
  }
  return outputs;
}

export async function buildMonitoringGridSnapshot(
  options: {
    prisma?: PrismaClient;
    limit?: number;
    status?: MonitoringItemType | 'critical' | 'warning' | 'clear';
  } = {},
) {
  const client = options.prisma ?? prisma;
  const limit = options.limit ?? 25;

  const rows = await client.monitoringGrid.findMany({
    include: {
      clinician: {
        select: {
          id: true,
          state: true,
          specialty: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      nextCheck: 'asc',
    },
    take: limit * 5,
  });

  const grouped = new Map<
    string,
    {
      clinicianId: string;
      clinicianName: string | null;
      state: string | null;
      specialty: string | null;
      items: typeof rows;
    }
  >();

  for (const row of rows) {
    if (
      options.status &&
      row.status !== options.status &&
      row.itemType !== options.status
    ) {
      continue;
    }
    const key = row.clinicianId;
    if (!grouped.has(key)) {
      grouped.set(key, {
        clinicianId: row.clinicianId,
        clinicianName: row.clinician.user?.name ?? null,
        state: row.clinician.state ?? null,
        specialty: row.clinician.specialty ?? null,
        items: [],
      });
    }
    grouped.get(key)?.items.push(row);
  }

  const summary = Array.from(grouped.values())
    .slice(0, limit)
    .map((group) => {
      const statusCount = group.items.reduce(
        (acc, item) => {
          acc[item.status] = (acc[item.status] ?? 0) + 1;
          return acc;
        },
        { clear: 0, warning: 0, critical: 0 } as Record<'clear' | 'warning' | 'critical', number>,
      );
      return {
        clinicianId: group.clinicianId,
        clinicianName: group.clinicianName,
        state: group.state,
        specialty: group.specialty,
        statusCount,
        items: group.items.map((item) => ({
          itemType: item.itemType,
          status: item.status,
          lastCheck: item.lastCheck.toISOString(),
          nextCheck: item.nextCheck.toISOString(),
        })),
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      clinicians: summary.length,
    },
    rows: summary,
  };
}


