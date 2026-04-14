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

  // 1. Active opportunities
  const openPositions = await prisma.opportunity.count({
    where: {
      organizationId,
      status: 'ACTIVE',
    },
  });

  // TODO: removed - referenced non-existent Prisma model 'application'
  // Without applications, pipeline/review metrics cannot be computed.
  const capacityScore = computeScore(openPositions, 0, 0, 0);

  return {
    organizationId,
    computedAt: now.toISOString(),
    openPositions,
    pipelineDepth: 0,
    acceptedThisQuarter: 0,
    avgReviewDays: 0,
    credentialReadiness: 0,
    capacityScore,
    startsEnabled: 0,
  };
}

// ─── System-wide aggregation ──────────────────────────────────

export async function computeSystemCapacity(): Promise<SystemCapacity> {
  const now = new Date();

  // TODO: removed - referenced non-existent Prisma model 'application'
  // Without applications, pipeline/review/acceptance metrics cannot be computed.
  const [totalOpenPositions, allOrgs] = await Promise.all([
    prisma.opportunity.count({ where: { status: 'ACTIVE' } }),
    prisma.organization.findMany({ select: { id: true } }),
  ]);

  const avgCapacityScore = computeScore(
    totalOpenPositions / Math.max(1, allOrgs.length),
    0,
    0,
    0,
  );

  return {
    computedAt: now.toISOString(),
    totalOrganizations: allOrgs.length,
    totalOpenPositions,
    totalPipelineDepth: 0,
    totalAcceptedThisQuarter: 0,
    systemAvgReviewDays: 0,
    totalStartsEnabled: 0,
    avgCapacityScore,
  };
}
