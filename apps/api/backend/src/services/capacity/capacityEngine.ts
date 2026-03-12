/**
 * capacityEngine.ts — Wave 240
 *
 * Computes the Capacity Score: "how many more clinicians can START
 * at this organization this quarter."
 *
 * Formula:
 *   capacityScore (0–100) = weighted composite of:
 *     - openPositions     × 15 pts  (demand signal)
 *     - pipelineDepth     × 10 pts  (supply pipeline)
 *     - credentialReadiness × 40 pts (credentialing friction)
 *     - speedFactor       × 35 pts  (velocity / review speed)
 *
 *   startsEnabled = floor(pipelineDepth × credentialReadiness × speedFactor)
 */

import prisma from '../../graphql/prisma_client';

// ─── Types ────────────────────────────────────────────────────

export type CapacityScore = {
  organizationId: string;
  computedAt: string;
  /** Count of ACTIVE opportunities. */
  openPositions: number;
  /** Count of PENDING + REVIEWED applications (in-flight pipeline). */
  pipelineDepth: number;
  /** Count of ACCEPTED applications in the last 90 days. */
  acceptedThisQuarter: number;
  /** Average calendar days from application created → reviewed. */
  avgReviewDays: number;
  /**
   * Fraction (0–1) of in-pipeline applicants who have at least one
   * VERIFIED or PENDING_VERIFICATION CandidateCredential.
   */
  credentialReadiness: number;
  /** Composite 0–100 score. */
  capacityScore: number;
  /** Estimated additional clinician starts this quarter. */
  startsEnabled: number;
};

export type SystemCapacity = {
  computedAt: string;
  totalOrganizations: number;
  totalOpenPositions: number;
  totalPipelineDepth: number;
  totalAcceptedThisQuarter: number;
  systemAvgReviewDays: number;
  totalStartsEnabled: number;
  avgCapacityScore: number;
};

// ─── Constants ────────────────────────────────────────────────

const QUARTER_MS = 90 * 24 * 60 * 60 * 1000;

/** Maximum "ideal" open positions used for score normalisation. */
const OPEN_POSITIONS_SCALE = 20;
/** Maximum pipeline depth used for score normalisation. */
const PIPELINE_SCALE = 50;
/**
 * Baseline review days that earns full speed credit.
 * Anything faster than 1 day → score = 1.0.
 * Anything slower than MAX_REVIEW_DAYS → score = 0.
 */
const MAX_REVIEW_DAYS = 60;

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Clamp a value to [0, 1].
 */
function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Speed factor: 1.0 when avg review is ≤ 1 day, 0.0 at MAX_REVIEW_DAYS.
 * Linear decay between the extremes.
 */
function speedFactor(avgReviewDays: number): number {
  if (avgReviewDays <= 1) return 1.0;
  if (avgReviewDays >= MAX_REVIEW_DAYS) return 0.0;
  return clamp01(1 - (avgReviewDays - 1) / (MAX_REVIEW_DAYS - 1));
}

/**
 * Composite score (0–100):
 *   15 pts  — demand (open positions)
 *   10 pts  — supply (pipeline depth)
 *   40 pts  — readiness (credential readiness %)
 *   35 pts  — velocity (speed factor)
 */
