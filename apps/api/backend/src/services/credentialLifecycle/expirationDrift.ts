/**
 * expirationDrift.ts — W2-PR44A
 *
 * Detects drift between the expiration we forecast and the expiration we
 * later observe (from issuer payload, manual update, primary-source pull).
 *
 * Drift is operator-visible by contract: the report's `operatorVisible`
 * field is the literal `true` so type-narrowing checks at consumers cannot
 * silently accept a "hidden" report.
 */

import type { ExpirationDriftReport } from './types';

const MS_PER_DAY = 86_400_000;

export function detectExpirationDrift(
  artifactId: string,
  forecastedExpiresAt: Date | string | null,
  observedExpiresAt: Date | string | null,
): ExpirationDriftReport {
  const forecastIso = toIsoOrNull(forecastedExpiresAt);
  const observedIso = toIsoOrNull(observedExpiresAt);

  if (forecastIso === null || observedIso === null) {
    return {
      artifactId,
      forecastedExpiresAt: forecastIso,
      observedExpiresAt: observedIso,
      driftDays: null,
      driftDirection: 'unknown',
      operatorVisible: true,
    };
  }

  const forecastMs = new Date(forecastIso).getTime();
  const observedMs = new Date(observedIso).getTime();
  const driftDays = Math.round((observedMs - forecastMs) / MS_PER_DAY);

  let direction: ExpirationDriftReport['driftDirection'];
  if (driftDays === 0) direction = 'on_time';
  else if (driftDays > 0) direction = 'later';
  else direction = 'earlier';

  return {
    artifactId,
    forecastedExpiresAt: forecastIso,
    observedExpiresAt: observedIso,
    driftDays,
    driftDirection: direction,
    operatorVisible: true,
  };
}

function toIsoOrNull(value: Date | string | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  // string — assume ISO; do not mutate
  return value;
}

/**
 * Aggregate drift reports for operator dashboards. Returns counts by
 * direction plus the maximum absolute drift seen.
 */
export interface DriftSummary {
  total: number;
  earlier: number;
  onTime: number;
  later: number;
  unknown: number;
  maxAbsoluteDriftDays: number;
}

export function summarizeDrift(reports: ReadonlyArray<ExpirationDriftReport>): DriftSummary {
  const summary: DriftSummary = {
    total: reports.length,
    earlier: 0,
    onTime: 0,
    later: 0,
    unknown: 0,
    maxAbsoluteDriftDays: 0,
  };
  for (const r of reports) {
    switch (r.driftDirection) {
      case 'earlier':
        summary.earlier += 1;
        break;
      case 'on_time':
        summary.onTime += 1;
        break;
      case 'later':
        summary.later += 1;
        break;
      case 'unknown':
        summary.unknown += 1;
        break;
    }
    if (r.driftDays !== null) {
      const abs = Math.abs(r.driftDays);
      if (abs > summary.maxAbsoluteDriftDays) summary.maxAbsoluteDriftDays = abs;
    }
  }
  return summary;
}
