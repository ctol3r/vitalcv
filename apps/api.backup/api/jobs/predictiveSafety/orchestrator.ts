/**
 * B203B-ML-008: PredictiveSafetyOrchestrator
 *
 * Runs weekly; updates predictive scores; writes to database;
 * triggers SafetyRadar and FusionEngine updates.
 */

import { PrismaClient } from '@prisma/client';
import { SafetyScoreEngine } from '../../services/predictiveSafety/scoreEngine.js';
import type { SafetyFeatureVector } from '../../services/predictiveSafety/models/SafetyFeatureVector.js';
import { createSafetyFeatureVector } from '../../services/predictiveSafety/models/SafetyFeatureVector.js';
import { recordSafetyForecastTimelineEvent } from '../../services/timeline/safetyForecastIntegration.js';
import { getServiceLogger } from '../../services/logging/serviceLogger.js';
import { fusionEngine, type FusionEngineResult } from '../../services/qualityFusion/fusionEngine.js';
import { syncPredictiveSafetyToRisk } from '../../services/credentialRisk/predictiveIntegration.js';

const prisma = new PrismaClient();
const log = getServiceLogger('jobs/predictiveSafety/orchestrator');
const scoreEngine = new SafetyScoreEngine();

export interface PredictiveSafetyJobResult {
  cliniciansProcessed: number;
  scoresUpdated: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

/**
 * Build safety feature vector from clinician data
 */
async function buildFeatureVector(clinicianId: string): Promise<SafetyFeatureVector | null> {
  try {
    const lookbackDays = 90;
    const lookbackDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    // Fetch clinician data
    const [qualitySignals, driftEvents, safetySignals, licenses, boardCerts, deaCerts, pecos, payerData, ehrSync] =
      await Promise.all([
        prisma.qualitySignal.findMany({
          where: { clinicianId, timestamp: { gte: lookbackDate } },
          orderBy: { timestamp: 'desc' },
        }),
        prisma.driftEvent.findMany({
          where: { clinicianId, triggeredAt: { gte: lookbackDate } },
        }),
        prisma.privilegeSafetySignal.findMany({
          where: { clinicianId, detectedAt: { gte: lookbackDate } },
        }),
        prisma.stateLicenseVerification.findMany({
          where: { clinicianId },
          orderBy: { expiryDate: 'asc' },
          take: 1,
        }),
        prisma.credential.findMany({
          where: {
            userId: { in: await prisma.clinicianProfile.findUnique({ where: { id: clinicianId } }).then(c => c ? [c.userId] : []) },
            type: 'BoardCertification',
          },
          orderBy: { expiresAt: 'asc' },
          take: 1,
        }),
        prisma.credential.findMany({
          where: {
            userId: { in: await prisma.clinicianProfile.findUnique({ where: { id: clinicianId } }).then(c => c ? [c.userId] : []) },
            type: 'DEARegistration',
          },
          orderBy: { expiresAt: 'asc' },
          take: 1,
        }),
        prisma.pECOSEnrollment.findMany({
          where: { clinicianId },
          orderBy: { revalidationDueAt: 'asc' },
          take: 1,
        }),
        prisma.payerEnrollment.findMany({
          where: { clinicianId },
        }),
        prisma.ehrSyncStatus.findFirst({
          where: { clinicianId },
          orderBy: { lastSyncAt: 'desc' },
        }),
      ]);

    // Calculate OPPE trend (simplified: based on quality signals)
    const oppeTrend = calculateOPPETrend(qualitySignals);

    // Calculate FPPE outcomes (simplified: based on recent FPPE failures)
    const fppeOutcomes = calculateFPPEOutcomes(safetySignals);

    // Calculate complication rate (normalized, stub)
    const complicationRate = calculateComplicationRate(qualitySignals);

    // Calculate drift events (normalized)
    const driftEventsNormalized = Math.min(1, driftEvents.length / 10);

    // Calculate license freshness (days until expiry, normalized to 0-1)
    const licenseFreshness = calculateFreshness(licenses[0]?.expiryDate);

    // Calculate board freshness
    const boardFreshness = calculateFreshness(boardCerts[0]?.expiresAt);

    // Calculate DEA freshness
    const deaExpiry = calculateFreshness(deaCerts[0]?.expiresAt);

    // Calculate PECOS status (0 = expired/inactive, 1 = active)
    const pecosStatus = calculatePecosStatus(pecos[0]);

    // Calculate payer denials (normalized, stub)
    const payerDenials = calculatePayerDenials(payerData);

    // Calculate EHR mismatches (normalized, stub)
    const ehrMismatches = calculateEhrMismatches(ehrSync);

    return createSafetyFeatureVector({
      clinicianId,
      timestamp: new Date(),
      features: {
        oppe_trend: oppeTrend,
        fppe_outcomes: fppeOutcomes,
        complication_rate: complicationRate,
        drift_events: driftEventsNormalized,
        license_freshness: licenseFreshness,
        board_freshness: boardFreshness,
        dea_expiry: deaExpiry,
        pecos_status: pecosStatus,
        payer_denials: payerDenials,
        ehr_mismatches: ehrMismatches,
      },
    });
  } catch (error) {
    log.error('Failed to build feature vector', { clinicianId, error });
    return null;
  }
}

function calculateOPPETrend(qualitySignals: any[]): number {
  if (qualitySignals.length === 0) return 0;
  // Simplified: count LOW/HIGH signals to determine trend
  const lowCount = qualitySignals.filter(s => s.severity === 'LOW').length;
  const highCount = qualitySignals.filter(s => s.severity === 'HIGH' || s.severity === 'CRITICAL').length;
  const trend = (highCount - lowCount) / qualitySignals.length;
  return Math.max(-1, Math.min(1, trend));
}

function calculateFPPEOutcomes(safetySignals: any[]): number {
  const fppeFailures = safetySignals.filter(s => s.signalType === 'FPPE_FAILURE').length;
  if (fppeFailures === 0) return 1.0;
  // Normalize: 0 failures = 1.0, >= 3 failures = 0.0
  return Math.max(0, 1 - fppeFailures / 3);
}

function calculateComplicationRate(qualitySignals: any[]): number {
  // Stub: based on quality signals with complications
  const complicationSignals = qualitySignals.filter(s =>
    s.signalType?.includes('COMPLICATION') || s.signalType?.includes('ADVERSE')
  ).length;
  return Math.min(1, complicationSignals / 10);
}

function calculateFreshness(expiryDate: Date | null | undefined): number {
  if (!expiryDate) return 0;
  const now = new Date();
  const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  // Normalize: 0 days = 0, 365 days = 1, >365 = 1
  return Math.min(1, Math.max(0, daysUntilExpiry / 365));
}

function calculatePecosStatus(pecos: any): number {
  if (!pecos) return 0;
  const now = new Date();
  const revalidationDue = pecos.revalidationDueAt || pecos.revalidationDate;
  if (revalidationDue && new Date(revalidationDue) < now) return 0.3; // Expired but not too old
  if (pecos.currentStatus === 'APPROVED' || pecos.status === 'ACTIVE') return 1.0;
  return 0.5;
}

function calculatePayerDenials(payerData: any[]): number {
  // Stub: simplified denial rate
  if (payerData.length === 0) return 0;
  const denied = payerData.filter(p => p.status === 'DENIED' || p.status === 'SUSPENDED').length;
  return Math.min(1, denied / payerData.length);
}

function calculateEhrMismatches(ehrSync: any): number {
  // Stub: based on sync status
  if (!ehrSync) return 0;
  if (ehrSync.hasMismatch) return 0.8;
  if (ehrSync.lastSyncAt) {
    const daysSinceSync = (Date.now() - new Date(ehrSync.lastSyncAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceSync > 30) return 0.5; // Stale sync
  }
  return 0;
}

/**
 * Run weekly predictive safety orchestrator job
 */
export async function runPredictiveSafetyOrchestrator(referenceDate = new Date()): Promise<PredictiveSafetyJobResult> {
  const startedAt = new Date();
  const stats: PredictiveSafetyJobResult = {
    cliniciansProcessed: 0,
    scoresUpdated: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  try {
    log.info('Starting predictive safety orchestrator job', { startedAt });

    // Fetch all active clinicians
    const clinicians = await prisma.clinicianProfile.findMany({
      select: { id: true, userId: true },
      where: {
        // Add any filters for active clinicians if needed
      },
    });

    if (clinicians.length === 0) {
      log.info('No clinicians found for processing');
      stats.finishedAt = new Date();
      return stats;
    }

    log.info(`Processing ${clinicians.length} clinicians`);

    for (const clinician of clinicians) {
      try {
        stats.cliniciansProcessed += 1;

        // Build feature vector
        const featureVector = await buildFeatureVector(clinician.id);
        if (!featureVector) {
          stats.errors.push(`[clinician:${clinician.id}] Failed to build feature vector`);
          continue;
        }

        // Calculate safety score
        const scoreResult = await scoreEngine.calculateScore(featureVector);

        // Store or update predictive safety score
        await prisma.predictiveSafetyScore.upsert({
          where: { clinicianId: clinician.id },
          create: {
            clinicianId: clinician.id,
            predictedRisk: scoreResult.predictedRisk,
            confidence: scoreResult.confidence,
            features: featureVector.features as any,
            recommendedActions: scoreResult.recommendedActions as any,
            lastUpdatedAt: scoreResult.timestamp,
          },
          update: {
            predictedRisk: scoreResult.predictedRisk,
            confidence: scoreResult.confidence,
            features: featureVector.features as any,
            recommendedActions: scoreResult.recommendedActions as any,
            lastUpdatedAt: scoreResult.timestamp,
          },
        });

        stats.scoresUpdated += 1;

        // Record timeline event
        await recordSafetyForecastTimelineEvent({
          clinicianId: clinician.id,
          predictedRisk: scoreResult.predictedRisk,
          previousRisk: await getPreviousRisk(clinician.id),
          features: featureVector.features,
          recommendedActions: scoreResult.recommendedActions,
          timestamp: scoreResult.timestamp,
        });

        // Sync predictive safety to credential risk (influences composite risk score)
        try {
          await syncPredictiveSafetyToRisk({
            clinicianId: clinician.id,
            predictedRisk: scoreResult.predictedRisk,
            source: 'predictiveSafety/orchestrator',
            metadata: {
              confidence: scoreResult.confidence,
              recommendedActions: scoreResult.recommendedActions,
            },
          });
          log.debug('Synced predictive safety to credential risk', { clinicianId: clinician.id });
        } catch (riskError) {
          log.warn('Failed to sync predictive safety to credential risk', {
            clinicianId: clinician.id,
            error: riskError,
          });
        }

        // Trigger FusionEngine update (for quality fusion scoring)
        try {
          await fusionEngine.run({ clinicianId: clinician.id });
          log.debug('Triggered FusionEngine update', { clinicianId: clinician.id });
        } catch (fusionError) {
          log.warn('Failed to trigger FusionEngine update', { clinicianId: clinician.id, error: fusionError });
        }

        // Note: SafetyRadar is typically a frontend service/component that reads from the database
        // The score update above will be picked up by SafetyRadar when it queries the database

        log.debug('Processed clinician', {
          clinicianId: clinician.id,
          predictedRisk: scoreResult.predictedRisk,
        });
      } catch (error) {
        const errorMsg = `[clinician:${clinician.id}] ${error instanceof Error ? error.message : String(error)}`;
        stats.errors.push(errorMsg);
        log.error('Failed to process clinician', { clinicianId: clinician.id, error });
      }
    }

    log.info('Predictive safety orchestrator job complete', {
      cliniciansProcessed: stats.cliniciansProcessed,
      scoresUpdated: stats.scoresUpdated,
      errors: stats.errors.length,
    });
  } catch (error) {
    const errorMsg = `Job failed: ${error instanceof Error ? error.message : String(error)}`;
    stats.errors.push(errorMsg);
    log.error('Predictive safety orchestrator job failed', { error });
  } finally {
    stats.finishedAt = new Date();
  }

  return stats;
}

async function getPreviousRisk(clinicianId: string): Promise<number | null> {
  const previous = await prisma.predictiveSafetyScore.findUnique({
    where: { clinicianId },
    select: { predictedRisk: true },
  });
  return previous?.predictedRisk ?? null;
}

// Allow running as standalone script
if (require.main === module) {
  runPredictiveSafetyOrchestrator()
    .then((result) => {
      console.log('[PredictiveSafetyOrchestrator] Job complete', result);
      process.exit(result.errors.length ? 1 : 0);
    })
    .catch((error) => {
      console.error('[PredictiveSafetyOrchestrator] Job failed', error);
      process.exit(1);
    });
}

