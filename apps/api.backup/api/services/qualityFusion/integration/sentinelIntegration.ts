/**
 * B208B-QS-010: Sentinel → FusionEngine integration
 *
 * FusionScore incorporates early anomaly penalties;
 * improves predictive accuracy
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import type { QualityMicroSignal } from '../../qualitySentinel/models/QualityMicroSignal.js';
import type { FusionEngineResult } from '../fusionEngine.js';

const prisma = new PrismaClient();
const log = getServiceLogger('qualityFusion/sentinelIntegration');

export interface SentinelFusionIntegrationOptions {
  anomalyPenaltyWeight?: number; // Weight for anomaly penalty in fusion score (default: 0.15)
  lookbackDays?: number; // Lookback window for anomaly penalties (default: 90)
  severityWeights?: Record<QualityMicroSignal['severity'], number>; // Penalty weights by severity
}

const DEFAULT_SEVERITY_WEIGHTS: Record<QualityMicroSignal['severity'], number> = {
  LOW: 0.02,
  MED: 0.05,
  HIGH: 0.12,
  CRITICAL: 0.2,
};

const DEFAULT_OPTIONS: Required<Omit<SentinelFusionIntegrationOptions, 'severityWeights'>> & {
  severityWeights: Record<QualityMicroSignal['severity'], number>;
} = {
  anomalyPenaltyWeight: 0.15,
  lookbackDays: 90,
  severityWeights: DEFAULT_SEVERITY_WEIGHTS,
};

/**
 * Apply sentinel anomaly penalties to fusion score
 */
export function applySentinelPenaltiesToFusion(
  fusionResult: FusionEngineResult,
  microSignals: QualityMicroSignal[],
  options: SentinelFusionIntegrationOptions = {}
): FusionEngineResult {
  const opts = {
    ...DEFAULT_OPTIONS,
    severityWeights: options.severityWeights ?? DEFAULT_SEVERITY_WEIGHTS,
    ...options,
  };

  if (microSignals.length === 0) {
    return fusionResult;
  }

  // Calculate total anomaly penalty
  let totalPenalty = 0;
  for (const microSignal of microSignals) {
    const severityWeight = opts.severityWeights[microSignal.severity] ?? 0;
    // Weight by anomaly score (0-1) and severity
    const penalty = microSignal.anomalyScore * severityWeight;
    totalPenalty += penalty;
  }

  // Normalize penalty (cap at reasonable maximum)
  const normalizedPenalty = Math.min(1, totalPenalty / microSignals.length);

  // Apply penalty to fusion score
  const adjustedFusionScore = Math.max(
    0,
    fusionResult.fusionScore - normalizedPenalty * opts.anomalyPenaltyWeight
  );

  // Update breakdown to include sentinel component
  const updatedBreakdown = [
    ...fusionResult.breakdown,
    {
      label: 'sentinel' as const,
      score: Math.max(0, 1 - normalizedPenalty),
      weight: opts.anomalyPenaltyWeight,
    },
  ];

  // Recalculate fusion score with new breakdown
  const recalculatedFusionScore = Number(
    updatedBreakdown
      .reduce((total, entry) => total + entry.score * entry.weight, 0)
      .toFixed(3)
  );

  log.debug('Applied sentinel penalties to fusion score', {
    clinicianId: fusionResult.clinicianId,
    originalFusionScore: fusionResult.fusionScore,
    adjustedFusionScore: recalculatedFusionScore,
    microSignalsCount: microSignals.length,
    totalPenalty: normalizedPenalty,
  });

  return {
    ...fusionResult,
    fusionScore: recalculatedFusionScore,
    breakdown: updatedBreakdown,
  };
}

/**
 * Get recent micro-signals for a clinician
 */
export async function getRecentMicroSignals(
  clinicianId: string,
  lookbackDays: number = DEFAULT_OPTIONS.lookbackDays
): Promise<QualityMicroSignal[]> {
  const lookbackDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  try {
    const qualitySignals = await prisma.qualitySignal.findMany({
      where: {
        clinicianId,
        timestamp: { gte: lookbackDate },
        source: 'qualitySentinel',
      },
      orderBy: { timestamp: 'desc' },
    });

    // Convert QualitySignal records to QualityMicroSignal
    const microSignals: QualityMicroSignal[] = qualitySignals
      .map((signal) => {
        const details = signal.details as any;
        if (!details?.anomalyScore) {
          return null; // Skip if not a micro-signal
        }

        return {
          clinicianId: signal.clinicianId,
          extractorId: details.extractorId ?? 'unknown',
          anomalyScore: details.anomalyScore,
          severity: signal.severity as QualityMicroSignal['severity'],
          detectedAt: signal.timestamp,
          metadata: details.metadata,
          source: signal.source ?? 'qualitySentinel',
        };
      })
      .filter((s): s is QualityMicroSignal => s !== null);

    return microSignals;
  } catch (error) {
    log.error('Failed to fetch recent micro-signals', {
      clinicianId,
      lookbackDays,
      error,
    });
    return [];
  }
}

/**
 * Enhance fusion engine result with sentinel anomaly penalties
 */
export async function enhanceFusionWithSentinel(
  fusionResult: FusionEngineResult,
  options: SentinelFusionIntegrationOptions = {}
): Promise<FusionEngineResult> {
  const opts = {
    ...DEFAULT_OPTIONS,
    severityWeights: options.severityWeights ?? DEFAULT_SEVERITY_WEIGHTS,
    ...options,
  };

  try {
    // Fetch recent micro-signals for this clinician
    const microSignals = await getRecentMicroSignals(
      fusionResult.clinicianId,
      opts.lookbackDays
    );

    if (microSignals.length === 0) {
      return fusionResult;
    }

    // Apply penalties
    return applySentinelPenaltiesToFusion(fusionResult, microSignals, opts);
  } catch (error) {
    log.error('Failed to enhance fusion with sentinel', {
      clinicianId: fusionResult.clinicianId,
      error,
    });
    // Return original result on error
    return fusionResult;
  }
}

/**
 * Update fusion score when new micro-signal is detected
 */
export async function updateFusionOnMicroSignal(
  microSignal: QualityMicroSignal,
  options: SentinelFusionIntegrationOptions = {}
): Promise<void> {
  try {
    // Fetch current fusion result (if available)
    // In practice, this would trigger a fusion recalculation
    // For now, we just log that fusion should be recalculated
    log.info('Micro-signal detected - fusion score should be recalculated', {
      clinicianId: microSignal.clinicianId,
      extractorId: microSignal.extractorId,
      anomalyScore: microSignal.anomalyScore,
      severity: microSignal.severity,
    });

    // In a full implementation, this would:
    // 1. Fetch current fusion result
    // 2. Apply sentinel penalties
    // 3. Update stored fusion score
    // 4. Trigger downstream updates (SafetyRadar, etc.)
  } catch (error) {
    log.error('Failed to update fusion on micro-signal', {
      clinicianId: microSignal.clinicianId,
      extractorId: microSignal.extractorId,
      error,
    });
  }
}

