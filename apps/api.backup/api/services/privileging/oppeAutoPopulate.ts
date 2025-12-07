/**
 * B170C-OPPE-004: Auto-populate OPPE metrics from analytics events.
 */

import { PrismaClient, AnalyticsEvent } from '@prisma/client';
import { mergeMetrics, normalizeMetrics, OPPECaseMetrics } from './models/OPPECase';

const prisma = new PrismaClient();

type AnalyticsMetricDelta = Partial<OPPECaseMetrics> & { lastEventAt?: string };

const EVENT_DELTA_MAP: Record<string, keyof OPPECaseMetrics> = {
  'jobs.match.completed': 'caseCount',
  'matcher.case.logged': 'caseCount',
  'clinical.complication.reported': 'complications',
  'psv.license.issue': 'licenseIssues',
  'psv.board.alert': 'boardAlerts',
  'psv.dea.alert': 'deaFindings',
  'compliance.issue.flagged': 'issuesFlagged',
};

export function mapAnalyticsEventToDelta(event: Pick<AnalyticsEvent, 'eventType' | 'timestamp'>): AnalyticsMetricDelta | null {
  const key = EVENT_DELTA_MAP[event.eventType];
  if (!key) {
    return null;
  }

  return {
    [key]: 1,
    lastEventAt: event.timestamp.toISOString(),
  } as AnalyticsMetricDelta;
}

export function reduceAnalyticsEvents(
  events: Pick<AnalyticsEvent, 'eventType' | 'timestamp'>[],
  baseMetrics?: OPPECaseMetrics
): OPPECaseMetrics {
  let current = baseMetrics ? { ...baseMetrics } : normalizeMetrics(undefined);

  for (const event of events) {
    const delta = mapAnalyticsEventToDelta(event);
    if (!delta) continue;

    const updated: Partial<OPPECaseMetrics> = {};
    (['caseCount', 'complications', 'issuesFlagged', 'licenseIssues', 'boardAlerts', 'deaFindings'] as const).forEach(
      (field) => {
        if (typeof delta[field] === 'number') {
          updated[field] = (current[field] ?? 0) + (delta[field] ?? 0);
        }
      }
    );

    current = mergeMetrics(current, {
      ...current,
      ...updated,
      lastEventAt: delta.lastEventAt,
    });
  }

  return current;
}

export async function autoPopulateOppeCaseFromEvents(caseId: string): Promise<OPPECaseMetrics> {
  const oppeCase = await prisma.oPPECase.findUnique({
    where: { id: caseId },
  });

  if (!oppeCase) {
    throw new Error(`OPPECase ${caseId} not found`);
  }

  const events = await prisma.analyticsEvent.findMany({
    where: {
      subjectId: oppeCase.clinicianId,
      timestamp: {
        gte: oppeCase.periodStart,
        lte: oppeCase.periodEnd,
      },
    },
    orderBy: { timestamp: 'asc' },
  });

  const baseMetrics = normalizeMetrics(oppeCase.metrics);
  const metrics = reduceAnalyticsEvents(events, baseMetrics);

  await prisma.oPPECase.update({
    where: { id: caseId },
    data: {
      metrics,
    },
  });

  return metrics;
}
