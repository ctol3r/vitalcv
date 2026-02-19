/**
 * Expiration Forecast Engine — Wave Y
 *
 * Computes risk levels based on days until credential expiration.
 *
 * Rules:
 *   - daysUntilExpiration <= 30 → "high"
 *   - daysUntilExpiration <= 60 → "medium"
 *   - daysUntilExpiration > 60  → "low"
 *   - No expiration date        → null (no forecast)
 *
 * Deterministic. No randomness. No external SaaS.
 */

import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

// ── Types ───────────────────────────────────────────────────

export type ForecastRiskLevel = 'low' | 'medium' | 'high';

export type ExpirationForecast = {
  artifactId: string;
  daysUntilExpiration: number | null;
  forecastRiskLevel: ForecastRiskLevel | null;
};

export type OrganizationForecastSummary = {
  organizationId: string;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  totalForecasted: number;
};

// ── Constants ───────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;
const HIGH_RISK_THRESHOLD_DAYS = 30;
const MEDIUM_RISK_THRESHOLD_DAYS = 60;

// ── Core computation ────────────────────────────────────────

export function computeDaysUntilExpiration(expiresAt: Date | null, now: Date): number | null {
  if (!expiresAt) return null;
  return Math.floor((expiresAt.getTime() - now.getTime()) / MS_PER_DAY);
}

export function computeForecastRiskLevel(daysUntilExpiration: number | null): ForecastRiskLevel | null {
  if (daysUntilExpiration === null) return null;
  if (daysUntilExpiration <= HIGH_RISK_THRESHOLD_DAYS) return 'high';
  if (daysUntilExpiration <= MEDIUM_RISK_THRESHOLD_DAYS) return 'medium';
  return 'low';
}

export function computeExpirationForecast(
  artifactId: string,
  expiresAt: Date | null,
  now: Date,
): ExpirationForecast {
  const daysUntilExpiration = computeDaysUntilExpiration(expiresAt, now);
  const forecastRiskLevel = computeForecastRiskLevel(daysUntilExpiration);
  return { artifactId, daysUntilExpiration, forecastRiskLevel };
}

// ── Organization-level aggregation ──────────────────────────

export async function getOrganizationForecastSummary(
  organizationId: string,
): Promise<OrganizationForecastSummary> {
  const normalizedOrgId = organizationId.trim();
  if (!normalizedOrgId) {
    return {
      organizationId,
      highRiskCount: 0,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      totalForecasted: 0,
    };
  }

  const artifacts = await prisma.verificationArtifact.findMany({
    where: {
      organizationId: normalizedOrgId,
      lifecycleState: 'ACTIVE',
      expiresAt: { not: null },
    },
    select: {
      id: true,
      expiresAt: true,
    },
  });

  const now = new Date();
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;

  for (const artifact of artifacts) {
    const forecast = computeExpirationForecast(artifact.id, artifact.expiresAt, now);

    switch (forecast.forecastRiskLevel) {
      case 'high':
        highRiskCount++;
        break;
      case 'medium':
        mediumRiskCount++;
        break;
      case 'low':
        lowRiskCount++;
        break;
    }
  }

  const totalForecasted = highRiskCount + mediumRiskCount + lowRiskCount;

  log('info', 'expiration_forecast_summary_computed', {
    event: 'expiration_forecast_summary_computed',
    organizationId: normalizedOrgId,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    totalForecasted,
  });

  return {
    organizationId: normalizedOrgId,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    totalForecasted,
  };
}
