/**
 * B208B-QS-009: Sentinel → SafetyRadar integration
 *
 * Minor anomalies increment background safety pressure;
 * repeated micro-signals escalate to MEDIUM/HIGH safety signals
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { SafetySignalCollector } from '../collectors/signalCollector.js';
import type { QualityMicroSignal } from '../../qualitySentinel/models/QualityMicroSignal.js';
import type {
  PrivilegeSafetySignalType,
  SafetySignalSeverity,
} from '../models/PrivilegeSafetySignal.js';

const prisma = new PrismaClient();
const log = getServiceLogger('safety/sentinelIntegration');
const signalCollector = new SafetySignalCollector();

export interface SentinelSafetyIntegrationOptions {
  minorAnomalyThreshold?: number; // Anomaly score threshold for "minor" (default: 0.3)
  escalationWindowHours?: number; // Time window for counting repeated signals (default: 24)
  escalationCountThreshold?: number; // Number of repeated signals to trigger escalation (default: 3)
  backgroundPressureIncrement?: number; // Increment for background safety pressure (default: 0.05)
}

const DEFAULT_OPTIONS: Required<SentinelSafetyIntegrationOptions> = {
  minorAnomalyThreshold: 0.3,
  escalationWindowHours: 24,
  escalationCountThreshold: 3,
  backgroundPressureIncrement: 0.05,
};

/**
 * Process QualityMicroSignal events and integrate with SafetyRadar
 */
export async function processSentinelMicroSignal(
  microSignal: QualityMicroSignal,
  options: SentinelSafetyIntegrationOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { clinicianId, anomalyScore, severity, detectedAt, extractorId } = microSignal;

  try {
    // 1. Check if this is a minor anomaly (below threshold)
    if (anomalyScore < opts.minorAnomalyThreshold) {
      // Increment background safety pressure (stored as metadata or separate tracking)
      await incrementBackgroundSafetyPressure(clinicianId, opts.backgroundPressureIncrement);
      log.debug('Incremented background safety pressure for minor anomaly', {
        clinicianId,
        anomalyScore,
        extractorId,
      });
      return;
    }

    // 2. Check for repeated micro-signals within escalation window
    const escalationWindowStart = new Date(
      detectedAt.getTime() - opts.escalationWindowHours * 60 * 60 * 1000
    );

    const recentMicroSignals = await prisma.qualitySignal.findMany({
      where: {
        clinicianId,
        timestamp: {
          gte: escalationWindowStart,
          lte: detectedAt,
        },
        source: 'qualitySentinel',
        details: {
          path: ['anomalyScore'],
          gte: opts.minorAnomalyThreshold,
        } as any,
      },
      orderBy: { timestamp: 'asc' },
    });

    const recentCount = recentMicroSignals.length + 1; // +1 for current signal

    // 3. Determine if escalation is needed
    if (recentCount >= opts.escalationCountThreshold) {
      // Escalate to MEDIUM or HIGH safety signal
      const escalatedSeverity: SafetySignalSeverity =
        recentCount >= opts.escalationCountThreshold * 2 ? 'HIGH' : 'MED';

      await signalCollector.ingestQualitySignal(
        {
          clinicianId,
          signalType: mapExtractorToSignalType(extractorId),
          severity: escalatedSeverity,
          timestamp: detectedAt,
          details: {
            summary: `Repeated micro-signals detected (${recentCount} in ${opts.escalationWindowHours}h window)`,
            extractorId,
            anomalyScore,
            recentCount,
            escalationWindowHours: opts.escalationWindowHours,
            metadata: {
              originalMicroSignal: {
                anomalyScore: microSignal.anomalyScore,
                severity: microSignal.severity,
                detectedAt: microSignal.detectedAt.toISOString(),
              },
            },
          },
          source: 'qualitySentinel/safetyIntegration',
        },
        {}
      );

      log.warn('Escalated repeated micro-signals to safety signal', {
        clinicianId,
        extractorId,
        recentCount,
        escalatedSeverity,
      });
    } else if (severity === 'HIGH' || severity === 'CRITICAL') {
      // High/CRITICAL severity micro-signals always create safety signals
      await signalCollector.ingestQualitySignal(
        {
          clinicianId,
          signalType: mapExtractorToSignalType(extractorId),
          severity: severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          timestamp: detectedAt,
          details: {
            summary: `High-severity micro-signal detected (${severity})`,
            extractorId,
            anomalyScore,
            metadata: {
              originalMicroSignal: {
                anomalyScore: microSignal.anomalyScore,
                severity: microSignal.severity,
                detectedAt: microSignal.detectedAt.toISOString(),
              },
            },
          },
          source: 'qualitySentinel/safetyIntegration',
        },
        {}
      );

      log.warn('Created safety signal from high-severity micro-signal', {
        clinicianId,
        extractorId,
        severity,
      });
    } else {
      // MED severity: increment background pressure
      await incrementBackgroundSafetyPressure(clinicianId, opts.backgroundPressureIncrement * 1.5);
      log.debug('Incremented background safety pressure for MED severity', {
        clinicianId,
        anomalyScore,
        extractorId,
      });
    }
  } catch (error) {
    log.error('Failed to process sentinel micro-signal', {
      clinicianId,
      extractorId,
      error,
    });
    throw error;
  }
}

/**
 * Increment background safety pressure for a clinician
 * This is stored as metadata on the clinician profile or in a separate tracking table
 */
async function incrementBackgroundSafetyPressure(
  clinicianId: string,
  increment: number
): Promise<void> {
  try {
    // Option 1: Store in clinician profile metadata
    const profile = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
      select: { metadata: true },
    });

    const currentPressure =
      (profile?.metadata as any)?.backgroundSafetyPressure ?? 0;
    const newPressure = Math.min(1, currentPressure + increment); // Cap at 1.0

    await prisma.clinicianProfile.update({
      where: { id: clinicianId },
      data: {
        metadata: {
          ...((profile?.metadata as any) ?? {}),
          backgroundSafetyPressure: newPressure,
          backgroundSafetyPressureUpdatedAt: new Date().toISOString(),
        } as any,
      },
    });

    log.debug('Updated background safety pressure', {
      clinicianId,
      previousPressure: currentPressure,
      newPressure,
      increment,
    });
  } catch (error) {
    log.warn('Failed to update background safety pressure', {
      clinicianId,
      error,
    });
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Map extractor ID to appropriate safety signal type
 */
function mapExtractorToSignalType(extractorId: string): PrivilegeSafetySignalType {
  // Map extractor IDs to safety signal types
  const mapping: Record<string, PrivilegeSafetySignalType> = {
    oppeMicroDrift: 'OPPE_LOW',
    complicationVariance: 'QUALITY_RISK',
    fppePerformance: 'FPPE_FAILURE',
    ehrMismatch: 'EHR_MISMATCH',
    payerDenial: 'PAYER_DENIAL_SPIKE',
    licenseDrift: 'LICENSE_RISK',
    boardDrift: 'BOARD_EXPIRED',
  };

  return mapping[extractorId] ?? 'QUALITY_RISK';
}

/**
 * Batch process multiple micro-signals
 */
export async function processSentinelMicroSignals(
  microSignals: QualityMicroSignal[],
  options: SentinelSafetyIntegrationOptions = {}
): Promise<void> {
  for (const microSignal of microSignals) {
    try {
      await processSentinelMicroSignal(microSignal, options);
    } catch (error) {
      log.error('Failed to process micro-signal in batch', {
        clinicianId: microSignal.clinicianId,
        extractorId: microSignal.extractorId,
        error,
      });
      // Continue processing other signals
    }
  }
}

