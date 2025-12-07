/**
 * B203B-ML-010: Update CredentialRisk engine with predictive features
 *
 * Low predicted safety → add predictive risk;
 * influences composite risk score.
 */

import { PrismaClient } from '@prisma/client';
import { mergeCredentialRisk } from './riskService.js';
import { CredentialRiskFactors, type CredentialRiskFactor } from './enums.js';
import { getServiceLogger } from '../logging/serviceLogger.js';

const prisma = new PrismaClient();
const log = getServiceLogger('credentialRisk/predictiveIntegration');

export interface PredictiveRiskUpdateInput {
  clinicianId: string;
  predictedRisk: number; // 0-1 scale from predictive safety model
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface PredictiveRiskUpdateResult {
  clinicianId: string;
  added: CredentialRiskFactor[];
  removed: CredentialRiskFactor[];
  compositeScore: number;
  summary: {
    predictedRisk: number;
    riskFactorAdded: boolean;
    lastEvaluatedAt: string;
  };
}

/**
 * Risk threshold for adding predictive risk factor
 * If predicted safety risk is above this threshold, add PREDICTIVE_SAFETY_RISK factor
 */
const PREDICTIVE_RISK_THRESHOLD = 0.5; // 50% predicted risk

/**
 * Sync predictive safety score to credential risk factors
 *
 * Low predicted safety (high predicted risk) → adds PREDICTIVE_SAFETY_RISK factor
 * This factor influences the composite risk score
 */
export async function syncPredictiveSafetyToRisk(
  input: PredictiveRiskUpdateInput
): Promise<PredictiveRiskUpdateResult> {
  if (!input.clinicianId) {
    throw new Error('syncPredictiveSafetyToRisk: clinicianId is required');
  }

  if (input.predictedRisk < 0 || input.predictedRisk > 1) {
    throw new Error('syncPredictiveSafetyToRisk: predictedRisk must be between 0 and 1');
  }

  const now = new Date().toISOString();

  // Determine if predictive risk factor should be added
  // Low predicted safety (high predicted risk) = add factor
  const shouldAddRiskFactor = input.predictedRisk >= PREDICTIVE_RISK_THRESHOLD;

  const add: CredentialRiskFactor[] = [];
  const remove: CredentialRiskFactor[] = [];

  if (shouldAddRiskFactor) {
    add.push(CredentialRiskFactors.PREDICTIVE_SAFETY_RISK);
    log.info('Adding predictive safety risk factor', {
      clinicianId: input.clinicianId,
      predictedRisk: input.predictedRisk,
      threshold: PREDICTIVE_RISK_THRESHOLD,
    });
  } else {
    remove.push(CredentialRiskFactors.PREDICTIVE_SAFETY_RISK);
    log.debug('Removing predictive safety risk factor (risk below threshold)', {
      clinicianId: input.clinicianId,
      predictedRisk: input.predictedRisk,
      threshold: PREDICTIVE_RISK_THRESHOLD,
    });
  }

  // Update credential risk with predictive factor
  await mergeCredentialRisk(input.clinicianId, {
    add: add.length > 0 ? add : undefined,
    remove: remove.length > 0 ? remove : undefined,
    details: {
      lastEvaluatedAt: now,
      source: input.source ?? 'predictiveSafety/integration',
      predictedRisk: input.predictedRisk,
      riskThreshold: PREDICTIVE_RISK_THRESHOLD,
      riskFactorAdded: shouldAddRiskFactor,
      ...input.metadata,
    },
  });

  // Fetch updated composite score
  const updatedRisk = await prisma.credentialRisk.findUnique({
    where: { clinicianId: input.clinicianId },
    select: { score: true },
  });

  const compositeScore = updatedRisk?.score ?? 0;

  log.info('Synced predictive safety to credential risk', {
    clinicianId: input.clinicianId,
    predictedRisk: input.predictedRisk,
    riskFactorAdded: shouldAddRiskFactor,
    compositeScore,
  });

  return {
    clinicianId: input.clinicianId,
    added: add,
    removed: remove,
    compositeScore,
    summary: {
      predictedRisk: input.predictedRisk,
      riskFactorAdded: shouldAddRiskFactor,
      lastEvaluatedAt: now,
    },
  };
}

/**
 * Batch sync predictive safety scores to credential risk
 */
export async function batchSyncPredictiveSafetyToRisk(
  inputs: PredictiveRiskUpdateInput[]
): Promise<PredictiveRiskUpdateResult[]> {
  const results: PredictiveRiskUpdateResult[] = [];

  for (const input of inputs) {
    try {
      const result = await syncPredictiveSafetyToRisk(input);
      results.push(result);
    } catch (error) {
      log.error('Failed to sync predictive safety to risk', {
        clinicianId: input.clinicianId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue processing other inputs
    }
  }

  return results;
}

