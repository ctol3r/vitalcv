/**
 * B224A-REP-005: PortfolioSyncJob
 *
 * Nightly job that reconciles the portfolio with external sources
 * (state boards, compacts, payers) and updates ReputationAggregator.
 */

import { PrismaClient } from '@prisma/client';
import { reputationAggregator } from '../../services/reputation/aggregator.js';
import { getPortfolio, updatePortfolioOnEvent } from '../../services/reputation/portfolioService.js';
import { reputationDeltaTracker } from '../../services/reputation/deltaTracker.js';

const prisma = new PrismaClient();

export interface PortfolioSyncJobResult {
  cliniciansProcessed: number;
  portfoliosUpdated: number;
  reputationsUpdated: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

/**
 * Run nightly portfolio sync job
 */
export async function runPortfolioSyncJob(): Promise<PortfolioSyncJobResult> {
  const startedAt = new Date();
  const result: PortfolioSyncJobResult = {
    cliniciansProcessed: 0,
    portfoliosUpdated: 0,
    reputationsUpdated: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  try {
    // Get all clinicians (using NpiClaim as proxy for clinicians)
    const clinicians = await prisma.npiClaim.findMany({
      select: {
        userId: true,
        npi: true,
      },
      distinct: ['userId'],
    });

    if (clinicians.length === 0) {
      result.finishedAt = new Date();
      return result;
    }

    // Initialize delta tracker with current scores
    const clinicianIds = clinicians.map((c) => c.userId);
    await reputationDeltaTracker.initialize(clinicianIds);

    // Process each clinician
    for (const clinician of clinicians) {
      try {
        const clinicianId = clinician.userId;

        // Get current portfolio
        const portfolio = await getPortfolio(clinicianId);

        // Sync with external sources
        await syncWithExternalSources(clinicianId, portfolio);

        // Recompute reputation from updated portfolio
        const reputationResult = await reputationAggregator.recomputeFromPortfolio(clinicianId);

        // Track delta
        await reputationDeltaTracker.trackChange(clinicianId, reputationResult.overallScore);

        result.cliniciansProcessed += 1;
        result.portfoliosUpdated += 1;
        result.reputationsUpdated += 1;
      } catch (error) {
        result.errors.push(
          `[clinician:${clinician.userId}] Failed to sync: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  } catch (error) {
    result.errors.push(
      `Portfolio sync job failed: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    result.finishedAt = new Date();
  }

  return result;
}

/**
 * Sync portfolio with external sources
 */
async function syncWithExternalSources(
  clinicianId: string,
  portfolio: any
): Promise<void> {
  // Sync with state boards
  await syncWithStateBoards(clinicianId, portfolio);

  // Sync with compacts
  await syncWithCompacts(clinicianId, portfolio);

  // Sync with payers
  await syncWithPayers(clinicianId, portfolio);

  // Sync with PECOS
  await syncWithPECOS(clinicianId, portfolio);
}

/**
 * Sync with state boards (placeholder - would integrate with state board APIs)
 */
async function syncWithStateBoards(clinicianId: string, portfolio: any): Promise<void> {
  // In production, this would:
  // 1. Query state board APIs for license status
  // 2. Update credentials in portfolio
  // 3. Emit events for changes
  // For now, it's a placeholder
}

/**
 * Sync with compacts (IMLC, PSYPACT, etc.)
 */
async function syncWithCompacts(clinicianId: string, portfolio: any): Promise<void> {
  try {
    // Check IMLC eligibility
    const imlc = await prisma.iMLCEligibility.findUnique({
      where: { clinicianDid: clinicianId },
    });

    if (imlc && imlc.status === 'LICENSED') {
      await updatePortfolioOnEvent(clinicianId, 'compact.imlc.licensed', {
        compactStates: imlc.compactStates,
      });
    }

    // Check PSYPACT
    const psypact = await prisma.pSYPACTCompact.findUnique({
      where: { clinicianDid: clinicianId },
    });

    if (psypact && psypact.status === 'ACTIVE') {
      await updatePortfolioOnEvent(clinicianId, 'compact.psypact.active', {
        participatingStates: psypact.participatingStates,
      });
    }

    // Check Counseling Compact
    const counseling = await prisma.counselingCompact.findUnique({
      where: { clinicianDid: clinicianId },
    });

    if (counseling && counseling.status === 'ACTIVE') {
      await updatePortfolioOnEvent(clinicianId, 'compact.counseling.active', {
        compactStates: counseling.compactStates,
      });
    }
  } catch (error) {
    console.error(`[PortfolioSync] Error syncing compacts for ${clinicianId}:`, error);
  }
}

/**
 * Sync with payers
 */
async function syncWithPayers(clinicianId: string, portfolio: any): Promise<void> {
  try {
    const enrollments = await prisma.payerEnrollment.findMany({
      where: {
        clinicianDid: clinicianId,
      },
      include: {
        payer: true,
      },
    });

    for (const enrollment of enrollments) {
      // Check if enrollment status changed
      // In production, would query payer APIs for current status
      await updatePortfolioOnEvent(clinicianId, 'enrollment.sync', {
        enrollmentId: enrollment.id,
        payerId: enrollment.payerId,
        status: enrollment.status,
      });
    }
  } catch (error) {
    console.error(`[PortfolioSync] Error syncing payers for ${clinicianId}:`, error);
  }
}

/**
 * Sync with PECOS
 */
async function syncWithPECOS(clinicianId: string, portfolio: any): Promise<void> {
  try {
    const pecosEnrollments = await prisma.pECOSEnrollment.findMany({
      where: {
        clinicianId,
      },
    });

    for (const enrollment of pecosEnrollments) {
      // Check if revalidation is due
      if (enrollment.revalidationDueAt && enrollment.revalidationDueAt <= new Date()) {
        await updatePortfolioOnEvent(clinicianId, 'pecos.revalidation.due', {
          enrollmentId: enrollment.id,
          enrollmentType: enrollment.enrollmentType,
        });
      }

      // In production, would query PECOS API for current status
      await updatePortfolioOnEvent(clinicianId, 'pecos.sync', {
        enrollmentId: enrollment.id,
        enrollmentType: enrollment.enrollmentType,
        status: enrollment.currentStatus,
      });
    }
  } catch (error) {
    console.error(`[PortfolioSync] Error syncing PECOS for ${clinicianId}:`, error);
  }
}

// Run job if called directly
if (require.main === module) {
  runPortfolioSyncJob()
    .then((result) => {
      console.log('[PortfolioSyncJob] Job complete', result);
      process.exit(result.errors.length ? 1 : 0);
    })
    .catch((error) => {
      console.error('[PortfolioSyncJob] Job failed', error);
      process.exit(1);
    });
}