function computeScore(
  openPositions: number,
  pipelineDepth: number,
  credentialReadiness: number,
  avgReviewDays: number,
): number {
  const demandScore = clamp01(openPositions / OPEN_POSITIONS_SCALE) * 15;
  const pipelineScore = clamp01(pipelineDepth / PIPELINE_SCALE) * 10;
  const readinessScore = clamp01(credentialReadiness) * 40;
  const velocityScore = speedFactor(avgReviewDays) * 35;
  const raw = demandScore + pipelineScore + readinessScore + velocityScore;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

// ─── Per-organisation computation ────────────────────────────

export async function computeOrganizationCapacity(
  organizationId: string,
): Promise<CapacityScore> {
  const now = new Date();
  const quarterStart = new Date(now.getTime() - QUARTER_MS);

  // 1. Active opportunities
  const openPositions = await prisma.opportunity.count({
    where: {
      organizationId,
      status: 'ACTIVE',
    },
  });

  // 2. All opportunities for this org (to join applications)
  const orgOpportunityIds = (
    await prisma.opportunity.findMany({
      where: { organizationId },
      select: { id: true },
    })
  ).map((o) => o.id);

  if (orgOpportunityIds.length === 0) {
    // No opportunities at all — return a zero score
    return {
      organizationId,
      computedAt: now.toISOString(),
      openPositions,
      pipelineDepth: 0,
      acceptedThisQuarter: 0,
      avgReviewDays: 0,
      credentialReadiness: 0,
      capacityScore: 0,
      startsEnabled: 0,
    };
  }

  // 3. Applications by status
  const [pipelineDepth, acceptedThisQuarter, reviewedApps] = await Promise.all([
    // PENDING + REVIEWED = still in-flight
    prisma.application.count({
      where: {
        opportunityId: { in: orgOpportunityIds },
        status: { in: ['PENDING', 'REVIEWED'] },
      },
    }),
    // ACCEPTED in last 90 days
    prisma.application.count({
      where: {
        opportunityId: { in: orgOpportunityIds },
        status: 'ACCEPTED',
        reviewedAt: { gte: quarterStart },
      },
    }),
    // Apps with a reviewedAt — used to calculate avg review time
    prisma.application.findMany({
      where: {
        opportunityId: { in: orgOpportunityIds },
        reviewedAt: { not: null },
      },
      select: { createdAt: true, reviewedAt: true },
    }),
  ]);

  // 4. Average review days
  let avgReviewDays = 0;
  if (reviewedApps.length > 0) {
    const totalMs = reviewedApps.reduce((sum, app) => {
      const delta = (app.reviewedAt as Date).getTime() - app.createdAt.getTime();
      return sum + delta;
    }, 0);
    avgReviewDays = totalMs / reviewedApps.length / (24 * 60 * 60 * 1000);
  }

  // 5. Credential readiness
  //    % of in-pipeline applicants who have ≥1 VERIFIED or PENDING_VERIFICATION credential.
  let credentialReadiness = 0;
  if (pipelineDepth > 0) {
    // Get clerkUserIds of pending/reviewed applicants
    const pipelineApps = await prisma.application.findMany({
      where: {
        opportunityId: { in: orgOpportunityIds },
        status: { in: ['PENDING', 'REVIEWED'] },
      },
      select: { clerkUserId: true, npi: true },
    });

    // clinicianId in CandidateCredential matches npi or clerkUserId
    const clinicianIds = pipelineApps
      .map((a) => a.npi ?? a.clerkUserId)
      .filter(Boolean) as string[];

    if (clinicianIds.length > 0) {
      // Count distinct clinicianIds that have a ready credential
      const readyCredentials = await prisma.candidateCredential.findMany({
        where: {
          clinicianId: { in: clinicianIds },
          status: { in: ['VERIFIED', 'PENDING_VERIFICATION'] },
        },
        select: { clinicianId: true },
        distinct: ['clinicianId'],
      });

      credentialReadiness = readyCredentials.length / clinicianIds.length;
    }
  }

  // 6. Compute composite score
  const capacityScore = computeScore(
    openPositions,
    pipelineDepth,
    credentialReadiness,
    avgReviewDays,
  );

  // 7. Starts enabled
  const sf = speedFactor(avgReviewDays);
  const startsEnabled = Math.floor(pipelineDepth * credentialReadiness * sf);

  return {
    organizationId,
    computedAt: now.toISOString(),
    openPositions,
    pipelineDepth,
    acceptedThisQuarter,
    avgReviewDays: Math.round(avgReviewDays * 10) / 10,
    credentialReadiness: Math.round(credentialReadiness * 1000) / 1000,
    capacityScore,
    startsEnabled,
  };
}

// ─── System-wide aggregation ──────────────────────────────────

export async function computeSystemCapacity(): Promise<SystemCapacity> {
  const now = new Date();
  const quarterStart = new Date(now.getTime() - QUARTER_MS);

  // Aggregate from DB directly for efficiency
  const [totalOpenPositions, allOrgs, pipelineCount, acceptedCount, reviewedApps] =
    await Promise.all([
      prisma.opportunity.count({ where: { status: 'ACTIVE' } }),
      prisma.organization.findMany({ select: { id: true } }),
      prisma.application.count({
        where: { status: { in: ['PENDING', 'REVIEWED'] } },
      }),
      prisma.application.count({
        where: {
          status: 'ACCEPTED',
          reviewedAt: { gte: quarterStart },
        },
      }),
      prisma.application.findMany({
        where: { reviewedAt: { not: null } },
        select: { createdAt: true, reviewedAt: true },
      }),
    ]);

  // System avg review days
  let systemAvgReviewDays = 0;
  if (reviewedApps.length > 0) {
    const totalMs = reviewedApps.reduce((sum, app) => {
      const delta = (app.reviewedAt as Date).getTime() - app.createdAt.getTime();
      return sum + delta;
    }, 0);
    systemAvgReviewDays = totalMs / reviewedApps.length / (24 * 60 * 60 * 1000);
  }

  // System credential readiness
  const pipelineApps = await prisma.application.findMany({
    where: { status: { in: ['PENDING', 'REVIEWED'] } },
    select: { clerkUserId: true, npi: true },
  });
  const clinicianIds = pipelineApps
    .map((a) => a.npi ?? a.clerkUserId)
    .filter(Boolean) as string[];

  let systemCredentialReadiness = 0;
  if (clinicianIds.length > 0) {
    const readyCredentials = await prisma.candidateCredential.findMany({
      where: {
        clinicianId: { in: clinicianIds },
        status: { in: ['VERIFIED', 'PENDING_VERIFICATION'] },
      },
      select: { clinicianId: true },
      distinct: ['clinicianId'],
    });
    systemCredentialReadiness = readyCredentials.length / clinicianIds.length;
  }

  const sf = speedFactor(systemAvgReviewDays);
  const totalStartsEnabled = Math.floor(pipelineCount * systemCredentialReadiness * sf);

  // Compute avg capacity score across all orgs (sample computation)
  const avgCapacityScore = computeScore(
    totalOpenPositions / Math.max(1, allOrgs.length),
    pipelineCount / Math.max(1, allOrgs.length),
    systemCredentialReadiness,
    systemAvgReviewDays,
  );

  return {
    computedAt: now.toISOString(),
    totalOrganizations: allOrgs.length,
    totalOpenPositions,
    totalPipelineDepth: pipelineCount,
    totalAcceptedThisQuarter: acceptedCount,
    systemAvgReviewDays: Math.round(systemAvgReviewDays * 10) / 10,
    totalStartsEnabled,
    avgCapacityScore,
  };
}
