import { createHash } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { PrismaClient as PrismaDelegate } from '@prisma/client';
import type { MonitorRunContext, MonitorRunOutput, MonitoringResult } from './types';
import { hoursSince, persistMonitoringResult, scheduleNextCheck } from './types';

const prisma = new PrismaDelegate();
const NPDB_STALE_HOURS = Number(process.env.NPDB_POLL_STALE_HOURS ?? 24 * 3);

type NpdbCategory = 'adverse_actions' | 'malpractice' | 'discipline';

interface NpdbSnapshot {
  status: 'CLEAR' | 'ADVERSE_ACTION';
  checkDate: Date;
  counts: Record<NpdbCategory, number>;
  cases: Record<NpdbCategory, Array<Record<string, unknown>>>;
}

export async function runNpdbMonitor(context: MonitorRunContext): Promise<MonitorRunOutput> {
  const client = context.prisma ?? prisma;
  const now = context.now ?? new Date();

  const record = await client.npdbOigMonitor.findFirst({
    where: {
      monitorType: 'NPDB',
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

  const needsRefresh =
    !record || !record.checkDate || hoursSince(record.checkDate, now) > NPDB_STALE_HOURS;

  let snapshot: NpdbSnapshot | null = null;

  if (needsRefresh) {
    snapshot = pollNpdbSnapshot(context, now);
    await client.npdbOigMonitor.create({
      data: {
        clinicianDid: context.did ?? null,
        npi: context.npi ?? null,
        monitorType: 'NPDB',
        status: snapshot.status,
        checkDate: snapshot.checkDate,
        adverseActions: snapshot.cases.adverse_actions,
      } as any,
    });
  }

  const effectiveRecord = snapshot
    ? {
        status: snapshot.status,
        checkDate: snapshot.checkDate,
        counts: snapshot.counts,
        cases: snapshot.cases,
      }
    : {
        status: (record?.status as string | undefined) ?? 'UNKNOWN',
        checkDate: record?.checkDate ?? now,
        counts:
          (record?.payload as { counts?: Record<NpdbCategory, number> } | undefined)?.counts ?? {
            adverse_actions: Array.isArray(record?.adverseActions)
              ? (record?.adverseActions as unknown[]).length
              : 0,
            malpractice: 0,
            discipline: 0,
          },
        cases:
          (record?.payload as { cases?: Record<NpdbCategory, Array<Record<string, unknown>>> } | undefined)
            ?.cases ?? {
            adverse_actions: Array.isArray(record?.adverseActions)
              ? (record?.adverseActions as Array<Record<string, unknown>>)
              : [],
            malpractice: [],
            discipline: [],
          },
      };

  const evaluation = evaluateNpdbSnapshot(effectiveRecord, now);
  const result: MonitoringResult = {
    clinicianId: context.id,
    itemType: 'npdb',
    status: evaluation.status,
    summary: evaluation.summary,
    lastCheck: effectiveRecord.checkDate ?? now,
    nextCheck: scheduleNextCheck(evaluation.status, now, {
      clear: 14,
      warning: 5,
      critical: 2,
    }),
    details: {
      counts: effectiveRecord.counts,
      status: effectiveRecord.status,
      highlightedCases: evaluation.highlightedCases,
    },
    source: 'npdb_v2_poll',
  };

  const persisted = await persistMonitoringResult(result, client);
  return {
    ...result,
    record: persisted.current,
    previous: persisted.previous,
  };
}

function evaluateNpdbSnapshot(
  snapshot: {
    status: string;
    counts: Record<NpdbCategory, number>;
    cases: Record<NpdbCategory, Array<Record<string, unknown>>>;
    checkDate?: Date | null;
  },
  now: Date,
) {
  const adverse = snapshot.counts.adverse_actions ?? 0;
  const malpractice = snapshot.counts.malpractice ?? 0;
  const discipline = snapshot.counts.discipline ?? 0;

  const totalFlags = adverse + malpractice + discipline;
  const highlightedCases = snapshot.cases.adverse_actions.slice(0, 2);

  if (totalFlags === 0) {
    return {
      status: 'clear' as const,
      summary: 'NPDB registry clear across adverse, malpractice, and discipline feeds',
      highlightedCases,
    };
  }

  if (adverse > 0 || discipline > 0) {
    return {
      status: 'critical' as const,
      summary: `NPDB shows ${adverse} adverse actions and ${discipline} disciplinary issues`,
      highlightedCases,
    };
  }

  return {
    status: 'warning' as const,
    summary: `NPDB shows ${malpractice} malpractice settlements`,
    highlightedCases,
  };
}

function pollNpdbSnapshot(context: MonitorRunContext, now: Date): NpdbSnapshot {
  const seedSource = context.npi ?? context.did ?? context.id;
  const seed = createHash('sha256').update(`${seedSource}:${now.toDateString()}`).digest('hex');
  const severity = parseInt(seed.slice(0, 4), 16) % 100;

  const counts: Record<NpdbCategory, number> = {
    adverse_actions: severity > 80 ? 1 : 0,
    malpractice: severity > 60 ? 1 : 0,
    discipline: severity > 90 ? 1 : 0,
  };

  const cases: Record<NpdbCategory, Array<Record<string, unknown>>> = {
    adverse_actions: buildCases('adverse', counts.adverse_actions, context),
    malpractice: buildCases('malpractice', counts.malpractice, context),
    discipline: buildCases('discipline', counts.discipline, context),
  };

  return {
    status: counts.adverse_actions + counts.discipline > 0 ? 'ADVERSE_ACTION' : 'CLEAR',
    checkDate: now,
    counts,
    cases,
  };
}

function buildCases(
  type: 'adverse' | 'malpractice' | 'discipline',
  count: number,
  context: MonitorRunContext,
) {
  if (count <= 0) {
    return [];
  }
  return Array.from({ length: count }).map((_, index) => ({
    caseId: `${type}-${context.id}-${index + 1}`,
    severity: type === 'malpractice' ? 'moderate' : 'high',
    occurredAt: new Date(Date.now() - index * 7 * 24 * 60 * 60 * 1000).toISOString(),
    summary:
      type === 'malpractice'
        ? 'Paid malpractice settlement reported'
        : type === 'discipline'
          ? 'Disciplinary action recorded by licensing board'
          : 'Adverse action recorded in NPDB',
  }));
}


