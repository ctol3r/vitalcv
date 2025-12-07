/**
 * B206B-WF-010: SupplyForecastTimelineIntegration
 *
 * Adds timeline events: SUPPLY_FORECAST, SUPPLY_SHOCK.
 * Includes predicted gaps + timelines.
 */

import crypto from 'node:crypto';
import { PrismaClient, TimelineEventSeverity } from '@prisma/client';
import type { AggregateSupplyForecast } from '../workforceForecast/supplyEngine.js';
import type { SupplyShock } from '../workforceForecast/detectors/supplyShockDetector.js';
import type { SupplyReadinessPrediction } from '../workforceForecast/model/supplyModel.js';

const prisma = new PrismaClient();

export interface SupplyForecastTimelineInput {
  forecast: AggregateSupplyForecast;
  timestamp: Date;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface SupplyShockTimelineInput {
  shock: SupplyShock;
  timestamp: Date;
  source?: string;
  metadata?: Record<string, unknown>;
}

function mapReadinessToSeverity(readiness: number): TimelineEventSeverity {
  if (readiness < 0.3) return TimelineEventSeverity.CRITICAL;
  if (readiness < 0.5) return TimelineEventSeverity.WARNING;
  if (readiness < 0.7) return TimelineEventSeverity.NOTICE;
  return TimelineEventSeverity.INFO;
}

function mapShockSeverityToTimelineSeverity(
  severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL'
): TimelineEventSeverity {
  switch (severity) {
    case 'CRITICAL':
      return TimelineEventSeverity.CRITICAL;
    case 'HIGH':
      return TimelineEventSeverity.WARNING;
    case 'MED':
      return TimelineEventSeverity.NOTICE;
    case 'LOW':
      return TimelineEventSeverity.INFO;
    default:
      return TimelineEventSeverity.NOTICE;
  }
}

function buildAuditHash(payload: SupplyForecastTimelineInput | SupplyShockTimelineInput): string {
  const key = 'forecast' in payload
    ? `forecast-${payload.forecast.orgId || payload.forecast.departmentId || payload.forecast.systemId}-${payload.timestamp.toISOString()}`
    : `shock-${payload.shock.id}-${payload.timestamp.toISOString()}`;

  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Record supply forecast timeline event
 */
export async function recordSupplyForecastTimelineEvent(
  input: SupplyForecastTimelineInput
): Promise<void> {
  const auditHash = buildAuditHash(input);
  const forecast = input.forecast;
  const severity = mapReadinessToSeverity(forecast.averageReadiness);

  // Build summary text
  const readinessPercent = Math.round(forecast.averageReadiness * 100);
  const summary = `Supply forecast: ${readinessPercent}% average readiness (${forecast.availableClinicians}/${forecast.totalClinicians} available, ${forecast.atRiskClinicians} at risk)`;

  // Create aggregate event for org/department/system
  const aggregateEvent = await prisma.credentialTimelineEvent.create({
    data: {
      clinicianId: forecast.orgId || forecast.departmentId || forecast.systemId || 'system',
      eventType: 'SUPPLY_FORECAST',
      severity,
      timestamp: input.timestamp,
      metadata: {
        orgId: forecast.orgId,
        departmentId: forecast.departmentId,
        systemId: forecast.systemId,
        timeWindowStart: forecast.timeWindowStart.toISOString(),
        timeWindowEnd: forecast.timeWindowEnd.toISOString(),
        totalClinicians: forecast.totalClinicians,
        availableClinicians: forecast.availableClinicians,
        atRiskClinicians: forecast.atRiskClinicians,
        averageReadiness: forecast.averageReadiness,
        predictedGaps: forecast.predictedGaps.map((gap) => ({
          startDate: gap.startDate.toISOString(),
          endDate: gap.endDate.toISOString(),
          reason: gap.reason,
          severity: gap.severity,
          affectedClinicians: gap.affectedClinicians,
        })),
        source: input.source ?? 'workforceForecast/supplyEngine',
        ...input.metadata,
      },
      auditHash,
    },
  });

  // Create individual events for each clinician forecast
  for (const clinicianForecast of forecast.clinicianForecasts) {
    const clinicianReadiness = clinicianForecast.prediction.supplyReadiness;
    const clinicianSeverity = mapReadinessToSeverity(clinicianReadiness);

    const clinicianSummary = `Supply readiness: ${Math.round(clinicianReadiness * 100)}%${clinicianForecast.prediction.predictedGaps.length > 0 ? ` (${clinicianForecast.prediction.predictedGaps.length} predicted gaps)` : ''}`;

    await prisma.credentialTimelineEvent.create({
      data: {
        clinicianId: clinicianForecast.clinicianId,
        eventType: 'SUPPLY_FORECAST',
        severity: clinicianSeverity,
        timestamp: input.timestamp,
        metadata: {
          timeWindowStart: clinicianForecast.prediction.timeWindowStart.toISOString(),
          timeWindowEnd: clinicianForecast.prediction.timeWindowEnd.toISOString(),
          supplyReadiness: clinicianReadiness,
          confidence: clinicianForecast.prediction.confidence,
          factors: {
            credentialCycles: clinicianForecast.prediction.factors.credentialCycles,
            safetyRisk: clinicianForecast.prediction.factors.safetyRisk,
            mobility: clinicianForecast.prediction.factors.mobility,
            enrollmentCycles: clinicianForecast.prediction.factors.enrollmentCycles,
          },
          predictedGaps: clinicianForecast.prediction.predictedGaps.map((gap) => ({
            startDate: gap.startDate.toISOString(),
            endDate: gap.endDate.toISOString(),
            reason: gap.reason,
            severity: gap.severity,
          })),
          aggregateEventId: aggregateEvent.id,
          source: input.source ?? 'workforceForecast/supplyEngine',
          ...input.metadata,
        },
        auditHash: crypto
          .createHash('sha256')
          .update(
            `supply-forecast-${clinicianForecast.clinicianId}-${input.timestamp.toISOString()}`
          )
          .digest('hex'),
      },
    });
  }
}

/**
 * Record supply shock timeline event
 */
export async function recordSupplyShockTimelineEvent(
  input: SupplyShockTimelineInput
): Promise<void> {
  const auditHash = buildAuditHash(input);
  const shock = input.shock;
  const severity = mapShockSeverityToTimelineSeverity(shock.severity);

  // Build summary text
  const summary = `Supply shock detected: ${shock.type} (${shock.severity}) - ${shock.affectedClinicians} clinicians affected`;

  // Create aggregate event for org/department/system
  const aggregateEvent = await prisma.credentialTimelineEvent.create({
    data: {
      clinicianId: shock.affectedOrgIds?.[0] || shock.affectedDepartmentIds?.[0] || 'system',
      eventType: 'SUPPLY_SHOCK',
      severity,
      timestamp: input.timestamp,
      metadata: {
        shockId: shock.id,
        shockType: shock.type,
        shockSeverity: shock.severity,
        affectedClinicians: shock.affectedClinicians,
        affectedOrgIds: shock.affectedOrgIds,
        affectedDepartmentIds: shock.affectedDepartmentIds,
        predictedStartDate: shock.predictedStartDate.toISOString(),
        predictedEndDate: shock.predictedEndDate.toISOString(),
        description: shock.description,
        factors: {
          baselineReadiness: shock.factors.baselineReadiness,
          shockReadiness: shock.factors.shockReadiness,
          readinessDrop: shock.factors.readinessDrop,
          gapCount: shock.factors.gapCount,
        },
        recommendations: shock.recommendations,
        source: input.source ?? 'workforceForecast/supplyShockDetector',
        ...input.metadata,
      },
      auditHash,
    },
  });

  // If we have specific affected clinicians, create individual events
  // Note: In practice, you'd need to map from org/department to clinician IDs
  // This is a placeholder for the structure
  if (shock.affectedClinicians > 0) {
    // Create a summary event that can be linked to individual clinician events
    // Individual events would be created when processing the forecast for each clinician
  }

  return;
}

/**
 * Record both forecast and shock events together
 */
export async function recordSupplyForecastWithShocks(
  forecast: AggregateSupplyForecast,
  shocks: SupplyShock[],
  timestamp: Date,
  source?: string
): Promise<void> {
  // Record forecast event
  await recordSupplyForecastTimelineEvent({
    forecast,
    timestamp,
    source,
  });

  // Record shock events
  for (const shock of shocks) {
    await recordSupplyShockTimelineEvent({
      shock,
      timestamp,
      source,
    });
  }
}

