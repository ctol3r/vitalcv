/**
 * Onboarding Analytics Engine — Wave R
 *
 * Tracks key milestone timestamps for each artifact and computes
 * deterministic day-difference metrics for revenue signal computation.
 *
 * All date math uses calendar-day differences (floor of ms delta / 86400000).
 * No randomness, no external SaaS.
 */

import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

// ── Deterministic day math ───────────────────────────────────

const MS_PER_DAY = 86_400_000;

function daysBetween(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY);
}

// ── Upsert helper ────────────────────────────────────────────

async function ensureAnalyticsRow(
  artifactId: string,
  organizationId: string,
): Promise<{ id: string; createdAt: Date }> {
  const existing = await prisma.onboardingAnalytics.findFirst({
    where: { artifactId },
  });

  if (existing) {
    return existing;
  }

  return prisma.onboardingAnalytics.create({
    data: { artifactId, organizationId },
  });
}

// ── Event recorders ──────────────────────────────────────────

export async function recordVerificationEvent(
  artifactId: string,
  organizationId: string,
): Promise<void> {
  try {
    const row = await ensureAnalyticsRow(artifactId, organizationId);
    const now = new Date();

    await prisma.onboardingAnalytics.update({
      where: { id: row.id },
      data: {
        firstVerifiedAt: now,
        daysToVerification: daysBetween(row.createdAt, now),
      },
    });
  } catch (error) {
    log('error', 'onboarding_analytics_verification_event_failed', {
      event: 'onboarding_analytics_verification_event_failed',
      artifactId,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export async function recordProofIssuedEvent(
  artifactId: string,
  organizationId: string,
): Promise<void> {
  try {
    const row = await ensureAnalyticsRow(artifactId, organizationId);
    const now = new Date();

    await prisma.onboardingAnalytics.update({
      where: { id: row.id },
      data: { firstProofIssuedAt: now },
    });
  } catch (error) {
    log('error', 'onboarding_analytics_proof_event_failed', {
      event: 'onboarding_analytics_proof_event_failed',
      artifactId,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export async function recordPSVCompletionEvent(
  artifactId: string,
  organizationId: string,
): Promise<void> {
  try {
    const row = await ensureAnalyticsRow(artifactId, organizationId);
    const now = new Date();

    await prisma.onboardingAnalytics.update({
      where: { id: row.id },
      data: {
        psvCompletedAt: now,
        daysToPSVCompletion: daysBetween(row.createdAt, now),
      },
    });
  } catch (error) {
    log('error', 'onboarding_analytics_psv_event_failed', {
      event: 'onboarding_analytics_psv_event_failed',
      artifactId,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

// ── Aggregation queries ──────────────────────────────────────

export type OnboardingMetrics = {
  avgDaysToVerification: number | null;
  avgDaysToPSVCompletion: number | null;
  totalArtifacts: number;
  completedVerifications: number;
  completedPSV: number;
};

export async function getOnboardingMetrics(organizationId: string): Promise<OnboardingMetrics> {
  const rows = await prisma.onboardingAnalytics.findMany({
    where: { organizationId },
  });

  const withVerification = rows.filter((r) => r.daysToVerification !== null);
  const withPSV = rows.filter((r) => r.daysToPSVCompletion !== null);

  const avgDaysToVerification =
    withVerification.length > 0
      ? Math.round(
          withVerification.reduce((sum, r) => sum + (r.daysToVerification ?? 0), 0) /
            withVerification.length,
        )
      : null;

  const avgDaysToPSVCompletion =
    withPSV.length > 0
      ? Math.round(
          withPSV.reduce((sum, r) => sum + (r.daysToPSVCompletion ?? 0), 0) / withPSV.length,
        )
      : null;

  return {
    avgDaysToVerification,
    avgDaysToPSVCompletion,
    totalArtifacts: rows.length,
    completedVerifications: withVerification.length,
    completedPSV: withPSV.length,
  };
}
