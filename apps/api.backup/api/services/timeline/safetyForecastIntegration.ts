/**
 * B203B-ML-009: SafetyForecastTimelineIntegration
 *
 * Adds timeline events: SAFETY_FORECAST, SAFETY_FORECAST_CHANGED.
 * Includes predicted risk and features.
 */

import crypto from 'node:crypto';
import { PrismaClient, TimelineEventSeverity } from '@prisma/client';
import type { SafetyFeatures } from '../predictiveSafety/models/SafetyFeatureVector.js';
import type { RecommendedAction } from '../predictiveSafety/scoreEngine.js';

const prisma = new PrismaClient();

export interface SafetyForecastTimelineInput {
  clinicianId: string;
  predictedRisk: number; // 0-1 scale
  previousRisk?: number | null;
  features: SafetyFeatures;
  recommendedActions: RecommendedAction[];
  timestamp: Date;
  source?: string;
  metadata?: Record<string, unknown>;
}

function mapRiskToSeverity(risk: number): TimelineEventSeverity {
  if (risk >= 0.8) return TimelineEventSeverity.CRITICAL;
  if (risk >= 0.6) return TimelineEventSeverity.WARNING;
  if (risk >= 0.4) return TimelineEventSeverity.NOTICE;
  return TimelineEventSeverity.INFO;
}

function buildAuditHash(payload: SafetyForecastTimelineInput): string {
  return crypto
    .createHash('sha256')
    .update(
      [
        payload.clinicianId,
        payload.predictedRisk.toString(),
        payload.timestamp.toISOString(),
        payload.previousRisk?.toString() ?? 'null',
      ].join(':')
    )
    .digest('hex');
}

function determineEventType(input: SafetyForecastTimelineInput): string {
  // Check if this is a significant change from previous risk
  if (input.previousRisk !== null && input.previousRisk !== undefined) {
    const change = Math.abs(input.predictedRisk - input.previousRisk);
    const significantChange = change >= 0.15; // 15% change threshold

    if (significantChange) {
      const isIncrease = input.predictedRisk > input.previousRisk;
      return isIncrease ? 'SAFETY_FORECAST_CHANGED' : 'SAFETY_FORECAST_CHANGED';
    }
  }

  return 'SAFETY_FORECAST';
}

/**
 * Record safety forecast timeline event
 */
export async function recordSafetyForecastTimelineEvent(
  input: SafetyForecastTimelineInput
): Promise<void> {
  const auditHash = buildAuditHash(input);
  const eventType = determineEventType(input);
  const severity = mapRiskToSeverity(input.predictedRisk);

  // Extract key feature values for summary
  const featureSummary: Record<string, number> = {
    oppe_trend: input.features.oppe_trend,
    fppe_outcomes: input.features.fppe_outcomes,
    complication_rate: input.features.complication_rate,
    drift_events: input.features.drift_events,
    license_freshness: input.features.license_freshness,
    board_freshness: input.features.board_freshness,
    dea_expiry: input.features.dea_expiry,
    pecos_status: input.features.pecos_status,
    payer_denials: input.features.payer_denials,
    ehr_mismatches: input.features.ehr_mismatches,
  };

  // Build summary text
  const riskPercent = Math.round(input.predictedRisk * 100);
  const summary = `Predictive safety risk: ${riskPercent}%${input.previousRisk !== null && input.previousRisk !== undefined ? ` (${input.predictedRisk > input.previousRisk ? '↑' : '↓'} from ${Math.round(input.previousRisk * 100)}%)` : ''}`;

  await prisma.credentialTimelineEvent.create({
    data: {
      clinicianId: input.clinicianId,
      eventType: eventType as any, // Will be SAFETY_FORECAST or SAFETY_FORECAST_CHANGED
      severity,
      timestamp: input.timestamp,
      metadata: {
        predictedRisk: input.predictedRisk,
        previousRisk: input.previousRisk ?? null,
        riskChange:
          input.previousRisk !== null && input.previousRisk !== undefined
            ? input.predictedRisk - input.previousRisk
            : null,
        features: featureSummary,
        recommendedActions: input.recommendedActions.map((action) => ({
          action: action.action,
          priority: action.priority,
          rationale: action.rationale,
          feature: action.feature,
        })),
        topFeatures: Object.entries(featureSummary)
          .sort(([, a], [, b]) => {
            // Sort by contribution (higher risk features first)
            // For freshness features, lower = higher risk, so invert
            const riskA = a < 0.5 ? 1 - a : a;
            const riskB = b < 0.5 ? 1 - b : b;
            return riskB - riskA;
          })
          .slice(0, 3)
          .map(([name]) => name),
        source: input.source ?? 'predictiveSafety/orchestrator',
        ...input.metadata,
      },
      auditHash,
    },
  });
}

