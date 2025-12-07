/**
 * B208B-QS-008: SentinelOrchestrator job
 *
 * Runs daily; scans all micro-signal extractors + models; outputs QualityMicroSignal events
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../services/logging/serviceLogger.js';
import { QualitySentinelModel } from '../../services/qualitySentinel/model/sentinelModel.js';
import { AnomalyScoreEngine } from '../../services/qualitySentinel/scoreEngine.js';
import {
  createQualityMicroSignal,
  type QualityMicroSignal,
} from '../../services/qualitySentinel/models/QualityMicroSignal.js';
import type { MicroSignalDataPoint } from '../../services/qualitySentinel/model/sentinelModel.js';
import { processSentinelMicroSignals } from '../../services/safety/integration/sentinelIntegration.js';
import { updateFusionOnMicroSignal } from '../../services/qualityFusion/integration/sentinelIntegration.js';

const prisma = new PrismaClient();
const log = getServiceLogger('jobs/qualitySentinel/orchestrator');

const sentinelModel = new QualitySentinelModel();
const scoreEngine = new AnomalyScoreEngine();

export interface SentinelOrchestratorResult {
  cliniciansProcessed: number;
  extractorsScanned: number;
  microSignalsGenerated: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

/**
 * Micro-signal extractor interface
 */
export interface MicroSignalExtractor {
  id: string;
  name: string;
  extract(clinicianId: string, lookbackDays: number): Promise<MicroSignalDataPoint[]>;
}

/**
 * Get all registered micro-signal extractors
 */
async function getMicroSignalExtractors(): Promise<MicroSignalExtractor[]> {
  // Import extractors dynamically
  const extractors: MicroSignalExtractor[] = [];

  // OPPE micro-drift extractor
  try {
    const { oppeMicroDriftExtractor } = await import(
      '../../services/qualitySentinel/extractors/oppeMicroDrift.js'
    );
    extractors.push(oppeMicroDriftExtractor);
  } catch (error) {
    log.warn('Failed to load OPPE micro-drift extractor', { error });
  }

  // Add more extractors here as they are implemented
  // Example: complication rate extractor, FPPE performance extractor, etc.

  return extractors;
}

/**
 * Extract micro-signals for a clinician using all extractors
 */
async function extractMicroSignals(
  clinicianId: string,
  lookbackDays: number
): Promise<Map<string, MicroSignalDataPoint[]>> {
  const extractors = await getMicroSignalExtractors();
  const results = new Map<string, MicroSignalDataPoint[]>();

  for (const extractor of extractors) {
    try {
      const dataPoints = await extractor.extract(clinicianId, lookbackDays);
      if (dataPoints.length > 0) {
        results.set(extractor.id, dataPoints);
        log.debug('Extracted micro-signals', {
          clinicianId,
          extractorId: extractor.id,
          dataPointCount: dataPoints.length,
        });
      }
    } catch (error) {
      log.warn('Failed to extract micro-signals', {
        clinicianId,
        extractorId: extractor.id,
        error,
      });
    }
  }

  return results;
}

/**
 * Process a single clinician through the sentinel pipeline
 */
async function processClinician(
  clinicianId: string,
  lookbackDays: number
): Promise<QualityMicroSignal[]> {
  const microSignals: QualityMicroSignal[] = [];

  // 1. Extract micro-signals from all extractors
  const extractedData = await extractMicroSignals(clinicianId, lookbackDays);

  if (extractedData.size === 0) {
    log.debug('No micro-signal data extracted', { clinicianId });
    return microSignals;
  }

  // 2. Process each extractor's data through the sentinel model
  for (const [extractorId, dataPoints] of extractedData.entries()) {
    try {
      // Run sentinel model analysis
      const modelResult = sentinelModel.analyze({
        clinicianId,
        extractorId,
        dataPoints,
        lookbackDays,
      });

      // Skip if no anomalies detected
      if (modelResult.anomalyScore === 0 && modelResult.detectedAnomalies.length === 0) {
        continue;
      }

      // 3. Compute anomaly score with severity recommendations
      const scoreResult = scoreEngine.computeScore(modelResult);

      // 4. Create QualityMicroSignal event
      const microSignal = createQualityMicroSignal({
        clinicianId,
        extractorId,
        anomalyScore: scoreResult.anomalyScore,
        severity: scoreResult.severity,
        detectedAt: new Date(),
        metadata: {
          modelResult: {
            anomalyScore: modelResult.anomalyScore,
            detectedAnomaliesCount: modelResult.detectedAnomalies.length,
            statisticalMetrics: modelResult.statisticalMetrics,
            trendAnalysis: modelResult.trendAnalysis,
          },
          scoreResult: {
            severity: scoreResult.severity,
            confidence: scoreResult.confidence,
            recommendations: scoreResult.recommendations,
          },
          contributingFactors: scoreResult.contributingFactors,
        },
        source: 'qualitySentinel/orchestrator',
      });

      microSignals.push(microSignal);

      log.debug('Generated QualityMicroSignal', {
        clinicianId,
        extractorId,
        anomalyScore: microSignal.anomalyScore,
        severity: microSignal.severity,
      });
    } catch (error) {
      log.error('Failed to process extractor data', {
        clinicianId,
        extractorId,
        error,
      });
      throw error;
    }
  }

  return microSignals;
}

