/**
 * matchBoostService.ts — Computes and caches historical outcome boosts for matching.
 *
 * Analyzes recent employer accept/reject patterns per specialty to generate
 * boost scores that the matchaEngine reads during scoring.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

export interface MatchBoostRecord {
  employerId: string;
  specialty: string;
  acceptRate: number;
  sampleSize: number;
  boostScore: number;
  computedAt: string;
}

function computeBoostScore(acceptRate: number, sampleSize: number): number {
  // Require minimum sample size for meaningful signal
  if (sampleSize < 3) return 0;

  // Scale boost based on accept rate
  // >60% accept rate: positive boost (max +8)
  // <30% accept rate: negative boost (min -5)
  // In between: proportional
  if (acceptRate >= 0.8) return 8;
  if (acceptRate >= 0.6) return Math.round((acceptRate - 0.6) * 25) + 3; // 3-8
  if (acceptRate >= 0.3) return Math.round((acceptRate - 0.3) * 10); // 0-3
  if (acceptRate >= 0.1) return Math.round((acceptRate - 0.3) * 15); // -3 to 0
  return -5;
}

/**
 * Recompute boost scores for all employer+specialty combinations with recent activity.
 * Designed to run after employer decisions or on a periodic schedule.
 */
export async function recomputeMatchBoosts(lookbackDays = 30): Promise<number> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  // Get all recent decision events grouped by employer
  const decisions = await prisma.learningEvent.findMany({
    where: {
      loopType: 'USAGE_TRACKING',
      eventType: { in: ['EMPLOYER_ACCEPTED', 'EMPLOYER_REJECTED'] },
      occurredAt: { gte: since },
    },
    select: {
      eventType: true,
      sourceId: true,
      metadata: true,
    },
  });

  // Group by employer + specialty (from metadata or fallback)
  const groups = new Map<string, { accepts: number; total: number }>();

  for (const d of decisions) {
    const employerId = d.sourceId;
    if (!employerId) continue;

    const meta = d.metadata as Record<string, unknown> | null;
    // Try to extract specialty from metadata; fall back to 'ALL'
    const specialty = (typeof meta?.specialty === 'string' && meta.specialty.length > 0)
      ? meta.specialty
      : 'ALL';

    const key = `${employerId}::${specialty}`;
    const group = groups.get(key) ?? { accepts: 0, total: 0 };
    group.total++;
    if (d.eventType === 'EMPLOYER_ACCEPTED') group.accepts++;
    groups.set(key, group);
  }

  // Upsert boost records
  let upsertCount = 0;
  for (const [key, stats] of groups) {
    const [employerId, specialty] = key.split('::');
    const acceptRate = stats.total > 0 ? stats.accepts / stats.total : 0;
    const boostScore = computeBoostScore(acceptRate, stats.total);

    await prisma.matchBoost.upsert({
      where: { employerId_specialty: { employerId, specialty } },
      create: {
        employerId,
        specialty,
        acceptRate: Math.round(acceptRate * 1000) / 1000,
        sampleSize: stats.total,
        boostScore,
      },
      update: {
        acceptRate: Math.round(acceptRate * 1000) / 1000,
        sampleSize: stats.total,
        boostScore,
        computedAt: new Date(),
      },
    });
    upsertCount++;
  }

  log('info', 'match_boosts_recomputed', {
    groupCount: groups.size,
    upsertCount,
    lookbackDays,
  });

  return upsertCount;
}

/**
 * Look up the cached boost score for a given employer + specialty.
 * Returns 0 if no data exists. Used synchronously by matchaEngine.
 */
export async function getMatchBoost(employerId: string, specialty: string): Promise<MatchBoostRecord | null> {
  // Try exact match first, then fall back to 'ALL' specialty
  const exact = await prisma.matchBoost.findUnique({
    where: { employerId_specialty: { employerId, specialty } },
  });

  if (exact) {
    return {
      employerId: exact.employerId,
      specialty: exact.specialty,
      acceptRate: exact.acceptRate,
      sampleSize: exact.sampleSize,
      boostScore: exact.boostScore,
      computedAt: exact.computedAt.toISOString(),
    };
  }

  // Fall back to employer-wide stats
  const fallback = await prisma.matchBoost.findUnique({
    where: { employerId_specialty: { employerId, specialty: 'ALL' } },
  });

  if (fallback) {
    return {
      employerId: fallback.employerId,
      specialty: fallback.specialty,
      acceptRate: fallback.acceptRate,
      sampleSize: fallback.sampleSize,
      boostScore: fallback.boostScore,
      computedAt: fallback.computedAt.toISOString(),
    };
  }

  return null;
}
