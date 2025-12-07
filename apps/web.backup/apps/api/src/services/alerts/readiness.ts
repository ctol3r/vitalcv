import { randomUUID } from 'crypto';
import type { DimensionSnapshot } from '../readiness/types';
import { translate } from '../../utils/i18n';

export type ReadinessAlertType = 'jump' | 'allClear';

export interface ReadinessAlert {
  id: string;
  clinicianId: string;
  recipientId: string;
  type: ReadinessAlertType;
  subject: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ReadinessAlertInput {
  clinicianId: string;
  previousScore?: number;
  currentScore: number;
  dimensions: DimensionSnapshot[];
  subscribers: string[];
  locale?: string;
}

const CRITICAL_DIMENSIONS: DimensionSnapshot['dimension'][] = [
  'PSD',
  'BOARD',
  'SANCTIONS',
  'NPDB',
];

export function evaluateReadinessAlerts(input: ReadinessAlertInput): ReadinessAlert[] {
  if (!input.subscribers.length) {
    return [];
  }

  const alerts: ReadinessAlert[] = [];
  const jumpAmount =
    typeof input.previousScore === 'number'
      ? input.currentScore - input.previousScore
      : 0;

  const locale = input.locale ?? 'en';
  const jumpTriggered = jumpAmount >= 0.15;
  const allClear = allCriticalDimensionsHealthy(input.dimensions);

  if (!jumpTriggered && !allClear) {
    return alerts;
  }

  for (const recipientId of input.subscribers) {
    if (jumpTriggered) {
      alerts.push(
        createAlert({
          clinicianId: input.clinicianId,
          recipientId,
          type: 'jump',
          subject: translate('alert.readiness_jump', locale),
          message: translate('alert.readiness_jump', locale),
          metadata: {
            previousScore: input.previousScore ?? null,
            currentScore: input.currentScore,
            jumpAmount,
          },
        }),
      );
    }

    if (allClear) {
      alerts.push(
        createAlert({
          clinicianId: input.clinicianId,
          recipientId,
          type: 'allClear',
          subject: translate('alert.critical_clear', locale),
          message: translate('alert.critical_clear', locale),
          metadata: {
            dimensions: input.dimensions
              .filter((dimension) => CRITICAL_DIMENSIONS.includes(dimension.dimension))
              .map((dimension) => ({
                dimension: dimension.dimension,
                score: dimension.score,
              })),
          },
        }),
      );
    }
  }

  return alerts;
}

function allCriticalDimensionsHealthy(dimensions: DimensionSnapshot[]): boolean {
  return dimensions
    .filter((dimension) => CRITICAL_DIMENSIONS.includes(dimension.dimension))
    .every((dimension) => dimension.score >= 0.85);
}

function createAlert(details: Omit<ReadinessAlert, 'id' | 'createdAt'>): ReadinessAlert {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...details,
  };
}

