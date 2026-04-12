/**
 * matchEffectivenessService.ts — Tracks and computes match quality metrics per opportunity.
 *
 * Aggregates learning events to compute view→click→apply→accept conversion rates.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

export interface MatchEffectiveness {
  opportunityId: string;
  viewCount: number;
  clickCount: number;
  applyCount: number;
  acceptCount: number;
  rejectCount: number;
  requestInfoCount: number;
  matchEffectivenessScore: number | null;
  clickThroughRate: number | null;
  applyRate: number | null;
}

export interface EmployerMatchSummary {
  employerId: string;
  totalDecisions: number;
  acceptCount: number;
  rejectCount: number;
  requestInfoCount: number;
  acceptRate: number | null;
  avgReadinessAtAccept: number | null;
  avgReadinessAtReject: number | null;
  commonMissingFields: string[];
}

async function countEvents(filters: { eventType: string; relatedId?: string; sourceId?: string }): Promise<number> {
  return prisma.learningEvent.count({
    where: {
      eventType: filters.eventType,
      loopType: 'USAGE_TRACKING',
      ...(filters.relatedId ? { relatedId: filters.relatedId } : {}),
      ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
    },
  });
}

function safeRate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 1000 : null;
}

export async function getMatchEffectiveness(opportunityId: string): Promise<MatchEffectiveness> {
  const [viewCount, clickCount, applyCount, acceptCount, rejectCount, requestInfoCount] =
    await Promise.all([
      countEvents({ eventType: 'JOB_VIEWED', relatedId: opportunityId }),
      countEvents({ eventType: 'JOB_CLICKED', relatedId: opportunityId }),
      countEvents({ eventType: 'APPLICATION_SUBMITTED', relatedId: opportunityId }),
      countEvents({ eventType: 'EMPLOYER_ACCEPTED', relatedId: opportunityId }),
      countEvents({ eventType: 'EMPLOYER_REJECTED', relatedId: opportunityId }),
      countEvents({ eventType: 'EMPLOYER_REQUESTED_INFO', relatedId: opportunityId }),
    ]);

  return {
    opportunityId,
    viewCount,
    clickCount,
    applyCount,
    acceptCount,
    rejectCount,
    requestInfoCount,
    matchEffectivenessScore: safeRate(acceptCount, applyCount),
    clickThroughRate: safeRate(clickCount, viewCount),
    applyRate: safeRate(applyCount, clickCount),
  };
}

export async function getEmployerMatchSummary(employerId: string): Promise<EmployerMatchSummary> {
  const [acceptCount, rejectCount, requestInfoCount] = await Promise.all([
    countEvents({ eventType: 'EMPLOYER_ACCEPTED', sourceId: employerId }),
    countEvents({ eventType: 'EMPLOYER_REJECTED', sourceId: employerId }),
    countEvents({ eventType: 'EMPLOYER_REQUESTED_INFO', sourceId: employerId }),
  ]);

  const totalDecisions = acceptCount + rejectCount + requestInfoCount;

  // Compute avg readiness from metadata
  const acceptEvents = await prisma.learningEvent.findMany({
    where: { eventType: 'EMPLOYER_ACCEPTED', sourceId: employerId, loopType: 'USAGE_TRACKING' },
    select: { metadata: true },
    take: 200,
  });
  const rejectEvents = await prisma.learningEvent.findMany({
    where: { eventType: 'EMPLOYER_REJECTED', sourceId: employerId, loopType: 'USAGE_TRACKING' },
    select: { metadata: true },
    take: 200,
  });

  function avgReadiness(events: Array<{ metadata: unknown }>): number | null {
    const scores = events
      .map((e) => {
        const meta = e.metadata as Record<string, unknown> | null;
        return typeof meta?.readinessScore === 'number' ? meta.readinessScore : null;
      })
      .filter((s): s is number => s !== null);
    return scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
  }

  // Compute most common missing fields from reject/request-info events
  const decisionEvents = [...rejectEvents, ...(await prisma.learningEvent.findMany({
    where: { eventType: 'EMPLOYER_REQUESTED_INFO', sourceId: employerId, loopType: 'USAGE_TRACKING' },
    select: { metadata: true },
    take: 200,
  }))];
  const fieldCounts = new Map<string, number>();
  for (const e of decisionEvents) {
    const meta = e.metadata as Record<string, unknown> | null;
    const missing = Array.isArray(meta?.missingCritical) ? meta.missingCritical as string[] : [];
    for (const field of missing) {
      fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
    }
  }
  const commonMissingFields = [...fieldCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([field]) => field);

  return {
    employerId,
    totalDecisions,
    acceptCount,
    rejectCount,
    requestInfoCount,
    acceptRate: safeRate(acceptCount, totalDecisions),
    avgReadinessAtAccept: avgReadiness(acceptEvents),
    avgReadinessAtReject: avgReadiness(rejectEvents),
    commonMissingFields,
  };
}