/**
 * Store QualityMicroSignal events in database
 */
async function storeMicroSignals(microSignals: QualityMicroSignal[]): Promise<void> {
  if (microSignals.length === 0) return;

  // Store as QualitySignal records in the database
  for (const microSignal of microSignals) {
    try {
      await prisma.qualitySignal.create({
        data: {
          clinicianId: microSignal.clinicianId,
          signalType: 'OPPE_LOW', // Default type, could be made configurable per extractor
          severity: microSignal.severity,
          timestamp: microSignal.detectedAt,
          source: microSignal.source,
          details: {
            extractorId: microSignal.extractorId,
            anomalyScore: microSignal.anomalyScore,
            metadata: microSignal.metadata,
          } as any,
        },
      });
    } catch (error) {
      log.error('Failed to store QualityMicroSignal', {
        clinicianId: microSignal.clinicianId,
        extractorId: microSignal.extractorId,
        error,
      });
      throw error;
    }
  }
}

/**
 * Run daily sentinel orchestrator job
 */
export async function runSentinelOrchestrator(
  referenceDate = new Date()
): Promise<SentinelOrchestratorResult> {
  const startedAt = new Date();
  const stats: SentinelOrchestratorResult = {
    cliniciansProcessed: 0,
    extractorsScanned: 0,
    microSignalsGenerated: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  try {
    log.info('Starting sentinel orchestrator job', { startedAt, referenceDate });

    const lookbackDays = 90;

    // Fetch all active clinicians
    const clinicians = await prisma.clinicianProfile.findMany({
      select: { id: true },
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

    // Get extractors to count them
    const extractors = await getMicroSignalExtractors();
    stats.extractorsScanned = extractors.length;

    // Process each clinician
    for (const clinician of clinicians) {
      try {
        stats.cliniciansProcessed += 1;

        // Process clinician through sentinel pipeline
        const microSignals = await processClinician(clinician.id, lookbackDays);

        if (microSignals.length > 0) {
          // Store micro-signals in database
          await storeMicroSignals(microSignals);
          stats.microSignalsGenerated += microSignals.length;

          // Integrate with SafetyRadar
          try {
            await processSentinelMicroSignals(microSignals);
            log.debug('Integrated micro-signals with SafetyRadar', {
              clinicianId: clinician.id,
              microSignalsCount: microSignals.length,
            });
          } catch (error) {
            log.warn('Failed to integrate with SafetyRadar', {
              clinicianId: clinician.id,
              error,
            });
          }

          // Integrate with FusionEngine
          for (const microSignal of microSignals) {
            try {
              await updateFusionOnMicroSignal(microSignal);
            } catch (error) {
              log.warn('Failed to update FusionEngine', {
                clinicianId: microSignal.clinicianId,
                extractorId: microSignal.extractorId,
                error,
              });
            }
          }

          log.debug('Processed clinician', {
            clinicianId: clinician.id,
            microSignalsGenerated: microSignals.length,
          });
        }
      } catch (error) {
        const errorMsg = `[clinician:${clinician.id}] ${
          error instanceof Error ? error.message : String(error)
        }`;
        stats.errors.push(errorMsg);
        log.error('Failed to process clinician', { clinicianId: clinician.id, error });
      }
    }

    log.info('Sentinel orchestrator job complete', {
      cliniciansProcessed: stats.cliniciansProcessed,
      extractorsScanned: stats.extractorsScanned,
      microSignalsGenerated: stats.microSignalsGenerated,
      errors: stats.errors.length,
    });
  } catch (error) {
    const errorMsg = `Job failed: ${error instanceof Error ? error.message : String(error)}`;
    stats.errors.push(errorMsg);
    log.error('Sentinel orchestrator job failed', { error });
  } finally {
    stats.finishedAt = new Date();
  }

  return stats;
}

// Allow running as standalone script
if (require.main === module) {
  runSentinelOrchestrator()
    .then((result) => {
      console.log('[SentinelOrchestrator] Job complete', result);
      process.exit(result.errors.length ? 1 : 0);
    })
    .catch((error) => {
      console.error('[SentinelOrchestrator] Job failed', error);
      process.exit(1);
    });
}

