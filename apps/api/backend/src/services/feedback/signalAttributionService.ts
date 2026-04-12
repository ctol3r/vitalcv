/**
 * signalAttributionService.ts — "Why this match worked" analysis.
 *
 * For accepted candidates, analyzes which signals were present vs absent at
 * the time of acceptance to identify which credentials matter most in practice.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

export interface SignalAttribution {
  signalPresenceFrequency: Record<string, number>;
  signalAbsenceFrequency: Record<string, number>;
  topPositiveSignals: string[];
  ignoredMissingSignals: string[];
  sampleSize: number;
}

export async function computeSignalAttribution(filters?: {
  employerId?: string;
  specialty?: string;
  since?: Date;
}): Promise<SignalAttribution> {
  const since = filters?.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const accepted = await prisma.learningEvent.findMany({
    where: {
      eventType: 'EMPLOYER_ACCEPTED',
      loopType: 'USAGE_TRACKING',
      occurredAt: { gte: since },
      ...(filters?.employerId ? { sourceId: filters.employerId } : {}),
    },
    select: { metadata: true },
    take: 500,
  });

  const presenceFreq = new Map<string, number>();
  const absenceFreq = new Map<string, number>();

  for (const event of accepted) {
    const meta = event.metadata as Record<string, unknown> | null;
    if (!meta) continue;

    // Count trust bands as positive signals
    if (typeof meta.trustBand === 'string') {
      const key = `TRUST_BAND:${meta.trustBand}`;
      presenceFreq.set(key, (presenceFreq.get(key) ?? 0) + 1);
    }

    // Count readiness score ranges
    if (typeof meta.readinessScore === 'number') {
      const bucket = meta.readinessScore >= 80 ? 'HIGH' : meta.readinessScore >= 50 ? 'MEDIUM' : 'LOW';
      const key = `READINESS:${bucket}`;
      presenceFreq.set(key, (presenceFreq.get(key) ?? 0) + 1);
    }

    // Count exclusion-clear as a positive signal
    if (meta.exclusionStatus === 'CLEAR' || meta.exclusionStatus === 'clear') {
      presenceFreq.set('EXCLUSION:CLEAR', (presenceFreq.get('EXCLUSION:CLEAR') ?? 0) + 1);
    }

    // Count verified credential presence
    if (typeof meta.verifiedCredentialCount === 'number' && meta.verifiedCredentialCount > 0) {
      presenceFreq.set('HAS_VERIFIED_CREDENTIALS', (presenceFreq.get('HAS_VERIFIED_CREDENTIALS') ?? 0) + 1);
    }

    // Count which missing signals didn't prevent acceptance
    const missingNonCritical = Array.isArray(meta.missingNonCritical) ? meta.missingNonCritical as string[] : [];
    for (const signal of missingNonCritical) {
      absenceFreq.set(signal, (absenceFreq.get(signal) ?? 0) + 1);
    }

    // Top blockers that were present but didn't prevent acceptance
    const topBlockers = Array.isArray(meta.topBlockers) ? meta.topBlockers as string[] : [];
    for (const blocker of topBlockers) {
      absenceFreq.set(`BLOCKER_TOLERATED:${blocker}`, (absenceFreq.get(`BLOCKER_TOLERATED:${blocker}`) ?? 0) + 1);
    }
  }

  const topPositiveSignals = [...presenceFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([signal]) => signal);

  const ignoredMissingSignals = [...absenceFreq.entries()]
    .filter(([, count]) => count >= 2) // At least 2 acceptances despite missing
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([signal]) => signal);

  return {
    signalPresenceFrequency: Object.fromEntries(presenceFreq),
    signalAbsenceFrequency: Object.fromEntries(absenceFreq),
    topPositiveSignals,
    ignoredMissingSignals,
    sampleSize: accepted.length,
  };
}
