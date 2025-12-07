/**
 * S72-D1-B-004: Freshness check (120 days) for PSV results
 *
 * Determines if PSV results are still fresh (≤120 days old)
 * Used before re-using PSV results for NCQA compliance
 *
 * NCQA CR1-CR5 require primary source verification within 120 days
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Number of days that PSV results remain fresh
 * NCQA requirement: 120 days
 */
export const PSV_FRESHNESS_DAYS = 120;

/**
 * PSV result with freshness information
 */
export interface PSVResultWithFreshness {
  psvResultId: string;
  clinicianId: string;
  checkedAt: Date;
  freshUntil: Date;
  isFresh: boolean;
  daysRemaining: number;
  overallStatus: string;
}

/**
 * Check if a PSV result is fresh
 *
 * @param psvResult - PSV result to check
 * @returns true if checkedAt is ≤120 days ago, false otherwise
 */
export function isFresh(psvResult: {
  checkedAt: Date | string;
  freshUntil?: Date | string;
}): boolean {
  const checkedAt = typeof psvResult.checkedAt === 'string'
    ? new Date(psvResult.checkedAt)
    : psvResult.checkedAt;

  const now = new Date();
  const daysSinceCheck = Math.floor((now.getTime() - checkedAt.getTime()) / (1000 * 60 * 60 * 24));

  return daysSinceCheck <= PSV_FRESHNESS_DAYS;
}

/**
 * Get days remaining until PSV result becomes stale
 *
 * @param psvResult - PSV result to check
 * @returns number of days remaining (negative if already stale)
 */
export function getDaysRemaining(psvResult: {
  checkedAt: Date | string;
  freshUntil?: Date | string;
}): number {
  const checkedAt = typeof psvResult.checkedAt === 'string'
    ? new Date(psvResult.checkedAt)
    : psvResult.checkedAt;

  const now = new Date();
  const daysSinceCheck = Math.floor((now.getTime() - checkedAt.getTime()) / (1000 * 60 * 60 * 24));

  return PSV_FRESHNESS_DAYS - daysSinceCheck;
}

/**
 * Get the date when a PSV result will become stale
 *
 * @param checkedAt - Date when PSV was performed
 * @returns Date when result becomes stale
 */
export function getFreshUntilDate(checkedAt: Date | string): Date {
  const checkDate = typeof checkedAt === 'string' ? new Date(checkedAt) : checkedAt;
  const freshUntil = new Date(checkDate);
  freshUntil.setDate(freshUntil.getDate() + PSV_FRESHNESS_DAYS);
  return freshUntil;
}

/**
 * Get PSV result with freshness information
 *
 * @param psvResultId - ID of PSV result to check
 * @returns PSV result with freshness details, or null if not found
 */
export async function getPSVResultWithFreshness(
  psvResultId: string
): Promise<PSVResultWithFreshness | null> {
  const psvResult = await prisma.pSVResult.findUnique({
    where: { id: psvResultId },
  });

  if (!psvResult) {
    return null;
  }

  const fresh = isFresh(psvResult);
  const daysRemaining = getDaysRemaining(psvResult);

  return {
    psvResultId: psvResult.id,
    clinicianId: psvResult.clinicianId,
    checkedAt: psvResult.checkedAt,
    freshUntil: psvResult.freshUntil,
    isFresh: fresh,
    daysRemaining,
    overallStatus: psvResult.overallStatus,
  };
}

/**
 * Get latest fresh PSV result for a clinician
 *
 * @param clinicianId - Clinician ID
 * @returns Latest fresh PSV result, or null if none exists
 */
export async function getLatestFreshPSVResult(
  clinicianId: string
): Promise<PSVResultWithFreshness | null> {
  const psvResults = await prisma.pSVResult.findMany({
    where: { clinicianId },
    orderBy: { checkedAt: 'desc' },
  });

  for (const psvResult of psvResults) {
    if (isFresh(psvResult)) {
      const daysRemaining = getDaysRemaining(psvResult);
      return {
        psvResultId: psvResult.id,
        clinicianId: psvResult.clinicianId,
        checkedAt: psvResult.checkedAt,
        freshUntil: psvResult.freshUntil,
        isFresh: true,
        daysRemaining,
        overallStatus: psvResult.overallStatus,
      };
    }
  }

  return null;
}

/**
 * Mark stale PSV results as not fresh (batch update)
 *
 * Should be run periodically (e.g., daily cron job)
 *
 * @returns Number of results marked as stale
 */
export async function markStalePSVResults(): Promise<number> {
  const now = new Date();

  const result = await prisma.pSVResult.updateMany({
    where: {
      isFresh: true,
      freshUntil: {
        lt: now,
      },
    },
    data: {
      isFresh: false,
    },
  });

  return result.count;
}

/**
 * Get all stale PSV results that need re-verification
 *
 * @param clinicianId - Optional clinician ID to filter
 * @returns Array of stale PSV results
 */
export async function getStalePSVResults(
  clinicianId?: string
): Promise<PSVResultWithFreshness[]> {
  const where: any = {
    isFresh: false,
  };

  if (clinicianId) {
    where.clinicianId = clinicianId;
  }

  const psvResults = await prisma.pSVResult.findMany({
    where,
    orderBy: { checkedAt: 'desc' },
  });

  return psvResults.map((psvResult) => {
    const daysRemaining = getDaysRemaining(psvResult);
    return {
      psvResultId: psvResult.id,
      clinicianId: psvResult.clinicianId,
      checkedAt: psvResult.checkedAt,
      freshUntil: psvResult.freshUntil,
      isFresh: false,
      daysRemaining,
      overallStatus: psvResult.overallStatus,
    };
  });
}

/**
 * Check if clinician needs PSV re-verification
 *
 * @param clinicianId - Clinician ID
 * @returns true if clinician has no fresh PSV results
 */
export async function needsPSVReverification(clinicianId: string): Promise<boolean> {
  const latestFresh = await getLatestFreshPSVResult(clinicianId);
  return latestFresh === null;
}

/**
 * Get PSV freshness status for multiple clinicians
 *
 * @param clinicianIds - Array of clinician IDs
 * @returns Map of clinician ID to freshness status
 */
export async function getBulkPSVFreshnessStatus(
  clinicianIds: string[]
): Promise<Map<string, { isFresh: boolean; daysRemaining: number; psvResultId?: string }>> {
  const results = new Map<string, { isFresh: boolean; daysRemaining: number; psvResultId?: string }>();

  // Get all PSV results for these clinicians
  const psvResults = await prisma.pSVResult.findMany({
    where: {
      clinicianId: { in: clinicianIds },
    },
    orderBy: { checkedAt: 'desc' },
  });

  // Group by clinician and find latest fresh result
  const clinicianResultsMap = new Map<string, typeof psvResults>();
  for (const result of psvResults) {
    if (!clinicianResultsMap.has(result.clinicianId)) {
      clinicianResultsMap.set(result.clinicianId, []);
    }
    clinicianResultsMap.get(result.clinicianId)!.push(result);
  }

  // Check freshness for each clinician
  for (const clinicianId of clinicianIds) {
    const clinicianResults = clinicianResultsMap.get(clinicianId) || [];
    const latestFresh = clinicianResults.find((r) => isFresh(r));

    if (latestFresh) {
      results.set(clinicianId, {
        isFresh: true,
        daysRemaining: getDaysRemaining(latestFresh),
        psvResultId: latestFresh.id,
      });
    } else {
      results.set(clinicianId, {
        isFresh: false,
        daysRemaining: -1,
      });
    }
  }

  return results;
}

