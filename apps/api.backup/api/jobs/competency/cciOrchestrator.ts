/**
 * B205B-CCI-009: CCI orchestrator job
 *
 * Runs weekly and on major events (privilege, drift, enrollment, FPPE/OPPE, forecast);
 * updates CCI table.
 */

import { PrismaClient } from '@prisma/client';
import { calculateCCI, normalizeFeatures, type CompetencyFeatures } from '../../services/competency/calcCCI.js';
import { explainCCI } from '../../services/competency/explainCCI.js';
import { getServiceLogger } from '../../services/logging/serviceLogger.js';

const prisma = new PrismaClient();
const log = getServiceLogger('jobs/competency/cciOrchestrator');

export type TriggerEvent =
  | 'weekly'
  | 'privilege_granted'
  | 'privilege_revoked'
  | 'drift_detected'
  | 'enrollment'
  | 'fppe_oppe'
  | 'forecast'
  | 'manual';

export interface CCIOrchestratorResult {
  cliniciansProcessed: number;
  scoresUpdated: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

/**
 * Build competency features from clinician data
 */
async function buildCompetencyFeatures(clinicianId: string): Promise<CompetencyFeatures | null> {
  try {
    const lookbackDays = 90;
    const lookbackDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    // Fetch clinician data (similar to predictive safety orchestrator)
    // Note: Some models may not exist in all schemas, so we use optional chaining
    const [
      qualitySignals,
      driftEvents,
      safetySignals,
      licenses,
      boardCerts,
      deaCerts,
      pecos,
      payerData,
      ehrSync,
      privileges,
      clinicianProfile,
    ] = await Promise.all([
      // Quality signals (for OPPE trend)
      prisma.qualitySignal.findMany({
        where: { clinicianId, timestamp: { gte: lookbackDate } },
        orderBy: { timestamp: 'desc' },
      }),
      // Drift events
      prisma.driftEvent.findMany({
        where: { clinicianId, triggeredAt: { gte: lookbackDate } },
      }),
      // Safety signals (for FPPE outcomes)
      prisma.privilegeSafetySignal.findMany({
        where: { clinicianId, detectedAt: { gte: lookbackDate } },
      }),
      // Licenses
      prisma.stateLicenseVerification.findMany({
        where: { clinicianId },
        orderBy: { expiryDate: 'asc' },
        take: 1,
      }),
      // Board certifications
      prisma.credential.findMany({
        where: {
          userId: await prisma.clinicianProfile
            .findUnique({ where: { id: clinicianId } })
            .then((c) => (c ? [c.userId] : [])),
          type: 'BoardCertification',
        },
        orderBy: { expiresAt: 'asc' },
        take: 1,
      }),
      // DEA registrations
      prisma.credential.findMany({
        where: {
          userId: await prisma.clinicianProfile
            .findUnique({ where: { id: clinicianId } })
            .then((c) => (c ? [c.userId] : [])),
          type: 'DEARegistration',
        },
        orderBy: { expiresAt: 'asc' },
        take: 1,
      }),
      // PECOS enrollment
      prisma.pECOSEnrollment.findMany({
        where: { clinicianId },
        orderBy: { revalidationDueAt: 'asc' },
        take: 1,
      }).catch(() => []), // Handle if model doesn't exist
      // Payer enrollment
      prisma.payerEnrollment.findMany({
        where: { clinicianDid: clinicianId },
      }),
      // EHR sync status
      prisma.ehrSyncStatus.findFirst({
        where: { clinicianId },
        orderBy: { lastSyncAt: 'desc' },
      }),
      // Privileges
      prisma.privilegeGranted.findMany({
        where: { clinicianDid: clinicianId, status: 'ACTIVE' },
      }),
      // Clinician profile (may not exist in all schemas)
      prisma.clinicianProfile
        .findUnique({
          where: { id: clinicianId },
        })
        .catch(() => null),
    ]);

    // Calculate OPPE trend
    const oppeTrend = calculateOPPETrend(qualitySignals);

    // Calculate FPPE outcomes
    const fppeOutcomes = calculateFPPEOutcomes(safetySignals);

    // Calculate complication rate
    const complicationRate = calculateComplicationRate(qualitySignals);

    // Calculate freshness metrics
    const licenseFreshness = calculateFreshness(licenses[0]?.expiryDate);
    const boardFreshness = calculateFreshness(boardCerts[0]?.expiresAt);
    const deaExpiry = calculateFreshness(deaCerts[0]?.expiresAt);

    // Calculate PECOS status
    const pecosStatus = calculatePecosStatus(pecos[0]);

    // Calculate payer denials
    const payerDenials = calculatePayerDenials(payerData);

    // Calculate EHR mismatches
    const ehrMismatches = calculateEhrMismatches(ehrSync);

    // Calculate drift events
    const driftEventsNormalized = Math.min(1, driftEvents.length / 10);

    // Years of experience (from profile or estimate)
    const yearsExperience = clinicianProfile?.yearsExperience;

    // Privilege coverage (simplified: count active privileges)
    const privilegeCoverage = privileges.length > 0 ? Math.min(1, privileges.length / 10) : 0.5;

    return normalizeFeatures({
      oppe_trend: oppeTrend,
      fppe_outcomes: fppeOutcomes,
      complication_rate: complicationRate,
      license_freshness: licenseFreshness,
      board_freshness: boardFreshness,
      dea_expiry: deaExpiry,
      pecos_status: pecosStatus,
      payer_denials: payerDenials,
      ehr_mismatches: ehrMismatches,
      drift_events: driftEventsNormalized,
      years_experience: yearsExperience,
      privilege_coverage: privilegeCoverage,
    });
  } catch (error) {
    log.error('Failed to build competency features', { clinicianId, error });
    return null;
  }
}

function calculateOPPETrend(qualitySignals: any[]): number {
  if (qualitySignals.length === 0) return 0;
  const lowCount = qualitySignals.filter((s) => s.severity === 'LOW').length;
  const highCount = qualitySignals.filter((s) => s.severity === 'HIGH' || s.severity === 'CRITICAL').length;
  const trend = (highCount - lowCount) / qualitySignals.length;
  return Math.max(-1, Math.min(1, trend));
}

function calculateFPPEOutcomes(safetySignals: any[]): number {
  const fppeFailures = safetySignals.filter((s) => s.signalType === 'FPPE_FAILURE').length;
  if (fppeFailures === 0) return 1.0;
  return Math.max(0, 1 - fppeFailures / 3);
}

function calculateComplicationRate(qualitySignals: any[]): number {
  const complicationSignals = qualitySignals.filter((s) =>
    s.signalType?.includes('COMPLICATION') || s.signalType?.includes('ADVERSE')
  ).length;
  return Math.min(1, complicationSignals / 10);
}

function calculateFreshness(expiryDate: Date | null | undefined): number {
  if (!expiryDate) return 0;
  const now = new Date();
  const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(1, Math.max(0, daysUntilExpiry / 365));
}

function calculatePecosStatus(pecos: any): number {
  if (!pecos) return 0;
  const now = new Date();
  const revalidationDue = pecos.revalidationDueAt || pecos.revalidationDate;
  if (revalidationDue && new Date(revalidationDue) < now) return 0.3;
  if (pecos.currentStatus === 'APPROVED' || pecos.status === 'ACTIVE') return 1.0;
  return 0.5;
}

function calculatePayerDenials(payerData: any[]): number {
  if (payerData.length === 0) return 0;
  const denied = payerData.filter((p) => p.status === 'DENIED' || p.status === 'SUSPENDED').length;
  return Math.min(1, denied / payerData.length);
}

function calculateEhrMismatches(ehrSync: any): number {
  if (!ehrSync) return 0;
  if (ehrSync.hasMismatch) return 0.8;
  if (ehrSync.lastSyncAt) {
    const daysSinceSync = (Date.now() - new Date(ehrSync.lastSyncAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceSync > 30) return 0.5;
  }
  return 0;
}

/**
 * Run CCI orchestrator for a specific clinician
 */
export async function computeCCIForClinician(
  clinicianId: string,
  triggerEvent: TriggerEvent = 'manual'
): Promise<{ success: boolean; cciScore?: number; error?: string }> {
  try {
    // Build features
    const features = await buildCompetencyFeatures(clinicianId);
    if (!features) {
      return { success: false, error: 'Failed to build competency features' };
    }

    // Calculate CCI
    const result = calculateCCI(features, {
      modelConfig: { type: 'linear' },
      handleMissingData: 'impute',
    });

    // Generate explanation
    const explanation = explainCCI(result, {
      includeRecommendations: true,
      causalGraphIntegration: false,
    });

    // Store in database
    await prisma.competencyCompositeIndex.create({
      data: {
        clinicianId,
        cciScore: result.cciScore,
        contributionMap: result.contributionMap as any,
        modelType: result.modelType,
        modelVersion: result.modelVersion,
        features: features as any,
        explanation: explanation.summary,
        triggerEvent,
      },
    });

    log.debug('CCI computed for clinician', {
      clinicianId,
      cciScore: result.cciScore,
      triggerEvent,
    });

    return { success: true, cciScore: result.cciScore };
  } catch (error) {
    log.error('Failed to compute CCI for clinician', { clinicianId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run weekly CCI orchestrator job
 */
export async function runCCIOrchestrator(
  triggerEvent: TriggerEvent = 'weekly',
  clinicianIds?: string[]
): Promise<CCIOrchestratorResult> {
  const startedAt = new Date();
  const stats: CCIOrchestratorResult = {
    cliniciansProcessed: 0,
    scoresUpdated: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  try {
    log.info('Starting CCI orchestrator job', { startedAt, triggerEvent });

    // Fetch clinicians to process
    // Note: If clinicianProfile model doesn't exist, use clinicianIds directly
    let clinicians: Array<{ id: string }> = [];

    if (clinicianIds && clinicianIds.length > 0) {
      // Process specific clinicians
      clinicians = clinicianIds.map((id) => ({ id }));
    } else {
      // Try to fetch from clinicianProfile, fallback to empty array
      try {
        clinicians = await prisma.clinicianProfile.findMany({
          select: { id: true },
        });
      } catch (error) {
        log.warn('clinicianProfile model not found, skipping batch processing', { error });
        // If model doesn't exist, return empty result
        stats.finishedAt = new Date();
        return stats;
      }
    }

    if (clinicians.length === 0) {
      log.info('No clinicians found for processing');
      stats.finishedAt = new Date();
      return stats;
    }

    log.info(`Processing ${clinicians.length} clinicians`);

    for (const clinician of clinicians) {
      try {
        stats.cliniciansProcessed += 1;

        const result = await computeCCIForClinician(clinician.id, triggerEvent);
        if (result.success) {
          stats.scoresUpdated += 1;
        } else {
          stats.errors.push(`[clinician:${clinician.id}] ${result.error}`);
        }
      } catch (error) {
        const errorMsg = `[clinician:${clinician.id}] ${error instanceof Error ? error.message : String(error)}`;
        stats.errors.push(errorMsg);
        log.error('Failed to process clinician', { clinicianId: clinician.id, error });
      }
    }

    log.info('CCI orchestrator job complete', {
      cliniciansProcessed: stats.cliniciansProcessed,
      scoresUpdated: stats.scoresUpdated,
      errors: stats.errors.length,
    });
  } catch (error) {
    const errorMsg = `Job failed: ${error instanceof Error ? error.message : String(error)}`;
    stats.errors.push(errorMsg);
    log.error('CCI orchestrator job failed', { error });
  } finally {
    stats.finishedAt = new Date();
  }

  return stats;
}

// Allow running as standalone script
if (require.main === module) {
  runCCIOrchestrator('weekly')
    .then((result) => {
      console.log('[CCIOrchestrator] Job complete', result);
      process.exit(result.errors.length ? 1 : 0);
    })
    .catch((error) => {
      console.error('[CCIOrchestrator] Job failed', error);
      process.exit(1);
    });
}

